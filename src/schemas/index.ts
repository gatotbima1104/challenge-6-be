import { z } from "zod";

export const ScheduleItemSchema = z.object({
  date: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  activity: z.string(),
  isDaily: z.boolean(),
  isWeekly: z.boolean(),
  isMonthly: z.boolean(),
});

export const ScheduleArraySchema = z.array(ScheduleItemSchema);
