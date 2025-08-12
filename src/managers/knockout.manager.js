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

  getKnockedOutPlayerByRevivalCode(knockoutState, revivalCode) {
    const playerId = Array.from(knockoutState.knockedOutPlayers.keys()).find(
      (id) =>
        knockoutState.knockedOutPlayers.get(id).revivalCode === revivalCode
    );
    if (!playerId) {
      throw new Error(
        `Player with revival code ${revivalCode} not found in knockout session`
      );
    }
    return {
      playerId,
      ...knockoutState.knockedOutPlayers.get(playerId),
    };
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
      expiresAt: new Date(Date.now() + GAME_CONSTANTS.REVIVAL_TIMEOUT),
    });
    knockoutState.revivalCodes.add(revivalCode);
  }

  revivePlayer(battleSessionId, revivalCode) {
    const knockoutState = this.getKnockoutState(battleSessionId);
    const { knockedOutPlayerId, knockedOutPlayer } =
      this.getKnockedOutPlayerByRevivalCode(knockoutState, revivalCode);

    if (this.isRevivalCodeExpired(knockoutState, revivalCode)) {
      return {
        success: false,
        message: "Revival code has expired",
      };
    }

    knockedOutPlayer.isKnockedOut = false;
    knockoutState.knockedOutPlayers.delete(knockedOutPlayerId);
    knockoutState.revivalCodes.delete(revivalCode);

    return {
      success: true,
      message: "Player revived successfully",
    };
  }

  isRevivalCodeExpired(knockoutState, revivalCode) {
    const knockedOutPlayer = this.getKnockedOutPlayerByRevivalCode(
      knockoutState,
      revivalCode
    );
    return knockedOutPlayer.expiresAt <= Date.now();
  }

  handleRevivalTimeout(battleSessionId, revivalCode) {
    const knockoutState = this.getKnockoutState(battleSessionId);
    const knockedOutPlayerId = this.getKnockedOutPlayerByRevivalCode(
      knockoutState,
      revivalCode
    );
    if (!this.isRevivalCodeExpired(knockoutState, revivalCode)) {
      throw 
    }
    knockoutState.knockedOutPlayers.delete(knockedOutPlayerId);
    knockoutState.revivalCodes.delete(revivalCode);
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
