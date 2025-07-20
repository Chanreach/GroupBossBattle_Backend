import { Badge, UserBadge, User } from "../models/index.js";

class BadgeService {
  // Get all available badges
  static async getAllBadges() {
    try {
      return await Badge.findAll({
        order: [["name", "ASC"]],
      });
    } catch (error) {
      console.error("Error getting badges:", error);
      throw error;
    }
  }

  // Award MVP badge (most damage in boss fight)
  static async awardMVPBadge(playerId, bossSessionId, totalDamage) {
    try {
      const mvpBadge = await Badge.findOne({ where: { name: "MVP" } });
      if (!mvpBadge) {
        console.error("MVP badge not found in database");
        return null;
      }

      // Check if player already has this badge for this boss session
      const existingBadge = await UserBadge.findOne({
        where: {
          playerId,
          badgeId: mvpBadge.id,
          bossSessionId: bossSessionId,
        },
      });

      if (existingBadge) {
        console.log(
          `Player ${playerId} already has MVP badge for boss session ${bossSessionId}`
        );
        return existingBadge;
      }

      // Award the badge
      const userBadge = await UserBadge.create({
        playerId,
        badgeId: mvpBadge.id,
        bossSessionId: bossSessionId,
      });

      console.log(
        `🏆 MVP badge awarded to player ${playerId} for boss session ${bossSessionId} with ${totalDamage} damage`
      );
      return userBadge;
    } catch (error) {
      console.error("Error awarding MVP badge:", error);
      throw error;
    }
  }

  // Award Last Hit badge (final blow to boss)
  static async awardLastHitBadge(playerId, bossSessionId) {
    try {
      const lastHitBadge = await Badge.findOne({ where: { name: "Last Hit" } });
      if (!lastHitBadge) {
        console.error("Last Hit badge not found in database");
        return null;
      }

      // Check if player already has this badge for this boss session
      const existingBadge = await UserBadge.findOne({
        where: {
          playerId,
          badgeId: lastHitBadge.id,
          bossSessionId: bossSessionId,
        },
      });

      if (existingBadge) {
        console.log(
          `Player ${playerId} already has Last Hit badge for boss session ${bossSessionId}`
        );
        return existingBadge;
      }

      // Award the badge
      const userBadge = await UserBadge.create({
        playerId,
        badgeId: lastHitBadge.id,
        bossSessionId: bossSessionId,
      });

      console.log(
        `🎯 Last Hit badge awarded to player ${playerId} for boss session ${bossSessionId}`
      );
      return userBadge;
    } catch (error) {
      console.error("Error awarding Last Hit badge:", error);
      throw error;
    }
  }

  // Award Boss Defeated badge to all winning team members
  static async awardBossDefeatedBadges(winningTeamPlayerIds, bossSessionId) {
    try {
      const bossDefeatedBadge = await Badge.findOne({
        where: { name: "Boss Defeated" },
      });
      if (!bossDefeatedBadge) {
        console.error("Boss Defeated badge not found in database");
        return [];
      }

      const awardedBadges = [];

      for (const playerId of winningTeamPlayerIds) {
        // Check if player already has this badge for this boss session
        const existingBadge = await UserBadge.findOne({
          where: {
            playerId,
            badgeId: bossDefeatedBadge.id,
            bossSessionId: bossSessionId,
          },
        });

        if (!existingBadge) {
          const userBadge = await UserBadge.create({
            playerId,
            badgeId: bossDefeatedBadge.id,
            bossSessionId: bossSessionId,
          });
          awardedBadges.push(userBadge);
        }
      }

      console.log(
        `🏅 Boss Defeated badges awarded to ${awardedBadges.length} players for boss session ${bossSessionId}`
      );
      return awardedBadges;
    } catch (error) {
      console.error("Error awarding Boss Defeated badges:", error);
      throw error;
    }
  }

  // Award question milestone badges (10, 25, 50, 100 correct answers per event)
  static async awardMilestoneBadge(playerId, eventId, correctAnswerCount) {
    try {
      const milestones = [
        { count: 10, name: "10 Questions" },
        { count: 25, name: "25 Questions" },
        { count: 50, name: "50 Questions" },
        { count: 100, name: "100 Questions" },
      ];

      const awardedBadges = [];

      for (const milestone of milestones) {
        if (correctAnswerCount >= milestone.count) {
          const milestoneBadge = await Badge.findOne({
            where: { name: milestone.name },
          });
          if (!milestoneBadge) {
            console.warn(`${milestone.name} badge not found in database`);
            continue;
          }

          // Check if player already has this milestone badge for this event
          // For milestones, we use eventId instead of bossSessionId
          const existingBadge = await UserBadge.findOne({
            where: {
              playerId,
              badgeId: milestoneBadge.id,
              bossSessionId: eventId, // Using eventId for milestones
            },
          });

          if (!existingBadge) {
            const userBadge = await UserBadge.create({
              playerId,
              badgeId: milestoneBadge.id,
              bossSessionId: eventId,
            });
            awardedBadges.push({
              badge: userBadge,
              badgeInfo: milestoneBadge,
              milestone: milestone.count,
            });

            console.log(
              `🎖️ ${milestone.name} milestone badge awarded to player ${playerId} for event ${eventId}`
            );
          }
        }
      }

      return awardedBadges;
    } catch (error) {
      console.error("Error awarding milestone badges:", error);
      throw error;
    }
  }

  // Get player's badges for a specific event
  static async getPlayerBadgesForEvent(playerId, eventId) {
    try {
      return await UserBadge.findAll({
        where: {
          playerId,
          bossSessionId: eventId,
        },
        include: [
          {
            model: Badge,
            attributes: ["id", "name", "image"],
          },
        ],
        order: [["earned_at", "DESC"]],
      });
    } catch (error) {
      console.error("Error getting player badges:", error);
      throw error;
    }
  }

  // Get player's total correct answers across all bosses in an event
  static async getPlayerEventStats(playerId, eventId, bossSessionManager) {
    try {
      // This would need to be implemented based on how you track event-wide stats
      // For now, we'll return a placeholder that can be updated with actual logic
      let totalCorrectAnswers = 0;

      // Get all boss sessions for this event
      const allSessions = bossSessionManager.getAllSessions();

      for (const session of allSessions) {
        if (session.eventId === eventId) {
          // Assuming you add eventId to sessions
          const player = session.players.get(playerId);
          if (player) {
            totalCorrectAnswers += player.correctAnswers || 0;
          }
        }
      }

      return {
        totalCorrectAnswers,
        eventId,
      };
    } catch (error) {
      console.error("Error getting player event stats:", error);
      throw error;
    }
  }

  // Initialize default badges in database (run once during setup)
  static async initializeDefaultBadges() {
    try {
      const defaultBadges = [
        { name: "MVP", image: "/badges/mvp.png" },
        { name: "Last Hit", image: "/badges/last-hit.png" },
        { name: "Boss Defeated", image: "/badges/boss-defeated.png" },
        { name: "10 Questions", image: "/badges/10-questions.png" },
        { name: "25 Questions", image: "/badges/25-questions.png" },
        { name: "50 Questions", image: "/badges/50-questions.png" },
        { name: "100 Questions", image: "/badges/100-questions.png" },
      ];

      for (const badgeData of defaultBadges) {
        const existingBadge = await Badge.findOne({
          where: { name: badgeData.name },
        });
        if (!existingBadge) {
          await Badge.create(badgeData);
          console.log(`✅ Created badge: ${badgeData.name}`);
        }
      }

      console.log("🎖️ Default badges initialized");
    } catch (error) {
      console.error("Error initializing default badges:", error);
      throw error;
    }
  }
}

export default BadgeService;
