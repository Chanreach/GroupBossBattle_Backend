import express from "express";
import eventBossController from "../controllers/event_boss.controller.js";

const router = express.Router();

router.get("/", eventBossController.getAllEventBosses);
router.get("/join/:joinCode", eventBossController.getEventBossByJoinCode);
router.get("/:id", eventBossController.getEventBossById);
router.post("/", eventBossController.createEventBoss);
router.put("/:id", eventBossController.updateEventBoss);
router.patch("/:id/status", eventBossController.updateEventBossStatus);
router.delete("/:id", eventBossController.deleteEventBoss);

export default router;
