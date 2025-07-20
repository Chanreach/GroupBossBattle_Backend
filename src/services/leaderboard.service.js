import { Leaderboard, User, EventBoss, Event } from "../models/index.js";
import { Op } from "sequelize";

class LeaderboardService {
  /**
   * Update player leaderboard after boss battle completion
   */
  static async updatePlayerLeaderboard(
    userId,
    eventId,
    eventBossId,
    battleStats
  ) {
    try {
      const { totalDamage, correctAnswers, totalQuestions } = battleStats;

      // Find or create leaderboard entry
      const [leaderboard, created] = await Leaderboard.findOrCreate({
        where: { userId, eventId },
        defaults: {
          eventBossId,
          totalDamageDealt: totalDamage || 0,
          totalCorrectAnswers: correctAnswers || 0,
          sessionsPlayed: 1,
        },
      });

      // If entry exists, update it
      if (!created) {
        await leaderboard.update({
          totalDamageDealt: leaderboard.totalDamageDealt + (totalDamage || 0),
          totalCorrectAnswers:
            leaderboard.totalCorrectAnswers + (correctAnswers || 0),
          sessionsPlayed: leaderboard.sessionsPlayed + 1,
          eventBossId, // Update to latest boss fought
        });
      }

      return leaderboard;
    } catch (error) {
      console.error("Error updating player leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get all-time leaderboard (across all events)
   */
  static async getAllTimeLeaderboard(limit = 50) {
    try {
      const leaderboard = await Leaderboard.findAll({
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "profileImage"],
          },
        ],
        attributes: [
          "userId",
          "totalDamageDealt",
          "totalCorrectAnswers",
          "sessionsPlayed",
        ],
        group: ["user_id", "user.id"],
        order: [
          ["totalDamageDealt", "DESC"],
          ["totalCorrectAnswers", "DESC"],
        ],
        limit,
      });

      // Calculate additional stats
      return leaderboard.map((entry, index) => ({
        rank: index + 1,
        userId: entry.userId,
        nickname: entry.user?.username || "Unknown",
        username: entry.user?.username || "Unknown",
        profileImage: entry.user?.profileImage,
        totalDamage: entry.totalDamageDealt,
        totalCorrectAnswers: entry.totalCorrectAnswers,
        sessionsPlayed: entry.sessionsPlayed,
        accuracy: entry.sessionsPlayed > 0
          ? Math.round((entry.totalCorrectAnswers / entry.sessionsPlayed) * 100)
          : 0,
        avgDamagePerSession:
          entry.sessionsPlayed > 0
            ? Math.round(entry.totalDamageDealt / entry.sessionsPlayed)
            : 0,
      }));
    } catch (error) {
      console.error("Error fetching all-time leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get all-time leaderboard for a specific boss
   */
  static async getBossAllTimeLeaderboard(bossId, limit = 50) {
    try {
      // First, get all EventBoss entries for this boss
      const eventBosses = await EventBoss.findAll({
        where: { bossId },
        attributes: ['id', 'eventId'],
      });

      if (eventBosses.length === 0) {
        return []; // No battles for this boss yet
      }

      const eventBossIds = eventBosses.map(eb => eb.id);

      // Get leaderboard entries for this boss across all events
      const leaderboard = await Leaderboard.findAll({
        where: { 
          eventBossId: { [Op.in]: eventBossIds }
        },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "profileImage"],
          },
        ],
        group: ["user_id", "user.id"],
        order: [
          ["totalDamageDealt", "DESC"],
          ["totalCorrectAnswers", "DESC"],
        ],
        limit,
      });

      // Calculate additional stats with accuracy-based ranking
      const leaderboardWithStats = leaderboard.map((entry) => ({
        userId: entry.userId,
        nickname: entry.user?.username || "Unknown",
        username: entry.user?.username || "Unknown", 
        profileImage: entry.user?.profileImage,
        totalDamage: entry.totalDamageDealt,
        totalCorrectAnswers: entry.totalCorrectAnswers,
        sessionsPlayed: entry.sessionsPlayed,
        accuracy: entry.sessionsPlayed > 0
          ? Math.round((entry.totalCorrectAnswers / entry.sessionsPlayed) * 100)
          : 0,
        avgDamagePerSession:
          entry.sessionsPlayed > 0
            ? Math.round(entry.totalDamageDealt / entry.sessionsPlayed)
            : 0,
      }));

      // Sort by combined score: primarily by total damage, then by accuracy
      leaderboardWithStats.sort((a, b) => {
        // Primary: Total damage (descending)
        if (b.totalDamage !== a.totalDamage) {
          return b.totalDamage - a.totalDamage;
        }
        // Secondary: Accuracy (descending)
        return b.accuracy - a.accuracy;
      });

      // Add ranks
      return leaderboardWithStats.map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
    } catch (error) {
      console.error("Error fetching boss all-time leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get event-specific leaderboard
   */
  static async getEventLeaderboard(eventId, limit = 50) {
    try {
      const leaderboard = await Leaderboard.findAll({
        where: { eventId },
        include: [
          {
            model: User,
            as: "user",
            attributes: ["id", "username", "profileImage"],
          },
        ],
        order: [
          ["totalDamageDealt", "DESC"],
          ["totalCorrectAnswers", "DESC"],
        ],
        limit,
      });

      return leaderboard.map((entry, index) => ({
        rank: index + 1,
        userId: entry.userId,
        username: entry.user?.username || "Unknown",
        profileImage: entry.user?.profileImage,
        totalDamage: entry.totalDamageDealt,
        totalCorrectAnswers: entry.totalCorrectAnswers,
        sessionsPlayed: entry.sessionsPlayed,
        avgDamagePerSession:
          entry.sessionsPlayed > 0
            ? Math.round(entry.totalDamageDealt / entry.sessionsPlayed)
            : 0,
        correctPercentage:
          entry.sessionsPlayed > 0
            ? Math.round(
                (entry.totalCorrectAnswers / entry.sessionsPlayed) * 100
              )
            : 0,
      }));
    } catch (error) {
      console.error("Error fetching event leaderboard:", error);
      throw error;
    }
  }

  /**
   * Update multiple players after battle completion
   */
  static async updateBattleLeaderboards(eventId, eventBossId, playersData) {
    try {
      const updatePromises = playersData.map((playerData) => {
        const { userId, totalDamage, correctAnswers, questionsAnswered } =
          playerData;
        return this.updatePlayerLeaderboard(userId, eventId, eventBossId, {
          totalDamage,
          correctAnswers,
          totalQuestions: questionsAnswered, // Map questionsAnswered to totalQuestions
        });
      });

      const results = await Promise.all(updatePromises);
      console.log(
        `✅ Updated ${results.length} player leaderboards for event ${eventId}, boss ${eventBossId}`
      );
      return results;
    } catch (error) {
      console.error("Error updating battle leaderboards:", error);
      throw error;
    }
  }

  /**
   * Get leaderboard stats for a specific user
   */
  static async getUserStats(userId) {
    try {
      const userStats = await Leaderboard.findAll({
        where: { userId },
        include: [
          {
            model: Event,
            as: "event",
            attributes: ["id", "name"],
          },
        ],
      });

      // Calculate total stats across all events
      const totalStats = userStats.reduce(
        (acc, stat) => ({
          totalDamage: acc.totalDamage + stat.totalDamageDealt,
          totalCorrectAnswers:
            acc.totalCorrectAnswers + stat.totalCorrectAnswers,
          totalSessions: acc.totalSessions + stat.sessionsPlayed,
          eventsParticipated: acc.eventsParticipated + 1,
        }),
        {
          totalDamage: 0,
          totalCorrectAnswers: 0,
          totalSessions: 0,
          eventsParticipated: 0,
        }
      );

      return {
        ...totalStats,
        avgDamagePerSession:
          totalStats.totalSessions > 0
            ? Math.round(totalStats.totalDamage / totalStats.totalSessions)
            : 0,
        eventStats: userStats.map((stat) => ({
          eventId: stat.eventId,
          eventName: stat.event?.name || "Unknown Event",
          totalDamage: stat.totalDamageDealt,
          correctAnswers: stat.totalCorrectAnswers,
          sessionsPlayed: stat.sessionsPlayed,
        })),
      };
    } catch (error) {
      console.error("Error fetching user stats:", error);
      throw error;
    }
  }
}

export default LeaderboardService;
