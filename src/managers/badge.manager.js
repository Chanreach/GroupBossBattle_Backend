import BadgeService from "../services/badge.service.js";
import EventBossService from "../services/event-boss.service.js";
import { GAME_CONSTANTS } from "../utils/game.constants.js";

class BadgeManager {
  constructor() {
    this.badges = new Map();
    this.playerBadges = new Map();
  }

  async initializeBadges() {
    const allBadges = await BadgeService.getAllBadges();
    if (!allBadges || allBadges.length === 0) return;

    allBadges.forEach((badge) => {
      this.badges.set(badge.code, badge);
    });
  }

  async initializePlayerBadges(playerId) {
    if (this.playerBadges.has(playerId)) return;

    this.playerBadges.set(playerId, []);
    const playerBadges = await BadgeService.getAllPlayerBadges(playerId);
    if (!playerBadges || playerBadges.length === 0) return;

    const playerBadge = this.playerBadges.get(playerId);
    playerBadges.forEach((badge) =>
      playerBadge.push({ ...badge, shouldAward: false })
    );
  }

  checkQuestionMilestoneEligibility(playerId, eventId, totalCorrectAnswers) {
    const milestones = this.getSortedQuestionMilestoneBadges();
    if (!milestones || milestones.length === 0) return null;

    const playerBadges = this.getPlayerBadges(playerId);
    if (!playerBadges) {
      return null;
    }

    for (const milestone of milestones) {
      if (this.hasEarnedBadge(playerBadges, eventId, null, milestone.code)) {
        continue;
      }
      if (totalCorrectAnswers >= milestone.threshold) {
        console.log(`Player ${playerId} is eligible for milestone badge ${milestone.code} with total correct answers: ${totalCorrectAnswers}`);
        return milestone.code;
      }
    }
    return null;
  }

  async checkHeroBadgeEligibility(playerId, eventId) {

    const bossDefeatedBadges = this.getAllPlayerBossDefeatBadges(
      playerId,
      eventId
    );
    if (!bossDefeatedBadges || bossDefeatedBadges.length === 0) {
      console.log("No boss defeated badges found.");
      return null;
    }

    const allEventBosses = await EventBossService.getAllEventBosses(eventId);
    if (!allEventBosses || allEventBosses.length === 0) {
      console.log("No event bosses found.");
      return null;
    }

    if (bossDefeatedBadges.length === allEventBosses.length) {
      const shouldAward = bossDefeatedBadges.some((badge) => badge.shouldAward);
      if (!shouldAward) {
        console.log("Hero badge already awarded.");
        return null;
      }
      console.log("Player is eligible for hero badge.");
      return GAME_CONSTANTS.BADGE_CODES.MILESTONE.HERO;
    }
    return null;
  }

  async awardBadge(playerId, eventBossId, eventId, badgeCode) {
    const playerBadges = this.getPlayerBadges(playerId);
    if (!playerBadges) {
      return null;
    }

    const badge = this.getBadgeByCode(badgeCode);
    if (!badge) {
      console.error("Badge not found.");
      return null;
    }

    if (this.hasEarnedBadge(playerBadges, eventId, eventBossId, badge.code)) {
      console.error("Player has already earned this badge.");
      return null;
    }

    const badgeData = await BadgeService.awardBadge(
      playerId,
      badge.id,
      eventBossId,
      eventId,
      badge.type
    );
    if (badgeData) {
      playerBadges.push({ ...badgeData, shouldAward: true });
    } else {
      console.error("Failed to award badge.");
      return null;
    }

    return badgeData;
  }

  hasEarnedBadge(playerBadges, eventId, eventBossId = null, badgeCode) {
    return playerBadges.some(
      (badge) =>
        badge.eventId === eventId &&
        badge.eventBossId === eventBossId &&
        badge.badgeCode === badgeCode
    );
  }

  getAllBadges() {
    return Array.from(this.badges.values());
  }

  getAllMilestoneBadges() {
    return Array.from(this.badges.values()).filter(
      (badge) => badge.type === "milestone"
    );
  }

  getSortedQuestionMilestoneBadges() {
    const milestones = this.getAllMilestoneBadges().filter(
      (badge) => badge.threshold !== null
    );
    return milestones.sort((a, b) => a.threshold - b.threshold);
  }

  getPlayerBadge(playerId, eventId, eventBossId = null, badgeCode) {
    const playerBadges = this.getPlayerBadges(playerId);
    if (!playerBadges) {
      return null;
    }

    return playerBadges.find(
      (badge) =>
        badge.eventId === eventId &&
        badge.eventBossId === eventBossId &&
        badge.badgeCode === badgeCode
    );
  }

  getAllPlayerBossDefeatBadges(playerId, eventId) {
    const playerBadges = this.getPlayerBadges(playerId);
    if (!playerBadges || playerBadges.length === 0) {
      return [];
    }

    return playerBadges.filter(
      (badge) =>
        badge.eventId === eventId &&
        badge.badgeCode === GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.BOSS_DEFEATED
    );
  }

  markPlayerBadgeAsAwarded(playerId, eventId, eventBossId = null, badgeCode) {
    const playerBadge = this.getPlayerBadge(
      playerId,
      eventId,
      eventBossId,
      badgeCode
    );
    if (!playerBadge) {
      console.error("Player badge not found.");
      return;
    }

    playerBadge.shouldAward = false;
  }

  getBadgeByCode(badgeCode) {
    if (!this.badges.has(badgeCode)) {
      console.error(`Badge with code ${badgeCode} does not exist.`);
      return null;
    }
    return this.badges.get(badgeCode);
  }

  getPlayerBadges(playerId) {
    if (!this.playerBadges.has(playerId)) {
      console.error(`Player with ID ${playerId} not found.`);
      return null;
    }
    return this.playerBadges.get(playerId);
  }
}

const badgeManager = new BadgeManager();
await badgeManager.initializeBadges();
export default badgeManager;
