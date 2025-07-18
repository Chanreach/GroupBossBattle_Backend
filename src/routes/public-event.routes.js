import express from "express";
import eventController from "../controllers/event.controller.js";

const router = express.Router();

// Public routes - no authentication required
router.get("/", eventController.getPublicEvents);
router.get("/:id", eventController.getPublicEventById);

export default router;
