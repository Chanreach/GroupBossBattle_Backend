import {
  Leaderboard,
  User,
  EventBoss,
  PlayerSession,
} from "../models/index.js";
import { Op, fn, col, literal } from "sequelize";

class LeaderboardService {
  static async updateLeaderboardEntry(
    playerId,
    eventBossId,
    totalDamage = 0,
    correctAnswers = 0,
    questionsAnswered = 0
  ) {
    try {
      const [leaderboardEntry, created] = await Leaderboard.findOrCreate({
        where: {
          playerId,
          eventBossId,
        },
        defaults: {
          totalDamageDealt: totalDamage,
          totalCorrectAnswers: correctAnswers,
          totalQuestionsAnswered: questionsAnswered,
          totalBattlesParticipated: 1,
        },
      });

      if (!created) {
        await leaderboardEntry.increment("totalDamageDealt", {
          by: totalDamage,
        });
        await leaderboardEntry.increment("totalCorrectAnswers", {
          by: correctAnswers,
        });
        await leaderboardEntry.increment("totalQuestionsAnswered", {
          by: questionsAnswered,
        });
        await leaderboardEntry.increment("totalBattlesParticipated", { by: 1 });
      }

      return leaderboardEntry;
    } catch (error) {
      console.error("Error creating leaderboard entry:", error);
      throw error;
    }
  }

  static async getPlayerStatsByEventBossId(playerId, eventBossId) {
    try {
      const leaderboardEntry = await Leaderboard.findOne({
        where: {
          playerId,
          eventBossId,
        },
      });
      return leaderboardEntry;
    } catch (error) {
      console.error("Error fetching player stats:", error);
      throw error;
    }
  }

  static async getPlayerStatsByEventId(playerId, eventId) {
    try {
      const eventBosses = await EventBoss.findAll({
        where: { eventId },
        attributes: ["id"],
      });

      const eventBossIds = eventBosses.map((eb) => eb.id);
      if (eventBossIds.length === 0) {
        return [];
      }

      const leaderboardEntry = await Leaderboard.findAll({
        where: {
          playerId,
          eventBossId: {
            [Op.in]: eventBossIds,
          },
        },
        attributes: [
          "playerId",
          [fn("SUM", col("total_damage_dealt")), "totalDamageDealt"],
          [fn("SUM", col("total_correct_answers")), "totalCorrectAnswers"],
          [
            fn("SUM", col("total_questions_answered")),
            "totalQuestionsAnswered",
          ],
          [
            fn("SUM", col("total_battles_participated")),
            "totalBattlesParticipated",
          ],
        ],
        group: ["playerId"],
      });

      return leaderboardEntry[0]
        ? {
            playerId: leaderboardEntry[0].playerId,
            eventId,
            totalDamageDealt: Number(
              leaderboardEntry[0].get("totalDamageDealt")
            ),
            totalCorrectAnswers: Number(
              leaderboardEntry[0].get("totalCorrectAnswers")
            ),
            totalQuestionsAnswered: Number(
              leaderboardEntry[0].get("totalQuestionsAnswered")
            ),
            totalBattlesParticipated: Number(
              leaderboardEntry[0].get("totalBattlesParticipated")
            ),
          }
        : null;
    } catch (error) {
      console.error("Error fetching player stats by event ID:", error);
      throw error;
    }
  }

  static async getEventBossAllTimeLeaderboard(eventBossId) {
    try {
      const leaderboardEntries = await Leaderboard.findAll({
        where: {
          eventBossId,
        },
        attributes: [
          "playerId",
          "eventBossId",
          "totalDamageDealt",
          "totalCorrectAnswers",
          "totalQuestionsAnswered",
          "totalBattlesParticipated",
          [
            literal(
              "ROUND(total_correct_answers / NULLIF(total_questions_answered, 0), 4)"
            ),
            "accuracy",
          ],
        ],
        order: [
          ["totalDamageDealt", "DESC"],
          ["accuracy", "DESC"],
          ["totalBattlesParticipated", "DESC"],
        ],
      });

      const enrichedEntries = await Promise.all(
        leaderboardEntries.map(async (entry) => {
          let username = "Unknown Player";
          let profileImage = null;
          let userId = null;
          try {
            const playerSession = await PlayerSession.findByPk(entry.playerId);
            if (playerSession) {
              username = playerSession.username;
              userId = playerSession.userId;
              if (userId) {
                const user = await User.findByPk(userId);
                if (user) {
                  profileImage = user.profileImage;
                }
              }
            }
          } catch (lookupError) {
            console.warn(
              `Could not resolve player name for ID ${entry.playerId}`
            );
          }
          return {
            playerId: entry.playerId,
            userId,
            eventBossId: entry.eventBossId,
            playerName: username,
            profileImage,
            totalDamageDealt: Number(entry.totalDamageDealt),
            totalCorrectAnswers: Number(entry.totalCorrectAnswers),
            totalQuestionsAnswered: Number(entry.totalQuestionsAnswered),
            totalBattlesParticipated: Number(entry.totalBattlesParticipated),
            accuracy: Number(entry.get("accuracy")) || 0,
          };
        })
      );
      return enrichedEntries;
    } catch (error) {
      console.error("Error fetching event boss all-time leaderboard:", error);
      throw error;
    }
  }

  static async getEventAllTimeLeaderboard(eventId) {
    try {
      const eventBosses = await EventBoss.findAll({
        where: { eventId },
        attributes: ["id"],
      });
      const eventBossIds = eventBosses.map((eb) => eb.id);
      if (eventBossIds.length === 0) {
        return [];
      }
      const leaderboardEntries = await Leaderboard.findAll({
        where: {
          eventBossId: {
            [Op.in]: eventBossIds,
          },
        },
        attributes: [
          "playerId",
          [fn("SUM", col("total_damage_dealt")), "totalDamageDealt"],
          [fn("SUM", col("total_correct_answers")), "totalCorrectAnswers"],
          [
            fn("SUM", col("total_questions_answered")),
            "totalQuestionsAnswered",
          ],
          [
            fn("SUM", col("total_battles_participated")),
            "totalBattlesParticipated",
          ],
          [
            fn(
              "ROUND",
              fn("SUM", col("total_correct_answers")) /
                fn("NULLIF", fn("SUM", col("total_questions_answered")), 0),
              4
            ),
            "accuracy",
          ],
        ],
        group: ["playerId"],
        order: [
          ["totalDamageDealt", "DESC"],
          ["accuracy", "DESC"],
          ["totalBattlesParticipated", "DESC"],
        ],
      });

      const enrichedEntries = await Promise.all(
        leaderboardEntries.map(async (entry) => {
          let username = "Unknown Player";
          let profileImage = null;
          let userId = null;
          try {
            const playerSession = await PlayerSession.findByPk(entry.playerId);
            if (playerSession) {
              username = playerSession.username;
              userId = playerSession.userId;
              if (userId) {
                const user = await User.findByPk(userId);
                if (user) {
                  profileImage = user.profileImage;
                }
              }
            }
          } catch (lookupError) {
            console.warn(
              `Could not resolve player name for ID ${entry.playerId}`
            );
          }
          return {
            playerId: entry.playerId,
            userId,
            eventId,
            playerName: username,
            profileImage,
            totalDamageDealt: Number(entry.get("totalDamageDealt")),
            totalCorrectAnswers: Number(entry.get("totalCorrectAnswers")),
            totalQuestionsAnswered: Number(entry.get("totalQuestionsAnswered")),
            totalBattlesParticipated: Number(
              entry.get("totalBattlesParticipated")
            ),
            accuracy: Number(entry.get("accuracy")) || 0,
          };
        })
      );
      return enrichedEntries;
    } catch (error) {
      console.error("Error fetching event all-time leaderboard:", error);
      throw error;
    }
  }
}

export default LeaderboardService;
