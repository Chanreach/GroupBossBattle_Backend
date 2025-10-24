import express from "express";
import eventBossController from "../controllers/event-boss.controller.js";

const router = express.Router();

router.get("/", eventBossController.getAllEventBosses);
router.get("/:id", eventBossController.getEventBossById);
router.get("/:id/:joinCode", eventBossController.getEventBossByIdAndJoinCode);
router.post("/", eventBossController.createEventBoss);
router.put("/:id", eventBossController.updateEventBoss);
router.delete("/:id", eventBossController.deleteEventBoss);

export default router;
