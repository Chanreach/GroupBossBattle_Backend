import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import Boss from "../models/boss.model.js";

// Import our modular components
import { GAME_CONSTANTS } from "./utils/constants.js";
import { CooldownManager } from "./utils/cooldown-manager.js";
import { TeamManager } from "./session/team-manager.js";
import { DamageCalculator } from "./combat/damage-calculator.js";
import { QuestionHandler } from "./combat/question-handler.js";
import { RevivalSystem } from "./combat/revival-system.js";
import { BadgeSystem } from "./rewards/badge-system.js";
import { Leaderboard } from "./rewards/leaderboard.js";

class BossEngine extends EventEmitter {
  constructor() {
    super();
    this.activeBossFights = new Map(); // Map<bossId, BossFightSession>
    this.playerSessions = new Map(); // Map<playerId, playerSession>
    this.cooldownManager = new CooldownManager();
  }

  /**
   * Create a new boss fight session
   */
  async createBossFight(bossId, hostId) {
    try {
      const boss = await Boss.findByPk(bossId);
      if (!boss) {
        throw new Error("Boss not found");
      }

      // Check if boss is on cooldown
      if (this.cooldownManager.isBossOnCooldown(bossId)) {
        throw new Error("Boss is on cooldown");
      }

      // Create new boss fight session
      const sessionId = uuidv4();
      const { teams, teamDamage } = TeamManager.initializeTeams(
        boss.number_of_teams
      );

      const bossFightSession = {
        sessionId,
        bossId,
        hostId,
        boss,
        status: GAME_CONSTANTS.BOSS_STATUSES.WAITING,
        players: new Map(),
        teams,
        currentHP: GAME_CONSTANTS.MINIMUM_HP_THRESHOLD,
        maxHP: GAME_CONSTANTS.MINIMUM_HP_THRESHOLD,
        totalDamage: 0,
        teamDamage,
        questions: [],
        usedQuestions: new Set(),
        startTime: null,
        endTime: null,
        winner: null,
        revivalCodes: new Map(),
        knockedOutPlayers: new Set(),
        badges: BadgeSystem.initializeBadges(),
      };

      this.activeBossFights.set(bossId, bossFightSession);

      // Boss spawns immediately on creation
      this.emit("bossFightCreated", {
        sessionId,
        bossId,
        boss: boss.toJSON(),
        status: GAME_CONSTANTS.BOSS_STATUSES.WAITING,
      });

      return bossFightSession;
    } catch (error) {
      throw new Error(`Failed to create boss fight: ${error.message}`);
    }
  }

  /**
   * Player joins a boss fight session
   */
  async joinBossFight(bossId, playerId, nickname) {
    const session = this.activeBossFights.get(bossId);
    if (!session) {
      throw new Error("Boss fight not found");
    }

    if (session.status === GAME_CONSTANTS.BOSS_STATUSES.ENDED) {
      throw new Error("Boss fight has ended");
    }

    // Check if player is already in the session
    if (session.players.has(playerId)) {
      return this.getPlayerSession(playerId);
    }

    // Create player session
    const playerSession = {
      playerId,
      nickname,
      bossId,
      sessionId: session.sessionId,
      teamId: null,
      hearts: GAME_CONSTANTS.PLAYER_STARTING_HEARTS,
      totalDamage: 0,
      questionsAnswered: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      status: GAME_CONSTANTS.PLAYER_STATUSES.WAITING,
      joinedAt: new Date(),
      currentQuestion: null,
      lastAnswerTime: null,
      badges: new Set(),
      revivalCode: null,
    };

    // Add player to session
    session.players.set(playerId, playerSession);
    this.playerSessions.set(playerId, playerSession);

    // Scale boss HP based on players
    const hpIncrease = DamageCalculator.scaleBossHP(
      session,
      session.players.size
    );

    this.emit("playerJoined", {
      sessionId: session.sessionId,
      playerId,
      nickname,
      totalPlayers: session.players.size,
      bossHP: session.currentHP,
      hpIncrease,
    });

    return playerSession;
  }

  /**
   * Player clicks "Join Boss Fight" button to confirm readiness
   */
  playerReady(playerId) {
    const playerSession = this.playerSessions.get(playerId);
    if (!playerSession) {
      throw new Error("Player session not found");
    }

    const session = this.activeBossFights.get(playerSession.bossId);
    if (!session) {
      throw new Error("Boss fight not found");
    }

    if (session.status === GAME_CONSTANTS.BOSS_STATUSES.COOLDOWN) {
      throw new Error("Boss is on cooldown");
    }

    // Assign player to team if not already assigned
    if (!playerSession.teamId) {
      playerSession.teamId = TeamManager.assignPlayerToTeam(
        session.teams,
        playerId
      );
    }

    playerSession.status = GAME_CONSTANTS.PLAYER_STATUSES.READY;

    // Check if we have enough players to start
    const readyPlayers = Array.from(session.players.values()).filter(
      (p) => p.status === GAME_CONSTANTS.PLAYER_STATUSES.READY
    );

    const canStart = TeamManager.canStartBattle(session.teams, readyPlayers);

    if (canStart) {
      this.startBossFight(session);
    }

    this.emit("playerReady", {
      sessionId: session.sessionId,
      playerId,
      teamId: playerSession.teamId,
      readyPlayers: readyPlayers.length,
      canStart,
    });
  }

  /**
   * Start the boss fight
   */
  startBossFight(session) {
    if (session.status !== GAME_CONSTANTS.BOSS_STATUSES.WAITING) {
      throw new Error("Boss fight cannot be started");
    }

    session.status = GAME_CONSTANTS.BOSS_STATUSES.ACTIVE;
    session.startTime = new Date();

    // Set all ready players to active
    for (const [playerId, playerSession] of session.players) {
      if (playerSession.status === GAME_CONSTANTS.PLAYER_STATUSES.READY) {
        playerSession.status = GAME_CONSTANTS.PLAYER_STATUSES.ACTIVE;
      }
    }

    this.emit("bossFightStarted", {
      sessionId: session.sessionId,
      bossId: session.bossId,
      startTime: session.startTime,
      players: Array.from(session.players.values()).map((p) => ({
        playerId: p.playerId,
        nickname: p.nickname,
        teamId: p.teamId,
      })),
    });

    // Start question cycle for all active players
    this.startQuestionCycle(session);
  }

  /**
   * Start question cycle for all active players
   */
  startQuestionCycle(session) {
    for (const [playerId, playerSession] of session.players) {
      if (playerSession.status === GAME_CONSTANTS.PLAYER_STATUSES.ACTIVE) {
        this.sendQuestionToPlayer(playerSession, session);
      }
    }
  }

  /**
   * Send question to a specific player
   */
  async sendQuestionToPlayer(playerSession, session) {
    try {
      // Get random question from category
      const question = await QuestionHandler.getRandomQuestion(
        session.boss.category_id,
        playerSession.playerId
      );

      // Create player question
      playerSession.currentQuestion =
        QuestionHandler.createPlayerQuestion(question);

      this.emit("questionSent", {
        playerId: playerSession.playerId,
        sessionId: session.sessionId,
        question: QuestionHandler.formatQuestionForClient(
          playerSession.currentQuestion
        ),
      });

      // Set timeout for question
      QuestionHandler.setupQuestionTimeout(
        playerSession,
        session,
        question.time_limit || 30000,
        (playerSession, session, result) => {
          this.handleQuestionTimeout(playerSession, session, result);
        }
      );
    } catch (error) {
      console.error("Error sending question:", error);
    }
  }

  /**
   * Handle player's answer submission
   */
  async submitAnswer(playerId, answerIndex) {
    const playerSession = this.playerSessions.get(playerId);
    const session = this.activeBossFights.get(playerSession?.bossId);

    // Validate answer
    const validation = QuestionHandler.validateAnswer(
      playerSession,
      session,
      answerIndex
    );
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Process answer
    const answerResult = QuestionHandler.processAnswer(
      playerSession,
      answerIndex
    );

    let result = {
      playerId,
      sessionId: session.sessionId,
      questionId: answerResult.questionId,
      isCorrect: answerResult.isCorrect,
      responseTime: answerResult.responseTime,
      damage: 0,
      heartsRemaining: answerResult.heartsRemaining,
    };

    if (answerResult.isCorrect) {
      // Calculate and apply damage
      const damage = DamageCalculator.calculateDamage(
        answerResult.responseTime
      );
      const damageResult = DamageCalculator.applyDamage(
        session,
        playerSession,
        damage
      );
      result.damage = damage;

      this.emit("damageDealt", {
        sessionId: session.sessionId,
        playerId: playerSession.playerId,
        teamId: playerSession.teamId,
        damage,
        bossHP: damageResult.bossHP,
        teamDamage: damageResult.teamDamage,
      });

      // Check milestone badges
      const badges = BadgeSystem.checkMilestoneBadges(playerSession, session);
      badges.forEach((badge) => {
        this.emit("badgeAwarded", {
          sessionId: session.sessionId,
          playerId: badge.playerId,
          badge: badge.badge,
          type: badge.type,
        });
      });
    } else if (playerSession.hearts <= 0) {
      this.knockOutPlayer(playerSession, session);
    }

    this.emit("answerSubmitted", result);

    // Check if boss is defeated
    if (DamageCalculator.isBossDefeated(session)) {
      this.defeatBoss(session, playerSession);
    } else if (QuestionHandler.shouldSendNextQuestion(playerSession, session)) {
      // Send next question
      setTimeout(() => {
        this.sendQuestionToPlayer(playerSession, session);
      }, 1000);
    }

    return result;
  }

  /**
   * Handle question timeout
   */
  handleQuestionTimeout(playerSession, session, result) {
    if (!result.timedOut) return;

    this.emit("questionTimeout", {
      playerId: playerSession.playerId,
      sessionId: session.sessionId,
      heartsRemaining: result.heartsRemaining,
    });

    if (playerSession.hearts <= 0) {
      this.knockOutPlayer(playerSession, session);
    } else if (QuestionHandler.shouldSendNextQuestion(playerSession, session)) {
      // Send next question
      setTimeout(() => {
        this.sendQuestionToPlayer(playerSession, session);
      }, 1000);
    }
  }

  /**
   * Knock out player and generate revival code
   */
  knockOutPlayer(playerSession, session) {
    const knockoutResult = RevivalSystem.knockOutPlayer(playerSession, session);

    this.emit("playerKnockedOut", {
      sessionId: session.sessionId,
      playerId: knockoutResult.playerId,
      teamId: knockoutResult.teamId,
      revivalCode: knockoutResult.revivalCode,
      expiresAt: knockoutResult.expiresAt,
    });

    // Set timeout for revival code expiration
    setTimeout(() => {
      const result = RevivalSystem.handleRevivalTimeout(playerSession, session);
      if (result.expired) {
        this.emit("revivalExpired", {
          sessionId: result.sessionId,
          playerId: result.playerId,
        });
      }
    }, knockoutResult.timeout);
  }

  /**
   * Attempt to revive a knocked out player
   */
  revivePlayer(reviverPlayerId, targetPlayerId, revivalCode) {
    const reviverSession = this.playerSessions.get(reviverPlayerId);
    const targetSession = this.playerSessions.get(targetPlayerId);
    const session = this.activeBossFights.get(reviverSession?.bossId);

    const result = RevivalSystem.revivePlayer(
      reviverSession,
      targetSession,
      session,
      revivalCode
    );

    this.emit("playerRevived", {
      sessionId: session.sessionId,
      reviverPlayerId: result.reviverPlayerId,
      targetPlayerId: result.targetPlayerId,
      teamId: result.teamId,
    });

    // Send new question to revived player
    setTimeout(() => {
      this.sendQuestionToPlayer(targetSession, session);
    }, 1000);

    return result;
  }

  /**
   * Defeat boss and award badges
   */
  defeatBoss(session, lastHitPlayer) {
    session.status = GAME_CONSTANTS.BOSS_STATUSES.DEFEATED;
    session.endTime = new Date();
    session.currentHP = 0;

    // Determine winning team
    const { winningTeam } = TeamManager.getWinningTeam(session.teamDamage);
    session.winner = winningTeam;

    // Award badges
    const badges = BadgeSystem.awardBadges(session, lastHitPlayer, winningTeam);

    this.emit("bossDefeated", {
      sessionId: session.sessionId,
      bossId: session.bossId,
      winner: winningTeam,
      endTime: session.endTime,
      totalDamage: session.totalDamage,
      teamDamage: Object.fromEntries(session.teamDamage),
    });

    this.emit("badgesAwarded", {
      sessionId: session.sessionId,
      badges,
    });

    // Start cooldown
    this.startCooldown(session);
  }

  /**
   * Start cooldown period
   */
  startCooldown(session) {
    const cooldownInfo = this.cooldownManager.startCooldown(
      session.bossId,
      session.boss.cooldown_duration,
      (bossId) => this.endCooldown(bossId)
    );

    session.status = GAME_CONSTANTS.BOSS_STATUSES.COOLDOWN;

    this.emit("cooldownStarted", {
      bossId: session.bossId,
      duration: cooldownInfo.duration,
      endsAt: cooldownInfo.endsAt,
    });
  }

  /**
   * End cooldown period
   */
  endCooldown(bossId) {
    const session = this.activeBossFights.get(bossId);

    if (session) {
      session.status = GAME_CONSTANTS.BOSS_STATUSES.WAITING;

      // Reset for next fight
      session.currentHP = session.maxHP;
      session.totalDamage = 0;
      TeamManager.resetTeamDamage(session.teams, session.teamDamage);
      session.knockedOutPlayers.clear();
      session.revivalCodes.clear();
      session.startTime = null;
      session.endTime = null;
      session.winner = null;

      // Reset player states
      for (const player of session.players.values()) {
        player.hearts = GAME_CONSTANTS.PLAYER_STARTING_HEARTS;
        player.status = GAME_CONSTANTS.PLAYER_STATUSES.WAITING;
        player.totalDamage = 0;
        player.currentQuestion = null;
        player.revivalCode = null;
      }
    }

    this.emit("cooldownEnded", {
      bossId,
      status: GAME_CONSTANTS.BOSS_STATUSES.WAITING,
    });
  }

  /**
   * Get current leaderboard
   */
  getLeaderboard(sessionId) {
    const session = Array.from(this.activeBossFights.values()).find(
      (s) => s.sessionId === sessionId
    );

    if (!session) {
      throw new Error("Session not found");
    }

    return Leaderboard.getCurrentLeaderboard(session);
  }

  /**
   * End boss fight manually (host/admin)
   */
  endBossFight(bossId, hostId) {
    const session = this.activeBossFights.get(bossId);
    if (!session) {
      throw new Error("Boss fight not found");
    }

    if (session.hostId !== hostId) {
      throw new Error("Only the host can end the boss fight");
    }

    session.status = GAME_CONSTANTS.BOSS_STATUSES.ENDED;
    session.endTime = new Date();

    // Clear cooldown
    this.cooldownManager.clearCooldown(bossId);

    this.emit("bossFightEnded", {
      sessionId: session.sessionId,
      bossId,
      endTime: session.endTime,
    });

    // Clean up player sessions
    for (const playerId of session.players.keys()) {
      this.playerSessions.delete(playerId);
    }

    this.activeBossFights.delete(bossId);
  }

  /**
   * Get live engagement metrics
   */
  getEngagementMetrics(bossId) {
    const session = this.activeBossFights.get(bossId);
    if (!session) {
      throw new Error("Boss fight not found");
    }

    const players = Array.from(session.players.values());
    const activePlayerCount = players.filter(
      (p) => p.status === GAME_CONSTANTS.PLAYER_STATUSES.ACTIVE
    ).length;
    const knockedOutCount = players.filter(
      (p) => p.status === GAME_CONSTANTS.PLAYER_STATUSES.KNOCKED_OUT
    ).length;
    const waitingCount = players.filter(
      (p) => p.status === GAME_CONSTANTS.PLAYER_STATUSES.WAITING
    ).length;

    return {
      sessionId: session.sessionId,
      bossId,
      status: session.status,
      totalPlayers: players.length,
      activePlayerCount,
      knockedOutCount,
      waitingCount,
      bossHP: session.currentHP,
      maxHP: session.maxHP,
      totalDamage: session.totalDamage,
      teamStats: TeamManager.getTeamStats(session.teams),
      playerStats: players.map((p) => ({
        playerId: p.playerId,
        nickname: p.nickname,
        teamId: p.teamId,
        hearts: p.hearts,
        status: p.status,
        questionsAnswered: p.questionsAnswered,
        correctAnswers: p.correctAnswers,
        totalDamage: p.totalDamage,
      })),
    };
  }

  // Utility methods
  getPlayerSession(playerId) {
    return this.playerSessions.get(playerId);
  }

  getBossFight(bossId) {
    return this.activeBossFights.get(bossId);
  }

  isBossOnCooldown(bossId) {
    return this.cooldownManager.isBossOnCooldown(bossId);
  }

  getCooldownRemaining(bossId) {
    return this.cooldownManager.getCooldownRemaining(bossId);
  }
}

export default BossEngine;
