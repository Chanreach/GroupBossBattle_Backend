import {
  Leaderboard,
  User,
  EventBoss,
  Event,
  Boss,
  PlayerSession,
} from "../models/index.js";
import { Op } from "sequelize";

class LeaderboardService {
  static async updatePlayerLeaderboard(
    playerId,
    eventBossId,
    totalDamage,
    correctAnswers
  ) {
    try {
      const [leaderboardEntry, created] = await Leaderboard.findOrCreate({
        where: {
          playerId: playerId,
          eventBossId: eventBossId,
        },
        defaults: {
          totalDamageDealt: totalDamage || 0,
          totalCorrectAnswers: correctAnswers || 0,
        },
      });

      if (!created) {
        // Update existing entry with new totals (not incremental)
        await leaderboardEntry.update({
          totalDamageDealt: totalDamage || 0,
          totalCorrectAnswers: correctAnswers || 0,
        });
      }

      return leaderboardEntry;
    } catch (error) {
      console.error("Error updating player leaderboard:", error);
      throw error;
    }
  }

  static async getEventOverallLeaderboard(eventId, limit = 50) {
    try {
      // First get all eventBoss IDs for this event
      const eventBosses = await EventBoss.findAll({
        where: { eventId: eventId },
        attributes: ["id"],
      });

      const eventBossIds = eventBosses.map((eb) => eb.id);

      if (eventBossIds.length === 0) {
        return [];
      }

      // Get all leaderboard entries for these event bosses
      const leaderboardEntries = await Leaderboard.findAll({
        where: {
          eventBossId: {
            [Op.in]: eventBossIds,
          },
        },
        order: [
          ["totalDamageDealt", "DESC"],
          ["totalCorrectAnswers", "DESC"],
        ],
        limit: parseInt(limit),
      });

      // Enrich with player names
      const enrichedEntries = await Promise.all(
        leaderboardEntries.map(async (entry) => {
          let playerName = "Unknown Player";
          let profilePicture = null;

          try {
            const user = await User.findByPk(entry.playerId);
            if (user) {
              playerName = user.username;
              profilePicture = user.profileImage;
            } else {
              const playerSession = await PlayerSession.findByPk(
                entry.playerId
              );
              if (playerSession) {
                playerName = playerSession.username;
              }
            }
          } catch (lookupError) {
            console.warn(
              `Could not resolve player name for ID ${entry.playerId}`
            );
          }

          return {
            playerId: entry.playerId,
            playerName: playerName,
            profilePicture: profilePicture,
            totalDamageDealt: entry.totalDamageDealt,
            totalCorrectAnswers: entry.totalCorrectAnswers,
            eventBossId: entry.eventBossId,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          };
        })
      );

      return enrichedEntries;
    } catch (error) {
      console.error("Error fetching event overall leaderboard:", error);
      throw error;
    }
  }

  static async getBossSpecificLeaderboard(eventId, eventBossId, limit = 50) {
    try {
      const leaderboardEntries = await Leaderboard.findAll({
        where: {
          eventBossId: eventBossId,
        },
        order: [
          ["totalDamageDealt", "DESC"],
          ["totalCorrectAnswers", "DESC"],
        ],
        limit: parseInt(limit),
      });

      // Enrich with player names
      const enrichedEntries = await Promise.all(
        leaderboardEntries.map(async (entry) => {
          let playerName = "Unknown Player";
          let profilePicture = null;

          try {
            const user = await User.findByPk(entry.playerId);
            if (user) {
              playerName = user.username;
              profilePicture = user.profileImage;
            } else {
              const playerSession = await PlayerSession.findByPk(
                entry.playerId
              );
              if (playerSession) {
                playerName = playerSession.username;
              }
            }
          } catch (lookupError) {
            console.warn(
              `Could not resolve player name for ID ${entry.playerId}`
            );
          }

          return {
            playerId: entry.playerId,
            playerName: playerName,
            profilePicture: profilePicture,
            totalDamageDealt: entry.totalDamageDealt,
            totalCorrectAnswers: entry.totalCorrectAnswers,
            eventBossId: entry.eventBossId,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          };
        })
      );

      return enrichedEntries;
    } catch (error) {
      console.error("Error fetching boss-specific leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get all-time leaderboard (across all boss fights) - Updated for new schema
   */
  static async getAllTimeLeaderboard() {
    try {
      // Get all leaderboard entries ordered by damage and correct answers
      const leaderboardEntries = await Leaderboard.findAll({
        order: [
          ["totalDamageDealt", "DESC"],
          ["totalCorrectAnswers", "DESC"],
        ],
      });

      // For each entry, try to resolve the player name from either User or PlayerSession
      const enrichedEntries = await Promise.all(
        leaderboardEntries.map(async (entry) => {
          let playerName = "Unknown Player";
          let profilePicture = null;

          try {
            // First try to find as a User (authenticated player)
            const user = await User.findByPk(entry.playerId);
            if (user) {
              playerName = user.username;
              profilePicture = user.profileImage;
            } else {
              // If not found as User, try PlayerSession (guest player)
              const playerSession = await PlayerSession.findByPk(
                entry.playerId
              );
              if (playerSession) {
                playerName = playerSession.username;
                // profilePicture stays null for guests
              }
            }
          } catch (lookupError) {
            console.warn(
              `Could not resolve player name for ID ${entry.playerId}:`,
              lookupError.message
            );
          }

          return {
            playerId: entry.playerId,
            playerName: playerName,
            profilePicture: profilePicture,
            totalDamageDealt: entry.totalDamageDealt,
            totalCorrectAnswers: entry.totalCorrectAnswers,
            eventBossId: entry.eventBossId,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          };
        })
      );

      return enrichedEntries;
    } catch (error) {
      console.error("Error fetching all-time leaderboard:", error);
      throw error;
    }
  }

  static async getBossAllTimeLeaderboard(bossId, limit = 50) {
    try {
      // First get all eventBoss IDs for this boss
      const eventBosses = await EventBoss.findAll({
        where: { bossId: bossId },
        attributes: ["id"],
      });

      const eventBossIds = eventBosses.map((eb) => eb.id);

      if (eventBossIds.length === 0) {
        return [];
      }

      // Get all leaderboard entries for these event bosses
      const leaderboardEntries = await Leaderboard.findAll({
        where: {
          eventBossId: {
            [Op.in]: eventBossIds,
          },
        },
        order: [
          ["totalDamageDealt", "DESC"],
          ["totalCorrectAnswers", "DESC"],
        ],
        limit: parseInt(limit),
      });

      // Enrich with player names
      const enrichedEntries = await Promise.all(
        leaderboardEntries.map(async (entry) => {
          let playerName = "Unknown Player";
          let profilePicture = null;

          try {
            const user = await User.findByPk(entry.playerId);
            if (user) {
              playerName = user.username;
              profilePicture = user.profileImage;
            } else {
              const playerSession = await PlayerSession.findByPk(
                entry.playerId
              );
              if (playerSession) {
                playerName = playerSession.username;
              }
            }
          } catch (lookupError) {
            console.warn(
              `Could not resolve player name for ID ${entry.playerId}`
            );
          }

          return {
            playerId: entry.playerId,
            playerName: playerName,
            profilePicture: profilePicture,
            totalDamageDealt: entry.totalDamageDealt,
            totalCorrectAnswers: entry.totalCorrectAnswers,
            eventBossId: entry.eventBossId,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          };
        })
      );

      return enrichedEntries;
    } catch (error) {
      console.error("Error fetching boss all-time leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get all-time leaderboard for a specific eventBoss - Updated for new schema
   */
  static async getEventBossAllTimeLeaderboard(eventBossId, limit = 50) {
    try {
      const leaderboardEntries = await Leaderboard.findAll({
        where: {
          eventBossId: eventBossId,
        },
        order: [
          ["totalDamageDealt", "DESC"],
          ["totalCorrectAnswers", "DESC"],
        ],
        limit: parseInt(limit),
      });

      // Enrich with player names
      const enrichedEntries = await Promise.all(
        leaderboardEntries.map(async (entry) => {
          let playerName = "Unknown Player";
          let profilePicture = null;

          try {
            const user = await User.findByPk(entry.playerId);
            if (user) {
              playerName = user.username;
              profilePicture = user.profileImage;
            } else {
              const playerSession = await PlayerSession.findByPk(
                entry.playerId
              );
              if (playerSession) {
                playerName = playerSession.username;
              }
            }
          } catch (lookupError) {
            console.warn(
              `Could not resolve player name for ID ${entry.playerId}`
            );
          }

          return {
            playerId: entry.playerId,
            playerName: playerName,
            profilePicture: profilePicture,
            totalDamageDealt: entry.totalDamageDealt,
            totalCorrectAnswers: entry.totalCorrectAnswers,
            eventBossId: entry.eventBossId,
            createdAt: entry.createdAt,
            updatedAt: entry.updatedAt,
          };
        })
      );

      return enrichedEntries;
    } catch (error) {
      console.error("Error fetching event boss all-time leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get player stats - Updated for new schema
   */
  static async getPlayerStats(playerId) {
    try {
      const playerEntries = await Leaderboard.findAll({
        where: {
          playerId: playerId,
        },
        order: [["createdAt", "DESC"]],
      });

      const totalDamage = playerEntries.reduce(
        (sum, entry) => sum + entry.totalDamageDealt,
        0
      );
      const totalCorrectAnswers = playerEntries.reduce(
        (sum, entry) => sum + entry.totalCorrectAnswers,
        0
      );

      return {
        playerId: playerId,
        totalBattles: playerEntries.length,
        totalDamageDealt: totalDamage,
        totalCorrectAnswers: totalCorrectAnswers,
        averageDamagePerBattle:
          playerEntries.length > 0
            ? Math.round(totalDamage / playerEntries.length)
            : 0,
        averageCorrectPerBattle:
          playerEntries.length > 0
            ? Math.round(totalCorrectAnswers / playerEntries.length)
            : 0,
        battles: playerEntries.map((entry) => ({
          eventBossId: entry.eventBossId,
          totalDamageDealt: entry.totalDamageDealt,
          totalCorrectAnswers: entry.totalCorrectAnswers,
          battleDate: entry.createdAt,
        })),
      };
    } catch (error) {
      console.error("Error fetching player stats:", error);
      throw error;
    }
  }

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
