import express from "express";
import LeaderboardService from "../services/leaderboard.service.js";

const router = express.Router();

/**
 * GET /api/leaderboards/all-time
 * Get all-time leaderboard across all events or for a specific boss
 */
router.get("/all-time", async (req, res) => {
  try {
    const { limit = 50, bossId } = req.query;
    
    let leaderboard;
    if (bossId && bossId !== 'default') {
      // Get all-time leaderboard for a specific boss
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
      bossId: bossId || 'all',
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

/**
 * GET /api/leaderboards/event/:eventId
 * Get leaderboard for a specific event
 */
router.get("/event/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { limit = 50 } = req.query;

    const leaderboard = await LeaderboardService.getEventLeaderboard(
      eventId,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: leaderboard,
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

/**
 * GET /api/leaderboards/user/:userId
 * Get stats for a specific user
 */
router.get("/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const userStats = await LeaderboardService.getUserStats(userId);

    res.json({
      success: true,
      data: userStats,
      userId,
    });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user stats",
      error: error.message,
    });
  }
});

/**
 * POST /api/leaderboards/update-battle
 * Update leaderboards after battle completion (internal use)
 */
router.post("/update-battle", async (req, res) => {
  try {
    const { eventId, eventBossId, playersData } = req.body;

    if (!eventId || !playersData || !Array.isArray(playersData)) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: eventId, playersData",
      });
    }

    const results = await LeaderboardService.updateBattleLeaderboards(
      eventId,
      eventBossId,
      playersData
    );

    res.json({
      success: true,
      message: "Leaderboards updated successfully",
      updatedCount: results.length,
    });
  } catch (error) {
    console.error("Error updating battle leaderboards:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update leaderboards",
      error: error.message,
    });
  }
});

export default router;
