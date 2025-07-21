/**
 * Badge System for Boss Battle Events
 * Handles badge definitions, validation, and awarding logic
 */

import Badge from "../models/badge.model.js";

// Badge name mappings (used to lookup database IDs)
export const BADGE_NAMES = {
  MVP: "MVP",
  LAST_HIT: "Last Hit",
  BOSS_DEFEATED: "Boss Defeated",
  MILESTONE_10: "10 Questions Milestone",
  MILESTONE_25: "25 Questions Milestone",
  MILESTONE_50: "50 Questions Milestone",
  MILESTONE_100: "100 Questions Milestone",
};

// Cache for badge IDs (loaded from database)
let BADGE_ID_CACHE = null;

/**
 * Load badge IDs from database and cache them
 */
async function loadBadgeIds() {
  if (BADGE_ID_CACHE) return BADGE_ID_CACHE;

  try {
    const badges = await Badge.findAll();
    BADGE_ID_CACHE = {};

    badges.forEach((badge) => {
      // Map badge names to their database IDs
      if (badge.name === BADGE_NAMES.MVP) BADGE_ID_CACHE.MVP = badge.id;
      else if (badge.name === BADGE_NAMES.LAST_HIT)
        BADGE_ID_CACHE.LAST_HIT = badge.id;
      else if (badge.name === BADGE_NAMES.BOSS_DEFEATED)
        BADGE_ID_CACHE.BOSS_DEFEATED = badge.id;
      else if (badge.name === BADGE_NAMES.MILESTONE_10)
        BADGE_ID_CACHE.MILESTONE_10 = badge.id;
      else if (badge.name === BADGE_NAMES.MILESTONE_25)
        BADGE_ID_CACHE.MILESTONE_25 = badge.id;
      else if (badge.name === BADGE_NAMES.MILESTONE_50)
        BADGE_ID_CACHE.MILESTONE_50 = badge.id;
      else if (badge.name === BADGE_NAMES.MILESTONE_100)
        BADGE_ID_CACHE.MILESTONE_100 = badge.id;
    });

    console.log("🎖️ Badge IDs loaded from database:", BADGE_ID_CACHE);
    return BADGE_ID_CACHE;
  } catch (error) {
    console.error("❌ Error loading badge IDs from database:", error);
    return null;
  }
}

// Badge definitions with icons and criteria
export const BADGE_DEFINITIONS = {
  // Battle Result Badges (awarded after boss defeat/battle end)
  MVP: {
    id: "mvp",
    name: "MVP",
    description: "Most Valuable Player - Top performer in the battle",
    icon: "👑",
    type: "battle_result",
    criteria: "Player with highest damage + accuracy score",
    trackingScope: "session", // per boss session only
  },
  LAST_HIT: {
    id: "last_hit",
    name: "Last Hit",
    description: "Delivered the final blow to defeat the boss",
    icon: "🎯",
    type: "battle_result",
    criteria: "Player who dealt the killing blow",
    trackingScope: "session", // per boss session only
  },
  BOSS_DEFEATED: {
    id: "boss_defeated",
    name: "Boss Defeated",
    description: "Participated in defeating a boss",
    icon: "🏆",
    type: "battle_result",
    criteria: "All players who participated in successful boss defeat",
    trackingScope: "session", // per boss session only
  },

  // Milestone Badges (awarded during battle for question milestones)
  MILESTONE_10: {
    id: "milestone_10",
    name: "10 Questions Milestone",
    description: "Answered 10 questions correctly",
    icon: "🥉",
    type: "milestone",
    criteria: "10 correct answers in event",
    trackingScope: "event", // per event (accumulative across sessions)
  },
  MILESTONE_25: {
    id: "milestone_25",
    name: "25 Questions Milestone",
    description: "Answered 25 questions correctly",
    icon: "🥈",
    type: "milestone",
    criteria: "25 correct answers in event",
    trackingScope: "event", // per event (accumulative across sessions)
  },
  MILESTONE_50: {
    id: "milestone_50",
    name: "50 Questions Milestone",
    description: "Answered 50 questions correctly",
    icon: "🥇",
    type: "milestone",
    criteria: "50 correct answers in event",
    trackingScope: "event", // per event (accumulative across sessions)
  },
  MILESTONE_100: {
    id: "milestone_100",
    name: "100 Questions Milestone",
    description: "Answered 100 questions correctly",
    icon: "💎",
    type: "milestone",
    criteria: "100 correct answers in event",
    trackingScope: "event", // per event (accumulative across sessions)
  },
};

// Milestone thresholds for easy checking
export const MILESTONE_THRESHOLDS = [10, 25, 50, 100];

/**
 * Badge Manager Class
 * Handles badge logic and validation
 */
export class BadgeManager {
  constructor() {
    this.sessionBadges = new Map(); // Track badges earned in current session
    this.eventMilestones = new Map(); // Track event milestone progress
  }

  /**
   * Initialize badge tracking for a session
   */
  initializeSession(sessionId, players) {
    // Only initialize if session doesn't exist
    if (!this.sessionBadges.has(sessionId)) {
      this.sessionBadges.set(sessionId, {
        players: new Map(),
        mvpCandidate: null,
        lastHitPlayer: null,
        bossDefeated: false,
      });
    }

    // Get existing session data
    const sessionData = this.sessionBadges.get(sessionId);

    // Add new players that aren't already tracked
    players.forEach((player) => {
      if (!sessionData.players.has(player.playerId)) {
        sessionData.players.set(player.playerId, {
          playerId: player.playerId,
          nickname: player.nickname,
          damage: 0,
          correctAnswers: 0,
          accuracy: 0,
          mvpScore: 0, // damage + accuracy weighted score
        });
      }
    });
  }

  /**
   * Update player performance metrics
   */
  updatePlayerPerformance(sessionId, playerId, metrics) {
    const sessionData = this.sessionBadges.get(sessionId);
    if (!sessionData) return;

    const playerData = sessionData.players.get(playerId);
    if (!playerData) return;

    // Update metrics
    Object.assign(playerData, metrics);

    // Calculate MVP score (weighted: 70% damage, 30% accuracy)
    playerData.mvpScore = playerData.damage * 0.7 + playerData.accuracy * 0.3;

    // Update MVP candidate
    if (
      !sessionData.mvpCandidate ||
      playerData.mvpScore > sessionData.mvpCandidate.mvpScore
    ) {
      sessionData.mvpCandidate = playerData;
    }

    console.log(`📊 Updated player ${playerId} performance:`, playerData);
  }

  /**
   * Record last hit (killing blow)
   */
  recordLastHit(sessionId, playerId, playerNickname) {
    const sessionData = this.sessionBadges.get(sessionId);
    if (!sessionData) return;

    sessionData.lastHitPlayer = {
      playerId,
      nickname: playerNickname,
    };

    console.log(
      `🎯 Last hit recorded for player ${playerId} (${playerNickname})`
    );
  }

  /**
   * Check for milestone badges during battle
   * Returns newly earned milestone badges
   */
  async checkMilestones(
    eventId,
    playerId,
    playerNickname,
    totalCorrectAnswers
  ) {
    const playerKey = `${eventId}_${playerId}`;
    const previousMilestones = this.eventMilestones.get(playerKey) || [];
    const newBadges = [];

    // Load badge IDs from database
    const badgeIds = await loadBadgeIds();
    if (!badgeIds) {
      console.error("❌ Failed to load badge IDs for milestone check");
      return [];
    }

    // Check each milestone threshold
    for (const threshold of MILESTONE_THRESHOLDS) {
      if (
        totalCorrectAnswers >= threshold &&
        !previousMilestones.includes(threshold)
      ) {
        // Get the correct badge ID and name from database
        let badgeId, badgeName, badgeIcon;

        if (threshold === 10) {
          badgeId = badgeIds.MILESTONE_10;
          badgeName = BADGE_NAMES.MILESTONE_10;
          badgeIcon = "🥉";
        } else if (threshold === 25) {
          badgeId = badgeIds.MILESTONE_25;
          badgeName = BADGE_NAMES.MILESTONE_25;
          badgeIcon = "🥈";
        } else if (threshold === 50) {
          badgeId = badgeIds.MILESTONE_50;
          badgeName = BADGE_NAMES.MILESTONE_50;
          badgeIcon = "🥇";
        } else if (threshold === 100) {
          badgeId = badgeIds.MILESTONE_100;
          badgeName = BADGE_NAMES.MILESTONE_100;
          badgeIcon = "💎";
        }

        if (badgeId) {
          newBadges.push({
            id: badgeId, // Use actual database ID
            name: badgeName,
            icon: badgeIcon,
            playerId,
            playerNickname,
            eventId,
            earnedAt: new Date(),
            milestone: threshold,
          });

          // Track that this milestone was earned
          previousMilestones.push(threshold);
        }
      }
    }

    // Update tracking
    if (newBadges.length > 0) {
      this.eventMilestones.set(playerKey, previousMilestones);
      console.log(
        `🏅 Player ${playerNickname} earned ${newBadges.length} milestone badges:`,
        newBadges.map((b) => b.name)
      );
    }

    return newBadges;
  }

  /**
   * Award battle result badges (called when boss is defeated)
   */
  async awardBattleResultBadges(
    sessionId,
    eventId,
    winningTeamPlayerIds = null
  ) {
    const sessionData = this.sessionBadges.get(sessionId);
    if (!sessionData) return [];

    // Load badge IDs from database
    const badgeIds = await loadBadgeIds();
    if (!badgeIds) {
      console.error("❌ Failed to load badge IDs from database");
      return [];
    }

    const badges = [];

    // MVP Badge
    if (sessionData.mvpCandidate) {
      badges.push({
        id: badgeIds.MVP, // Use actual database ID
        name: BADGE_NAMES.MVP,
        icon: "👑",
        playerId: sessionData.mvpCandidate.playerId,
        playerNickname: sessionData.mvpCandidate.nickname,
        eventId,
        sessionId,
        earnedAt: new Date(),
        metrics: {
          damage: sessionData.mvpCandidate.damage,
          accuracy: sessionData.mvpCandidate.accuracy,
          mvpScore: sessionData.mvpCandidate.mvpScore,
        },
      });
    }

    // Last Hit Badge
    if (sessionData.lastHitPlayer) {
      badges.push({
        id: badgeIds.LAST_HIT, // Use actual database ID
        name: BADGE_NAMES.LAST_HIT,
        icon: "🎯",
        playerId: sessionData.lastHitPlayer.playerId,
        playerNickname: sessionData.lastHitPlayer.nickname,
        eventId,
        sessionId,
        earnedAt: new Date(),
      });
    }

    // Boss Defeated Badge (only for winning team players)
    if (winningTeamPlayerIds && winningTeamPlayerIds.length > 0) {
      console.log(
        `🏅 Awarding Boss Defeated badges to winning team players: ${winningTeamPlayerIds.join(
          ", "
        )}`
      );

      sessionData.players.forEach((player) => {
        // Only award to players who are in the winning team
        if (winningTeamPlayerIds.includes(player.playerId)) {
          badges.push({
            id: badgeIds.BOSS_DEFEATED, // Use actual database ID
            name: BADGE_NAMES.BOSS_DEFEATED,
            icon: "🏆",
            playerId: player.playerId,
            playerNickname: player.nickname,
            eventId,
            sessionId,
            earnedAt: new Date(),
          });
          console.log(
            `🏅 Boss Defeated badge awarded to ${player.nickname} (${player.playerId})`
          );
        } else {
          console.log(
            `🚫 Boss Defeated badge NOT awarded to ${player.nickname} (not in winning team)`
          );
        }
      });
    } else {
      console.log(
        "🚫 No Boss Defeated badges awarded - no winning team specified"
      );
    }

    console.log(
      `🏆 Awarded ${badges.length} battle result badges for session ${sessionId}`
    );
    return badges;
  }

  /**
   * Get session stats for debugging
   */
  getSessionStats(sessionId) {
    return this.sessionBadges.get(sessionId);
  }

  /**
   * Clear session data (cleanup)
   */
  clearSession(sessionId) {
    this.sessionBadges.delete(sessionId);
  }
}

// Export singleton instance
export const badgeManager = new BadgeManager();

export default {
  BADGE_DEFINITIONS,
  MILESTONE_THRESHOLDS,
  BadgeManager,
  badgeManager,
};
