import { Router } from "express";
import { ScheduleController } from "../controllers/schedule.controller";

export const scheduleRouter = () => {
  const router = Router();
  const scheduleController = new ScheduleController();

  router.post("/schedule", scheduleController.createSchedule);
  router.post("/update", scheduleController.updatedSchedule);
  router.get("/test", scheduleController.testServer);

  return router;
};
