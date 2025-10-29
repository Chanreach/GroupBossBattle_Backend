import { GAME_CONSTANTS } from "../utils/game.constants.js";
import { generateUniqueRevivalCode } from "../utils/game.utils.js";

class KnockoutManager {
  constructor() {
    this.knockoutStates = new Map();
  }

  initializeKnockout(battleSessionId) {
    this.knockoutStates.set(battleSessionId, {
      knockedOutPlayers: new Map(),
      revivalCodes: new Set(),
    });
  }

  getKnockoutState(battleSessionId) {
    if (!this.knockoutStates.has(battleSessionId)) {
      console.error("Knockout session not found.");
      return null;
    }
    return this.knockoutStates.get(battleSessionId);
  }

  getKnockedOutPlayers(battleSessionId) {
    const knockoutState = this.getKnockoutState(battleSessionId);
    return knockoutState
      ? Array.from(knockoutState.knockedOutPlayers.keys())
      : [];
  }

  getKnockedOutPlayerById(battleSessionId, playerId) {
    const knockoutState = this.getKnockoutState(battleSessionId);
    if (!knockoutState?.knockedOutPlayers.has(playerId)) {
      console.error(
        `Player with ID ${playerId} not found in knockout session.`
      );
      return null;
    }
    return knockoutState.knockedOutPlayers.get(playerId);
  }

  getKnockedOutPlayerByRevivalCode(battleSessionId, revivalCode) {
    const knockoutState = this.getKnockoutState(battleSessionId);
    if (!knockoutState) {
      return null;
    }

    const knockedOutPlayerId = Array.from(
      knockoutState.knockedOutPlayers.keys()
    ).find(
      (id) =>
        knockoutState.knockedOutPlayers.get(id).revivalCode === revivalCode
    );
    return knockedOutPlayerId
      ? {
          id: knockedOutPlayerId,
          ...this.getKnockedOutPlayerById(battleSessionId, knockedOutPlayerId),
        }
      : null;
  }

  addKnockedOutPlayer(battleSessionId, playerId) {
    const knockoutState = this.getKnockoutState(battleSessionId);
    if (!knockoutState) {
      return null;
    }

    const revivalCode = generateUniqueRevivalCode(
      battleSessionId,
      playerId,
      knockoutState.revivalCodes
    );
    if (!revivalCode) {
      console.error("Failed to generate a unique revival code.");
      return null;
    }

    knockoutState.knockedOutPlayers.set(playerId, {
      isKnockedOut: true,
      revivalCode,
      revivalEndAt: Date.now() + GAME_CONSTANTS.REVIVAL_TIMEOUT,
      timeoutId: null,
    });
    knockoutState.revivalCodes.add(revivalCode);
    return knockoutState.knockedOutPlayers.get(playerId);
  }

  revivePlayer(battleSessionId, revivalCode) {
    const knockoutState = this.getKnockoutState(battleSessionId);
    const knockedOutPlayer = this.getKnockedOutPlayerByRevivalCode(
      battleSessionId,
      revivalCode
    );

    let isRevived, reason;
    const isCodeExpired =
      knockedOutPlayer &&
      this.isRevivalCodeExpired(battleSessionId, revivalCode);
    if (knockedOutPlayer && !isCodeExpired) {
      knockedOutPlayer.isKnockedOut = false;
      if (knockedOutPlayer.timeoutId) clearTimeout(knockedOutPlayer.timeoutId);
      knockoutState.knockedOutPlayers.delete(knockedOutPlayer.id);
      knockoutState.revivalCodes.delete(revivalCode);
      isRevived = true;
      reason = null;
    } else {
      isRevived = false;
      reason = isCodeExpired
        ? GAME_CONSTANTS.REVIVAL_CODE.EXPIRED
        : GAME_CONSTANTS.REVIVAL_CODE.INVALID;
    }

    return {
      isRevived,
      knockedOutPlayerId: knockedOutPlayer ? knockedOutPlayer.id : null,
      reason,
    };
  }

  isRevivalCodeExpired(battleSessionId, revivalCode) {
    const knockedOutPlayer = this.getKnockedOutPlayerByRevivalCode(
      battleSessionId,
      revivalCode
    );
    return knockedOutPlayer.revivalEndAt <= Date.now();
  }

  handleRevivalTimeout(battleSessionId, playerId) {
    const knockoutState = this.getKnockoutState(battleSessionId);
    const knockedOutPlayer = this.getKnockedOutPlayerById(
      battleSessionId,
      playerId
    );
    if (
      !this.isRevivalCodeExpired(battleSessionId, knockedOutPlayer.revivalCode)
    ) {
      console.error("Revival code is not expired.");
      return;
    }
    knockoutState.knockedOutPlayers.delete(knockedOutPlayer.id);
    knockoutState.revivalCodes.delete(knockedOutPlayer.revivalCode);
  }

  handleExpiredRevivalCodes(knockoutState) {
    const now = Date.now();
    for (const [playerId, playerData] of knockoutState.knockedOutPlayers) {
      if (playerData.revivalEndAt <= now) {
        knockoutState.knockedOutPlayers.delete(playerId);
        knockoutState.revivalCodes.delete(playerData.revivalCode);
      }
    }
  }

  removeKnockedOutPlayer(battleSessionId, playerId) {
    const knockoutState = this.getKnockoutState(battleSessionId);
    const knockedOutPlayer = this.getKnockedOutPlayerById(
      battleSessionId,
      playerId
    );
    if (!knockedOutPlayer) return;

    knockoutState.knockedOutPlayers.delete(playerId);
    knockoutState.revivalCodes.delete(knockedOutPlayer.revivalCode);
  }
}

export default KnockoutManager;
