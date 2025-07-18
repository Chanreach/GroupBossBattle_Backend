import { GAME_CONSTANTS } from "../utils/constants.js";

export class RevivalSystem {
  /**
   * Generate a unique revival code
   */
  static generateRevivalCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /**
   * Knock out player and generate revival code
   */
  static knockOutPlayer(playerSession, session) {
    const { PLAYER_STATUSES, REVIVAL_TIMEOUT } = GAME_CONSTANTS;

    playerSession.status = PLAYER_STATUSES.KNOCKED_OUT;
    session.knockedOutPlayers.add(playerSession.playerId);

    // Generate revival code
    const revivalCode = this.generateRevivalCode();
    const expiresAt = new Date(Date.now() + REVIVAL_TIMEOUT);

    session.revivalCodes.set(playerSession.playerId, {
      code: revivalCode,
      expiresAt,
    });

    playerSession.revivalCode = revivalCode;

    return {
      playerId: playerSession.playerId,
      teamId: playerSession.teamId,
      revivalCode,
      expiresAt,
      timeout: REVIVAL_TIMEOUT,
    };
  }

  /**
   * Attempt to revive a knocked out player
   */
  static revivePlayer(reviverSession, targetSession, session, revivalCode) {
    const { PLAYER_STATUSES, PLAYER_STARTING_HEARTS } = GAME_CONSTANTS;

    // Validate revival attempt
    const validation = this.validateRevivalAttempt(
      reviverSession,
      targetSession,
      session,
      revivalCode
    );
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Revive player
    targetSession.status = PLAYER_STATUSES.ACTIVE;
    targetSession.hearts = PLAYER_STARTING_HEARTS;
    targetSession.revivalCode = null;

    session.knockedOutPlayers.delete(targetSession.playerId);
    session.revivalCodes.delete(targetSession.playerId);

    return {
      success: true,
      message: "Player revived successfully",
      reviverPlayerId: reviverSession.playerId,
      targetPlayerId: targetSession.playerId,
      teamId: targetSession.teamId,
    };
  }

  /**
   * Validate revival attempt
   */
  static validateRevivalAttempt(
    reviverSession,
    targetSession,
    session,
    revivalCode
  ) {
    const { PLAYER_STATUSES, BOSS_STATUSES } = GAME_CONSTANTS;

    if (!reviverSession || !targetSession) {
      return { valid: false, error: "Player session not found" };
    }

    if (reviverSession.bossId !== targetSession.bossId) {
      return { valid: false, error: "Players not in same boss fight" };
    }

    if (!session || session.status !== BOSS_STATUSES.ACTIVE) {
      return { valid: false, error: "Boss fight not active" };
    }

    if (reviverSession.status !== PLAYER_STATUSES.ACTIVE) {
      return { valid: false, error: "Reviver must be active" };
    }

    if (targetSession.status !== PLAYER_STATUSES.KNOCKED_OUT) {
      return { valid: false, error: "Target player is not knocked out" };
    }

    // Check revival code
    const storedRevival = session.revivalCodes.get(targetSession.playerId);
    if (!storedRevival || storedRevival.code !== revivalCode) {
      return { valid: false, error: "Invalid revival code" };
    }

    if (new Date() > storedRevival.expiresAt) {
      return { valid: false, error: "Revival code expired" };
    }

    return { valid: true };
  }

  /**
   * Handle revival timeout
   */
  static handleRevivalTimeout(playerSession, session) {
    const { PLAYER_STATUSES } = GAME_CONSTANTS;

    if (playerSession.status === PLAYER_STATUSES.KNOCKED_OUT) {
      // Remove player from current fight but keep their progress
      session.revivalCodes.delete(playerSession.playerId);
      session.knockedOutPlayers.delete(playerSession.playerId);
      playerSession.revivalCode = null;

      return {
        expired: true,
        playerId: playerSession.playerId,
        sessionId: session.sessionId,
      };
    }

    return { expired: false };
  }

  /**
   * Get revival status for a player
   */
  static getRevivalStatus(playerSession, session) {
    const { PLAYER_STATUSES } = GAME_CONSTANTS;

    if (playerSession.status !== PLAYER_STATUSES.KNOCKED_OUT) {
      return { needsRevival: false };
    }

    const revivalInfo = session.revivalCodes.get(playerSession.playerId);
    if (!revivalInfo) {
      return { needsRevival: false };
    }

    const timeRemaining = revivalInfo.expiresAt - new Date();
    const expired = timeRemaining <= 0;

    return {
      needsRevival: true,
      revivalCode: revivalInfo.code,
      expiresAt: revivalInfo.expiresAt,
      timeRemaining: Math.max(0, timeRemaining),
      expired,
    };
  }

  /**
   * Get all teammates who can revive a player
   */
  static getAvailableRevivers(targetSession, session) {
    const { PLAYER_STATUSES } = GAME_CONSTANTS;

    return Array.from(session.players.values())
      .filter(
        (player) =>
          player.teamId === targetSession.teamId &&
          player.status === PLAYER_STATUSES.ACTIVE &&
          player.playerId !== targetSession.playerId
      )
      .map((player) => ({
        playerId: player.playerId,
        nickname: player.nickname,
        hearts: player.hearts,
      }));
  }

  /**
   * Clean up expired revival codes
   */
  static cleanupExpiredRevivals(session) {
    const now = new Date();
    const expiredPlayers = [];

    for (const [playerId, revivalInfo] of session.revivalCodes) {
      if (now > revivalInfo.expiresAt) {
        session.revivalCodes.delete(playerId);
        session.knockedOutPlayers.delete(playerId);
        expiredPlayers.push(playerId);
      }
    }

    return expiredPlayers;
  }
}
