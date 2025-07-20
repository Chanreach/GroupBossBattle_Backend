import { Leaderboard, User, EventBoss, Event, Boss } from "../models/index.js";
import { Op } from "sequelize";

class LeaderboardService {
  /**
   * Update player leaderboard after boss battle completion
   */
  static async updatePlayerLeaderboard(
    playerId,
    eventId,
    eventBossId,
    updateData
  ) {
    try {
      const [leaderboardEntry, created] = await Leaderboard.findOrCreate({
        where: {
          playerId: playerId,
          eventId: eventId,
          eventBossId: eventBossId,
          leaderboardType: "event_overall",
        },
        defaults: {
          totalDamageDealt: updateData.totalDamage || 0,
          totalCorrectAnswers: updateData.correctAnswers || 0,
        },
      });

      if (!created) {
        // Update existing entry by incrementing values
        await leaderboardEntry.update({
          totalDamageDealt:
            leaderboardEntry.totalDamageDealt + (updateData.totalDamage || 0),
          totalCorrectAnswers:
            leaderboardEntry.totalCorrectAnswers +
            (updateData.correctAnswers || 0),
        });
      }

      return leaderboardEntry;
    } catch (error) {
      console.error("Error updating player leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get event overall leaderboard - no limit, get all records
   */
  static async getEventOverallLeaderboard(eventId) {
    try {
      const leaderboard = await Leaderboard.findAll({
        where: {
          eventId: eventId,
          leaderboardType: "event_overall",
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["username", "profileImage"],
          },
        ],
        order: [
          ["total_damage_dealt", "DESC"],
          ["total_correct_answers", "DESC"],
        ],
        // No limit - get all records
      });

      return leaderboard.map((entry) => ({
        playerId: entry.playerId,
        playerName: entry.user ? entry.user.username : "Unknown Player",
        profilePicture: entry.user ? entry.user.profileImage : null,
        totalDamageDealt: entry.totalDamageDealt,
        totalCorrectAnswers: entry.totalCorrectAnswers,
        eventId: entry.eventId,
        eventBossId: entry.eventBossId,
      }));
    } catch (error) {
      console.error("Error fetching event overall leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get boss-specific leaderboard - no limit, get all records
   */
  static async getBossSpecificLeaderboard(eventId, eventBossId) {
    try {
      const leaderboard = await Leaderboard.findAll({
        where: {
          eventId: eventId,
          eventBossId: eventBossId,
          leaderboardType: "event_overall",
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["username", "profileImage"],
          },
        ],
        order: [
          ["total_damage_dealt", "DESC"],
          ["total_correct_answers", "DESC"],
        ],
        // No limit - get all records
      });

      return leaderboard.map((entry) => ({
        playerId: entry.playerId,
        playerName: entry.user ? entry.user.username : "Unknown Player",
        profilePicture: entry.user ? entry.user.profileImage : null,
        totalDamageDealt: entry.totalDamageDealt,
        totalCorrectAnswers: entry.totalCorrectAnswers,
        eventId: entry.eventId,
        eventBossId: entry.eventBossId,
      }));
    } catch (error) {
      console.error("Error fetching boss-specific leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get all-time leaderboard (across all events) - no limit, get all records
   */
  static async getAllTimeLeaderboard() {
    try {
      const leaderboard = await Leaderboard.findAll({
        where: {
          leaderboardType: "event_overall",
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["username", "profileImage"],
          },
        ],
        order: [
          ["total_damage_dealt", "DESC"],
          ["total_correct_answers", "DESC"],
        ],
        // No limit - get all records
      });

      return leaderboard.map((entry) => ({
        playerId: entry.playerId,
        playerName: entry.user ? entry.user.username : "Unknown Player",
        profilePicture: entry.user ? entry.user.profileImage : null,
        totalDamageDealt: entry.totalDamageDealt,
        totalCorrectAnswers: entry.totalCorrectAnswers,
        eventId: entry.eventId,
        eventBossId: entry.eventBossId,
      }));
    } catch (error) {
      console.error("Error fetching all-time leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get boss all-time leaderboard (specific boss across all events) - no limit
   */
  static async getBossAllTimeLeaderboard(bossId) {
    try {
      const leaderboard = await Leaderboard.findAll({
        where: {
          leaderboardType: "event_overall",
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["username", "profileImage"],
          },
          {
            model: EventBoss,
            as: "eventBoss",
            where: {
              bossId: bossId,
            },
            include: [
              {
                model: Boss,
                as: "boss",
                attributes: ["name"],
              },
            ],
          },
        ],
        order: [
          ["total_damage_dealt", "DESC"],
          ["total_correct_answers", "DESC"],
        ],
        // No limit - get all records
      });

      return leaderboard.map((entry) => ({
        playerId: entry.playerId,
        playerName: entry.user ? entry.user.username : "Unknown Player",
        profilePicture: entry.user ? entry.user.profileImage : null,
        totalDamageDealt: entry.totalDamageDealt,
        totalCorrectAnswers: entry.totalCorrectAnswers,
        bossName: entry.eventBoss?.boss?.name || "Unknown Boss",
      }));
    } catch (error) {
      console.error("Error fetching boss all-time leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get player's rank in event overall leaderboard
   */
  static async getPlayerEventRank(playerId, eventId) {
    try {
      const leaderboard = await this.getEventOverallLeaderboard(eventId);
      const playerIndex = leaderboard.findIndex(
        (entry) => entry.playerId === playerId
      );
      return playerIndex !== -1 ? playerIndex + 1 : null;
    } catch (error) {
      console.error("Error fetching player event rank:", error);
      throw error;
    }
  }
}

export default LeaderboardService;
