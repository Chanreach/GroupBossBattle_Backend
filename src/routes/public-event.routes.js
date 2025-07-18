import express from "express";
import eventController from "../controllers/event.controller.js";

const router = express.Router();

// Public route - no authentication required
router.get("/", eventController.getPublicEvents);

export default router;
