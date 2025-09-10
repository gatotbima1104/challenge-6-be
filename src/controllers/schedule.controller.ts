import { Request, Response, NextFunction } from "express";
import { sumopodApiKey, sumopodApiUrl } from "../config";
import OpenAI from "openai";

export class ScheduleController {

    async createSchedule(req: Request, res: Response, next: NextFunction) {
        try {

            const { sleepTime, wakeupTime, productivityTime, activities } = req.body || {};
            // console.log(req.body);
            if (typeof sleepTime !== "string" || sleepTime.trim() === "" ||
                typeof wakeupTime !== "string" || wakeupTime.trim() === "" ||
                typeof productivityTime !== "string" || productivityTime.trim() === "") {
                return res.status(400).json({ message: "Please enter the sleep time, wakeup time, and productivity time." });
            }

            const client = new OpenAI({
                apiKey: sumopodApiKey,
                baseURL: sumopodApiUrl
            })

            const response = await client.chat.completions.create({
                model: "gpt-4.1-mini",
                messages: [
                    {
                        role: "user",
                        content : 
                        `
                            [DATA]
                            Jam tidur: ${sleepTime}
                            Jam bangun: ${wakeupTime}
                            Jam produktif: ${productivityTime}
                            Daftar aktivitas:
                            ${activities.map((item: any) => `- ${item}`).join("\n")}

                            [INSTRUKSI]
                            1. Setiap aktivitas di daftar harus dijadwalkan tepat satu kali pada tanggal yang sesuai.
                                • Default = tanggal hari ini (todayISO).
                                • Jika ada kata "besok"/"tomorrow"/"mañana"/"demain"/dst → date = hari ini + 1.
                                • Jika ada kata "lusa"/"day after tomorrow"/"après-demain"/dst → date = hari ini + 2.
                                • Jika ada tanggal eksplisit (mis. "tanggal 13 september", "13/09", "2025-09-13") → gunakan tanggal itu (format ke ISO YYYY-MM-DD).
                                • Jika ada nama hari (Senin, Monday, Lunes, Lundi, Montag, dll) → gunakan kemunculan berikutnya dari hari itu.
                            2. Gunakan field "isDaily", "isWeekly", "isMonthly" hanya sebagai penanda pola, bukan menentukan tanggal:
                                • "setiap hari" → jadwalkan sekali di hari ini, beri "isDaily": true.  
                                • "setiap minggu" → jadwalkan sekali di hari ini juga, beri "isWeekly": true.  
                                • "setiap bulan" → jadwalkan sekali di hari ini juga, beri "isMonthly": true.  
                            3. Tidak boleh ada aktivitas yang muncul lebih dari sekali dalam array output.
                            4. Pastikan jadwal berada di antara jam bangun hingga tidur.
                            5. Kelompokkan aktivitas luar rumah agar efisien (misalnya belanja + laundry + ke rumah teman).
                            6. Aktivitas produktif harus ditempatkan dalam rentang jam produktif bila memungkinkan.
                            7. Jangan isi gap/jeda kosong, langsung lompat ke aktivitas berikutnya.
                            8. Field "date" wajib menggunakan tanggal hari ini dalam format ISO berdasarkan timezonenya {YYYY-MM-DD → inject dari host code, misalnya pakai \`${new Date().toISOString().slice(0,10)}.
                            9. Output harus berupa JSON array dengan format tanpa ada teks lain di luar array:
                            [
                                { "date": "YYYY-MM-DD", "start": "HH:mm", "end": "HH:mm", "activity": "...", "isDaily": true/false, "isWeekly": true/false, "isMonthly": true/false }
                            ].
                        `
                    }
                ]
            })

            const raw = response.choices[0]?.message.content || "{}";
            let parsed: any;

            try {
                parsed = JSON.parse(raw);
            } catch {
                parsed = { schedule: raw };
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
    
}