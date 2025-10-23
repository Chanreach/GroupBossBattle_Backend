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
      console.log(
        "[BattleSessionManager] Cannot create battle session. Event is not ongoing."
      );
      return null;
    }

    const existingSession = this.getBattleSession(eventBossId);
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
      startTime: null,
      endTime: null,
      podiumEndTime: null,
      cooldownEndTime: null,
    };

    const eventBossInit = await this.eventBossManager.initializeEventBoss(
      battleSession,
      eventBossId
    );
    if (!eventBossInit) {
      console.error("Failed to initialize event boss for battle session");
      return null;
    }

    const questionsInit = await this.questionManager.initializeQuestionBank(
      battleSession.questions.bank,
      eventBossId
    );
    if (!questionsInit) {
      console.error("Failed to initialize question bank for battle session");
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
      console.error("Failed to create teams for battle session");
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
        console.error("Failed to initialize player session");
        return null;
      }
    }

    const updatedEventBoss = await this.updateEventBossStatus(
      eventBossId,
      GAME_CONSTANTS.BOSS_STATUS.IN_BATTLE
    );
    if (!updatedEventBoss) {
      console.error("Failed to update event boss status");
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
    battleSession.startTime = Date.now();
    return battleSession;
  }

  async startBattleSession(eventBossId) {
    if (!this.canStartBattleSession(eventBossId)) {
      console.error("Cannot start battle session");
      return null;
    }

    if (!this.isBattleSessionStarted(eventBossId)) {
      const battleSessionInit = await this.initializeBattleSession(eventBossId);
      if (!battleSessionInit) {
        console.error("Failed to initialize battle session");
        return null;
      }
    }

    return this.getBattleSession(eventBossId);
  }

  async addPlayerToBattleSession(eventBossId, playerInfo) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession) return null;

    const eventStatus = this.getEventStatus(battleSession.event.id);
    if (eventStatus !== GAME_CONSTANTS.EVENT_STATUS.ONGOING) {
      console.log(
        "[BattleSessionManager] Cannot add player. Event is not ongoing."
      );
      return null;
    }

    const existingPlayer = this.getPlayerFromBattleSession(
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
          console.error("Failed to remove existing player from battle session");
          return null;
        }
      } else {
        console.error("Player is already in the battle session");
        return null;
      }
    }

    if (this.isNicknameTaken(eventBossId, playerInfo.nickname)) {
      console.error("Nickname already taken in this battle session");
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
        console.error("Failed to initialize player session");
        return null;
      }
    }

    const updatedEventBoss = this.eventBossManager.updateEventBossHP(
      battleSession.eventBoss,
      battleSession.players.size
    );
    if (!updatedEventBoss) {
      console.error("Failed to update event boss HP");
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
      console.error("Failed to assign player to a team");
      return null;
    }
    player.teamId = teamId;

    const questionPool = this.questionManager.prepareQuestionPoolForPlayer(
      battleSession.questions,
      battleSession.id,
      player.id
    );
    if (!questionPool) {
      console.error("Failed to prepare question pool for player");
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
      console.error("Player not found in battle session");
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
      console.error("No current question for player");
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
        console.error("Failed to validate player answer");
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
      console.error("Failed to process player answer");
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
      const defeatedBattleSession = await this.handleEventBossDefeat(
        eventBossId
      );
      if (!defeatedBattleSession) {
        console.error("Failed to handle event boss defeat");
        return null;
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

  async handleEventBossDefeat(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession) return null;

    battleSession.state = GAME_CONSTANTS.BATTLE_STATE.ENDED;
    battleSession.endTime = Date.now();
    battleSession.podiumEndTime = Date.now() + GAME_CONSTANTS.PODIUM_COUNTDOWN;

    const eventBoss = this.getEventBoss(eventBossId);
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
        battleSession.cooldownEndTime = updatedEventBoss.cooldownEndTime;
      }
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
      console.error("Battle session is not ended");
      return null;
    }

    const mvpPlayerId = this.findMVPPlayerId(battleSession);
    const winnerTeamId = this.findWinnerTeamId(battleSession);
    const lastHitPlayerId = this.findLastHitPlayerId(battleSession);
    for (const player of battleSession.players.values()) {
      if (player.id === mvpPlayerId) {
        const badgeData = await this.awardBadgeToPlayer(
          player.id,
          eventBossId,
          battleSession.event.id,
          GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.MVP
        );
        if (!badgeData) {
          console.error("Failed to award MVP badge to player:", player.id);
        }
      }
      if (player.teamId === winnerTeamId) {
        const badgeData = await this.awardBadgeToPlayer(
          player.id,
          eventBossId,
          battleSession.event.id,
          GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.BOSS_DEFEATED
        );
        if (!badgeData) {
          console.error(
            "Failed to award boss defeated badge to player:",
            player.id
          );
        }
      }
      if (player.id === lastHitPlayerId) {
        const badgeData = await this.awardBadgeToPlayer(
          player.id,
          eventBossId,
          battleSession.event.id,
          GAME_CONSTANTS.BADGE_CODES.ACHIEVEMENT.LAST_HIT
        );
        if (!badgeData) {
          console.error("Failed to award last hit badge to player:", player.id);
        }
      }
    }
  }

  async awardHeroBadgesToEligiblePlayers(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession) return null;

    if (battleSession.state !== GAME_CONSTANTS.BATTLE_STATE.ENDED) {
      console.error("Battle session is not ended");
      return null;
    }

    for (const player of battleSession.players.values()) {
      const badgeCode = await this.badgeManager.checkHeroBadgeEligibility(
        player.id,
        battleSession.event.id
      );
      if (badgeCode) {
        const badgeData = await this.awardBadgeToPlayer(
          player.id,
          eventBossId,
          battleSession.event.id,
          badgeCode
        );
        if (!badgeData) {
          console.error("Failed to award hero badge to player:", player.id);
        }
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

    if (!this.isPlayerKnockedOut(eventBossId, player.id)) {
      throw new Error("Player is not knocked out.");
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
      player.id === lastHitAward.player.id &&
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
      GAME_CONSTANTS.BADGE_CODES.HERO
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
        GAME_CONSTANTS.BADGE_CODES.HERO
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

  endBattleSessions(eventId) {
    for (const battleSession of this.battleSessions.values()) {
      if (battleSession.event.id === eventId) {
        this.handleEventBossDefeat(battleSession.eventBoss.id);
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
      console.error("Battle session not found");
      return null;
    }
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
    const battleSession = this.getBattleSession(eventBossId);
    return battleSession ? battleSession.players.size : 0;
  }

  getEventBoss(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    return battleSession?.eventBoss;
  }

  getEventBossStatus(eventBossId) {
    const battleSession = this.getBattleSession(eventBossId);
    return battleSession ? battleSession.eventBoss.status : null;
  }

  getPlayerFromBattleSession(eventBossId, playerId) {
    const battleSession = this.getBattleSession(eventBossId);
    if (!battleSession?.players.has(playerId)) {
      console.error("Player not found in battle session");
      return null;
    }
    return battleSession.players.get(playerId);
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

  deleteBattleSession(battleSessionId) {
    this.battleSessions.delete(battleSessionId);
  }
}

const battleSessionManager = new BattleSessionManager();
export default battleSessionManager;
