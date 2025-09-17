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
      throw new Error("Knockout session not found");
    }
    return this.knockoutStates.get(battleSessionId);
  }

  getKnockedOutPlayers(battleSessionId) {
    const knockoutState = this.getKnockoutState(battleSessionId);
    return Array.from(knockoutState.knockedOutPlayers.keys());
  }

  getKnockedOutPlayerById(battleSessionId, playerId) {
    const knockoutState = this.getKnockoutState(battleSessionId);
    if (!knockoutState.knockedOutPlayers.has(playerId)) {
      throw new Error(
        `Player with ID ${playerId} not found in knockout session`
      );
    }
    return knockoutState.knockedOutPlayers.get(playerId);
  }

  getKnockedOutPlayerByRevivalCode(battleSessionId, revivalCode) {
    const knockoutState = this.getKnockoutState(battleSessionId);
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
    const revivalCode = generateUniqueRevivalCode(
      battleSessionId,
      playerId,
      knockoutState.revivalCodes
    );
    knockoutState.knockedOutPlayers.set(playerId, {
      isKnockedOut: true,
      revivalCode,
      expiresAt: Date.now() + GAME_CONSTANTS.REVIVAL_TIMEOUT,
    });
    knockoutState.revivalCodes.add(revivalCode);
  }

  revivePlayer(battleSessionId, revivalCode) {
    const knockoutState = this.getKnockoutState(battleSessionId);
    const knockedOutPlayer = this.getKnockedOutPlayerByRevivalCode(
      battleSessionId,
      revivalCode
    );

    console.log("Knocked out player found for revival code:", knockedOutPlayer);
    let isRevived, reason;
    const isCodeExpired =
      knockedOutPlayer && this.isRevivalCodeExpired(battleSessionId, revivalCode);
    if (knockedOutPlayer && !isCodeExpired) {
      knockedOutPlayer.isKnockedOut = false;
      knockoutState.knockedOutPlayers.delete(knockedOutPlayer.id);
      knockoutState.revivalCodes.delete(revivalCode);
      isRevived = true;
      reason = null;
    } else {
      isRevived = false;
      reason = isCodeExpired ? GAME_CONSTANTS.REVIVAL_CODE.EXPIRED : GAME_CONSTANTS.REVIVAL_CODE.INVALID;
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
    return knockedOutPlayer.expiresAt <= Date.now();
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
      throw new Error("Revival code is not expired");
    }
    knockoutState.knockedOutPlayers.delete(knockedOutPlayer.id);
    knockoutState.revivalCodes.delete(knockedOutPlayer.revivalCode);
  }

  handleExpiredRevivalCodes(knockoutState) {
    const now = Date.now();
    for (const [playerId, playerData] of knockoutState.knockedOutPlayers) {
      if (playerData.expiresAt <= now) {
        knockoutState.knockedOutPlayers.delete(playerId);
        knockoutState.revivalCodes.delete(playerData.revivalCode);
      }
    }
  }
}

export default KnockoutManager;
