import express from "express";
import leaderboardController from "../controllers/leaderboard.controller.js";
import LeaderboardService from "../services/leaderboard.service.js";

const router = express.Router();

router.get("/", leaderboardController.getAllEventAllTimeLeaderboards);

router.get("/all-time", async (req, res) => {
  try {
    const { limit = 50, bossId, eventBossId } = req.query;

    let leaderboard;
    if (eventBossId && eventBossId !== "default") {
      // Get all-time leaderboard for a specific event boss
      leaderboard = await LeaderboardService.getEventBossAllTimeLeaderboard(
        eventBossId,
        parseInt(limit)
      );
    } else if (bossId && bossId !== "default") {
      // Get all-time leaderboard for a specific boss (across all events)
      leaderboard = await LeaderboardService.getBossAllTimeLeaderboard(
        bossId,
        parseInt(limit)
      );
    } else {
      // Get overall all-time leaderboard
      leaderboard = await LeaderboardService.getAllTimeLeaderboard(
        parseInt(limit)
      );
    }

    res.json({
      success: true,
      leaderboard: leaderboard, // Changed from data to leaderboard to match frontend
      total: leaderboard.length,
      bossId: bossId || "all",
      eventBossId: eventBossId || null,
    });
  } catch (error) {
    console.error("Error fetching all-time leaderboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch all-time leaderboard",
      error: error.message,
    });
  }
});

router.get("/event/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { limit = 50 } = req.query;

    const leaderboard = await LeaderboardService.getEventOverallLeaderboard(
      eventId,
      parseInt(limit)
    );

    res.json({
      success: true,
      leaderboard: leaderboard,
      total: leaderboard.length,
      eventId,
    });
  } catch (error) {
    console.error("Error fetching event leaderboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch event leaderboard",
      error: error.message,
    });
  }
});

router.get("/boss/:eventId/:eventBossId", async (req, res) => {
  try {
    const { eventId, eventBossId } = req.params;
    const { limit = 50 } = req.query;

    const leaderboard = await LeaderboardService.getBossSpecificLeaderboard(
      eventId,
      eventBossId,
      parseInt(limit)
    );

    res.json({
      success: true,
      leaderboard: leaderboard,
      total: leaderboard.length,
      eventId,
      eventBossId,
    });
  } catch (error) {
    console.error("Error fetching boss-specific leaderboard:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch boss-specific leaderboard",
      error: error.message,
    });
  }
});

router.get("/player/:playerId", async (req, res) => {
  try {
    const { playerId } = req.params;

    const playerStats = await LeaderboardService.getPlayerStats(playerId);

    res.json({
      success: true,
      data: playerStats,
      playerId,
    });
  } catch (error) {
    console.error("Error fetching player stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch player stats",
      error: error.message,
    });
  }
});

export default router;
