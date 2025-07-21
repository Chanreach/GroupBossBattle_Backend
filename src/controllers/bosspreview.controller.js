import EventBoss from "../models/event_boss.model.js";
import Boss from "../models/boss.model.js";
import Event from "../models/event.model.js";
import bossSessionManager from "../socket/managers/boss-session.manager.js";

/**
 * Debug endpoint to check what data exists
 */
const debugData = async (req, res) => {
  try {
    console.log("Debug: Checking EventBoss data...");

    // Get all EventBosses
    const eventBosses = await EventBoss.findAll({
      include: [
        {
          model: Boss,
          as: "boss",
          attributes: ["id", "name", "description", "image"],
        },
        {
          model: Event,
          as: "event",
          attributes: ["id", "name", "status"],
        },
      ],
      limit: 5,
    });

    console.log(`Found ${eventBosses.length} EventBosses`);

    res.status(200).json({
      success: true,
      data: {
        count: eventBosses.length,
        eventBosses: eventBosses.map((eb) => ({
          id: eb.id,
          eventId: eb.eventId,
          bossId: eb.bossId,
          joinCode: eb.joinCode,
          boss: eb.boss ? eb.boss.name : "No boss data",
          event: eb.event ? eb.event.name : "No event data",
        })),
      },
    });
  } catch (error) {
    console.error("Debug error:", error);
    res.status(500).json({
      message: "Debug error",
      error: error.message,
    });
  }
};

/**
 * Get boss preview data by boss ID and event ID
 */
const getBossPreview = async (req, res) => {
  try {
    const { bossId, eventId } = req.params;
    console.log("Getting boss preview for:", { bossId, eventId });

    if (!bossId || !eventId) {
      return res.status(400).json({
        message: "Boss ID and Event ID are required",
      });
    }

    // Find event boss with boss and event details
    console.log("Searching for EventBoss with:", { bossId, eventId });
    const eventBoss = await EventBoss.findOne({
      where: {
        bossId,
        eventId,
      },
      include: [
        {
          model: Boss,
          as: "boss",
          attributes: [
            "id",
            "name",
            "description",
            "image",
            "cooldownDuration",
            "numberOfTeams",
          ],
        },
        {
          model: Event,
          as: "event",
          attributes: ["id", "name", "description", "status"],
        },
      ],
    });

    console.log("EventBoss query result:", eventBoss ? "Found" : "Not found");
    if (eventBoss) {
      console.log("Event status:", eventBoss.event?.status);
      console.log("EventBoss status:", eventBoss.status);
    }

    if (!eventBoss) {
      return res.status(404).json({
        message: "Boss not found for this event",
      });
    }

    // Check if event is active (temporarily remove this check for debugging)
    // if (eventBoss.event.status !== "active") {
    //   return res.status(400).json({
    //     message: "Event is not currently active",
    //   });
    // }

    // For now, allow any event status for testing
    console.log("Allowing event with status:", eventBoss.event?.status);

    // Format response
    const response = {
      success: true,
      data: {
        eventBoss: {
          id: eventBoss.id,
          joinCode: eventBoss.joinCode,
          status: eventBoss.status,
          cooldownDuration: eventBoss.cooldownDuration,
          numberOfTeams: eventBoss.numberOfTeams,
        },
        boss: eventBoss.boss,
        event: eventBoss.event,
        cooldown: {
          isOnCooldown: eventBoss.status === "cooldown",
          // Add cooldown end time calculation here if needed
        },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error getting boss preview:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    res.status(500).json({
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get leaderboard data for boss preview
 */
const getBossPreviewLeaderboard = async (req, res) => {
  try {
    const { bossId, eventId } = req.params;

    if (!bossId || !eventId) {
      return res.status(400).json({
        message: "Boss ID and Event ID are required",
      });
    }

    console.log(
      `🏆 Getting leaderboard data for eventBoss: ${eventId}, boss: ${bossId}`
    );

    // First, try to find the EventBoss by eventId and bossId
    const eventBoss = await EventBoss.findOne({
      where: {
        eventId: eventId,
        bossId: bossId,
      },
      include: [
        {
          model: Boss,
          as: "boss",
          attributes: ["id", "name", "description", "image"],
        },
        {
          model: Event,
          as: "event",
          attributes: ["id", "name", "status"],
        },
      ],
    });

    if (!eventBoss) {
      return res.status(404).json({
        message: "Event Boss not found",
      });
    }

    // Get comprehensive leaderboard data from session manager
    const leaderboardData =
      await bossSessionManager.getComprehensiveLeaderboardData(eventBoss.id);

    // Format the response to match frontend expectations
    const formattedResponse = {
      teamLeaderboard: leaderboardData.teamLeaderboard.map((team) => ({
        rank: team.rank,
        team: team.teamName,
        dmg: team.totalDamage,
        correct: team.totalCorrectAnswers,
        avatar: "/src/assets/Placeholder/Profile1.jpg",
        playerCount: team.playerCount,
      })),
      individualLeaderboard: leaderboardData.individualLeaderboard.map(
        (player) => ({
          rank: player.rank,
          player: player.playerName,
          team: player.teamName,
          dmg: player.totalDamage,
          correct: player.correctAnswers,
          avatar: player.avatar,
        })
      ),
      allTimeLeaderboard: leaderboardData.allTimeLeaderboard.map((player) => ({
        rank: player.rank,
        player: player.playerName,
        dmg: player.totalDamage,
        correct: player.correctAnswers,
        avatar: player.avatar,
      })),
      sessionInfo: leaderboardData.bossInfo || {
        eventBossId: eventBoss.id,
        bossName: eventBoss.boss?.name || "Unknown Boss",
        sessionActive: leaderboardData.sessionActive,
      },
    };

    console.log(`🏆 Leaderboard data prepared:`, {
      teams: formattedResponse.teamLeaderboard.length,
      players: formattedResponse.individualLeaderboard.length,
      allTime: formattedResponse.allTimeLeaderboard.length,
      sessionActive: leaderboardData.sessionActive,
    });

    res.status(200).json({
      success: true,
      data: formattedResponse,
    });
  } catch (error) {
    console.error("Error getting boss preview leaderboard:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

export default {
  debugData,
  getBossPreview,
  getBossPreviewLeaderboard,
};
