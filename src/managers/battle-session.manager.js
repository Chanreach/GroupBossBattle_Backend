import EventBossManager from "./event-boss.manager.js";
import TeamManager from "../managers/team.manager.js";
import QuestionManager from "../managers/question.manager.js";
import CombatManager from "../managers/combat.manager.js";
import KnockoutManager from "../managers/knockout.manager.js";
import BadgeManager from "../managers/badge.manager.js";
import LeaderboardManager from "./leaderboard.manager.js";
import { generateBattleSessionId } from "../utils/game.utils.js";
import { GAME_CONSTANTS } from "../utils/game.constants.js";

class BattleSessionManager {
  constructor() {
    this.eventBossManager = new EventBossManager();
    this.teamManager = new TeamManager();
    this.questionManager = new QuestionManager();
    this.combatManager = new CombatManager();
    this.knockoutManager = new KnockoutManager();
    this.badgeManager = new BadgeManager();
    this.leaderboardManager = new LeaderboardManager();
    this.battleSessions = new Map();
  }

  async createBattleSession(eventBossId) {
    const existingSession = this.battleSessions.get(eventBossId);
    if (existingSession) {
      return existingSession;
    }

    try {
      const battleSessionId = this.generateUniqueBattleSessionId(eventBossId);
      const battleSession = {
        id: battleSessionId,
        eventBoss: {},
        event: {},
        players: new Map(),
        teams: new Map(),
        questions: {
          bank: [],
          pools: new Map(),
        },
        combat: {
          playerStats: new Map(),
          teamStats: new Map(),
        },
        state: GAME_CONSTANTS.BATTLE_STATE.ACTIVE,
        startTime: null,
        endTime: null,
      };
      await this.eventBossManager.initializeEventBoss(
        battleSession,
        eventBossId
      );
      await this.questionManager.initializeQuestionBank(
        battleSession.questions.bank,
        eventBossId
      );

      this.battleSessions.set(eventBossId, battleSession);
      return battleSession;
    } catch (error) {
      throw error;
    }
  }

  addPlayerToBattleSession(eventBossId, playerInfo) {
    const battleSession = this.getBattleSession(eventBossId);
    const existingPlayer = this.findPlayerInBattleSession(
      eventBossId,
      playerInfo.id
    );
    if (existingPlayer) {
      throw new Error("Player already exists in the battle session");
    }

    if (this.isNicknameTaken(eventBossId, playerInfo.nickname)) {
      throw new Error("Nickname is already taken.");
    }

    const player = {
      ...playerInfo,
      teamId: null,
    };
    player.contextStatus = GAME_CONSTANTS.PLAYER.CONTEXT_STATUS.IN_BATTLE;
    player.battleState = GAME_CONSTANTS.PLAYER.BATTLE_STATE.ACTIVE;
    battleSession.players.set(player.id, player);

    if (this.isBattleSessionStarted(eventBossId)) {
      this.initializePlayerSession(eventBossId, player.id);
    }

    this.eventBossManager.updateEventBossHP(
      battleSession.eventBoss,
      battleSession.players.size
    );

    return {
      player,
      sessionSize: battleSession.players.size,
    };
  }

  removePlayerFromBattleSession(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    battleSession.players.delete(player.id);
  }

  async startBattleSession(eventBossId) {
    if (!this.canStartBattleSession(eventBossId)) {
      throw new Error("Cannot start battle session");
    }

    if (!this.isBattleSessionStarted(eventBossId)) {
      await this.initializeBattleSession(eventBossId);
    }
  }

  async initializeBattleSession(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    try {
      this.teamManager.createTeams(
        battleSession.teams,
        battleSession.id,
        battleSession.eventBoss.id,
        battleSession.eventBoss.numberOfTeams
      );

      for (const team of battleSession.teams.values()) {
        this.combatManager.initializeTeamStats(battleSession.combat, team.id);
      }
      for (const player of battleSession.players.values()) {
        this.initializePlayerSession(eventBossId, player.id);
      }

      await this.updateEventBossStatus(
        eventBossId,
        GAME_CONSTANTS.BOSS_STATUS.IN_BATTLE
      );
      this.knockoutManager.initializeKnockout(battleSession.id);
      this.leaderboardManager.initializeTeamLeaderboard(
        eventBossId,
        Array.from(battleSession.teams.values())
      );
      this.leaderboardManager.initializeIndividualLeaderboard(
        eventBossId,
        Array.from(battleSession.players.values())
      );

      battleSession.state = GAME_CONSTANTS.BATTLE_STATE.IN_PROGRESS;
      battleSession.startTime = Date.now();
    } catch (error) {
      console.error("Error initializing battle session:", error);
      throw error;
    }
  }

  initializePlayerSession(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    const teamId = this.teamManager.assignPlayerToTeam(
      battleSession.teams,
      battleSession.id,
      playerId
    );
    player.teamId = teamId;
    this.questionManager.prepareQuestionPoolForPlayer(
      battleSession.questions,
      battleSession.id,
      player.id
    );
    this.combatManager.initializePlayerStats(battleSession.combat, player.id);
  }

  addPlayerToLeaderboard(eventBossId, playerId) {
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    this.leaderboardManager.addPlayerToLeaderboard(eventBossId, player);
    return this.leaderboardManager.getLiveLeaderboard(eventBossId);
  }

  getNextQuestionForPlayer(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    return this.questionManager.getNextQuestion(
      battleSession.questions,
      battleSession.id,
      player.id
    );
  }

  getCurrentQuestionForPlayer(eventBossId, playerId) {
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    const questionPool = this.getQuestionPool(eventBossId, player.id);
    return this.questionManager.getCurrentQuestion(questionPool);
  }

  getCurrentQuestionNumberForPlayer(eventBossId, playerId) {
    const questionPool = this.getQuestionPool(eventBossId, playerId);
    return questionPool ? questionPool.currentIndex : 0;
  }

  async processPlayerAnswer(eventBossId, playerId, choiceIndex, responseTime) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    const question = this.getCurrentQuestionForPlayer(eventBossId, playerId);

    let answerResult;
    if (choiceIndex == -1 && responseTime == question.timeLimit) {
      answerResult = this.combatManager.processQuestionTimeout(
        battleSession.combat,
        battleSession.eventBoss,
        player.id,
        player.teamId
      );
    } else {
      const isCorrect = this.questionManager.validatePlayerAnswer(
        question,
        choiceIndex
      );
      answerResult = this.combatManager.processPlayerAttack(
        battleSession.combat,
        battleSession.eventBoss,
        player.id,
        player.teamId,
        isCorrect,
        responseTime,
        question.timeLimit
      );
    }

    if (answerResult.playerHearts <= 0) {
      player.battleState = GAME_CONSTANTS.PLAYER.BATTLE_STATE.KNOCKED_OUT;
      this.knockoutManager.addKnockedOutPlayer(battleSession.id, player.id);
    }

    this.leaderboardManager.updateLiveLeaderboard(eventBossId, player.id, {
      totalDamage: answerResult.damage,
      correctAnswers: answerResult.isCorrect ? 1 : 0,
      incorrectAnswers: answerResult.isCorrect ? 0 : 1,
      questionsAnswered: 1,
    });

    const isEventBossDefeated = this.isEventBossDefeated(eventBossId);
    if (isEventBossDefeated) {
      await this.handleEventBossDefeat(eventBossId);
    }

    return {
      answerResult,
      isEventBossDefeated,
      isPlayerKnockedOut: this.isPlayerKnockedOut(eventBossId, playerId),
    };
  }

  async handleEventBossDefeat(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    battleSession.state = GAME_CONSTANTS.BATTLE_STATE.ENDED;
    battleSession.endTime = Date.now();

    const eventBoss = this.getEventBoss(eventBossId);
    if (eventBoss.status !== GAME_CONSTANTS.BOSS_STATUS.COOLDOWN) {
      await this.updateEventBossStatus(
        eventBossId,
        GAME_CONSTANTS.BOSS_STATUS.COOLDOWN
      );
    }
    // this.battleSessions.delete(eventBossId);
  }

  async updateEventBossStatus(eventBossId, status) {
    const battleSession = this.getBattleSession(eventBossId);
    await this.eventBossManager.updateEventBossStatus(
      battleSession.eventBoss,
      status
    );
    return battleSession.eventBoss;
  }

  isPlayerKnockedOut(eventBossId, playerId) {
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    return (
      player.battleState === GAME_CONSTANTS.PLAYER.BATTLE_STATE.KNOCKED_OUT
    );
  }

  isPlayerDead(eventBossId, playerId) {
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    return player.battleState === GAME_CONSTANTS.PLAYER.BATTLE_STATE.DEAD;
  }

  getKnockedOutPlayerInfo(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    return this.isPlayerKnockedOut(eventBossId, playerId)
      ? this.knockoutManager.getKnockedOutPlayerById(
          battleSession.id,
          player.id
        )
      : null;
  }

  attemptPlayerRevival(eventBossId, reviverId, revivalCode) {
    const battleSession = this.getBattleSession(eventBossId);
    const reviver = this.getPlayerFromBattleSession(eventBossId, reviverId);

    if (this.isPlayerKnockedOut(eventBossId, reviver.id)) {
      throw new Error("You are not allowed to revive players.");
    }

    const response = this.knockoutManager.revivePlayer(
      battleSession.id,
      revivalCode
    );

    if (response.isRevived) {
      this.combatManager.restorePlayerHearts(
        battleSession.combat,
        response.knockedOutPlayerId
      );
      const knockedOutPlayer = this.getPlayerFromBattleSession(
        eventBossId,
        response.knockedOutPlayerId
      );
      knockedOutPlayer.battleState = GAME_CONSTANTS.PLAYER.BATTLE_STATE.ACTIVE;
    } else if (response.reason === GAME_CONSTANTS.REVIVAL_CODE.EXPIRED) {
      this.handleRevivalCodeExpiry(eventBossId, response.knockedOutPlayerId);
    }

    return response;
  }

  handleRevivalCodeExpiry(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);

    if (!this.isPlayerKnockedOut(eventBossId, player.id)) {
      throw new Error("Player is not knocked out.");
    }

    this.knockoutManager.handleRevivalTimeout(battleSession.id, player.id);
    player.battleState = GAME_CONSTANTS.PLAYER.BATTLE_STATE.DEAD;
  }

  getBattleLiveLeaderboard(eventBossId) {
    return this.leaderboardManager.getLiveLeaderboard(eventBossId);
  }

  getPreviewLiveLeaderboard(eventBossId) {
    return this.leaderboardManager.getComprehensiveLiveLeaderboard(eventBossId);
  }

  isEventBossDefeated(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    return this.eventBossManager.isEventBossDefeated(battleSession.eventBoss);
  }

  canStartBattleSession(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    return (
      battleSession &&
      battleSession.players.size >= GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED
    );
  }

  isBattleSessionStarted(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    return (
      battleSession &&
      battleSession.state === GAME_CONSTANTS.BATTLE_STATE.IN_PROGRESS
    );
  }

  reconnectPlayerToBattleSession(eventBossId, playerId, newSocketId) {
    const player = this.findPlayerInBattleSession(eventBossId, playerId);
    if (player) {
      player.socketId = newSocketId;
      player.isConnected = true;
    }
    return player;
  }

  getBattleSession(eventBossId) {
    if (!this.battleSessions.has(eventBossId)) {
      throw new Error("Battle session not found");
    }
    return this.battleSessions.get(eventBossId);
  }

  hasBattleSession(eventBossId) {
    return this.battleSessions.has(eventBossId);
  }

  findBattleSession(eventBossId) {
    return this.battleSessions.get(eventBossId) || null;
  }

  isBattleSessionInProgress(eventBossId) {
    const battleSession = this.battleSessions.get(eventBossId);
    return (
      battleSession &&
      battleSession.state === GAME_CONSTANTS.BATTLE_STATE.IN_PROGRESS
    );
  }

  canJoinMidGame(eventBossId) {
    const battleSession = this.findBattleSession(eventBossId);
    return (
      battleSession &&
      battleSession.state === GAME_CONSTANTS.BATTLE_STATE.IN_PROGRESS
    );
  }

  getBattleSessionSize(eventBossId) {
    const battleSession = this.battleSessions.get(eventBossId);
    return battleSession ? battleSession.players.size : 0;
  }

  getEventBoss(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    return battleSession.eventBoss;
  }

  getPlayerFromBattleSession(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession.players.has(playerId)) {
      throw new Error("Player not found in the battle session");
    }
    return battleSession.players.get(playerId);
  }

  findPlayerInBattleSession(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    return battleSession.players.get(playerId) || null;
  }

  getPlayerTeamInfo(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    const team = this.teamManager.getTeamOfPlayer(
      battleSession.teams,
      player.id
    );
    return {
      teamId: team.id,
      teamName: team.name,
    };
  }

  getQuestionPool(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    return battleSession.questions.pools.get(player.id) || null;
  }

  getPlayerHearts(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    return this.combatManager.getPlayerHearts(battleSession.combat, player.id);
  }

  generateUniqueBattleSessionId(eventBossId) {
    let uniqueId;
    do {
      uniqueId = generateBattleSessionId(eventBossId);
    } while (this.battleSessions.has(uniqueId));
    return uniqueId;
  }

  isNicknameTaken(eventBossId, nickname) {
    const battleSession = this.getBattleSession(eventBossId);

    for (const player of battleSession.players.values()) {
      if (player.nickname === nickname) {
        return true;
      }
    }
    return false;
  }

  deleteBattleSession(eventBossId) {
    this.battleSessions.delete(eventBossId);
  }
}

const battleSessionManager = new BattleSessionManager();
export default battleSessionManager;
