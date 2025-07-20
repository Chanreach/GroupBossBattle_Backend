import BadgeService from "../services/badge.service.js";

class BadgeController {
  // Get all available badges
  static async getAllBadges(req, res) {
    try {
      const badges = await BadgeService.getAllBadges();
      res.status(200).json({
        success: true,
        data: badges,
      });
    } catch (error) {
      console.error("Error in getAllBadges:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve badges",
        error: error.message,
      });
    }
  }

  // Get player badges for a specific event
  static async getPlayerBadges(req, res) {
    try {
      const { playerId, eventId } = req.params;

      if (!playerId || !eventId) {
        return res.status(400).json({
          success: false,
          message: "Player ID and Event ID are required",
        });
      }

      const badges = await BadgeService.getPlayerBadgesForEvent(
        playerId,
        eventId
      );

      res.status(200).json({
        success: true,
        data: badges,
      });
    } catch (error) {
      console.error("Error in getPlayerBadges:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve player badges",
        error: error.message,
      });
    }
  }

  // Award MVP badge manually (admin use)
  static async awardMVPBadge(req, res) {
    try {
      const { playerId, bossSessionId, totalDamage } = req.body;

      if (!playerId || !bossSessionId) {
        return res.status(400).json({
          success: false,
          message: "Player ID and Boss Session ID are required",
        });
      }

      const badge = await BadgeService.awardMVPBadge(
        playerId,
        bossSessionId,
        totalDamage
      );

      if (!badge) {
        return res.status(404).json({
          success: false,
          message: "MVP badge not found or could not be awarded",
        });
      }

      res.status(201).json({
        success: true,
        message: "MVP badge awarded successfully",
        data: badge,
      });
    } catch (error) {
      console.error("Error in awardMVPBadge:", error);
      res.status(500).json({
        success: false,
        message: "Failed to award MVP badge",
        error: error.message,
      });
    }
  }

  // Award Last Hit badge manually (admin use)
  static async awardLastHitBadge(req, res) {
    try {
      const { playerId, bossSessionId } = req.body;

      if (!playerId || !bossSessionId) {
        return res.status(400).json({
          success: false,
          message: "Player ID and Boss Session ID are required",
        });
      }

      const badge = await BadgeService.awardLastHitBadge(
        playerId,
        bossSessionId
      );

      if (!badge) {
        return res.status(404).json({
          success: false,
          message: "Last Hit badge not found or could not be awarded",
        });
      }

      res.status(201).json({
        success: true,
        message: "Last Hit badge awarded successfully",
        data: badge,
      });
    } catch (error) {
      console.error("Error in awardLastHitBadge:", error);
      res.status(500).json({
        success: false,
        message: "Failed to award Last Hit badge",
        error: error.message,
      });
    }
  }

  // Award Boss Defeated badges manually (admin use)
  static async awardBossDefeatedBadges(req, res) {
    try {
      const { playerIds, bossSessionId } = req.body;

      if (!playerIds || !Array.isArray(playerIds) || !bossSessionId) {
        return res.status(400).json({
          success: false,
          message: "Player IDs array and Boss Session ID are required",
        });
      }

      const badges = await BadgeService.awardBossDefeatedBadges(
        playerIds,
        bossSessionId
      );

      res.status(201).json({
        success: true,
        message: `Boss Defeated badges awarded to ${badges.length} players`,
        data: badges,
      });
    } catch (error) {
      console.error("Error in awardBossDefeatedBadges:", error);
      res.status(500).json({
        success: false,
        message: "Failed to award Boss Defeated badges",
        error: error.message,
      });
    }
  }

  // Award milestone badge manually (admin use)
  static async awardMilestoneBadge(req, res) {
    try {
      const { playerId, eventId, correctAnswerCount } = req.body;

      if (!playerId || !eventId || correctAnswerCount === undefined) {
        return res.status(400).json({
          success: false,
          message: "Player ID, Event ID, and correct answer count are required",
        });
      }

      const badges = await BadgeService.awardMilestoneBadge(
        playerId,
        eventId,
        correctAnswerCount
      );

      res.status(201).json({
        success: true,
        message: `${badges.length} milestone badge(s) awarded`,
        data: badges,
      });
    } catch (error) {
      console.error("Error in awardMilestoneBadge:", error);
      res.status(500).json({
        success: false,
        message: "Failed to award milestone badge",
        error: error.message,
      });
    }
  }

  // Get player event statistics
  static async getPlayerEventStats(req, res) {
    try {
      const { playerId, eventId } = req.params;

      if (!playerId || !eventId) {
        return res.status(400).json({
          success: false,
          message: "Player ID and Event ID are required",
        });
      }

      // Note: This would need access to bossSessionManager
      // For now, return basic structure
      const stats = {
        totalCorrectAnswers: 0,
        eventId: eventId,
        playerId: playerId,
      };

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Error in getPlayerEventStats:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve player statistics",
        error: error.message,
      });
    }
  }

  // Initialize default badges (admin use)
  static async initializeBadges(req, res) {
    try {
      await BadgeService.initializeDefaultBadges();

      res.status(200).json({
        success: true,
        message: "Default badges initialized successfully",
      });
    } catch (error) {
      console.error("Error in initializeBadges:", error);
      res.status(500).json({
        success: false,
        message: "Failed to initialize badges",
        error: error.message,
      });
    }
  }
}

export default BadgeController;
