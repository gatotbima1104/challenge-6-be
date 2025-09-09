import { Request, Response, NextFunction } from "express";
import { sumopodApiKey, sumopodApiUrl } from "../config";
import path from "path";
import OpenAI from "openai";

export class ScheduleController {

    async createSchedule(req: Request, res: Response, next: NextFunction) {
        try {

            const { content } = req.body || {};
            if (typeof content !== "string" || content.trim() === "") {
                return res.status(400).json({ message: "Content is required and must be a non-empty string." });
            }

            const client = new OpenAI({
                apiKey: sumopodApiKey,
                baseURL: sumopodApiUrl
            })

            const response = await client.chat.completions.create({
                model: "gpt-5-mini",
                messages: [
                    {
                        role: "user",
                        content
                    }
                ]
            })

            const data = response.choices[0]?.message.content;
            return res.status(200).json({
                message: "Success",
                data
            })
            
        } catch (error) {
            next(error);   
        }
    }
    
}