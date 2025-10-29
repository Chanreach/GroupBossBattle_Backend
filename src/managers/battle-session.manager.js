import eventManager from "./event.manager.js";
import EventBossManager from "./event-boss.manager.js";
import TeamManager from "../managers/team.manager.js";
import QuestionManager from "../managers/question.manager.js";
import CombatManager from "../managers/combat.manager.js";
import KnockoutManager from "../managers/knockout.manager.js";
import badgeManager from "../managers/badge.manager.js";
import leaderboardManager from "./leaderboard.manager.js";
import EventBossService from "../services/event-boss.service.js";
import { generateBattleSessionId, compareScores } from "../utils/game.utils.js";
import { SOCKET_EVENTS, SOCKET_ROOMS } from "../utils/socket.constants.js";
import { GAME_CONSTANTS } from "../utils/game.constants.js";

class BattleSessionManager {
  constructor() {
    this.eventBossManager = new EventBossManager();
    this.teamManager = new TeamManager();
    this.questionManager = new QuestionManager();
    this.combatManager = new CombatManager();
    this.knockoutManager = new KnockoutManager();
    this.leaderboardManager = leaderboardManager;
    this.badgeManager = badgeManager;
    this.battleSessions = new Map();
  }

  async createBattleSession(eventBossId) {
    const eventBoss = await EventBossService.getEventBossById(eventBossId);
    if (!eventBoss) {
      console.error(
        "[BattleSessionManager] Cannot create battle session. Event boss not found."
      );
      return null;
    }

    const eventStatus = this.getEventStatus(eventBoss.eventId);
    if (eventStatus !== GAME_CONSTANTS.EVENT_STATUS.ONGOING) {
      console.error(
        "[BattleSessionManager] Cannot create battle session. Event is not ongoing."
      );
      return null;
    }

    const existingSession = this.findBattleSession(eventBossId);
    if (existingSession?.state === GAME_CONSTANTS.BATTLE_STATE.ENDED) {
      this.deleteBattleSession(existingSession.id);
    }

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
      startAt: null,
      endAt: null,
      podiumEndAt: null,
      cooldownEndAt: null,
    };

    const eventBossInit = await this.eventBossManager.initializeEventBoss(
      battleSession,
      eventBossId
    );
    if (!eventBossInit) {
      console.error("[BattleSessionManager] Failed to initialize event boss.");
      return null;
    }

    const questionsInit = await this.questionManager.initializeQuestionBank(
      battleSession.questions.bank,
      eventBossId
    );
    if (!questionsInit) {
      console.error(
        "[BattleSessionManager] Failed to initialize question bank."
      );
      return null;
    }

    this.battleSessions.set(newBattleSessionId, battleSession);
    return battleSession;
  }

  async initializeBattleSession(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession) return null;

    const teamsCreated = this.teamManager.createTeams(
      battleSession.teams,
      battleSession.id,
      battleSession.eventBoss.id,
      battleSession.eventBoss.numberOfTeams
    );
    if (!teamsCreated) {
      console.error(
        "[BattleSessionManager] Failed to create teams for battle session."
      );
      return null;
    }

    for (const team of battleSession.teams.values()) {
      this.combatManager.initializeTeamStats(battleSession.combat, team.id);
    }
    for (const player of battleSession.players.values()) {
      const playerInit = await this.initializePlayerSession(
        eventBossId,
        player.id
      );
      if (!playerInit) {
        console.error(
          "[BattleSessionManager] Failed to initialize player session."
        );
        return null;
      }
    }

    const updatedEventBoss = await this.updateEventBossStatus(
      eventBossId,
      GAME_CONSTANTS.BOSS_STATUS.IN_BATTLE
    );
    if (!updatedEventBoss) {
      console.error(
        "[BattleSessionManager] Failed to update event boss status."
      );
      return null;
    }

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
    battleSession.startAt = Date.now();
    return battleSession;
  }

  async startBattleSession(eventBossId) {
    if (!this.canStartBattleSession(eventBossId)) {
      console.error("[BattleSessionManager] Cannot start battle session.");
      return null;
    }

    if (!this.isBattleSessionStarted(eventBossId)) {
      const battleSessionInit = await this.initializeBattleSession(eventBossId);
      if (!battleSessionInit) {
        console.error(
          "[BattleSessionManager] Failed to initialize battle session."
        );
        return null;
      }
    }

    return this.getBattleSession(eventBossId);
  }

  async addPlayerToBattleSession(eventBossId, playerInfo) {
    if (this.isPlayerInAnyBattleSession(playerInfo.id)) {
      console.error(
        "[BattleSessionManager] Player is already in another active battle session."
      );
      return null;
    }

    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession) return null;

    const eventStatus = this.getEventStatus(battleSession.event.id);
    if (eventStatus !== GAME_CONSTANTS.EVENT_STATUS.ONGOING) {
      console.error(
        "[BattleSessionManager] Cannot add player. Event is not ongoing."
      );
      return null;
    }

    const existingPlayer = this.findPlayerFromBattleSession(
      eventBossId,
      playerInfo.id
    );
    if (existingPlayer) {
      if (
        existingPlayer.battleState === GAME_CONSTANTS.PLAYER.BATTLE_STATE.DEAD
      ) {
        const removedPlayer = this.removePlayerFromBattleSession(
          eventBossId,
          playerInfo.id
        );
        if (!removedPlayer) {
          console.error(
            "[BattleSessionManager] Failed to remove existing player from battle session."
          );
          return null;
        }
      } else {
        console.error(
          "[BattleSessionManager] Player is already in the battle session."
        );
        return null;
      }
    }

    if (this.isNicknameTaken(eventBossId, playerInfo.nickname)) {
      console.error(
        "[BattleSessionManager] Nickname already taken in this battle session."
      );
      return null;
    }

    const player = {
      ...playerInfo,
      teamId: null,
    };
    player.contextStatus = GAME_CONSTANTS.PLAYER.CONTEXT_STATUS.IN_BATTLE;
    player.battleState = GAME_CONSTANTS.PLAYER.BATTLE_STATE.ACTIVE;
    battleSession.players.set(player.id, player);

    if (this.isBattleSessionStarted(eventBossId)) {
      const playerInit = await this.initializePlayerSession(
        eventBossId,
        player.id
      );
      if (!playerInit) {
        console.error(
          "[BattleSessionManager] Failed to initialize player session."
        );
        return null;
      }
    }

    const updatedEventBoss = this.eventBossManager.updateEventBossHP(
      battleSession.eventBoss,
      battleSession.players.size
    );
    if (!updatedEventBoss) {
      console.error("[BattleSessionManager] Failed to update event boss HP.");
      return null;
    }

    return {
      battleSessionId: battleSession.id,
      player,
      sessionSize: battleSession.players.size,
    };
  }

  removePlayerFromBattleSession(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    if (!battleSession || !player) return null;

    battleSession.players.delete(player.id);
    this.teamManager.removePlayerFromTeam(battleSession.teams, player.id);
    return player;
  }

  async initializePlayerSession(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    if (!battleSession || !player) return null;

    const teamId = this.teamManager.assignPlayerToTeam(
      battleSession.teams,
      battleSession.id,
      playerId
    );
    if (!teamId) {
      console.error(
        "[BattleSessionManager] Failed to assign player to a team."
      );
      return null;
    }
    player.teamId = teamId;

    const questionPool = this.questionManager.prepareQuestionPoolForPlayer(
      battleSession.questions,
      battleSession.id,
      player.id
    );
    if (!questionPool) {
      console.error(
        "[BattleSessionManager] Failed to prepare question pool for player."
      );
      return null;
    }

    this.combatManager.initializePlayerStats(battleSession.combat, player.id);
    player.revivedCount = 0;

    await this.badgeManager.initializePlayerBadges(player.id);

    const playerStats = await this.leaderboardManager.getPlayerStatsByEventId(
      player.id,
      battleSession.event.id
    );
    player.totalCorrectAnswers = playerStats?.totalCorrectAnswers ?? 0;
    return player;
  }

  addPlayerToLeaderboard(eventBossId, playerId) {
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    if (!player) {
      console.error(
        "[BattleSessionManager] Player not found in battle session."
      );
      return null;
    }

    this.leaderboardManager.addPlayerToLeaderboard(eventBossId, player);
    return this.leaderboardManager.getLiveLeaderboard(eventBossId);
  }

  getNextQuestionForPlayer(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    if (!battleSession || !player) return null;

    return this.questionManager.getNextQuestion(
      battleSession.questions,
      battleSession.id,
      player.id
    );
  }

  getCurrentQuestionForPlayer(eventBossId, playerId) {
    const questionPool = this.getQuestionPool(eventBossId, playerId);
    return this.questionManager.getCurrentQuestion(questionPool);
  }

  getCurrentQuestionNumberForPlayer(eventBossId, playerId) {
    const questionPool = this.getQuestionPool(eventBossId, playerId);
    return questionPool?.currentIndex ?? 0;
  }

  async processPlayerAnswer(eventBossId, playerId, choiceIndex, responseTime) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    if (!battleSession || !player) return null;

    const question = this.getCurrentQuestionForPlayer(eventBossId, playerId);
    if (!question) {
      console.error("[BattleSessionManager] No current question for player.");
      return null;
    }

    let answerResult;
    const playerBadge = {
      player,
      badge: null,
    };
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
      if (isCorrect === null) {
        console.error(
          "[BattleSessionManager] Failed to validate player answer."
        );
        return null;
      }

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
    if (!answerResult) {
      console.error("[BattleSessionManager] Failed to process player answer.");
      return null;
    }

    if (answerResult.isCorrect) {
      player.totalCorrectAnswers += 1;

      const badgeCode = this.badgeManager.checkQuestionMilestoneEligibility(
        player.id,
        battleSession.event.id,
        player.totalCorrectAnswers
      );
      if (badgeCode) {
        const badge = await this.awardBadgeToPlayer(
          player.id,
          eventBossId,
          battleSession.event.id,
          badgeCode
        );
        if (badge) {
          playerBadge.badge = this.badgeManager.getBadgeByCode(badgeCode);
        }
      }
    }

    if (answerResult.playerHearts <= 0) {
      player.battleState = GAME_CONSTANTS.PLAYER.BATTLE_STATE.KNOCKED_OUT;
      this.knockoutManager.addKnockedOutPlayer(battleSession.id, player.id);
    }

    this.updateBattleLiveLeaderboard(eventBossId, player.id);

    const isEventBossDefeated = this.isEventBossDefeated(eventBossId);
    if (isEventBossDefeated) {
      const finalizedSession = await this.finalizeBattleSessionEnd(eventBossId);
      if (!finalizedSession) {
        console.error(
          "[BattleSessionManager] Failed to finalize battle session end."
        );
        return null;
      }
    }

    return {
      answerResult,
      isEventBossDefeated,
      isPlayerKnockedOut: this.isPlayerKnockedOut(eventBossId, playerId),
      playerBadge,
    };
  }

  updateBattleLiveLeaderboard(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    if (!battleSession || !player) return;

    const playerStats = this.combatManager.getPlayerStats(
      battleSession.combat,
      player.id
    );
    const teamStats = this.combatManager.getTeamStats(
      battleSession.combat,
      player.teamId
    );
    if (!playerStats || !teamStats) return;

    playerStats.revivedCount = player.revivedCount;

    this.leaderboardManager.updateLiveLeaderboard(
      eventBossId,
      player.id,
      playerStats,
      teamStats
    );
  }

  async finalizeBattleSessionEnd(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession) return null;

    battleSession.state = GAME_CONSTANTS.BATTLE_STATE.ENDED;
    battleSession.endAt = Date.now();
    battleSession.podiumEndAt =
      Date.now() + GAME_CONSTANTS.PODIUM_COUNTDOWN + 1000;

    const eventBoss = battleSession.eventBoss;
    if (!eventBoss) {
      console.error("[BattleSessionManager] Event boss not found.");
      return null;
    }

    const eventStatus = this.getEventStatus(battleSession.event.id);
    if (!eventStatus) return null;

    if (eventBoss.status !== GAME_CONSTANTS.BOSS_STATUS.COOLDOWN) {
      const status =
        eventStatus === GAME_CONSTANTS.EVENT_STATUS.COMPLETED
          ? GAME_CONSTANTS.BOSS_STATUS.PENDING
          : GAME_CONSTANTS.BOSS_STATUS.COOLDOWN;

      const updatedEventBoss = await this.updateEventBossStatus(
        eventBossId,
        status
      );
      if (!updatedEventBoss) {
        console.error(
          `[BattleSessionManager] Failed to update event boss status to ${status}`
        );
        return null;
      }

      if (status === GAME_CONSTANTS.BOSS_STATUS.COOLDOWN) {
        battleSession.cooldownEndAt = updatedEventBoss.cooldownEndAt;
      }
    }

    for (const player of battleSession.players.values()) {
      player.contextStatus = GAME_CONSTANTS.PLAYER.CONTEXT_STATUS.IN_PODIUM;
    }

    await this.awardAchievementBadgesToAllPlayers(eventBossId);
    await this.awardHeroBadgesToEligiblePlayers(eventBossId);

    for (const player of battleSession.players.values()) {
      const playerStats = this.combatManager.getPlayerStats(
        battleSession.combat,
        player.id
      );

      await this.leaderboardManager.updateEventBossAllTimeLeaderboard(
        player.id,
        battleSession.event.id,
        eventBossId,
        {
          totalDamage: playerStats ? playerStats.totalDamage : 0,
          correctAnswers: playerStats ? playerStats.correctAnswers : 0,
          questionsAnswered: playerStats ? playerStats.questionsAnswered : 0,
        }
      );
    }

    return battleSession;
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
    if (!battleSession) return null;

    if (battleSession.state !== GAME_CONSTANTS.BATTLE_STATE.ENDED) {
      console.error("[BattleSessionManager] Battle session is not ended.");
      return null;
    }

    const mvpPlayerId = this.findMVPPlayerId(battleSession);
    const winnerTeamId = this.findWinnerTeamId(battleSession);
    const lastHitPlayerId = this.findLastHitPlayerId(battleSession);
    for (const player of battleSession.players.values()) {
      if (player.id === mvpPlayerId) {
        await this.awardBadgeToPlayer(
          player.id,
          eventBossId,
          battleSession.event.id,
          GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.MVP
        );
      }
      if (player.teamId === winnerTeamId) {
        await this.awardBadgeToPlayer(
          player.id,
          eventBossId,
          battleSession.event.id,
          GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.BOSS_DEFEATED
        );
      }
      if (player.id === lastHitPlayerId) {
        await this.awardBadgeToPlayer(
          player.id,
          eventBossId,
          battleSession.event.id,
          GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.LAST_HIT
        );
      }
    }
  }

  async awardHeroBadgesToEligiblePlayers(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession) return null;

    if (battleSession.state !== GAME_CONSTANTS.BATTLE_STATE.ENDED) {
      console.error("[BattleSessionManager] Battle session is not ended.");
      return null;
    }

    for (const player of battleSession.players.values()) {
      const badgeCode = await this.badgeManager.checkHeroBadgeEligibility(
        player.id,
        battleSession.event.id
      );
      if (badgeCode) {
        await this.awardBadgeToPlayer(
          player.id,
          eventBossId,
          battleSession.event.id,
          badgeCode
        );
      }
    }
  }

  async updateEventBossStatus(eventBossId, status) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession) return null;

    const updatedEventBoss = await this.eventBossManager.updateEventBossStatus(
      battleSession.eventBoss,
      status
    );
    return updatedEventBoss;
  }

  isPlayerKnockedOut(eventBossId, playerId) {
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    if (!player) return null;

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
    if (!battleSession || !player) return null;

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
      this.updateBattleLiveLeaderboard(eventBossId, reviver.id);
    } else if (response.reason === GAME_CONSTANTS.REVIVAL_CODE.EXPIRED) {
      this.handleRevivalCodeExpiry(eventBossId, response.knockedOutPlayerId);
    }

    return response;
  }

  handleRevivalCodeExpiry(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    if (!battleSession || !player) return;

    if (!this.isPlayerKnockedOut(eventBossId, player.id)) {
      console.error(
        "[BattleSessionManager] Cannot handle revival code expiry. Player is not knocked out."
      );
      return;
    }

    this.knockoutManager.handleRevivalTimeout(battleSession.id, player.id);
    player.battleState = GAME_CONSTANTS.PLAYER.BATTLE_STATE.DEAD;
  }

  findMVPPlayerId(battleSession) {
    let mvpPlayerId = null;
    let highestScore = null;
    const lastHitPlayerId = battleSession.achievementAwards.lastHit;

    for (const [playerId, stats] of battleSession.combat.playerStats) {
      const player = this.getPlayerFromBattleSession(
        battleSession.eventBoss.id,
        playerId
      );
      if (!player) {
        continue;
      }

      const score = [
        stats.totalDamage,
        stats.accuracy,
        -stats.averageResponseTime,
        GAME_CONSTANTS.PLAYER_BATTLE_STATE_SCORE[player.battleState],
        stats.hearts,
        player.revivedCount,
        playerId === lastHitPlayerId ? 1 : 0,
      ];

      if (!highestScore || compareScores(score, highestScore) > 0) {
        highestScore = score;
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
    let highestScore = null;
    let lastHitPlayerTeamId =
      this.getPlayerFromBattleSession(
        battleSession.eventBoss.id,
        battleSession.achievementAwards.lastHit
      )?.teamId ?? null;

    for (const [teamId, stats] of battleSession.combat.teamStats) {
      const score = [
        stats.totalDamage,
        stats.accuracy,
        -stats.averageResponseTime,
        teamId === lastHitPlayerTeamId ? 1 : 0,
      ];

      if (!highestScore || compareScores(score, highestScore) > 0) {
        highestScore = score;
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
    const playerBadge = this.badgeManager.getPlayerBadge(
      mvpPlayerId,
      battleSession.event.id,
      battleSession.eventBoss.id,
      GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.MVP
    );
    return {
      player: mvpPlayer,
      badge: mvpBadge,
      shouldAward: !!playerBadge?.shouldAward,
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
    const playerBadge = this.badgeManager.getPlayerBadge(
      lastHitPlayerId,
      battleSession.event.id,
      battleSession.eventBoss.id,
      GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.LAST_HIT
    );
    return {
      player: lastHitPlayer,
      badge: lastHitBadge,
      shouldAward: !!playerBadge?.shouldAward,
    };
  }

  getWinnerTeamBadge(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    const winnerTeamId = battleSession.achievementAwards.winnerTeam;
    const winnerTeam = this.getTeamInfoById(
      battleSession.eventBoss.id,
      winnerTeamId
    );
    const bossDefeatedBadge = this.badgeManager.getBadgeByCode(
      GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.BOSS_DEFEATED
    );
    return {
      team: winnerTeam,
      badge: bossDefeatedBadge,
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

  getPlayerBadgesFromBattleSession(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    if (!battleSession || !player) return null;
    let playerBadges = [];

    const mvpAward = this.getMVPPlayerBadge(eventBossId);
    const lastHitAward = this.getLastHitPlayerBadge(eventBossId);
    const bossDefeatedAward = this.getWinnerTeamBadge(eventBossId);

    if (
      player.id === mvpAward.player.id &&
      mvpAward.badge &&
      mvpAward.shouldAward
    ) {
      playerBadges.push(mvpAward);
      this.badgeManager.markPlayerBadgeAsAwarded(
        player.id,
        battleSession.event.id,
        battleSession.eventBoss.id,
        GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.MVP
      );
    }
    if (
      player.id === lastHitAward.player?.id &&
      lastHitAward.badge &&
      lastHitAward.shouldAward
    ) {
      playerBadges.push(lastHitAward);
      this.badgeManager.markPlayerBadgeAsAwarded(
        player.id,
        battleSession.event.id,
        battleSession.eventBoss.id,
        GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.LAST_HIT
      );
    }
    if (
      player.teamId === bossDefeatedAward.team.teamId &&
      bossDefeatedAward.badge
    ) {
      const playerBadge = this.badgeManager.getPlayerBadge(
        player.id,
        battleSession.event.id,
        battleSession.eventBoss.id,
        GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.BOSS_DEFEATED
      );
      if (!!playerBadge?.shouldAward) {
        playerBadges.push(bossDefeatedAward);
        this.badgeManager.markPlayerBadgeAsAwarded(
          player.id,
          battleSession.event.id,
          battleSession.eventBoss.id,
          GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.BOSS_DEFEATED
        );
      }
    }

    const heroAward = this.badgeManager.getPlayerBadge(
      player.id,
      battleSession.event.id,
      null,
      GAME_CONSTANTS.BADGE_CODES.MILESTONE.HERO
    );
    const heroBadge = this.badgeManager.getBadgeByCode(
      GAME_CONSTANTS.BADGE_CODES.MILESTONE.HERO
    );
    if (heroAward?.shouldAward) {
      playerBadges.push({
        player,
        badge: heroBadge,
      });
      this.badgeManager.markPlayerBadgeAsAwarded(
        player.id,
        battleSession.event.id,
        null,
        GAME_CONSTANTS.BADGE_CODES.MILESTONE.HERO
      );
    }

    return playerBadges;
  }

  async getBattlePodium(eventBossId) {
    const leaderboard =
      await this.leaderboardManager.getComprehensiveLiveLeaderboard(
        eventBossId
      );
    const podium = leaderboard.teamLeaderboard
      ? leaderboard.teamLeaderboard.slice(0, 3)
      : [];

    return {
      leaderboard,
      podium,
    };
  }

  getEventStatus(eventId) {
    const status = eventManager.getEventStatus(eventId);
    if (!status) {
      console.error("[BattleSessionManager] Event not found.");
      return null;
    }

    return status;
  }

  isEventBossDefeated(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession) return null;

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
    return battleSession?.state === GAME_CONSTANTS.BATTLE_STATE.IN_PROGRESS;
  }

  reconnectPlayerToBattleSession(eventBossId, playerId, newSocketId) {
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    if (player) {
      player.socketId = newSocketId;
      player.isConnected = true;
    }
    return player;
  }

  disconnectPlayerFromBattleSession(eventBossId, playerId) {
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    if (player) {
      player.isConnected = false;
    }
    return player;
  }

  async endBattleSessionsGracefully(io, eventId) {
    for (const battleSession of this.battleSessions.values()) {
      if (battleSession.event.id === eventId) {
        const eventBossId = battleSession.eventBoss.id;

        if (battleSession.state === GAME_CONSTANTS.BATTLE_STATE.IN_PROGRESS) {
          const finalizedSession = await this.finalizeBattleSessionEnd(
            eventBossId
          );
          if (!finalizedSession) {
            console.error(
              "[BattleSessionManager] Failed to finalize battle session end."
            );
            continue;
          }

          io.to(SOCKET_ROOMS.BATTLE_SESSION(eventBossId)).emit(
            SOCKET_EVENTS.EVENT.ENDED,
            {
              message: "The event has ended. Thank you for participating!",
              data: { podiumEndAt: battleSession.podiumEndAt },
            }
          );

          io.to(SOCKET_ROOMS.BATTLE_MONITOR(eventBossId)).emit(
            SOCKET_EVENTS.EVENT.ENDED,
            {
              message: "The event has ended. Thank you for participating!",
            }
          );

          io.to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId)).emit(
            SOCKET_EVENTS.EVENT.ENDED,
            {
              message: "The event has ended. Thank you for participating!",
            }
          );
        }
      }
    }
  }

  async removePlayerFromAllBattleSessions(io, playerIds = []) {
    const ids = Array.isArray(playerIds) ? playerIds : [playerIds];
    for (const battleSession of this.battleSessions.values()) {
      const removed = [];
      const socketIds = [];
      for (const playerId of ids) {
        if (battleSession.players.has(playerId)) {
          const player = battleSession.players.get(playerId);
          const team = this.getPlayerTeamInfo(
            battleSession.eventBoss.id,
            playerId
          );
          const isKnockedOut = this.isPlayerKnockedOut(
            battleSession.eventBoss.id,
            playerId
          );
          socketIds.push(player.socketId);

          battleSession.players.delete(playerId);
          this.teamManager.removePlayerFromTeam(battleSession.teams, playerId);
          this.combatManager.removePlayerStats(battleSession.combat, playerId);
          this.leaderboardManager.removePlayerFromLeaderboard(
            battleSession.eventBoss.id,
            playerId
          );

          if (isKnockedOut) {
            this.knockoutManager.removeKnockedOutPlayer(
              battleSession.id,
              playerId
            );

            const knockedOutPlayers =
              battleSessionManager.getKnockedOutPlayersByTeam(
                battleSession.eventBoss.id,
                team.teamId
              );
            io.to(
              SOCKET_ROOMS.TEAM(battleSession.eventBoss.id, team.teamId)
            ).emit(SOCKET_EVENTS.BATTLE_SESSION.TEAMMATE.KNOCKED_OUT_COUNT, {
              message:
                "Your teammate has been removed from the battle session.",
              data: {
                knockedOutPlayersCount: knockedOutPlayers.length,
              },
            });
          }
          removed.push(playerId);
        }
      }

      if (removed.length > 0) {
        const previewLeaderboard = await this.getPreviewLiveLeaderboard(
          battleSession.eventBoss.id
        );
        const liveLeaderboard = this.getBattleLiveLeaderboard(
          battleSession.eventBoss.id
        );
        const message = `${removed.length} player${
          removed.length > 1 ? "s" : ""
        } removed from battle session.`;

        for (const socketId of socketIds) {
          io.to(socketId).emit(SOCKET_EVENTS.BATTLE_SESSION.PLAYER.REMOVED, {
            message: "You have been removed from the battle session.",
          });
        }

        io.to(SOCKET_ROOMS.BATTLE_SESSION(battleSession.eventBoss.id)).emit(
          SOCKET_EVENTS.BATTLE_SESSION.PLAYERS.REMOVED,
          {
            message,
            data: {
              leaderboard: liveLeaderboard,
            },
          }
        );

        io.to(SOCKET_ROOMS.BATTLE_MONITOR(battleSession.eventBoss.id)).emit(
          SOCKET_EVENTS.BATTLE_SESSION.PLAYERS.REMOVED,
          {
            message,
            data: {
              leaderboard: previewLeaderboard,
              activePlayers: this.getActivePlayersCount(
                battleSession.eventBoss.id
              ),
            },
          }
        );

        io.to(SOCKET_ROOMS.BOSS_PREVIEW(battleSession.eventBoss.id)).emit(
          SOCKET_EVENTS.BATTLE_SESSION.PLAYERS.REMOVED,
          {
            message,
            data: {
              leaderboard: previewLeaderboard,
              sessionSize: this.getBattleSessionSize(
                battleSession.eventBoss.id
              ),
            },
          }
        );
      }
    }
  }

  getBattleSessionId(eventBossId) {
    for (const battleSession of this.battleSessions.values()) {
      if (battleSession.eventBoss.id === eventBossId) {
        return battleSession.id;
      }
    }
    return null;
  }

  getBattleSession(eventBossId) {
    const battleSessionId = this.getBattleSessionId(eventBossId);
    if (!this.battleSessions.has(battleSessionId)) {
      console.error("[BattleSessionManager] Battle session not found.");
      return null;
    }
    return battleSessionId ? this.battleSessions.get(battleSessionId) : null;
  }

  findBattleSession(eventBossId) {
    const battleSessionId = this.getBattleSessionId(eventBossId);
    return battleSessionId ? this.battleSessions.get(battleSessionId) : null;
  }

  getBattleState(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    return battleSession?.state || null;
  }

  isBattleSessionInProgress(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    return (
      battleSession &&
      battleSession.state === GAME_CONSTANTS.BATTLE_STATE.IN_PROGRESS
    );
  }

  canJoinMidGame(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
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
    const battleSession = this.findBattleSession(eventBossId);
    return battleSession?.eventBoss;
  }

  getEventBossStatus(eventBossId) {
    const battleSession = this.findBattleSession(eventBossId);
    return battleSession ? battleSession.eventBoss.status : null;
  }

  getPlayerFromBattleSession(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession?.players.has(playerId)) {
      console.error(
        "[BattleSessionManager] Player not found in battle session."
      );
      return null;
    }
    return battleSession.players.get(playerId);
  }

  findPlayerFromBattleSession(eventBossId, playerId) {
    const battleSession = this.findBattleSession(eventBossId);
    return battleSession?.players.get(playerId) || null;
  }

  getAllPlayersFromBattleSession(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession) return [];

    return Array.from(battleSession.players.values());
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
      teamId: team?.id,
      teamName: team?.name,
    };
  }

  getPlayersByTeam(eventBossId, teamId) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession) return [];

    return this.teamManager.getPlayersInTeam(battleSession.teams, teamId);
  }

  getQuestionPool(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    if (!battleSession || !player) return null;

    return battleSession.questions.pools.get(player.id) ?? null;
  }

  getPlayerHearts(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    if (!battleSession || !player) return null;

    return this.combatManager.getPlayerHearts(battleSession.combat, player.id);
  }

  getPlayerBattleState(eventBossId, playerId) {
    const player = this.getPlayerFromBattleSession(eventBossId, playerId);
    return player?.battleState || null;
  }

  getActivePlayersCount(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession) return 0;

    let count = 0;
    for (const player of battleSession.players.values()) {
      if (player.isConnected) {
        count++;
      }
    }
    return count;
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
      if (player.battleState === GAME_CONSTANTS.PLAYER.BATTLE_STATE.DEAD) {
        continue;
      }

      if (player.nickname.toLowerCase() === nickname.toLowerCase()) {
        return true;
      }
    }
    return false;
  }

  isPlayerInAnyBattleSession(playerId) {
    for (const battleSession of this.battleSessions.values()) {
      if (battleSession.players.has(playerId)) {
        const player = battleSession.players.get(playerId);
        if (
          battleSession.state !== GAME_CONSTANTS.BATTLE_STATE.ENDED &&
          player.battleState !== GAME_CONSTANTS.PLAYER.BATTLE_STATE.DEAD
        ) {
          return true;
        }
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
