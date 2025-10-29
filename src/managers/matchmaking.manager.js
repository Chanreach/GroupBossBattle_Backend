import battleSessionManager from "../managers/battle-session.manager.js";
import { GAME_CONSTANTS } from "../utils/game.constants.js";

class MatchmakingManager {
  constructor() {
    this.battleQueues = new Map();
  }

  createBattleQueue(eventBossId) {
    if (!this.battleQueues.has(eventBossId)) {
      this.battleQueues.set(eventBossId, []);
    }
  }

  async addPlayerToQueue(eventBossId, playerInfo, socketId) {
    const existingPlayer = this.getPlayerInfo(eventBossId, playerInfo.id);
    let player = existingPlayer;

    if (!existingPlayer) {
      if (this.isPlayerInAnyQueue(playerInfo.id)) {
        console.error("[MatchmakingManager] Player is already in another battle queue.");
        return null;
      }

      if (this.isNicknameTaken(eventBossId, playerInfo.nickname)) {
        console.error("[MatchmakingManager] Nickname is already taken.");
        return null;
      }

      player = {
        ...playerInfo,
        contextStatus: GAME_CONSTANTS.PLAYER.CONTEXT_STATUS.IN_QUEUE,
        battleState: null,
        socketId,
        isConnected: true,
      };
      this.getBattleQueue(eventBossId).push(player);

      if (this.isAbleToStartBattle(eventBossId)) {
        try {
          const battleSession = await battleSessionManager.createBattleSession(
            eventBossId
          );
          if (!battleSession) {
            console.error(
              "[MatchmakingManager] Failed to create battle session."
            );
            return null;
          }

          for (const player of this.getAllPlayers(eventBossId)) {
            const playerInfo = this.getPlayerInfo(eventBossId, player.id);
            if (!playerInfo) {
              console.error("[MatchmakingManager] Player not found.");
              return null;
            }

            const response =
              await battleSessionManager.addPlayerToBattleSession(
                eventBossId,
                playerInfo
              );
            if (!response) {
              console.error(
                "[MatchmakingManager] Failed to add player to battle session."
              );
              return null;
            }
          }

          const startedSession = await battleSessionManager.startBattleSession(
            eventBossId
          );
          if (!startedSession) {
            console.error(
              "[MatchmakingManager] Failed to start battle session."
            );
            return null;
          }

          const queueSize = this.getQueueSize(eventBossId);
          this.resetBattleQueue(eventBossId);
          player.contextStatus = GAME_CONSTANTS.PLAYER.CONTEXT_STATUS.IN_BATTLE;

          return {
            battleSessionId:
              battleSessionManager.getBattleSessionId(eventBossId),
            player,
            queueSize,
            isBattleStarted: true,
          };
        } catch (error) {
          console.error(
            "[MatchmakingManager] Error creating battle session:",
            error
          );
          throw error;
        }
      }
    }

    return {
      player,
      queueSize: this.getQueueSize(eventBossId),
      isBattleStarted: false,
    };
  }

  removePlayerFromQueue(eventBossId, playerId) {
    const playerInfo = this.getPlayerInfo(eventBossId, playerId);
    if (!playerInfo) {
      console.error("[MatchmakingManager] Player not found.");
      return null;
    }

    const battleQueue = this.getBattleQueue(eventBossId);
    if (battleQueue) {
      const index = battleQueue.findIndex((player) => player.id === playerId);
      if (index !== -1) {
        battleQueue.splice(index, 1);
      }
    }

    return {
      queueSize: this.getQueueSize(eventBossId),
      isBattleStarted: false,
    };
  }

  isNicknameTaken(eventBossId, nickname) {
    return this.getBattleQueue(eventBossId).some(
      (player) => player.nickname.toLowerCase() === nickname.toLowerCase()
    );
  }

  isPlayerInAnyQueue(playerId) {
    for (const battleQueue of this.battleQueues.values()) {
      if (battleQueue.some((player) => player.id === playerId)) {
        return true;
      }
    }
    return false;
  }

  getBattleQueue(eventBossId) {
    if (!this.battleQueues.has(eventBossId)) {
      this.createBattleQueue(eventBossId);
    }
    return this.battleQueues.get(eventBossId) || [];
  }

  getQueueSize(eventBossId) {
    return this.getBattleQueue(eventBossId).length;
  }

  getPlayerInfo(eventBossId, playerId) {
    return (
      this.getBattleQueue(eventBossId).find(
        (player) => player.id === playerId
      ) || null
    );
  }

  getAllPlayers(eventBossId) {
    return this.getBattleQueue(eventBossId);
  }

  isAbleToStartBattle(eventBossId) {
    return (
      this.getBattleQueue(eventBossId).length >=
      GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED
    );
  }

  resetBattleQueue(eventBossId) {
    this.battleQueues.delete(eventBossId);
  }
}

const matchmakingManager = new MatchmakingManager();
export default matchmakingManager;
