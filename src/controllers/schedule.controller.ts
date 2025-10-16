import { Request, Response, NextFunction } from "express";
import { sumopodApiKey, sumopodApiUrl, CLOUDKIT_CONFIG } from "../config";
import OpenAI from "openai";
import { ScheduleArraySchema } from "../schemas/index";
import { v4 as uuidv4 } from 'uuid';
import axios from "axios";

export class ScheduleController {

    private client: OpenAI;

    constructor() {
        this.client = new OpenAI({
            apiKey: sumopodApiKey,
            baseURL: sumopodApiUrl
        })

        this.createSchedule = this.createSchedule.bind(this);
        this.updatedSchedule = this.updatedSchedule.bind(this);
        this.testServer = this.testServer.bind(this);
    }

    // Clean the response
    private cleanJsonString = (str: string): string => {
        let cleaned = str.trim();

        // Remove leading ```json or ``` 
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replace(/^```[a-z]*\n?/, "");
        }

        // Remove trailing ```
        if (cleaned.endsWith("```")) {
            cleaned = cleaned.replace(/```$/, "");
        }

        return cleaned.trim();
    }

    // Compare two activities ignoring the id field
    private isSameActivity = (a: any, b: any): boolean => {
        return (
            JSON.stringify({ ...a, id: undefined }) ===
            JSON.stringify({ ...b, id: undefined })
        );
    }


    async createSchedule(req: Request, res: Response, next: NextFunction) {
        try {

            const { activities } = req.body || {};
            // console.log(req.body);
            if (typeof activities === "undefined" || !Array.isArray(activities) || activities.length === 0) {
                return res.status(400).json({ message: "Activities are required." });
            }

            const todayISO = new Date().toISOString().slice(0, 10);     // YYYY-MM-DD
            const nowTime = new Date().toISOString().slice(11, 16);   

            const response = await this.client.chat.completions.create({
                model: "gpt-4.1-mini",
                messages: [
                    {
                        role: "user",
                        content : 
                        `
                            [DATA]
                            Kondisi waktu sekarang: tanggal ${todayISO}, jam ${nowTime}.  
                            Tentukan periode: pagi (07:00–11:59), siang (12:00–15:59), sore (16:00–18:59), malam (19:00–22:00).  
                            Jam bangun dan tidur orang pada umumnya: 07:00 - 22:00
                            Jam produktif: Ikut jam produktif umum orang pada umumnya (antara jam 09:00 - 17:00)
                            Daftar aktivitas:
                            ${activities.map((item: any) => `- ${item}`).join("\n")}

                            [NOTES]
                            - **WAJIB**: Setiap aktivitas di daftar harus muncul **tepat satu kali** di output. Tidak boleh ada yang hilang atau terduplikasi.  
                            - **WAJIB**: Waktu mulai ("start") tidak boleh lebih kecil dari jam sekarang (${nowTime}) pada hari ${todayISO}.  
                                • Jika aktivitas cocok pagi (misalnya Gym 07:00) tetapi sekarang sudah lewat (${nowTime}), geser ke slot berikutnya yang masih logis hari ini (contoh sore atau malam).  
                                • Jika semua slot logis hari ini sudah lewat, pindahkan aktivitas ke hari berikutnya (${todayISO}+1) pada jam yang sesuai (contoh Gym = pagi besok).  
                                • Selalu pastikan "end" > "start". 
                             - Nama aktivitas harus **disederhanakan**:
                                • Ambil inti penting saja, jangan pakai kata tambahan.  
                                • Contoh: "at dinner time" → "Dinner", "do some workout in the morning" → "Workout".  
                                • Hilangkan kata hubung, preposisi, dan keterangan waktu (at, in, on, time, etc).  
                                • Gunakan bentuk kata benda/singkatan yang umum dipakai di jadwal.  
                            - Kelompokkan aktivitas luar rumah agar efisien (misalnya belanja + laundry + ke rumah teman, etc).
                            - Tidak boleh ada aktivitas yang muncul lebih dari sekali dalam array output
                            - Jangan terikat waktu perjam pada setiap aktivitas, gunakan rentang waktu yang masuk akal.
                            - Pastikan penjadwalan berdasarkan energi orang pada umumnya (misalnya aktivitas berat di jam produktif, olahraga di pagi atau sore hari, etc)
                            - Output harus berupa JSON array dan **WAJIB** format tanpa ada teks lain di luar array:
                               [
                                   { 
                                     "date": ["YYYY-MM-DD"],   // selalu array of string, meski hanya 1 tanggal
                                     "start": "HH:mm", 
                                     "end": "HH:mm", // Make sure end is after start
                                     "activity": "...",
                                     "isDaily": true/false, 
                                     "isWeekly": true/false, 
                                     "isMonthly": true/false,
                                     "reminder": "quarter"
                                   }
                               ].
                            - **WAJIB** Jika ada aktivitas yang punya title sama, cukup satu objek saja, masukkan semua tanggal dalam array [date].

                            [INSTRUKSI]
                            1. Setiap aktivitas di daftar harus dijadwalkan tepat satu kali pada tanggal yang sesuai.
                                • Default = tanggal hari ini (todayISO).
                                • Jika ada kata "besok"/"tomorrow"/"mañana"/"demain"/dst → date = hari ini + 1.
                                • Jika ada kata "lusa"/"day after tomorrow"/"après-demain"/dst → date = hari ini + 2.
                                • Jika ada tanggal eksplisit (mis. "tanggal 13 september", "13/09", "2025-09-13") → gunakan tanggal itu (format ke ISO YYYY-MM-DD).
                                • Jika ada nama hari (Senin, Monday, Lunes, Lundi, Montag, dll) → **hitung kemunculan berikutnya dari hari itu, dimulai dari todayISO.**
                            2. Gunakan field "isDaily", "isWeekly", "isMonthly" hanya sebagai penanda pola:
                                • "setiap hari" → jadwalkan sekali di hari ini, beri "isDaily": true.  
                                • "setiap minggu" → jadwalkan sekali di hari ini juga, beri "isWeekly": true.  
                                • "setiap bulan" → jadwalkan sekali di hari ini juga, beri "isMonthly": true.  
                                • Gunakan "isDaily": true hanya jika teks aktivitas eksplisit mengandung kata "setiap hari" / "every day" / "quotidien" / dst.
                                • Gunakan "isWeekly": true hanya jika teks aktivitas eksplisit mengandung kata "setiap minggu" / "weekly" / "hebdomadaire" / dst.
                                • Gunakan "isMonthly": true hanya jika teks aktivitas eksplisit mengandung kata "setiap bulan" / "monthly" / "mensuel" / dst.
                                • Jika hanya ada nama hari (mis. "di hari Jumat", "on Friday"), itu **bukan pola berulang**, hanya gunakan tanggal berikutnya sesuai hari itu, dan set isDaily/isWeekly/isMonthly ke false.
                            3. Pastikan jadwal berada di antara jam bangun hingga tidur.
                            4. Aktivitas produktif harus ditempatkan dalam rentang jam produktif bila memungkinkan.
                            5. Jangan isi gap/jeda kosong, langsung lompat ke aktivitas berikutnya.
                            6. Field "date" wajib menggunakan tanggal hari ini dalam format ISO berdasarkan timezonenya {YYYY-MM-DD → inject dari host code, misalnya pakai \`${new Date().toISOString().slice(0,10)}.
                            7. Jika aktivitas tidak punya jam eksplisit, gunakan aturan default:  
                                • Aktivitas produktif → taruh di jam produktif.  
                                • Aktivitas santai/rekreasi/outdoor (mis. olahraga, memancing, main bola) → taruh di jam yang cocok dengan aktivitas itu, **jangan taruh malam dekat jam tidur**.  
                                • Jika durasi tidak disebutkan → gunakan default 1–2 jam.  
                        `
                    }
                ]
            })

            const raw = response.choices[0]?.message.content || "{}";
            let parsed;

            try {

                const cleaned = this.cleanJsonString(raw)
                const rawResponse = JSON.parse(cleaned)
                const validate = ScheduleArraySchema.parse(rawResponse);
                parsed = validate.map( item => ({
                    id: uuidv4(),
                    ...item,
                    description: "",
                    reminder: "quarter",
                    isCurrent: false
                }))
            } catch (e) {
                console.error("Invalid schedule format:", e);
                return res.status(500).json({ message: "Invalid response format", raw });
            }

            return res.status(200).json({
                message: "Success",
                data: parsed
            })
            
        } catch (error) {
            next(error);   
        }
    }

    async updatedSchedule(req: Request, res: Response, next: NextFunction) {
        try {

            const { oldSchedule, newSchedule } = req.body || {};
            if (Object.keys(oldSchedule).length === 0 && Object.keys(newSchedule).length === 0) {
                return res.status(400).json({ message: "Request body is empty." });
            }

            const response = await this.client.chat.completions.create({
                model: "gpt-4.1-mini",
                messages: [
                    {
                        role: "user",
                        content: `
                            Ini adalah jadwal lama (oldSchedule):
                            ${JSON.stringify(oldSchedule, null, 2)}

                            Lakukan update berdasarkan instruksi berikut (newSchedule):
                            ${JSON.stringify(newSchedule, null, 2)}

                            Aturan penting:
                            - Keluarkan **semua aktivitas** dari jadwal lama, tetapi dengan perubahan dari newSchedule sudah diterapkan.
                            - Jika aktivitas dihapus, jangan masukkan ke hasil.
                            - Jika aktivitas diubah, pastikan field lain tetap sama kecuali yang dimodifikasi.
                            - Format tanggal selalu: "YYYY-MM-DD".
                            - Format waktu selalu: "HH:mm" (24 jam).
                            - Output harus berupa JSON array dan **WAJIB** format tanpa ada teks lain di luar array:
                            [
                                { 
                                    "id": "SAME_AS_OLD",
                                    "date": ["YYYY-MM-DD"],   // selalu array of string, meski hanya 1 tanggal
                                    "start": "HH:mm", 
                                    "end": "HH:mm", // Make sure end is after start
                                    "activity": "...",
                                    "isDaily": true/false, 
                                    "isWeekly": true/false, 
                                    "isMonthly": true/false,
                                    "reminder": "quarter"
                                }
                            ].
                        `
                    }
                ]
            })

            const raw = response.choices[0]?.message.content || "{}";
            let parsed;

            try {
                const cleaned = this.cleanJsonString(raw)
                const rawResponse = JSON.parse(cleaned)
                const validate = ScheduleArraySchema.parse(rawResponse);
                parsed = validate.map((item) => {
                    const match = oldSchedule.find((old: any) =>
                    this.isSameActivity(old, item)
                    );

                    return {
                    ...item,
                    // id,
                    description: match ? match.description : "",
                    reminder: match ? match.reminder : "quarter",
                    isCurrent: false
                    };
                });
            } catch (e) {
                console.error("Invalid schedule format:", e);
                return res.status(500).json({ message: "Invalid response format", raw });
            }

            return res.status(200).json({
                message: "Success",
                data: parsed
            })
            
        } catch (error) {
            next(error);
        }
    }

    

    async testServer(req: Request, res: Response, next: NextFunction) {
        return res.status(200).json({
            message: "Success",
            data: "works"
        })
    }

    async voteServer(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, times } = req.body;
      console.log(req.body);

      if (!name || !Array.isArray(times)) {
        return res.status(400).json({ message: "Invalid request body" });
      }

      const record = {
        operationType: "create",
        recordType: "Vote",
        fields: {
          name: { value: name },
          times: { value: times },
          isVoted: { value: false },
          createdAt: { value: new Date().toISOString() },
          updatedAt: { value: new Date().toISOString() },
        },
      };

      const response = await axios.post(
        `https://api.apple-cloudkit.com/database/1/${CLOUDKIT_CONFIG.container}/${CLOUDKIT_CONFIG.environment}/public/records/modify`,
        { operations: [record] },
        {
          headers: {
            "Content-Type": "application/json",
            "X-Apple-CloudKit-Request-KeyID": CLOUDKIT_CONFIG.apiToken,
          },
        }
      );

      return res.status(200).json({
        message: "Vote saved to CloudKit",
        data: response.data,
      });
    } catch (error: any) {
      console.error("CloudKit Error:", error.response?.data || error.message);
      return res.status(500).json({
        message: "Failed to save vote",
        error: error.response?.data || error.message,
      });
    }
  }
    
}

