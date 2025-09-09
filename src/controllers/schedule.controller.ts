import { Request, Response, NextFunction } from "express";
import { sumopodApiKey, sumopodApiUrl } from "../config";
import OpenAI from "openai";

export class ScheduleController {

    async createSchedule(req: Request, res: Response, next: NextFunction) {
        try {

            const { sleepTime, wakeupTime, productivityTime, activities } = req.body || {};
            console.log(req.body);
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
                            Daftar aktivitas: ${activities.map((item: any) => `- ${item}`).join("\n")}

                            [INSTRUKSI]
                            1. Pastikan mengikuti Data jam tidur dan bangun serta produktifitas.
                            2. Susun jadwal realistis berdasarkan kebiasaan umum, dengan mengelompokkan aktivitas luar rumah.
                            3. Jangan tambahkan aktivitas yang tidak ada di daftar.
                            4. Jangan tuliskan jeda/gap kosong, cukup lompat jamnya.
                            5. Kalau jadwalnya tidak ada informasi tanggal berakhir, artinya itu akan menjadi aktivitas pada hari ini.
                            6. Balikan hasil dalam JSON array dengan format:
                            [
                                { "start": "HH:mm", "end": "HH:mm", "activity": "..." }
                            ]
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