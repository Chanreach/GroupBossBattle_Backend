import { Op, fn, col } from "sequelize";
import { Event, Badge, UserBadge } from "../models/index.js";

class BadgeService {
  static async initializeBadges() {
    try {
      const badges = [
        {
          name: "MVP",
          image: "/badges/mvp.png",
          description: "Most Valuable Player",
          code: "mvp",
          type: "achievement",
          threshold: null,
        },
        {
          name: "Last Hit",
          image: "/badges/last-hit.png",
          description: "Deal the final blow to the boss",
          code: "last-hit",
          type: "achievement",
          threshold: null,
        },
        {
          name: "Boss Defeated",
          image: "/badges/boss-defeated.png",
          description: "Defeat a boss",
          code: "boss-defeated",
          type: "achievement",
          threshold: null,
        },
        {
          name: "10 Questions",
          image: "/badges/10-questions.png",
          description: "Answer 10 questions correctly",
          code: "questions_10",
          type: "milestone",
          threshold: 10,
        },
        {
          name: "25 Questions",
          image: "/badges/25-questions.png",
          description: "Answer 25 questions correctly",
          code: "questions_25",
          type: "milestone",
          threshold: 25,
        },
        {
          name: "50 Questions",
          image: "/badges/50-questions.png",
          description: "Answer 50 questions correctly",
          code: "questions_50",
          type: "milestone",
          threshold: 50,
        },
        {
          name: "100 Questions",
          image: "/badges/100-questions.png",
          description: "Answer 100 questions correctly",
          code: "questions_100",
          type: "milestone",
          threshold: 100,
        },
      ];

      for (const badge of badges) {
        await Badge.findOrCreate({
          where: { code: badge.code },
          defaults: badge,
        });
      }
    } catch (error) {
      console.error("Error initializing badges:", error);
      throw error;
    }
  }

  static async getAllBadges() {
    try {
      return await Badge.findAll({
        order: [["name", "ASC"]],
        attributes: [
          "id",
          "name",
          "image",
          "description",
          "code",
          "type",
          "threshold",
        ],
      });
    } catch (error) {
      console.error("Error getting badges:", error);
      throw error;
    }
  }

  static async getAllPlayerBadges(playerId) {
    try {
      const playerBadges = await UserBadge.findAll({
        where: { playerId },
        attributes: [
          "badgeId",
          "eventBossId",
          "eventId",
          [fn("COUNT", col("badgeId")), "earnCount"],
          [fn("MAX", col("earnedAt")), "lastEarnedAt"],
        ],
        include: [
          {
            model: Badge,
            as: "badge",
          },
          {
            model: Event,
            as: "event",
            where: { status: { [Op.ne]: "completed" } },
          },
        ],
        group: ["badgeId", "eventBossId", "eventId"],
        raw: true,
        nest: true,
      });

      return playerBadges.map((playerBadge) => ({
        badgeId: playerBadge.badge.id,
        badgeCode: playerBadge.badge.code,
        eventBossId: playerBadge.eventBossId,
        eventId: playerBadge.eventId,
        earnCount: playerBadge.earnCount,
        lastEarnedAt: playerBadge.lastEarnedAt,
      }));
    } catch (error) {
      console.error("Error getting player badges:", error);
      throw error;
    }
  }

  static async awardBadge(
    playerId,
    badgeId,
    eventBossId = null,
    eventId,
    badgeType
  ) {
    try {
      const badge = await Badge.findByPk(badgeId);
      if (!badge) {
        throw new Error(`Badge with ID ${badgeId} not found.`);
      }

      const event = await Event.findByPk(eventId);
      if (!event) {
        throw new Error(`Event with ID ${eventId} not found.`);
      }

      const userBadge = await UserBadge.create({
        playerId,
        badgeId,
        eventBossId: badgeType === "achievement" ? eventBossId : null,
        eventId,
        earnedAt: new Date(),
      });

      await userBadge.reload({
        include: [
          {
            model: Badge,
            as: "badge",
          },
        ],
      });

      return {
        badgeId: userBadge.badgeId,
        badgeCode: userBadge.badge.code,
        eventBossId: userBadge.eventBossId,
        eventId: userBadge.eventId,
        lastEarnedAt: userBadge.earnedAt,
      };
    } catch (error) {
      console.error(`Error awarding ${badgeType} badge: ${error}`);
      throw error;
    }
  }
}

export default BadgeService;
