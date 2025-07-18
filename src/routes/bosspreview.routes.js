import express from "express";
import bossPreviewController from "../controllers/bosspreview.controller.js";

const router = express.Router();

// GET /api/boss-preview/debug - Debug endpoint to check data
router.get("/debug", bossPreviewController.debugData);

// GET /api/boss-preview/:eventId/:bossId - Get boss preview data
router.get("/:eventId/:bossId", bossPreviewController.getBossPreview);

// GET /api/boss-preview/:eventId/:bossId/leaderboard - Get leaderboard data
router.get("/:eventId/:bossId/leaderboard", bossPreviewController.getBossPreviewLeaderboard);

export default router;
