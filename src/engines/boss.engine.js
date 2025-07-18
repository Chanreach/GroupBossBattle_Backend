import { EventEmitter } from "events";
import Boss from "../models/boss.model.js";
import { v4 as uuidv4 } from "uuid";

class BossEngine extends EventEmitter {
  constructor() {
    super();
    this.activeBossFights = new Map(); // Map<bossId, BossFightSession>
    this.playerSessions = new Map(); // Map<playerId, playerSession>
    this.cooldownTimers = new Map(); // Map<bossId, cooldownInfo>

    // Constants
    this.MINIMUM_HP_THRESHOLD = 30; // Minimum HP requiring 30 correct answers
    this.PLAYER_STARTING_HEARTS = 3;
    this.REVIVAL_TIMEOUT = 60000; // 60 seconds in milliseconds
    this.DAMAGE_MULTIPLIERS = {
      FAST: 1.5,
      NORMAL: 1.0,
      SLOW: 0.5,
    };
    this.RESPONSE_TIME_THRESHOLDS = {
      FAST: 10000, // 10 seconds
      SLOW: 25000, // 25 seconds
    };
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
      if (this.isBossOnCooldown(bossId)) {
        throw new Error("Boss is on cooldown");
      }

      // Create new boss fight session
      const sessionId = uuidv4();
      const bossFightSession = {
        sessionId,
        bossId,
        hostId,
        boss,
        status: "waiting", // waiting, active, cooldown, ended
        players: new Map(),
        teams: new Map(),
        currentHP: this.MINIMUM_HP_THRESHOLD,
        maxHP: this.MINIMUM_HP_THRESHOLD,
        totalDamage: 0,
        teamDamage: new Map(),
        questions: [],
        usedQuestions: new Set(),
        startTime: null,
        endTime: null,
        winner: null,
        revivalCodes: new Map(), // Map<playerId, {code, expiresAt}>
        knockedOutPlayers: new Set(),
        badges: {
          bossDefeated: new Set(),
          lastHit: null,
          mvp: null,
          answerMilestones: new Map(), // Map<playerId, milestoneCount>
          hero: new Set(),
        },
      };

      // Initialize teams
      for (let i = 1; i <= boss.number_of_teams; i++) {
        bossFightSession.teams.set(i, {
          teamId: i,
          players: new Set(),
          totalDamage: 0,
          name: `Team ${i}`,
        });
        bossFightSession.teamDamage.set(i, 0);
      }

      this.activeBossFights.set(bossId, bossFightSession);

      // Boss spawns immediately on creation
      this.emit("bossFightCreated", {
        sessionId,
        bossId,
        boss: boss.toJSON(),
        status: "waiting",
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

    if (session.status === "ended") {
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
      hearts: this.PLAYER_STARTING_HEARTS,
      totalDamage: 0,
      questionsAnswered: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      status: "waiting", // waiting, active, knocked_out, revived
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
    this.scaleBossHP(session);

    this.emit("playerJoined", {
      sessionId: session.sessionId,
      playerId,
      nickname,
      totalPlayers: session.players.size,
      bossHP: session.currentHP,
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

    if (session.status === "cooldown") {
      throw new Error("Boss is on cooldown");
    }

    // Assign player to team if not already assigned
    if (!playerSession.teamId) {
      playerSession.teamId = this.assignPlayerToTeam(session, playerId);
    }

    playerSession.status = "ready";

    // Check if we have enough players to start (at least 2 players, 1 per team)
    const readyPlayers = Array.from(session.players.values()).filter(
      (p) => p.status === "ready"
    );
    const teamsWithPlayers = new Set(readyPlayers.map((p) => p.teamId));

    if (readyPlayers.length >= 2 && teamsWithPlayers.size >= 2) {
      this.startBossFight(session);
    }

    this.emit("playerReady", {
      sessionId: session.sessionId,
      playerId,
      teamId: playerSession.teamId,
      readyPlayers: readyPlayers.length,
      canStart: readyPlayers.length >= 2 && teamsWithPlayers.size >= 2,
    });
  }

  /**
   * Start the boss fight
   */
  startBossFight(session) {
    if (session.status !== "waiting") {
      throw new Error("Boss fight cannot be started");
    }

    session.status = "active";
    session.startTime = new Date();

    // Set all ready players to active
    for (const [playerId, playerSession] of session.players) {
      if (playerSession.status === "ready") {
        playerSession.status = "active";
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
   * Assign player to team with load balancing
   */
  assignPlayerToTeam(session, playerId) {
    const teams = Array.from(session.teams.values());

    // Find team with least players
    let minPlayersTeam = teams[0];
    for (const team of teams) {
      if (team.players.size < minPlayersTeam.players.size) {
        minPlayersTeam = team;
      }
    }

    // Add player to team
    minPlayersTeam.players.add(playerId);

    return minPlayersTeam.teamId;
  }

  /**
   * Scale boss HP based on number of players
   */
  scaleBossHP(session) {
    const playerCount = session.players.size;
    // Scale HP: minimum 30 + additional HP per player
    const scaledHP = Math.max(
      this.MINIMUM_HP_THRESHOLD,
      this.MINIMUM_HP_THRESHOLD + playerCount * 5
    );

    // Only increase HP, never decrease during active fight
    if (scaledHP > session.maxHP) {
      const hpIncrease = scaledHP - session.maxHP;
      session.maxHP = scaledHP;
      session.currentHP += hpIncrease;
    }
  }

  /**
   * Start question cycle for all active players
   */
  startQuestionCycle(session) {
    for (const [playerId, playerSession] of session.players) {
      if (playerSession.status === "active") {
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
      const question = await this.getRandomQuestion(
        session.boss.category_id,
        playerSession.playerId
      );

      // Randomize answer positions
      const randomizedAnswers = this.randomizeAnswers(question.answers);

      playerSession.currentQuestion = {
        questionId: question.id,
        question: question.question_text,
        answers: randomizedAnswers,
        correctIndex: randomizedAnswers.findIndex((a) => a.is_correct),
        timeLimit: question.time_limit || 30000,
        sentAt: new Date(),
      };

      this.emit("questionSent", {
        playerId: playerSession.playerId,
        sessionId: session.sessionId,
        question: {
          id: question.id,
          text: question.question_text,
          answers: randomizedAnswers.map((a) => ({
            text: a.choice_text,
            index: a.index,
          })),
          timeLimit: question.time_limit || 30000,
        },
      });

      // Set timeout for question
      setTimeout(() => {
        this.handleQuestionTimeout(playerSession, session);
      }, question.time_limit || 30000);
    } catch (error) {
      console.error("Error sending question:", error);
    }
  }

  /**
   * Handle player's answer submission
   */
  async submitAnswer(playerId, answerIndex) {
    const playerSession = this.playerSessions.get(playerId);
    if (!playerSession) {
      throw new Error("Player session not found");
    }

    const session = this.activeBossFights.get(playerSession.bossId);
    if (!session || session.status !== "active") {
      throw new Error("Boss fight not active");
    }

    if (playerSession.status !== "active" || !playerSession.currentQuestion) {
      throw new Error("Player not in active question state");
    }

    const question = playerSession.currentQuestion;
    const responseTime = new Date() - question.sentAt;
    const isCorrect = answerIndex === question.correctIndex;

    playerSession.questionsAnswered++;
    playerSession.lastAnswerTime = new Date();

    let damage = 0;
    let result = {
      playerId,
      sessionId: session.sessionId,
      questionId: question.questionId,
      isCorrect,
      responseTime,
      damage: 0,
      heartsRemaining: playerSession.hearts,
    };

    if (isCorrect) {
      playerSession.correctAnswers++;

      // Calculate damage based on response speed
      if (responseTime <= this.RESPONSE_TIME_THRESHOLDS.FAST) {
        damage = this.DAMAGE_MULTIPLIERS.FAST;
      } else if (responseTime <= this.RESPONSE_TIME_THRESHOLDS.SLOW) {
        damage = this.DAMAGE_MULTIPLIERS.NORMAL;
      } else {
        damage = this.DAMAGE_MULTIPLIERS.SLOW;
      }

      // Apply damage
      this.applyDamage(session, playerSession, damage);
      result.damage = damage;

      // Check milestone badges
      this.checkMilestoneBadges(playerSession, session);
    } else {
      playerSession.incorrectAnswers++;
      playerSession.hearts--;

      if (playerSession.hearts <= 0) {
        this.knockOutPlayer(playerSession, session);
      }
    }

    result.heartsRemaining = playerSession.hearts;
    playerSession.currentQuestion = null;

    this.emit("answerSubmitted", result);

    // Check if boss is defeated
    if (session.currentHP <= 0) {
      this.defeatBoss(session, playerSession);
    } else if (playerSession.status === "active") {
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
  handleQuestionTimeout(playerSession, session) {
    if (!playerSession.currentQuestion) {
      return; // Question already answered
    }

    playerSession.questionsAnswered++;
    playerSession.incorrectAnswers++;
    playerSession.hearts--;
    playerSession.currentQuestion = null;

    this.emit("questionTimeout", {
      playerId: playerSession.playerId,
      sessionId: session.sessionId,
      heartsRemaining: playerSession.hearts,
    });

    if (playerSession.hearts <= 0) {
      this.knockOutPlayer(playerSession, session);
    } else if (playerSession.status === "active") {
      // Send next question
      setTimeout(() => {
        this.sendQuestionToPlayer(playerSession, session);
      }, 1000);
    }
  }

  /**
   * Apply damage to boss and update team stats
   */
  applyDamage(session, playerSession, damage) {
    session.currentHP = Math.max(0, session.currentHP - damage);
    session.totalDamage += damage;

    playerSession.totalDamage += damage;

    // Update team damage
    const teamDamage = session.teamDamage.get(playerSession.teamId) || 0;
    session.teamDamage.set(playerSession.teamId, teamDamage + damage);

    // Update team object
    const team = session.teams.get(playerSession.teamId);
    if (team) {
      team.totalDamage += damage;
    }

    this.emit("damageDealt", {
      sessionId: session.sessionId,
      playerId: playerSession.playerId,
      teamId: playerSession.teamId,
      damage,
      bossHP: session.currentHP,
      teamDamage: team?.totalDamage || 0,
    });
  }

  /**
   * Knock out player and generate revival code
   */
  knockOutPlayer(playerSession, session) {
    playerSession.status = "knocked_out";
    session.knockedOutPlayers.add(playerSession.playerId);

    // Generate revival code
    const revivalCode = this.generateRevivalCode();
    const expiresAt = new Date(Date.now() + this.REVIVAL_TIMEOUT);

    session.revivalCodes.set(playerSession.playerId, {
      code: revivalCode,
      expiresAt,
    });

    playerSession.revivalCode = revivalCode;

    this.emit("playerKnockedOut", {
      sessionId: session.sessionId,
      playerId: playerSession.playerId,
      teamId: playerSession.teamId,
      revivalCode,
      expiresAt,
    });

    // Set timeout for revival code expiration
    setTimeout(() => {
      this.handleRevivalTimeout(playerSession, session);
    }, this.REVIVAL_TIMEOUT);
  }

  /**
   * Attempt to revive a knocked out player
   */
  revivePlayer(reviverPlayerId, targetPlayerId, revivalCode) {
    const reviverSession = this.playerSessions.get(reviverPlayerId);
    const targetSession = this.playerSessions.get(targetPlayerId);

    if (!reviverSession || !targetSession) {
      throw new Error("Player session not found");
    }

    if (reviverSession.bossId !== targetSession.bossId) {
      throw new Error("Players not in same boss fight");
    }

    const session = this.activeBossFights.get(reviverSession.bossId);
    if (!session || session.status !== "active") {
      throw new Error("Boss fight not active");
    }

    if (reviverSession.status !== "active") {
      throw new Error("Reviver must be active");
    }

    if (targetSession.status !== "knocked_out") {
      throw new Error("Target player is not knocked out");
    }

    // Check revival code
    const storedRevival = session.revivalCodes.get(targetPlayerId);
    if (!storedRevival || storedRevival.code !== revivalCode) {
      throw new Error("Invalid revival code");
    }

    if (new Date() > storedRevival.expiresAt) {
      throw new Error("Revival code expired");
    }

    // Revive player
    targetSession.status = "active";
    targetSession.hearts = this.PLAYER_STARTING_HEARTS;
    targetSession.revivalCode = null;

    session.knockedOutPlayers.delete(targetPlayerId);
    session.revivalCodes.delete(targetPlayerId);

    this.emit("playerRevived", {
      sessionId: session.sessionId,
      reviverPlayerId,
      targetPlayerId,
      teamId: targetSession.teamId,
    });

    // Send new question to revived player
    setTimeout(() => {
      this.sendQuestionToPlayer(targetSession, session);
    }, 1000);

    return { success: true, message: "Player revived successfully" };
  }

  /**
   * Handle revival timeout
   */
  handleRevivalTimeout(playerSession, session) {
    if (playerSession.status === "knocked_out") {
      // Remove player from current fight but keep their progress
      session.revivalCodes.delete(playerSession.playerId);
      session.knockedOutPlayers.delete(playerSession.playerId);

      this.emit("revivalExpired", {
        sessionId: session.sessionId,
        playerId: playerSession.playerId,
      });
    }
  }

  /**
   * Check and award milestone badges
   */
  checkMilestoneBadges(playerSession, session) {
    const milestones = [10, 25, 50, 100];
    const currentMilestone =
      session.badges.answerMilestones.get(playerSession.playerId) || 0;

    for (const milestone of milestones) {
      if (
        playerSession.correctAnswers >= milestone &&
        currentMilestone < milestone
      ) {
        session.badges.answerMilestones.set(playerSession.playerId, milestone);
        playerSession.badges.add(`answers_${milestone}`);

        this.emit("badgeAwarded", {
          sessionId: session.sessionId,
          playerId: playerSession.playerId,
          badge: `answers_${milestone}`,
          type: "milestone",
        });
      }
    }
  }

  /**
   * Defeat boss and award badges
   */
  defeatBoss(session, lastHitPlayer) {
    session.status = "defeated";
    session.endTime = new Date();
    session.currentHP = 0;

    // Determine winning team
    let winningTeam = null;
    let maxDamage = 0;

    for (const [teamId, damage] of session.teamDamage) {
      if (damage > maxDamage) {
        maxDamage = damage;
        winningTeam = teamId;
      }
    }

    session.winner = winningTeam;

    // Award badges
    this.awardBadges(session, lastHitPlayer, winningTeam);

    this.emit("bossDefeated", {
      sessionId: session.sessionId,
      bossId: session.bossId,
      winner: winningTeam,
      endTime: session.endTime,
      totalDamage: session.totalDamage,
      teamDamage: Object.fromEntries(session.teamDamage),
    });

    // Start cooldown
    this.startCooldown(session);
  }

  /**
   * Award badges after boss defeat
   */
  awardBadges(session, lastHitPlayer, winningTeam) {
    // Boss Defeated Badge - all players on winning team
    const winningTeamPlayers = Array.from(session.players.values()).filter(
      (p) => p.teamId === winningTeam
    );

    for (const player of winningTeamPlayers) {
      session.badges.bossDefeated.add(player.playerId);
      player.badges.add("boss_defeated");
    }

    // Last Hit Badge
    if (lastHitPlayer) {
      session.badges.lastHit = lastHitPlayer.playerId;
      lastHitPlayer.badges.add("last_hit");
    }

    // MVP Badge - player with highest damage
    let mvpPlayer = null;
    let maxDamage = 0;

    for (const [playerId, player] of session.players) {
      if (player.totalDamage > maxDamage) {
        maxDamage = player.totalDamage;
        mvpPlayer = player;
      }
    }

    if (mvpPlayer) {
      session.badges.mvp = mvpPlayer.playerId;
      mvpPlayer.badges.add("mvp");
    }

    // Emit badge events
    this.emit("badgesAwarded", {
      sessionId: session.sessionId,
      badges: {
        bossDefeated: Array.from(session.badges.bossDefeated),
        lastHit: session.badges.lastHit,
        mvp: session.badges.mvp,
      },
    });
  }

  /**
   * Start cooldown period
   */
  startCooldown(session) {
    const cooldownDuration = session.boss.cooldown_duration * 1000; // Convert to milliseconds
    const endsAt = new Date(Date.now() + cooldownDuration);

    this.cooldownTimers.set(session.bossId, {
      endsAt,
      timer: setTimeout(() => {
        this.endCooldown(session.bossId);
      }, cooldownDuration),
    });

    // Update session status
    session.status = "cooldown";

    this.emit("cooldownStarted", {
      bossId: session.bossId,
      duration: cooldownDuration,
      endsAt,
    });
  }

  /**
   * End cooldown period
   */
  endCooldown(bossId) {
    this.cooldownTimers.delete(bossId);
    const session = this.activeBossFights.get(bossId);

    if (session) {
      session.status = "waiting";
      // Reset for next fight
      session.currentHP = session.maxHP;
      session.totalDamage = 0;
      session.teamDamage.clear();
      session.knockedOutPlayers.clear();
      session.revivalCodes.clear();
      session.startTime = null;
      session.endTime = null;
      session.winner = null;

      // Initialize team damage
      for (const teamId of session.teams.keys()) {
        session.teamDamage.set(teamId, 0);
        session.teams.get(teamId).totalDamage = 0;
      }

      // Reset player states
      for (const player of session.players.values()) {
        player.hearts = this.PLAYER_STARTING_HEARTS;
        player.status = "waiting";
        player.totalDamage = 0;
        player.currentQuestion = null;
        player.revivalCode = null;
      }
    }

    this.emit("cooldownEnded", {
      bossId,
      status: "waiting",
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

    // Team leaderboard
    const teamLeaderboard = Array.from(session.teams.values())
      .sort((a, b) => b.totalDamage - a.totalDamage)
      .map((team) => ({
        teamId: team.teamId,
        name: team.name,
        totalDamage: team.totalDamage,
        playerCount: team.players.size,
      }));

    // Individual leaderboard
    const individualLeaderboard = Array.from(session.players.values())
      .sort((a, b) => b.totalDamage - a.totalDamage)
      .map((player) => ({
        playerId: player.playerId,
        nickname: player.nickname,
        teamId: player.teamId,
        totalDamage: player.totalDamage,
        questionsAnswered: player.questionsAnswered,
        correctAnswers: player.correctAnswers,
        hearts: player.hearts,
        status: player.status,
      }));

    return {
      sessionId,
      teamLeaderboard,
      individualLeaderboard,
      bossHP: session.currentHP,
      maxHP: session.maxHP,
      status: session.status,
    };
  }

  /**
   * Check if boss is on cooldown
   */
  isBossOnCooldown(bossId) {
    const cooldown = this.cooldownTimers.get(bossId);
    return cooldown && new Date() < cooldown.endsAt;
  }

  /**
   * Get cooldown remaining time
   */
  getCooldownRemaining(bossId) {
    const cooldown = this.cooldownTimers.get(bossId);
    if (!cooldown) return 0;

    const remaining = cooldown.endsAt - new Date();
    return Math.max(0, remaining);
  }

  /**
   * Utility functions
   */
  generateRevivalCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  randomizeAnswers(answers) {
    const shuffled = [...answers].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4).map((answer, index) => ({
      ...answer,
      index,
    }));
  }

  async getRandomQuestion(categoryId, playerId) {
    // This would integrate with your question system
    // For now, returning a mock question structure
    return {
      id: uuidv4(),
      question_text: "Sample question?",
      category_id: categoryId,
      time_limit: 30000,
      answers: [
        { choice_text: "Answer 1", is_correct: true },
        { choice_text: "Answer 2", is_correct: false },
        { choice_text: "Answer 3", is_correct: false },
        { choice_text: "Answer 4", is_correct: false },
      ],
    };
  }

  getPlayerSession(playerId) {
    return this.playerSessions.get(playerId);
  }

  getBossFight(bossId) {
    return this.activeBossFights.get(bossId);
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

    session.status = "ended";
    session.endTime = new Date();

    // Clear timers
    const cooldown = this.cooldownTimers.get(bossId);
    if (cooldown) {
      clearTimeout(cooldown.timer);
      this.cooldownTimers.delete(bossId);
    }

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
      (p) => p.status === "active"
    ).length;
    const knockedOutCount = players.filter(
      (p) => p.status === "knocked_out"
    ).length;
    const waitingCount = players.filter((p) => p.status === "waiting").length;

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
      teamStats: Array.from(session.teams.values()).map((team) => ({
        teamId: team.teamId,
        playerCount: team.players.size,
        totalDamage: team.totalDamage,
      })),
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
}

export default BossEngine;
