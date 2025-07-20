import express from "express";
import BadgeController from "../controllers/badge.controller.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

/**
 * Badge Routes
 *
 * Handles all badge-related API endpoints including
 * badge retrieval, awarding, and player statistics
 */

// Get all available badges
router.get("/", BadgeController.getAllBadges);

// Get player badges for a specific event
router.get("/player/:playerId/event/:eventId", BadgeController.getPlayerBadges);

// Get player event statistics
router.get(
  "/stats/:playerId/event/:eventId",
  BadgeController.getPlayerEventStats
);

// Protected routes (require authentication)
// Award MVP badge (admin use)
router.post("/award/mvp", authenticateToken, BadgeController.awardMVPBadge);

// Award Last Hit badge (admin use)
router.post(
  "/award/lasthit",
  authenticateToken,
  BadgeController.awardLastHitBadge
);

// Award Boss Defeated badges (admin use)
router.post(
  "/award/boss-defeated",
  authenticateToken,
  BadgeController.awardBossDefeatedBadges
);

// Award milestone badge (admin use)
router.post(
  "/award/milestone",
  authenticateToken,
  BadgeController.awardMilestoneBadge
);

// Initialize default badges (admin use)
router.post("/initialize", authenticateToken, BadgeController.initializeBadges);

export default router;
