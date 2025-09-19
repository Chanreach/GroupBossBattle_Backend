import BadgeService from "../services/badge.service.js";

class BadgeManager {
  constructor() {
    this.badges = new Map();
    this.playerBadges = new Map();
  }

  async initializeBadges() {
    const allBadges = await BadgeService.getAllBadges();
    allBadges.forEach((badge) => {
      this.badges.set(badge.code, badge);
    });
  }

  async initializePlayerBadges(playerId) {
    if (this.playerBadges.has(playerId)) {
      return;
    }

    this.playerBadges.set(playerId, []);
    const playerBadges = await BadgeService.getAllPlayerBadges(playerId);
    playerBadges.forEach((badge) => {
      this.playerBadges.get(playerId).push(badge);
    });
  }

  checkMilestoneEligibility(playerId, eventId, totalCorrectAnswers) {
    const milestones = this.getSortedMilestoneBadges();
    const playerBadges = this.getPlayerBadges(playerId);
    console.log("Player badges:", playerBadges);

    for (const milestone of milestones) {
      if (this.hasEarnedMilestoneBadge(playerBadges, eventId, milestone.code)) {
        continue;
      }
      if (totalCorrectAnswers >= milestone.threshold) {
        return milestone.code;
      }
    }
    return null;
  }

  async awardBadge(playerId, eventBossId, eventId, badgeCode) {
    const playerBadges = this.getPlayerBadges(playerId);
    const badge = this.getBadgeByCode(badgeCode);

    if (
      badge.type === "milestone" &&
      this.hasEarnedMilestoneBadge(playerBadges, eventId, badge.code)
    ) {
      throw new Error("Player has already earned this milestone badge.");
    }

    const badgeData = await BadgeService.awardBadge(
      playerId,
      badge.id,
      eventBossId,
      eventId,
      badge.type
    );

    if (badgeData) {
      const existingPlayerBadge = playerBadges.find(
        (badge) =>
          badge.eventId === badgeData.eventId &&
          badge.eventBossId === badgeData.eventBossId &&
          badge.badgeCode === badgeData.badgeCode
      );
      if (existingPlayerBadge) {
        existingPlayerBadge.earnCount = badgeData.earnCount;
        existingPlayerBadge.lastEarnedAt = badgeData.lastEarnedAt;
      } else {
        playerBadges.push(badgeData);
      }
    } else {
      throw new Error("Failed to award badge.");
    }

    return badgeData;
  }

  hasEarnedMilestoneBadge(playerBadges, eventId, milestoneCode) {
    return playerBadges.some(
      (badge) => badge.eventId === eventId && badge.badgeCode === milestoneCode
    );
  }

  hasEarnedAchievementBadge(
    playerBadges,
    eventId,
    eventBossId,
    achievementCode
  ) {
    return playerBadges.some(
      (badge) =>
        badge.eventId === eventId &&
        badge.eventBossId === eventBossId &&
        badge.badgeCode === achievementCode
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

  getSortedMilestoneBadges() {
    return this.getAllMilestoneBadges().sort(
      (a, b) => a.threshold - b.threshold
    );
  }

  getPlayerBadge(playerId, eventId, eventBossId, badgeCode) {
    const playerBadges = this.getPlayerBadges(playerId);
    return playerBadges.find(
      (badge) =>
        badge.eventId === eventId &&
        badge.eventBossId === eventBossId &&
        badge.badgeCode === badgeCode
    );
  }

  getBadgeByCode(badgeCode) {
    if (!this.badges.has(badgeCode)) {
      throw new Error(`Badge with code ${badgeCode} does not exist.`);
    }
    return this.badges.get(badgeCode);
  }

  getPlayerBadges(playerId) {
    if (!this.playerBadges.has(playerId)) {
      throw new Error(`Player with ID ${playerId} not found.`);
    }
    return this.playerBadges.get(playerId);
  }
}

const badgeManager = new BadgeManager();
await badgeManager.initializeBadges();
export default badgeManager;
