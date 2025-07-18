import { GAME_CONSTANTS } from "../utils/constants.js";

export class BadgeSystem {
  /**
   * Check and award milestone badges
   */
  static checkMilestoneBadges(playerSession, session) {
    const { MILESTONE_BADGES } = GAME_CONSTANTS;
    const currentMilestone =
      session.badges.answerMilestones.get(playerSession.playerId) || 0;
    const awardedBadges = [];

    for (const milestone of MILESTONE_BADGES) {
      if (
        playerSession.correctAnswers >= milestone &&
        currentMilestone < milestone
      ) {
        session.badges.answerMilestones.set(playerSession.playerId, milestone);
        playerSession.badges.add(`answers_${milestone}`);
        awardedBadges.push({
          type: "milestone",
          badge: `answers_${milestone}`,
          playerId: playerSession.playerId,
          milestone,
        });
      }
    }

    return awardedBadges;
  }

  /**
   * Award badges after boss defeat
   */
  static awardBadges(session, lastHitPlayer, winningTeam) {
    const { BADGE_TYPES } = GAME_CONSTANTS;
    const awardedBadges = {
      bossDefeated: [],
      lastHit: null,
      mvp: null,
    };

    // Boss Defeated Badge - all players on winning team
    if (winningTeam) {
      const winningTeamPlayers = Array.from(session.players.values()).filter(
        (p) => p.teamId === winningTeam
      );

      for (const player of winningTeamPlayers) {
        session.badges.bossDefeated.add(player.playerId);
        player.badges.add(BADGE_TYPES.BOSS_DEFEATED);
        awardedBadges.bossDefeated.push(player.playerId);
      }
    }

    // Last Hit Badge
    if (lastHitPlayer) {
      session.badges.lastHit = lastHitPlayer.playerId;
      lastHitPlayer.badges.add(BADGE_TYPES.LAST_HIT);
      awardedBadges.lastHit = lastHitPlayer.playerId;
    }

    // MVP Badge - player with highest damage
    const mvpPlayer = this.findMVPPlayer(session);
    if (mvpPlayer) {
      session.badges.mvp = mvpPlayer.playerId;
      mvpPlayer.badges.add(BADGE_TYPES.MVP);
      awardedBadges.mvp = mvpPlayer.playerId;
    }

    return awardedBadges;
  }

  /**
   * Find MVP player (highest damage dealer)
   */
  static findMVPPlayer(session) {
    let mvpPlayer = null;
    let maxDamage = 0;

    for (const [playerId, player] of session.players) {
      if (player.totalDamage > maxDamage) {
        maxDamage = player.totalDamage;
        mvpPlayer = player;
      }
    }

    return mvpPlayer;
  }

  /**
   * Check if player deserves hero badge (defeats all bosses in event)
   */
  static checkHeroBadge(playerId, eventId) {
    // This would need to integrate with your event system
    // For now, just a placeholder
    return false;
  }

  /**
   * Get player's badges
   */
  static getPlayerBadges(playerSession) {
    return Array.from(playerSession.badges);
  }

  /**
   * Initialize badge system for session
   */
  static initializeBadges() {
    return {
      bossDefeated: new Set(),
      lastHit: null,
      mvp: null,
      answerMilestones: new Map(), // Map<playerId, milestoneCount>
      hero: new Set(),
    };
  }
}
