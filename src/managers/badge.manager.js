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
    if (!this.playerBadges.has(playerId)) {
      this.playerBadges.set(playerId, []);
    }

    const playerBadges = await BadgeService.getAllPlayerBadges(playerId);
    playerBadges.forEach((badge) => {
      this.playerBadges.get(playerId).push(badge);
    });
  }

  async awardBadge(playerId, eventBossId, eventId, badgeCode) {
    const playerBadges = this.getPlayerBadges(playerId);
    const badge = this.getBadgeByCode(badgeCode);

    if (badge.type === "milestone" && this.hasEarnedMilestoneBadge(playerBadges, eventId, badge.code)) {
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
      if (
        this.hasEarnedAchievementBadge(
          playerBadges,
          eventId,
          eventBossId,
          badge.code
        )
      ) {
        const existingBadge = this.getPlayerBadge(
          playerId,
          eventId,
          eventBossId,
          badge.code
        );

        if (existingBadge) {
          existingBadge.earnCount++;
          existingBadge.lastEarnedAt = badgeData.lastEarnedAt;
        }
      } else {
        playerBadges.push({
          badgeId: badgeData.badgeId,
          badgeCode: badgeData.badgeCode,
          eventBossId: badgeData.eventBossId,
          eventId: badgeData.eventId,
          earnCount: 1,
          lastEarnedAt: badgeData.lastEarnedAt,
        });
      }
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
      this.playerBadges.set(playerId, []);
    }
    return this.playerBadges.get(playerId);
  }
}

export default BadgeManager;
