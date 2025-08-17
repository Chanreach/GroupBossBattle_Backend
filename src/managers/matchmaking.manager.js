import { GAME_CONSTANTS } from "../utils/game.constants";

class MatchmakingManager {
  constructor() {
    this.battleQueues = new Map();
  }

  createBattleQueue(eventBossId) {
    if (!this.battleQueues.has(eventBossId)) {
      this.battleQueues.set(eventBossId, []);
    }
  }

  addPlayerToQueue(eventBossId, playerInfo) {
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
      };
      this.getBattleQueue(eventBossId).push(player);
    }
    return this.getPlayerInfo(eventBossId, playerInfo.id);
  }

  removePlayerFromQueue(eventBossId, playerId) {
    const battleQueue = this.getBattleQueue(eventBossId);
    if (battleQueue) {
      const index = battleQueue.findIndex((player) => player.id === playerId);
      if (index !== -1) {
        battleQueue.splice(index, 1);
      }
    }
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
