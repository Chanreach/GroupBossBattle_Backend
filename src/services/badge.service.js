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

  // Award MVP badge (most damage in boss fight) - Updated for simplified schema
  static async awardMVPBadge(
    playerId,
    eventBossId,
    totalDamage,
    eventId = null
  ) {
    try {
      const mvpBadge = await Badge.findOne({ where: { name: "MVP" } });
      if (!mvpBadge) {
        console.error("MVP badge not found in database");
        return null;
      }

      // Check if player already has this badge for this event boss
      const existingBadge = await UserBadge.findOne({
        where: {
          playerId,
          badgeId: mvpBadge.id,
          eventBossId: eventBossId,
        },
      });

      if (existingBadge) {
        console.log(
          `Player ${playerId} already has MVP badge for event boss ${eventBossId}`
        );
        return existingBadge;
      }

      // Award the badge
      const userBadge = await UserBadge.create({
        playerId,
        badgeId: mvpBadge.id,
        eventBossId: eventBossId,
        eventId: eventId || 1, // Default to 1 if not provided
      });

      console.log(
        `🏆 MVP badge awarded to player ${playerId} for event boss ${eventBossId} with ${totalDamage} damage`
      );
      console.log(
        `🏆 [FRONTEND] MVP Badge: ${mvpBadge.name}, Player: ${playerId}, Damage: ${totalDamage}`
      );

      return {
        userBadge,
        badgeInfo: mvpBadge,
        totalDamage,
      };
    } catch (error) {
      console.error("Error awarding MVP badge:", error);
      throw error;
    }
  }

  // Award Last Hit badge (final blow to boss) - Updated for simplified schema
  static async awardLastHitBadge(playerId, eventBossId, eventId = null) {
    try {
      const lastHitBadge = await Badge.findOne({ where: { name: "Last Hit" } });
      if (!lastHitBadge) {
        console.error("Last Hit badge not found in database");
        return null;
      }

      // Check if player already has this badge for this event boss
      const existingBadge = await UserBadge.findOne({
        where: {
          playerId,
          badgeId: lastHitBadge.id,
          eventBossId: eventBossId,
        },
      });

      if (existingBadge) {
        console.log(
          `Player ${playerId} already has Last Hit badge for event boss ${eventBossId}`
        );
        return existingBadge;
      }

      // Award the badge
      const userBadge = await UserBadge.create({
        playerId,
        badgeId: lastHitBadge.id,
        eventBossId: eventBossId,
        eventId: eventId || 1,
      });

      console.log(
        `🎯 Last Hit badge awarded to player ${playerId} for event boss ${eventBossId}`
      );
      console.log(
        `🎯 [FRONTEND] Last Hit Badge: ${lastHitBadge.name}, Player: ${playerId}`
      );

      return {
        userBadge,
        badgeInfo: lastHitBadge,
      };
    } catch (error) {
      console.error("Error awarding Last Hit badge:", error);
      throw error;
    }
  }

  // Award Boss Defeated badge to all winning team members - Updated for simplified schema
  static async awardBossDefeatedBadges(
    winningTeamPlayerIds,
    eventBossId,
    eventId = null
  ) {
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
        // Check if player already has this badge for this event boss
        const existingBadge = await UserBadge.findOne({
          where: {
            playerId,
            badgeId: bossDefeatedBadge.id,
            eventBossId: eventBossId,
          },
        });

        if (!existingBadge) {
          const userBadge = await UserBadge.create({
            playerId,
            badgeId: bossDefeatedBadge.id,
            eventBossId: eventBossId,
            eventId: eventId || 1,
          });
          awardedBadges.push({
            userBadge,
            badgeInfo: bossDefeatedBadge,
            playerId,
          });
        }
      }

      console.log(
        `🏅 Boss Defeated badges awarded to ${awardedBadges.length} players for event boss ${eventBossId}`
      );

      awardedBadges.forEach((badge) => {
        console.log(
          `🏅 [FRONTEND] Boss Defeated Badge: ${badge.badgeInfo.name}, Player: ${badge.playerId}`
        );
      });

      return awardedBadges;
    } catch (error) {
      console.error("Error awarding Boss Defeated badges:", error);
      throw error;
    }
  }

  // Real-time milestone badge checking during the fight
  static async checkMilestoneProgress(
    playerId,
    eventId,
    currentCorrectAnswers,
    socketCallback = null
  ) {
    try {
      console.log(
        `🎖️ [MILESTONE CHECK] Player ${playerId}, Event ${eventId}, Current Correct: ${currentCorrectAnswers}`
      );

      const milestones = [10, 25, 50, 100];
      const awardedBadges = [];

      for (const milestone of milestones) {
        if (currentCorrectAnswers === milestone) {
          // Check if player already has this milestone badge for this event
          const milestoneBadge = await Badge.findOne({
            where: { name: `${milestone} Questions` },
          });

          if (!milestoneBadge) {
            console.warn(`${milestone} Questions badge not found in database`);
            continue;
          }

          const existingBadge = await UserBadge.findOne({
            where: {
              playerId,
              badgeId: milestoneBadge.id,
              eventId: eventId,
            },
          });

          if (!existingBadge) {
            // Award the milestone badge
            const userBadge = await UserBadge.create({
              playerId,
              badgeId: milestoneBadge.id,
              eventBossId: null, // Event-wide milestone, not boss-specific
              eventId: eventId,
            });

            const badgeNotification = {
              type: "milestone_badge",
              badge: {
                id: userBadge.id,
                name: milestoneBadge.name,
                image: milestoneBadge.image,
                milestone: milestone,
              },
              playerId: playerId,
              message: `🎖️ Milestone achieved! ${milestone} correct answers!`,
              timestamp: new Date(),
            };

            awardedBadges.push(badgeNotification);

            console.log(
              `🎖️ [MILESTONE BADGE] ${milestoneBadge.name} awarded to player ${playerId} for reaching ${milestone} correct answers in event ${eventId}`
            );
            console.log(
              `🎖️ [FRONTEND NOTIFICATION] Badge: ${milestoneBadge.name}, Player: ${playerId}, Milestone: ${milestone}`
            );

            // Send real-time notification if callback provided
            if (socketCallback) {
              socketCallback(badgeNotification);
            }
          }
        }
      }

      return awardedBadges;
    } catch (error) {
      console.error("Error checking milestone progress:", error);
      throw error;
    }
  }

  // Award question milestone badges (10, 25, 50, 100 correct answers per event) - Updated for simplified schema
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
          const existingBadge = await UserBadge.findOne({
            where: {
              playerId,
              badgeId: milestoneBadge.id,
              eventId: eventId,
            },
          });

          if (!existingBadge) {
            const userBadge = await UserBadge.create({
              playerId,
              badgeId: milestoneBadge.id,
              eventBossId: null, // Event-wide milestone
              eventId: eventId,
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

  // Get player's badges for a specific event - Updated for simplified schema
  static async getPlayerBadgesForEvent(playerId, eventId) {
    try {
      return await UserBadge.findAll({
        where: {
          playerId,
          eventId: eventId,
        },
        include: [
          {
            model: Badge,
            as: "badge",
            attributes: ["id", "name", "image"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });
    } catch (error) {
      console.error("Error getting player badges:", error);
      throw error;
    }
  }

  // Get player's event-wide stats for milestone tracking
  static async getPlayerEventStats(playerId, eventId, bossSessionManager) {
    try {
      let totalCorrectAnswers = 0;

      // Get all sessions for this event from the boss session manager
      const allSessions = bossSessionManager.getAllSessions();

      for (const [eventBossId, session] of allSessions) {
        if (session.eventId === eventId) {
          const player = session.players.get(playerId);
          if (player) {
            totalCorrectAnswers += player.correctAnswers || 0;
          }
        }
      }

      console.log(
        `📊 [EVENT STATS] Player ${playerId} in Event ${eventId}: ${totalCorrectAnswers} total correct answers`
      );

      return {
        totalCorrectAnswers,
        eventId,
        playerId,
      };
    } catch (error) {
      console.error("Error getting player event stats:", error);
      throw error;
    }
  }

  // Calculate player's total correct answers across the entire event
  static async calculateEventWideCorrectAnswers(
    playerId,
    eventId,
    bossSessionManager
  ) {
    try {
      let eventTotal = 0;
      const allSessions = bossSessionManager.getAllSessions();

      for (const [eventBossId, session] of allSessions) {
        if (session.eventId === eventId) {
          const player = session.players.get(playerId);
          if (player) {
            eventTotal += player.correctAnswers || 0;
          }
        }
      }

      console.log(
        `🧮 [CALCULATION] Player ${playerId} has ${eventTotal} total correct answers across event ${eventId}`
      );
      return eventTotal;
    } catch (error) {
      console.error("Error calculating event-wide correct answers:", error);
      return 0;
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
