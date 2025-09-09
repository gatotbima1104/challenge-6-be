import { Router } from "express";
import { ScheduleController } from "../controllers/schedule.controller";

export const scheduleRouter = () => {
  const router = Router();
  const scheduleController = new ScheduleController();

  router.post("/schedule", scheduleController.createSchedule);

  return router;
};
