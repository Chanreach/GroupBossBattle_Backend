import EventBossManager from "./event-boss.manager.js";
import TeamManager from "../managers/team.manager.js";
import QuestionManager from "../managers/question.manager.js";
import CombatManager from "../managers/combat.manager.js";
import KnockoutManager from "../managers/knockout.manager.js";
import badgeManager from "../managers/badge.manager.js";
import LeaderboardManager from "./leaderboard.manager.js";
import PlayerSessionService from "../services/player-session.service.js";
import { generateBattleSessionId } from "../utils/game.utils.js";
import { GAME_CONSTANTS } from "../utils/game.constants.js";

class BattleSessionManager {
  constructor() {
    this.eventBossManager = new EventBossManager();
    this.teamManager = new TeamManager();
    this.questionManager = new QuestionManager();
    this.combatManager = new CombatManager();
    this.knockoutManager = new KnockoutManager();
    this.leaderboardManager = new LeaderboardManager();
    this.badgeManager = badgeManager;
    this.battleSessions = new Map();
  }

  async createBattleSession(eventBossId) {
    const battleSessionId = this.getBattleSessionId(eventBossId);
    const existingSession = this.battleSessions.get(battleSessionId);
    if (existingSession && existingSession.state === GAME_CONSTANTS.BATTLE_STATE.ENDED) {
      this.deleteBattleSession(battleSessionId);
    }

    try {
      const newBattleSessionId = this.generateUniqueBattleSessionId(eventBossId);
      const battleSession = {
        id: newBattleSessionId,
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
        achievementAwards: {
          mvp: null,
          lastHit: null,
          winnerTeam: null,
        },
        startTime: null,
        endTime: null,
        podiumEndTime: null,
        cooldownEndTime: null,
      };

      await this.eventBossManager.initializeEventBoss(
        battleSession,
        eventBossId
      );
      await this.questionManager.initializeQuestionBank(
        battleSession.questions.bank,
        eventBossId
      );

      this.battleSessions.set(newBattleSessionId, battleSession);
      return battleSession;
    } catch (error) {
      throw error;
    }
  }

  async addPlayerToBattleSession(eventBossId, playerInfo) {
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
      await this.initializePlayerSession(eventBossId, player.id);
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
        await this.initializePlayerSession(eventBossId, player.id);
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

  async initializePlayerSession(eventBossId, playerId) {
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
    player.revivedCount = 0;

    const userId = player.isGuest ? null : player.id;
    const playerSession = await PlayerSessionService.createPlayerSession(
      userId,
      player.username,
      battleSession.event.id
    );
    player.playerSessionId = playerSession.id;

    await this.badgeManager.initializePlayerBadges(player.playerSessionId);

    const playerStats = await this.leaderboardManager.getPlayerStatsByEventId(
      player.id,
      battleSession.event.id
    );
    player.totalCorrectAnswers = playerStats
      ? playerStats.totalCorrectAnswers
      : 0;
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
    let badgeEarned = null;
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
        battleSession.achievementAwards,
        player.id,
        player.teamId,
        isCorrect,
        responseTime,
        question.timeLimit
      );
    }

    if (answerResult.isCorrect) {
      player.totalCorrectAnswers += 1;

      const badgeCode = this.badgeManager.checkMilestoneEligibility(
        player.playerSessionId,
        battleSession.event.id,
        player.totalCorrectAnswers
      );
      if (badgeCode) {
        await this.awardBadgeToPlayer(
          player.playerSessionId,
          eventBossId,
          battleSession.event.id,
          badgeCode
        );
        badgeEarned = this.badgeManager.getBadgeByCode(badgeCode);
      }
      console.log(`Player ${player.nickname} earned badge: ${badgeCode}`);
    }

    if (answerResult.playerHearts <= 0) {
      player.battleState = GAME_CONSTANTS.PLAYER.BATTLE_STATE.KNOCKED_OUT;
      this.knockoutManager.addKnockedOutPlayer(battleSession.id, player.id);
    }

    const playerStats = this.combatManager.getPlayerStats(
      battleSession.combat,
      player.id
    );
    const teamStats = this.combatManager.getTeamStats(
      battleSession.combat,
      player.teamId
    );
    this.leaderboardManager.updateLiveLeaderboard(
      eventBossId,
      player.id,
      playerStats,
      teamStats
    );

    const isEventBossDefeated = this.isEventBossDefeated(eventBossId);
    if (isEventBossDefeated) {
      await this.handleEventBossDefeat(eventBossId);
      await this.awardAchievementBadgesToAllPlayers(eventBossId);

      for (const player of battleSession.players.values()) {
        const playerStats = this.combatManager.getPlayerStats(
          battleSession.combat,
          player.id
        );
        await this.leaderboardManager.updateEventBossAllTimeLeaderboard(
          player.playerSessionId,
          eventBossId,
          {
            totalDamage: playerStats ? playerStats.totalDamage : 0,
            correctAnswers: playerStats ? playerStats.correctAnswers : 0,
            questionsAnswered: playerStats ? playerStats.questionsAnswered : 0,
          }
        );
      }
    }

    return {
      answerResult,
      isEventBossDefeated,
      isPlayerKnockedOut: this.isPlayerKnockedOut(eventBossId, playerId),
      badgeEarned,
    };
  }

  async handleEventBossDefeat(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    battleSession.state = GAME_CONSTANTS.BATTLE_STATE.ENDED;
    battleSession.endTime = Date.now();
    battleSession.podiumEndTime = Date.now() + GAME_CONSTANTS.PODIUM_COUNTDOWN;

    const eventBoss = this.getEventBoss(eventBossId);
    if (eventBoss.status !== GAME_CONSTANTS.BOSS_STATUS.COOLDOWN) {
      const updatedEventBoss = await this.updateEventBossStatus(
        eventBossId,
        GAME_CONSTANTS.BOSS_STATUS.COOLDOWN
      );
      battleSession.cooldownEndTime = updatedEventBoss.cooldownEndTime;
    }
  }

  async awardBadgeToPlayer(playerId, eventBossId, eventId, badgeCode) {
    return await this.badgeManager.awardBadge(
      playerId,
      eventBossId,
      eventId,
      badgeCode
    );
  }

  async awardAchievementBadgesToAllPlayers(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    const mvpPlayerId = this.findMVPPlayerId(battleSession);
    const winnerTeamId = this.findWinnerTeamId(battleSession);
    const lastHitPlayerId = this.findLastHitPlayerId(battleSession);
    for (const player of battleSession.players.values()) {
      if (player.id === mvpPlayerId) {
        await this.awardBadgeToPlayer(
          player.playerSessionId,
          eventBossId,
          battleSession.event.id,
          GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.MVP
        );
      }
      if (player.teamId === winnerTeamId) {
        await this.awardBadgeToPlayer(
          player.playerSessionId,
          eventBossId,
          battleSession.event.id,
          GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.TEAM_VICTORY
        );
      }
      if (player.id === lastHitPlayerId) {
        await this.awardBadgeToPlayer(
          player.playerSessionId,
          eventBossId,
          battleSession.event.id,
          GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.LAST_HIT
        );
      }
    }
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

  getKnockedOutPlayersByTeam(eventBossId, teamId) {
    const playerIds = this.getPlayersByTeam(eventBossId, teamId);
    let knockedOutPlayers = [];
    for (const playerId of playerIds) {
      const player = this.getPlayerFromBattleSession(eventBossId, playerId);
      if (this.isPlayerKnockedOut(eventBossId, player.id)) {
        knockedOutPlayers.push(player);
      }
    }
    return knockedOutPlayers;
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
      knockedOutPlayer.battleState = GAME_CONSTANTS.PLAYER.BATTLE_STATE.REVIVED;
      reviver.revivedCount += 1;
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

  findMVPPlayerId(battleSession) {
    let mvpPlayerId = null;
    let highestDamage = -1;
    let highestAccuracy = -1;
    let lastHitPlayerId = battleSession.achievementAwards.lastHit;
    for (const [playerId, stats] of battleSession.combat.playerStats) {
      const accuracy = stats.questionsAnswered
        ? stats.correctAnswers / stats.questionsAnswered
        : 0;
      if (
        stats.totalDamage > highestDamage ||
        (stats.totalDamage === highestDamage && accuracy > highestAccuracy) ||
        (stats.totalDamage === highestDamage &&
          accuracy === highestAccuracy &&
          playerId === lastHitPlayerId)
      ) {
        highestDamage = stats.totalDamage;
        highestAccuracy = accuracy;
        mvpPlayerId = playerId;
      }
    }
    battleSession.achievementAwards.mvp = mvpPlayerId;
    return mvpPlayerId;
  }

  findLastHitPlayerId(battleSession) {
    return battleSession.achievementAwards.lastHit;
  }

  findWinnerTeamId(battleSession) {
    let winnerTeamId = null;
    let highestDamage = -1;
    let highestAccuracy = -1;
    let lastHitPlayerTeamId = this.getPlayerFromBattleSession(
      battleSession.eventBoss.id,
      battleSession.achievementAwards.lastHit
    ).teamId;
    for (const [teamId, stats] of battleSession.combat.teamStats) {
      const accuracy = stats.questionsAnswered
        ? stats.correctAnswers / stats.questionsAnswered
        : 0;
      if (
        stats.totalDamage > highestDamage ||
        (stats.totalDamage === highestDamage && accuracy > highestAccuracy) ||
        (stats.totalDamage === highestDamage &&
          accuracy === highestAccuracy &&
          teamId === lastHitPlayerTeamId)
      ) {
        highestDamage = stats.totalDamage;
        winnerTeamId = teamId;
      }
    }
    battleSession.achievementAwards.winnerTeam = winnerTeamId;
    return winnerTeamId;
  }

  getMVPPlayerBadge(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    const mvpPlayerId = battleSession.achievementAwards.mvp;
    const mvpPlayer = this.getPlayerFromBattleSession(
      battleSession.eventBoss.id,
      mvpPlayerId
    );
    const mvpBadge = this.badgeManager.getBadgeByCode(
      GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.MVP
    );
    return {
      mvpPlayer,
      mvpBadge,
    };
  }

  getLastHitPlayerBadge(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    const lastHitPlayerId = battleSession.achievementAwards.lastHit;
    const lastHitPlayer = this.getPlayerFromBattleSession(
      battleSession.eventBoss.id,
      lastHitPlayerId
    );
    const lastHitBadge = this.badgeManager.getBadgeByCode(
      GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.LAST_HIT
    );
    return {
      lastHitPlayer,
      lastHitBadge,
    };
  }

  getWinnerTeamBadge(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    const winnerTeamId = battleSession.achievementAwards.winnerTeam;
    const winnerTeam = this.getTeamInfoById(
      battleSession.eventBoss.id,
      winnerTeamId
    );
    const teamVictoryBadge = this.badgeManager.getBadgeByCode(
      GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.TEAM_VICTORY
    );
    return {
      winnerTeam,
      teamVictoryBadge,
    };
  }

  getBattleLiveLeaderboard(eventBossId) {
    return this.leaderboardManager.getLiveLeaderboard(eventBossId);
  }

  async getPreviewLiveLeaderboard(eventBossId) {
    return await this.leaderboardManager.getComprehensiveLiveLeaderboard(
      eventBossId
    );
  }

  async getFinalizedLeaderboard(eventBossId) {
    return await this.leaderboardManager.getComprehensiveLiveLeaderboard(
      eventBossId
    );
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
    const battleSessionId = this.getBattleSessionId(eventBossId);
    if (!this.battleSessions.has(battleSessionId)) {
      throw new Error("Battle session not found");
    }
    return this.battleSessions.get(battleSessionId);
  }

  getBattleSessionId(eventBossId) {
    for (const battleSession of this.battleSessions.values()) {
      if (battleSession.eventBoss.id === eventBossId) {
        return battleSession.id;
      }
    }
    return null;
  }

  hasBattleSession(eventBossId) {
    const battleSessionId = this.getBattleSessionId(eventBossId);
    return this.battleSessions.has(battleSessionId);
  }

  findBattleSession(eventBossId) {
    const battleSessionId = this.getBattleSessionId(eventBossId);
    return this.battleSessions.get(battleSessionId) || null;
  }

  isBattleSessionInProgress(eventBossId) {
    const battleSession = this.findBattleSession(eventBossId);
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
    const battleSession = this.findBattleSession(eventBossId);
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

  getTeamInfoById(eventBossId, teamId) {
    const battleSession = this.getBattleSession(eventBossId);
    const team = this.teamManager.getTeamById(battleSession.teams, teamId);
    return {
      teamId: team.id,
      teamName: team.name,
    };
  }

  getPlayersByTeam(eventBossId, teamId) {
    const battleSession = this.getBattleSession(eventBossId);
    return this.teamManager.getPlayersInTeam(battleSession.teams, teamId);
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

  getPlayerBattleState(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    return player.battleState;
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

  deleteBattleSession(battleSessionId) {
    this.battleSessions.delete(battleSessionId);
  }
}

const battleSessionManager = new BattleSessionManager();
export default battleSessionManager;
