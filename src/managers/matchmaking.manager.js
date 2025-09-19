import { GAME_CONSTANTS } from "../utils/game.constants.js";
import battleSessionManager from "../managers/battle-session.manager.js";

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
    if (!existingPlayer) {
      if (this.isNicknameTaken(eventBossId, playerInfo.nickname)) {
        throw new Error("Nickname is already taken.");
      }
      const player = {
        id: playerInfo.id,
        username: playerInfo.username,
        nickname: playerInfo.nickname,
        isGuest: playerInfo.isGuest,
        contextStatus: GAME_CONSTANTS.PLAYER.CONTEXT_STATUS.IN_QUEUE,
        battleState: null,
        socketId,
        isConnected: true,
      };
      this.getBattleQueue(eventBossId).push(player);

      if (this.isAbleToStartBattle(eventBossId)) {
        try {
          await battleSessionManager.createBattleSession(eventBossId);

          for (const player of this.getAllPlayers(eventBossId)) {
            const playerInfo = this.getPlayerInfo(eventBossId, player.id);
            if (!playerInfo) {
              console.error("Player not found.");
              return;
            }
            await battleSessionManager.addPlayerToBattleSession(
              eventBossId,
              playerInfo
            );
          }

          await battleSessionManager.startBattleSession(eventBossId);
          const queueSize = this.getQueueSize(eventBossId);
          this.resetBattleQueue(eventBossId);

          return {
            playerInfo,
            queueSize,
            isBattleStarted: true,
          };
        } catch (error) {
          console.error("Error creating battle session:", error);
          throw error;
        }
      }
    }

    return {
      playerInfo: this.getPlayerInfo(eventBossId, playerInfo.id),
      queueSize: this.getQueueSize(eventBossId),
    };
  }

  removePlayerFromQueue(eventBossId, playerId) {
    const playerInfo = this.getPlayerInfo(eventBossId, playerId);
    if (!playerInfo) {
      console.error("Player not found.");
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
      (player) => player.nickname === nickname
    );
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
