import { Leaderboard, User } from "../../models/index.js";
import { fn, col, literal } from "sequelize";

class LeaderboardService {
  static async updateLeaderboardEntry(
    userId,
    eventId,
    eventBossId,
    totalDamage = 0,
    correctAnswers = 0,
    questionsAnswered = 0
  ) {
    try {
      const [leaderboardEntry, created] = await Leaderboard.findOrCreate({
        where: {
          userId,
          eventId,
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
      return null;
    }
  }

  static async getPlayerStatsByEventBossId(userId, eventBossId) {
    try {
      const leaderboardEntry = await Leaderboard.findOne({
        where: {
          userId,
          eventBossId,
        },
      });
      return leaderboardEntry;
    } catch (error) {
      console.error("Error fetching player stats:", error);
      return null;
    }
  }

  static async getPlayerStatsByEventId(userId, eventId) {
    try {
      const leaderboardEntry = await Leaderboard.findAll({
        where: {
          userId,
          eventId,
        },
        attributes: [
          "userId",
          "eventId",
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
        group: ["userId", "eventId"],
      });

      return leaderboardEntry[0]
        ? {
            userId: leaderboardEntry[0].userId,
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
      console.error("Error fetching player stats:", error);
      return null;
    }
  }

  static async getEventBossAllTimeLeaderboard(eventBossId) {
    try {
      const leaderboardEntries = await Leaderboard.findAll({
        where: {
          eventBossId,
        },
        attributes: [
          "userId",
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
          try {
            const user = await User.findByPk(entry.userId);
            if (user) {
              username = user.username;
              profileImage = user.profileImage;
            }
          } catch (lookupError) {
            console.warn(
              `Could not resolve player name for ID ${entry.userId}`
            );
          }
          return {
            userId: entry.userId,
            eventBossId: entry.eventBossId,
            username,
            profileImage,
            totalDamageDealt: Number(entry.totalDamageDealt),
            totalCorrectAnswers: Number(entry.totalCorrectAnswers),
            totalQuestionsAnswered: Number(entry.totalQuestionsAnswered),
            totalBattlesParticipated: Number(entry.totalBattlesParticipated),
            accuracy: Number(entry.get("accuracy")) || 0,
            rank: 0,
          };
        })
      );
      return enrichedEntries;
    } catch (error) {
      console.error("Error fetching event boss all-time leaderboard:", error);
      return null;
    }
  }

  static async getEventAllTimeLeaderboard(eventId) {
    try {
      const leaderboardEntries = await Leaderboard.findAll({
        where: {
          eventId,
        },
        attributes: [
          "userId",
          "eventId",
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
        group: ["userId", "eventId"],
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
            const user = await User.findByPk(entry.userId);
            if (user) {
              username = user.username;
              userId = user.id;
              profileImage = user.profileImage;
            }
          } catch (lookupError) {
            console.warn(
              `Could not resolve player name for ID ${entry.userId}`
            );
          }
          return {
            userId,
            eventId,
            username,
            profileImage,
            totalDamageDealt: Number(entry.get("totalDamageDealt")),
            totalCorrectAnswers: Number(entry.get("totalCorrectAnswers")),
            totalQuestionsAnswered: Number(entry.get("totalQuestionsAnswered")),
            totalBattlesParticipated: Number(
              entry.get("totalBattlesParticipated")
            ),
            accuracy: Number(entry.get("accuracy")) || 0,
            rank: 0,
          };
        })
      );
      return enrichedEntries;
    } catch (error) {
      console.error("Error fetching event all-time leaderboard:", error);
      return null;
    }
  }
}

export default LeaderboardService;
