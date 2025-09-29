import { v4 as uuidv4 } from "uuid";
import {
  GAME_CONSTANTS,
  getResponseTimeCategory,
  createTeamAssignmentSeed,
} from "../../utils/game.constants.js";
import { generateSeed } from "../../utils/generate-seed.js";
import RandomGenerator from "../../utils/random-generator.js";
import TeamNameGenerator from "../../utils/team-name-generator.js";
import BadgeService from "../../services/badge.service.js";
import { badgeManager, BADGE_DEFINITIONS } from "../../utils/badge-system.js";
import {
  EventBoss,
  // PlayerSession,
  Leaderboard,
  Badge,
  UserBadge,
  User,
} from "../../models/index.js";
import {
  generateUniqueRevivalCode,
  validateRevivalCode,
  formatRevivalCodeForDisplay,
} from "../../utils/generateRevivalCode.js";

function createPlayerSeed(playerId, sessionId, contexts = []) {
  const contextString = contexts.join("_");
  const seedString = `${playerId}_${sessionId}_${contextString}`;
  return generateSeed([seedString]);
}

function createComprehensivePlayerSeed(
  playerId,
  bossSessionId,
  eventBossId,
  roomCode,
  joinCode,
  numberOfTeams,
  numberOfPlayers,
  contexts = []
) {
  const timestamp = Date.now();
  const contextString = contexts.join("_");
  const seedString = `${playerId}_${bossSessionId}_${eventBossId}_${roomCode}_${joinCode}_teams${numberOfTeams}_players${numberOfPlayers}_${contextString}_${timestamp}`;
  return generateSeed([seedString]);
}

class BossSessionManager {
  constructor() {
    this.sessions = new Map(); // eventBossId -> session data
    this.playerSessions = new Map(); // socketId -> player session info
    this.reviveCodes = new Map(); // code -> { playerId, expiresAt, eventBossId }
  }

  // Create or get existing boss session
  createSession(eventBossId, bossData) {
    if (!this.sessions.has(eventBossId)) {
      const initialHp = GAME_CONSTANTS.MINIMUM_HP_THRESHOLD;

      const session = {
        eventBossId,
        eventId: bossData.eventId, // Add eventId for tracking event-wide progress
        bossData: {
          ...bossData,
          baseHp: initialHp,
          currentHp: initialHp,
          maxHp: initialHp,
          isActive: false,
          cooldownUntil: null,
          questionsData: bossData.questionsData || [],
        },
        players: new Map(), // playerId -> player data
        teams: new Map(), // teamId -> team data
        isStarted: false,
        startedAt: null,
        waitingPlayers: new Set(), // players in preview/waiting
        activePlayers: new Set(), // players currently in battle
        questions: new Map(), // playerId -> current question data
        questionPools: new Map(), // playerId -> assigned question pool
        numberOfTeams: bossData.numberOfTeams || 2,
        badges: {
          sessionId: uuidv4(), // Unique session ID for badge tracking
          earnedBadges: [], // Store badges earned in this session for logging
        },
      };

      console.log(
        `🐛 CREATED NEW SESSION for ${eventBossId} with badge sessionId: ${session.badges.sessionId}`
      );

      // Initialize teams with generated names using comprehensive seeding
      const teamNames = TeamNameGenerator.generateUniqueTeamNames(
        session.numberOfTeams,
        [
          session.badges.sessionId,
          eventBossId,
          session.roomCode,
          session.joinCode,
          session.numberOfTeams,
          "team_names",
          Date.now(),
        ]
      );

      for (let i = 1; i <= session.numberOfTeams; i++) {
        session.teams.set(i, {
          id: i,
          name: teamNames[i - 1], // Use generated team name
          totalDamage: 0,
          players: new Set(),
        });
      }

      // Initialize badge tracking for this session
      badgeManager.initializeSession(session.badges.sessionId, []);

      this.sessions.set(eventBossId, session);
    } else {
      const existingSession = this.sessions.get(eventBossId);
      console.log(
        `🐛 EXISTING SESSION for ${eventBossId} with badge sessionId: ${existingSession.badges.sessionId}`
      );
    }
    return this.sessions.get(eventBossId);
  }

  // Helper function to get player's total correct answers across the event
  async getPlayerEventCorrectAnswers(eventId, player) {
    try {
      // For now, just use session data to avoid database complexity
      // TODO: Implement proper event-wide tracking later
      return player.correctAnswers;
    } catch (error) {
      console.error("Error getting player event correct answers:", error);
      return player.correctAnswers; // Fallback to session data
    }
  }

  // Check if nickname is unique within the session
  isNicknameUnique(eventBossId, nickname) {
    const session = this.sessions.get(eventBossId);
    if (!session) return true;

    const trimmedNickname = nickname.trim().toLowerCase();

    for (const player of session.players.values()) {
      if (player.nickname.toLowerCase() === trimmedNickname) {
        return false;
      }
    }

    return true;
  }

  // Check if nickname is unique in the session
  isNicknameUnique(eventBossId, nickname) {
    const session = this.sessions.get(eventBossId);
    if (!session) return true;

    const trimmedNickname = nickname.trim().toLowerCase();

    // Check if any existing player has the same nickname (case-insensitive)
    for (const player of session.players.values()) {
      if (player.nickname.toLowerCase() === trimmedNickname) {
        return false;
      }
    }

    return true;
  }

  // Add player to session
  async addPlayer(eventBossId, socketId, playerData) {
    const session = this.sessions.get(eventBossId);
    if (!session) return null;

    const playerId = playerData.playerId || uuidv4();

    // Ensure guest users have null userId
    let userId = null;
    if (playerData.id && !playerData.isGuest) {
      userId = playerData.id;
    }

    console.log(
      `🔍 [DEBUG] Adding player: ${playerData.nickname}, isGuest: ${playerData.isGuest}, original ID: ${playerData.id}, final userId: ${userId}`
    );

    const player = {
      id: playerId,
      socketId,
      nickname: playerData.nickname,
      userId: userId, // Explicitly set to null for guests
      username: playerData.username || playerData.nickname,
      isGuest: playerData.isGuest || false,
      hearts: 3,
      totalDamage: 0,
      isKnockedOut: false,
      teamId: null,
      status: "waiting",
      joinedAt: new Date(),
      questionsAnswered: 0,
      correctAnswers: 0,
    };

    // **INSERT INTO PLAYER SESSION TABLE (only once per event)**
    try {
      // Check if player session already exists for this event
      const existingPlayerSession = await PlayerSession.findOne({
        where: {
          userId: userId, // This will be null for guests, which is fine
          eventId: session.eventId,
          username: playerData.username || playerData.nickname,
        },
      });

      if (!existingPlayerSession) {
        // Create new player session record
        const newPlayerSession = await PlayerSession.create({
          id: uuidv4(),
          userId: userId, // null for guests, actual UUID for authenticated users
          username: playerData.username || playerData.nickname,
          eventId: session.eventId,
        });

        console.log(
          `✅ [PLAYER SESSION] Created new player session for ${playerData.nickname} in event ${session.eventId}`
        );

        // Store the session ID for potential leaderboard use
        player.playerSessionId = newPlayerSession.id;
      } else {
        console.log(
          `♻️ [PLAYER SESSION] Player ${playerData.nickname} already has session in event ${session.eventId}`
        );
        player.playerSessionId = existingPlayerSession.id;
      }
    } catch (playerSessionError) {
      console.error(
        "❌ Error creating player session:",
        playerSessionError.message
      );
      // Continue with player addition even if player session fails
    }

    session.players.set(playerId, player);
    session.waitingPlayers.add(playerId);

    // Update badge manager with new player
    const sessionPlayers = Array.from(session.players.values()).map((p) => ({
      playerId: p.id,
      nickname: p.nickname,
    }));
    badgeManager.initializeSession(session.badges.sessionId, sessionPlayers);

    // 🐛 DEBUG: Verify badge session after player join
    const badgeSessionCheck = badgeManager.getSessionStats(
      session.badges.sessionId
    );
    console.log(`🐛 Badge session after player join:`, {
      sessionId: session.badges.sessionId,
      sessionExists: !!badgeSessionCheck,
      playersCount: badgeSessionCheck?.players?.size || 0,
      playerNickname: playerData.nickname,
    });

    // Store socket to player mapping with user info for reconnection
    this.playerSessions.set(socketId, {
      playerId,
      eventBossId,
      nickname: playerData.nickname,
      userId: userId, // Use the same cleaned userId
      username: playerData.username || playerData.nickname,
      isGuest: playerData.isGuest || false,
    });

    // **AUTO-ASSIGN TO TEAM if battle has already started (mid-game join)**
    if (session.isStarted) {
      this.assignPlayerToTeam(session, playerId);
      // Also move player to active players
      session.waitingPlayers.delete(playerId);
      session.activePlayers.add(playerId);
      player.status = "active";

      // **UPDATE BOSS HP for mid-game join**
      const hpUpdateResult = this.updateBossHP(
        eventBossId,
        session.players.size,
        session.numberOfTeams
      );
      if (hpUpdateResult.changed) {
        console.log(
          `[MID-GAME JOIN] Boss HP updated for player ${player.nickname}`
        );
      }
    }

    // **AUTO-ASSIGN QUESTION POOL when player joins**
    // If battle is already started (mid-game join) or if we want to pre-assign
    const questionPoolResult = await this.assignQuestionPool(
      eventBossId,
      playerId
    );

    // **NEW: Broadcast leaderboard update to boss preview viewers after player joins**
    // Note: We'll need io to be passed in from the socket handler

    return { session, player, questionPoolResult };
  }

  // **ENHANCED: Assign randomized question pool to a player with proper answer selection**
  async assignQuestionPool(eventBossId, playerId, categoryId = null) {
    const session = this.sessions.get(eventBossId);
    if (!session) return null;

    try {
      // Get questions from the session's stored questionsData (from database)
      const questionsData = session.bossData.questionsData || [];

      if (questionsData.length === 0) {
        console.warn(`No questions data found for boss ${eventBossId}`);
        return null;
      }

      // Flatten all questions from all categories into a single pool
      let allQuestions = [];
      questionsData.forEach((category) => {
        category.questions.forEach((question) => {
          try {
            // Validate question structure before adding to pool
            this.validateQuestionStructure(question);

            // Transform database question format to game format with original choices
            const gameQuestion = {
              id: question.questionId,
              categoryId: category.categoryId,
              categoryName: category.categoryName,
              text: question.questionText,
              timeLimit: question.timeLimit || 30000, // Default 30 seconds
              answerChoices: question.answerChoices, // Keep original structure for proper selection
              originalQuestion: question, // Keep original for reference
            };
            allQuestions.push(gameQuestion);
          } catch (validationError) {
            console.warn(
              `Skipping invalid question: ${validationError.message}`
            );
          }
        });
      });

      if (allQuestions.length === 0) {
        console.warn(`No valid questions available for boss ${eventBossId}`);
        return null;
      }

      // Create player-specific seed for reproducible randomization
      const playerSeed = createComprehensivePlayerSeed(
        playerId,
        session.badges.sessionId,
        session.eventBossId,
        session.roomCode,
        session.joinCode,
        session.numberOfTeams,
        session.players.size,
        ["question_pool"]
      );
      const questionRng = new RandomGenerator(playerSeed);

      // Shuffle the questions for this specific player using seeded randomization
      const shuffledQuestions = questionRng.shuffle([...allQuestions]);

      // Process each question with proper answer selection and randomization
      const questionsWithPreparedChoices = shuffledQuestions.map(
        (question, questionIndex) => {
          return this.prepareQuestionForPlayer(
            question,
            playerId,
            eventBossId,
            questionIndex
          );
        }
      );

      // Assign pool to player
      session.questionPools.set(playerId, {
        questions: questionsWithPreparedChoices,
        currentIndex: 0, // Track which question they're on
        totalQuestions: questionsWithPreparedChoices.length,
        hasLooped: false,
        loopCount: 0,
        questionsUsed: new Set(),
        seed: playerSeed, // Store seed for debugging
        createdAt: new Date(),
      });

      const player = session.players.get(playerId);
      const playerNickname = player?.nickname || `Player ${playerId}`;

      return {
        questionsAssigned: questionsWithPreparedChoices.length,
        playerNickname,
        playerId,
        categoriesCount: questionsData.length,
        questionsPreview: questionsWithPreparedChoices.slice(0, 3).map((q) => ({
          category: q.categoryName,
          text: q.text,
          choicesCount: q.choices.length,
        })),
        seed: playerSeed,
      };
    } catch (error) {
      console.error("Error assigning question pool:", error);
      return null;
    }
  }

  /**
   * Prepare question by selecting 4 random answers from available choices and randomizing positions
   * Always includes the correct answer + 3 random incorrect ones
   */
  prepareQuestionForPlayer(question, playerId, eventBossId, questionIndex) {
    const session = this.sessions.get(eventBossId);
    if (!session) {
      throw new Error(`Session not found for eventBossId: ${eventBossId}`);
    }

    const allChoices = question.answerChoices;
    if (allChoices.length < 4) {
      throw new Error(
        `Question ${question.id} must have at least 4 answer choices, found ${allChoices.length}`
      );
    }

    // Create seed for this specific question and player using comprehensive seeding
    const questionSeed = createComprehensivePlayerSeed(
      playerId,
      session.badges.sessionId,
      session.eventBossId,
      session.roomCode,
      session.joinCode,
      session.numberOfTeams,
      session.players.size,
      ["question_choices", question.id, questionIndex]
    );
    const choiceRng = new RandomGenerator(questionSeed);

    // Find correct answer and incorrect answers
    const correctChoice = allChoices.find((choice) => choice.isCorrect);
    const incorrectChoices = allChoices.filter((choice) => !choice.isCorrect);

    if (!correctChoice) {
      throw new Error(`Question ${question.id} has no correct answer marked`);
    }

    if (incorrectChoices.length < 3) {
      throw new Error(
        `Question ${question.id} needs at least 3 incorrect choices, found ${incorrectChoices.length}`
      );
    }

    // Select 3 random incorrect answers using seeded randomization
    const shuffledIncorrect = choiceRng.shuffle([...incorrectChoices]);
    const selectedIncorrect = shuffledIncorrect.slice(0, 3);

    // Combine correct answer with 3 selected incorrect answers
    const selectedChoices = [correctChoice, ...selectedIncorrect];

    // Shuffle all 4 choices using seeded randomization
    const finalChoices = choiceRng.shuffle(selectedChoices);

    // Find new position of correct answer after shuffling
    const correctAnswerIndex = finalChoices.findIndex(
      (choice) => choice.isCorrect
    );

    // Format choices for game use
    const formattedChoices = finalChoices.map((choice, index) => ({
      id: choice.id,
      text: choice.choiceText,
      index: index,
    }));

    return {
      id: question.id,
      categoryId: question.categoryId,
      categoryName: question.categoryName,
      text: question.text,
      timeLimit: question.timeLimit || 30000,
      choices: formattedChoices,
      correctAnswerIndex: correctAnswerIndex,
      correctAnswerText: correctChoice.choiceText,
      originalQuestion: question.originalQuestion,
      totalAvailableChoices: allChoices.length,
      selectedChoicesInfo: {
        correct: correctChoice.choiceText,
        incorrect: selectedIncorrect.map((c) => c.choiceText),
      },
    };
  }

  getNextQuestionForPlayer(eventBossId, playerId) {
    const session = this.sessions.get(eventBossId);
    if (!session) return null;

    const playerPool = session.questionPools.get(playerId);
    if (!playerPool) return null;

    const { questions, currentIndex } = playerPool;

    // Check if we need to loop back to start
    if (currentIndex >= questions.length) {
      playerPool.currentIndex = 0;
      playerPool.hasLooped = true;
      playerPool.loopCount++;
      playerPool.questionsUsed.clear();

      // Reshuffle questions for variety on each loop using seeded randomization
      // Add loop count to seed for different shuffle each loop but still reproducible
      const loopSeed = createComprehensivePlayerSeed(
        playerId,
        session.badges.sessionId,
        session.eventBossId,
        session.roomCode,
        session.joinCode,
        session.numberOfTeams,
        session.players.size,
        ["question_pool", `loop_${playerPool.loopCount}`]
      );
      const loopRng = new RandomGenerator(loopSeed);
      playerPool.questions = loopRng.shuffle([...playerPool.questions]);
    }

    const currentQuestion = playerPool.questions[playerPool.currentIndex];

    // Move to next question
    playerPool.currentIndex++;
    playerPool.questionsUsed.add(currentQuestion.id);

    // Store current question in active questions map
    session.questions.set(playerId, {
      ...currentQuestion,
      id: currentQuestion.id, // Use the actual question ID from database
      correctAnswerIndex: currentQuestion.correctAnswerIndex, // Explicitly ensure this is preserved
      choices: currentQuestion.choices, // Explicitly ensure choices are preserved
      correctAnswerText: currentQuestion.correctAnswerText, // Also preserve correct answer text
      startTime: Date.now(),
      timeLimit: currentQuestion.timeLimit || 30000, // Use question's time limit or default
      fromPool: true,
      questionNumber: playerPool.currentIndex,
      hasLooped: playerPool.hasLooped,
      loopCount: playerPool.loopCount,
    });

    return {
      id: currentQuestion.id,
      categoryId: currentQuestion.categoryId,
      categoryName: currentQuestion.categoryName,
      text: currentQuestion.text,
      choices: currentQuestion.choices,
      correctAnswerIndex: currentQuestion.correctAnswerIndex,
      timeLimit: currentQuestion.timeLimit || 30000,
      questionNumber: playerPool.currentIndex,
      totalQuestions: playerPool.totalQuestions,
      metadata: {
        questionIndex: playerPool.currentIndex - 1,
        totalAvailable: questions.length,
        hasLooped: playerPool.hasLooped,
        loopCount: playerPool.loopCount,
        categoryId: currentQuestion.categoryId,
        totalAvailableChoices: currentQuestion.totalAvailableChoices,
        selectedChoicesInfo: currentQuestion.selectedChoicesInfo,
      },
    };
  }

  getQuestionById(eventBossId, playerId, questionId) {
    const session = this.sessions.get(eventBossId);
    if (!session) return null;

    const playerPool = session.questionPools.get(playerId);
    if (!playerPool) return null;

    const question = playerPool.questions.find((q) => q.id === questionId);
    if (!question) return null;

    return question;
  }

  markQuestionAnswered(
    eventBossId,
    playerId,
    questionId,
    isCorrect,
    responseTime
  ) {
    const session = this.sessions.get(eventBossId);
    if (!session) return null;

    const playerPool = session.questionPools.get(playerId);
    if (!playerPool) return null;

    // Track question history for analytics
    if (!playerPool.questionHistory) {
      playerPool.questionHistory = [];
    }

    playerPool.questionHistory.push({
      questionId,
      isCorrect,
      responseTime,
      answeredAt: new Date(),
      loopNumber: playerPool.loopCount,
    });

    return playerPool;
  }

  getPlayerPoolStats(eventBossId, playerId) {
    const session = this.sessions.get(eventBossId);
    if (!session) return null;

    const playerPool = session.questionPools.get(playerId);
    if (!playerPool) return null;

    const history = playerPool.questionHistory || [];
    const correctAnswers = history.filter((q) => q.isCorrect).length;
    const totalAnswered = history.length;

    return {
      playerId: playerId,
      totalQuestionsInPool: playerPool.questions.length,
      currentIndex: playerPool.currentIndex,
      totalAnswered,
      correctAnswers,
      incorrectAnswers: totalAnswered - correctAnswers,
      accuracy:
        totalAnswered > 0
          ? ((correctAnswers / totalAnswered) * 100).toFixed(1)
          : 0,
      hasLooped: playerPool.hasLooped,
      loopCount: playerPool.loopCount,
      averageResponseTime:
        totalAnswered > 0
          ? history.reduce((sum, q) => sum + q.responseTime, 0) / totalAnswered
          : 0,
      createdAt: playerPool.createdAt,
    };
  }

  validateQuestionStructure(question) {
    if (!question.answerChoices || !Array.isArray(question.answerChoices)) {
      throw new Error(
        `Question ${question.id || "unknown"} missing answerChoices array`
      );
    }

    if (question.answerChoices.length < 4) {
      throw new Error(
        `Question ${
          question.id || "unknown"
        } needs at least 4 answer choices, found ${
          question.answerChoices.length
        }`
      );
    }

    const correctChoices = question.answerChoices.filter(
      (choice) => choice.isCorrect
    );
    if (correctChoices.length !== 1) {
      throw new Error(
        `Question ${
          question.id || "unknown"
        } must have exactly 1 correct answer, found ${correctChoices.length}`
      );
    }

    const incorrectChoices = question.answerChoices.filter(
      (choice) => !choice.isCorrect
    );
    if (incorrectChoices.length < 3) {
      throw new Error(
        `Question ${
          question.id || "unknown"
        } needs at least 3 incorrect choices for proper randomization, found ${
          incorrectChoices.length
        }`
      );
    }

    return true;
  }

  removePlayer(socketId) {
    const playerSession = this.playerSessions.get(socketId);
    if (!playerSession) return null;

    const { playerId, eventBossId } = playerSession;
    const session = this.sessions.get(eventBossId);

    if (session) {
      const player = session.players.get(playerId);
      if (player && player.teamId) {
        const team = session.teams.get(player.teamId);
        if (team) {
          team.players.delete(playerId);
        }
      }

      session.players.delete(playerId);
      session.waitingPlayers.delete(playerId);
      session.activePlayers.delete(playerId);
    }

    this.playerSessions.delete(socketId);
    return playerSession;
  }

  reconnectPlayer(eventBossId, newSocketId, userInfo) {
    const session = this.sessions.get(eventBossId);
    if (!session) {
      return null;
    }

    // Find existing player by user ID or username
    let existingPlayer = null;
    let playerId = null;

    for (const [pid, player] of session.players.entries()) {
      const userMatches = userInfo.id && player.userId === userInfo.id;
      const usernameMatches =
        userInfo.username && player.username === userInfo.username;
      const guestMatches =
        userInfo.isGuest &&
        player.isGuest &&
        player.username === userInfo.username;

      if (userMatches || usernameMatches || guestMatches) {
        existingPlayer = player;
        playerId = pid;
        break;
      }
    }

    if (!existingPlayer) {
      return null;
    }

    // Update socket ID for the existing player
    const oldSocketId = existingPlayer.socketId;
    existingPlayer.socketId = newSocketId;

    // Update playerSessions mapping
    if (oldSocketId && this.playerSessions.has(oldSocketId)) {
      this.playerSessions.delete(oldSocketId);
    }

    this.playerSessions.set(newSocketId, {
      playerId,
      eventBossId,
      nickname: existingPlayer.nickname,
      userId: existingPlayer.userId,
      username: existingPlayer.username,
      isGuest: existingPlayer.isGuest,
    });

    return {
      success: true,
      session,
      player: existingPlayer,
      isReconnect: true,
    };
  }

  // Start boss fight
  async startBossFight(eventBossId) {
    const session = this.sessions.get(eventBossId);
    if (!session || session.isStarted) return false;

    // Check if boss is on cooldown
    if (
      session.bossData.cooldownUntil &&
      new Date() < session.bossData.cooldownUntil
    ) {
      return false;
    }

    const playerCount = session.waitingPlayers.size;
    const numberOfTeams = session.numberOfTeams;

    try {
      // **UPDATE BOSS STATUS TO IN-BATTLE**
      await EventBoss.update(
        { status: "in-battle" },
        { where: { id: eventBossId } }
      );

      console.log(
        `🎲 [BOSS BATTLE] Starting battle for eventBossId: ${eventBossId}, participants: ${playerCount}`
      );

      // **2. SCALE BOSS HP based on player count and team count**
      this.scaleBossHp(eventBossId);

      // **3. ASSIGN PLAYERS TO TEAMS**
      this.assignPlayersToTeams(session);

      // **4. ASSIGN QUESTION POOLS to all players when battle starts**
      const questionPoolAssignments =
        await this.assignQuestionPoolsToAllPlayers(eventBossId);

      // Team Information
      console.log(`👥 [TEAMS INFO]:`);
      session.teams.forEach((team, teamId) => {
        const teamPlayers = Array.from(team.players).map((playerId) => {
          const player = session.players.get(playerId);
          return player ? player.nickname : `Player-${playerId}`;
        });
        console.log(
          `   Team ${teamId}: ${teamPlayers.join(", ")} (${
            team.players.size
          } players)`
        );
      });

      // Move waiting players to active
      session.waitingPlayers.forEach((playerId) => {
        session.activePlayers.add(playerId);
        const player = session.players.get(playerId);
        if (player) {
          player.status = "active";
        }
      });
      session.waitingPlayers.clear();

      session.isStarted = true;
      session.startedAt = new Date();
      session.bossData.isActive = true;

      // **UPDATE BOSS STATUS TO IN-BATTLE**
      try {
        await EventBoss.update(
          { status: "in-battle" },
          { where: { id: eventBossId } }
        );
        console.log(
          `🔄 [BOSS STATUS] Updated boss ${eventBossId} to 'in-battle'`
        );
      } catch (error) {
        console.error("Error updating boss status to in-battle:", error);
      }

      return {
        success: true,
        eventBossId: eventBossId,
        questionPoolAssignments,
        bossHp: {
          baseHp: session.bossData.baseHp,
          scaledHp: session.bossData.maxHp,
          currentHp: session.bossData.currentHp,
        },
        teams: Array.from(session.teams.values()).map((team) => ({
          id: team.id,
          name: team.name,
          playerCount: team.players.size,
          players: Array.from(team.players)
            .map((playerId) => {
              const player = session.players.get(playerId);
              return player
                ? { id: playerId, nickname: player.nickname }
                : null;
            })
            .filter(Boolean),
        })),
      };
    } catch (error) {
      console.error("Error creating boss session:", error);
      return {
        success: false,
        error: "Failed to create boss session",
      };
    }
  }

  async assignQuestionPoolsToAllPlayers(eventBossId) {
    const session = this.sessions.get(eventBossId);
    if (!session) return [];

    const playerIds = Array.from(session.waitingPlayers);
    const assignmentResults = [];

    for (const playerId of playerIds) {
      if (!session.questionPools.has(playerId)) {
        const result = await this.assignQuestionPool(eventBossId, playerId);
        if (result) {
          assignmentResults.push(result);
        }
      } else {
        const player = session.players.get(playerId);
        const playerNickname = player?.nickname || `Player ${playerId}`;

        assignmentResults.push({
          questionsAssigned: session.questionPools.get(playerId).totalQuestions,
          playerNickname,
          playerId,
          wasAlreadyAssigned: true,
        });
      }
    }

    assignmentResults.forEach((result, index) => {
      console.log(
        `   ${index + 1}. ${result.playerNickname}: ${
          result.questionsAssigned
        } questions ${
          result.wasAlreadyAssigned ? "(already assigned)" : "(newly assigned)"
        }`
      );
    });

    return assignmentResults;
  }

  // Assign players to teams with balanced but randomized assignment
  assignPlayersToTeams(session) {
    const playerIds = Array.from(session.waitingPlayers);

    // Sort playerIds for consistent order (important for seeded randomization)
    playerIds.sort();

    playerIds.forEach((playerId, index) => {
      const player = session.players.get(playerId);
      if (player) {
        // Use the team assignment approach from TeamManager
        const teamArray = Array.from(session.teams.values());

        // Find all teams with minimum players (for load balancing)
        const minPlayerCount = Math.min(
          ...teamArray.map((team) => team.players.size)
        );
        const availableTeams = teamArray.filter(
          (team) => team.players.size === minPlayerCount
        );

        let selectedTeam;

        if (availableTeams.length === 1) {
          // Only one team with minimum players, assign there
          selectedTeam = availableTeams[0];
        } else {
          // Multiple teams with same minimum count, randomize selection
          // Use player-specific seed for consistent but random assignment
          const seed = createTeamAssignmentSeed(
            session.badges.sessionId,
            session.eventBossId,
            session.roomCode,
            session.joinCode,
            session.numberOfTeams,
            session.players.size,
            index
          );
          const rng = new RandomGenerator(seed);
          const randomIndex = rng.randomInt(0, availableTeams.length - 1);
          selectedTeam = availableTeams[randomIndex];
        }

        // Assign player to selected team
        player.teamId = selectedTeam.id;
        selectedTeam.players.add(playerId);
      }
    });
  }

  // Assign a single player to a team (for mid-game joins) with balanced randomization
  assignPlayerToTeam(session, playerId) {
    const player = session.players.get(playerId);
    if (!player || player.teamId) return; // Already assigned

    const teamArray = Array.from(session.teams.values());

    // Find all teams with minimum players (for load balancing)
    const minPlayerCount = Math.min(
      ...teamArray.map((team) => team.players.size)
    );
    const availableTeams = teamArray.filter(
      (team) => team.players.size === minPlayerCount
    );

    let selectedTeam;

    if (availableTeams.length === 1) {
      // Only one team with minimum players, assign there
      selectedTeam = availableTeams[0];
    } else {
      // Multiple teams with same minimum count, randomize selection
      // Use player-specific seed for consistent assignment
      const seed = createTeamAssignmentSeed(
        session.badges.sessionId,
        session.eventBossId,
        session.roomCode,
        session.joinCode,
        session.numberOfTeams,
        session.players.size,
        session.players.size
      );
      const rng = new RandomGenerator(seed);
      const randomIndex = rng.randomInt(0, availableTeams.length - 1);
      selectedTeam = availableTeams[randomIndex];
    }

    // Assign player to selected team
    player.teamId = selectedTeam.id;
    selectedTeam.players.add(playerId);
  }

  // Send team information to a specific player
  sendTeamInfoToPlayer(io, eventBossId, playerId, reason = "assignment") {
    const session = this.sessions.get(eventBossId);
    if (!session) return false;

    const player = session.players.get(playerId);
    if (!player || !player.teamId || !player.socketId) return false;

    const team = session.teams.get(player.teamId);
    const playerSocket = io.sockets.sockets.get(player.socketId);

    if (playerSocket && team) {
      const message =
        reason === "reconnect" || reason === "mid-game-join-preview"
          ? `You are in ${team.name}`
          : `You are assigned to ${team.name}`;

      playerSocket.emit("player:team-info", {
        teamId: player.teamId,
        teamName: team.name,
        message: message,
        showToast: true, // **NEW: Request frontend to show toast**
        reason: reason,
      });
      return true;
    }
    return false;
  }

  // Send team information to all players in session
  sendTeamInfoToAllPlayers(io, eventBossId, reason = "battle-start") {
    const session = this.sessions.get(eventBossId);
    if (!session) return;

    let sentCount = 0;
    session.players.forEach((player, playerId) => {
      if (this.sendTeamInfoToPlayer(io, eventBossId, playerId, reason)) {
        sentCount++;
      }
    });

    return sentCount;
  }

  // **NEW: Notify team members about player knockout**
  notifyTeamAboutKnockout(io, eventBossId, knockedOutPlayerId) {
    const session = this.sessions.get(eventBossId);
    if (!session) {
      console.log("💀 DEBUG: Session not found for eventBossId:", eventBossId);
      return false;
    }

    const knockedOutPlayer = session.players.get(knockedOutPlayerId);
    if (!knockedOutPlayer || !knockedOutPlayer.teamId) {
      console.log("💀 DEBUG: Knocked out player not found or no teamId:", {
        knockedOutPlayer,
        teamId: knockedOutPlayer?.teamId,
      });
      return false;
    }

    const team = session.teams.get(knockedOutPlayer.teamId);
    if (!team) {
      console.log(
        "💀 DEBUG: Team not found for teamId:",
        knockedOutPlayer.teamId
      );
      console.log(
        "💀 DEBUG: Available teams:",
        Array.from(session.teams.keys())
      );
      return false;
    }

    console.log(
      "💀 =============== TEAM KNOCKOUT NOTIFICATION DEBUG ==============="
    );
    console.log("💀 Knocked Out Player:", knockedOutPlayer.nickname);
    console.log("💀 Team ID:", knockedOutPlayer.teamId);
    console.log("💀 Team Name:", team.name);
    console.log("💀 Team Players Array:", team.players);
    console.log("💀 All Session Players:");
    session.players.forEach((player, playerId) => {
      console.log(
        `   - ${player.nickname} (${playerId}): Team ${player.teamId}, Socket ${player.socketId}`
      );
    });
    console.log(
      "💀 ================================================================"
    );

    // **FIXED: Get all teammates from the session players on the same team**
    const teammates = Array.from(session.players.values()).filter(
      (player) =>
        player.teamId === knockedOutPlayer.teamId &&
        player.id !== knockedOutPlayerId &&
        player.socketId // Make sure they have an active socket
    );

    console.log(
      "💀 Found teammates:",
      teammates.map((p) => `${p.nickname} (${p.id})`)
    );

    // Notify all team members except the knocked out player
    let notificationsSent = 0;
    teammates.forEach((teammate) => {
      const playerSocket = io.sockets.sockets.get(teammate.socketId);
      if (playerSocket) {
        console.log(
          `💀 Sending notification to ${teammate.nickname} (${teammate.socketId})`
        );
        playerSocket.emit("teammate:knocked-out", {
          message: `${knockedOutPlayer.nickname} has been knocked out!`,
          knockedOutPlayerNickname: knockedOutPlayer.nickname,
          knockedOutPlayerId: knockedOutPlayerId, // **FIXED: Add player ID for tracking**
          teamName: team.name,
          revivalNeeded: true,
        });
        notificationsSent++;
      } else {
        console.log(
          `💀 Socket not found for ${teammate.nickname} (${teammate.socketId})`
        );
      }
    });

    console.log(
      `💀 Notified ${notificationsSent} team members about ${knockedOutPlayer.nickname}'s knockout`
    );
    return notificationsSent > 0;
  }

  // **ENHANCED: Process attack with response time-based damage calculation (from combat system)**
  async processAttack(
    eventBossId,
    playerId,
    isCorrect,
    responseTime,
    questionTimeLimit,
    damage = null,
    io = null
  ) {
    const session = this.sessions.get(eventBossId);
    if (!session || !session.isStarted) return null;

    const player = session.players.get(playerId);
    if (!player || player.isKnockedOut || player.status !== "active")
      return null;

    // Calculate damage using combat system method if not provided
    const calculatedDamage =
      damage !== null
        ? damage
        : this.calculateDamage(isCorrect, responseTime, questionTimeLimit);
    const responseCategory = getResponseTimeCategory(
      responseTime,
      questionTimeLimit
    );

    // Update player stats
    player.totalDamage += calculatedDamage;
    player.questionsAnswered++;
    if (isCorrect) {
      player.correctAnswers++;

      // 🎖️ BADGE TRACKING: Update badge manager with performance
      badgeManager.updatePlayerPerformance(session.badges.sessionId, playerId, {
        damage: player.totalDamage,
        correctAnswers: player.correctAnswers,
        accuracy:
          player.questionsAnswered > 0
            ? (player.correctAnswers / player.questionsAnswered) * 100
            : 0,
      });

      // Check for milestone badges based on EVENT-WIDE progress (accumulative)
      const eventCorrectAnswers = await this.getPlayerEventCorrectAnswers(
        session.eventId,
        player
      );
      console.log(
        `🎖️ Player ${player.nickname}: Session=${player.correctAnswers}, Event Total=${eventCorrectAnswers} correct answers`
      );

      // Check for milestone badges using our new badge system
      const newMilestoneBadges = await badgeManager.checkMilestones(
        session.eventId,
        playerId,
        player.nickname,
        eventCorrectAnswers
      );

      // Emit milestone badge notifications immediately
      if (newMilestoneBadges.length > 0) {
        console.log(
          `� NEW MILESTONE BADGES AWARDED to ${player.nickname}:`,
          newMilestoneBadges.map((b) => `${b.name} (${b.milestone} questions)`)
        );

        // Store for session tracking
        session.badges.earnedBadges.push(...newMilestoneBadges);

        // **SAVE MILESTONE BADGES TO DATABASE IMMEDIATELY**
        try {
          for (const badge of newMilestoneBadges) {
            // The badge.id now contains the actual database badge ID
            await UserBadge.create({
              playerId: badge.playerId,
              badgeId: badge.id, // This is now the actual database badge ID
              eventBossId: eventBossId,
              eventId: badge.eventId,
              earnedAt: badge.earnedAt || new Date(),
            });

            console.log(
              `💾 Saved milestone badge ${badge.name} for ${badge.playerNickname} to database`
            );
          }
        } catch (dbError) {
          console.error(
            "❌ Error saving milestone badges to database:",
            dbError
          );
        }

        // Find player's socket ID
        let playerSocketId = player.socketId;
        if (!playerSocketId) {
          // Fallback: find socket ID from playerSessions mapping
          for (const [
            socketId,
            playerSession,
          ] of this.playerSessions.entries()) {
            if (
              playerSession.playerId === player.id &&
              playerSession.eventBossId === eventBossId
            ) {
              playerSocketId = socketId;
              break;
            }
          }
        }

        if (playerSocketId && io) {
          // Emit to player immediately
          io.to(playerSocketId).emit("badge-earned", {
            type: "Milestone",
            badgeId: newMilestoneBadges[0].id,
            badgeIcon: newMilestoneBadges[0].icon,
            message: `�️ Congratulations! You earned the ${newMilestoneBadges[0].name} milestone badge!`,
            milestone: newMilestoneBadges[0].milestone,
            eventBossId,
            isBattleEnd: false, // This is immediate, not at battle end
          });
        } else {
          console.warn(
            `⚠️ Could not emit badge notification: socketId=${playerSocketId}, io=${!!io}`
          );
        }

        // Emit to all players for celebration
        if (io) {
          io.to(`boss-${eventBossId}`).emit("badge:player-milestone", {
            playerNickname: player.nickname,
            badges: newMilestoneBadges,
            message: `🎉 ${player.nickname} reached ${newMilestoneBadges[0].milestone} correct answers!`,
          });
        }
      }

      console.log(`🎖️ Badge tracking updated for ${player.nickname}`);
    }

    // Update team damage
    const team = session.teams.get(player.teamId);
    if (team) {
      team.totalDamage += calculatedDamage;
    }

    // **UPDATE LEADERBOARD AT END OF BATTLE ONLY**
    // Note: Real-time leaderboard updates moved to endBossFight() to avoid duplicate accumulation
    // Live leaderboard display uses session data, database is updated only once per session

    try {
      // Use playerSessionId if available, otherwise use userId for authenticated users
      const leaderboardPlayerId = player.playerSessionId || player.userId;

      if (leaderboardPlayerId) {
        console.log(
          `📊 [LEADERBOARD] Session data for ${player.nickname}: ${player.totalDamage} damage, ${player.correctAnswers} correct (DB will be updated at battle end)`
        );
      } else {
        console.log(
          `📊 [LEADERBOARD] Skipped for guest ${player.nickname} - no valid ID`
        );
      }
    } catch (leaderboardError) {
      console.error("❌ Error updating leaderboard:", leaderboardError.message);
      // Don't fail the attack process for leaderboard errors
    }

    // Update boss HP
    if (calculatedDamage > 0) {
      session.bossData.currentHp = Math.max(
        0,
        session.bossData.currentHp - calculatedDamage
      );
    }

    // Check if boss is defeated
    const isBossDefeated = session.bossData.currentHp <= 0;
    if (isBossDefeated) {
      // Record last hit player for badge system
      badgeManager.recordLastHit(
        session.badges.sessionId,
        playerId,
        player.nickname
      );
      console.log(
        `🎯 Last hit recorded for ${player.nickname} - boss defeated!`
      );

      this.endBossFight(eventBossId, playerId, io); // Pass playerId as finalHitPlayerId
    }

    console.log(`⚔️  [COMBAT] Player attack processed:`, {
      playerNickname: player.nickname,
      isCorrect,
      responseTime: `${responseTime}ms`,
      responseCategory,
      damage: calculatedDamage,
      bossHPAfter: session.bossData.currentHp,
      bossDefeated: isBossDefeated,
    });

    // **NEW: Broadcast leaderboard update to boss preview viewers**
    if (typeof io !== "undefined" && io) {
      this.broadcastLeaderboardUpdate(io, eventBossId).catch((error) => {
        console.error(
          "Error broadcasting leaderboard update after attack:",
          error
        );
      });
    }

    return {
      session,
      player,
      team,
      damage: calculatedDamage,
      responseCategory,
      responseTime,
      isBossDefeated,
      finalHitBy: isBossDefeated ? playerId : null,
      bossCurrentHP: session.bossData.currentHp,
      bossMaxHP: session.bossData.maxHp,
    };
  }

  // **NEW: Calculate damage based on correctness and response speed (from combat system)**
  calculateDamage(isCorrect, responseTime, questionTimeLimit) {
    if (!isCorrect) {
      return 0; // No damage for incorrect answers
    }

    const responseCategory = getResponseTimeCategory(
      responseTime,
      questionTimeLimit
    );
    const multiplier = GAME_CONSTANTS.DAMAGE_MULTIPLIERS[responseCategory];

    return GAME_CONSTANTS.BASE_DAMAGE * multiplier; // Base damage multiplied by speed bonus
  }

  // **NEW: Update player leaderboard data - ACCUMULATIVE ACROSS SESSIONS**
  async updatePlayerLeaderboard(
    playerId,
    eventBossId,
    sessionTotalDamage,
    sessionTotalCorrectAnswers
  ) {
    try {
      // Find existing leaderboard entry or create new one
      const [leaderboardEntry, created] = await Leaderboard.findOrCreate({
        where: {
          playerId: playerId,
          eventBossId: eventBossId,
        },
        defaults: {
          id: uuidv4(),
          playerId: playerId,
          eventBossId: eventBossId,
          totalDamageDealt: sessionTotalDamage,
          totalCorrectAnswers: sessionTotalCorrectAnswers,
        },
      });

      // If entry already exists, ADD session totals to existing totals (accumulative across sessions)
      if (!created) {
        await leaderboardEntry.update({
          totalDamageDealt:
            leaderboardEntry.totalDamageDealt + sessionTotalDamage,
          totalCorrectAnswers:
            leaderboardEntry.totalCorrectAnswers + sessionTotalCorrectAnswers,
        });
      }

      return leaderboardEntry;
    } catch (error) {
      console.error("❌ Error updating player leaderboard:", error.message);
      throw error;
    }
  }

  // Process incorrect answer (lose heart)
  processIncorrectAnswer(eventBossId, playerId) {
    const session = this.sessions.get(eventBossId);
    if (!session || !session.isStarted) return null;

    const player = session.players.get(playerId);
    if (!player || player.isKnockedOut) return null;

    // ===== ENHANCED PLAYER SESSION DEBUG =====
    console.log("👤 =============== PLAYER SESSION DEBUG ===============");
    console.log("🆔 Session Info:");
    console.log(`   Event Boss ID: ${eventBossId}`);
    console.log(`   Session Started: ${session.isStarted}`);
    console.log(`   Total Players: ${session.players.size}`);
    console.log("👤 Player Before Processing:");
    console.log(`   Player ID: ${playerId}`);
    console.log(`   Nickname: ${player.nickname}`);
    console.log(`   Team ID: ${player.teamId}`);
    console.log(`   Hearts: ${player.hearts}`);
    console.log(`   Status: ${player.status}`);
    console.log(`   Is Knocked Out: ${player.isKnockedOut}`);
    console.log(`   Questions Answered: ${player.questionsAnswered}`);
    console.log(`   Correct Answers: ${player.correctAnswers}`);
    console.log(`   Total Damage: ${player.totalDamage}`);
    console.log(`   Socket ID: ${player.socketId}`);
    console.log("� ====================================================");

    console.log("�💔 Processing incorrect answer:", {
      playerId,
      playerNickname: player.nickname,
      currentHearts: player.hearts,
      newHearts: Math.max(0, player.hearts - 1),
    });

    const heartsBeforeProcessing = player.hearts;
    player.hearts = Math.max(0, player.hearts - 1);
    player.questionsAnswered++;
    const heartsAfterProcessing = player.hearts;

    console.log("💔 Heart Processing Results:");
    console.log(`   Hearts Before: ${heartsBeforeProcessing}`);
    console.log(`   Hearts After: ${heartsAfterProcessing}`);
    console.log(
      `   Hearts Lost: ${heartsBeforeProcessing - heartsAfterProcessing}`
    );
    console.log(`   Will Be Knocked Out: ${player.hearts <= 0}`);

    // Check if player is knocked out
    if (player.hearts <= 0) {
      player.isKnockedOut = true;
      player.status = "knocked_out";

      console.log("💀 =============== PLAYER KNOCKOUT DEBUG ===============");
      console.log("💀 Player knocked out:", {
        playerId,
        playerNickname: player.nickname,
        hearts: player.hearts,
        finalStatus: player.status,
        isKnockedOut: player.isKnockedOut,
      });
      console.log("💀 ====================================================");

      // Generate revival code
      const reviveCode = this.generateReviveCode(eventBossId, playerId);

      return {
        session,
        player,
        isKnockedOut: true,
        reviveCode,
        shouldNotifyTeam: true,
      };
    }

    console.log("✅ Player survived with hearts remaining:", player.hearts);
    return {
      session,
      player,
      isKnockedOut: false,
    };
  }

  // **ENHANCED: Generate revival code with proper uniqueness checking**
  generateReviveCode(eventBossId, playerId) {
    const session = this.sessions.get(eventBossId);
    if (!session) {
      throw new Error("Session not found");
    }

    try {
      // Generate a unique revival code for this session using comprehensive seeding
      const code = generateUniqueRevivalCode(
        session.badges.sessionId,
        session.eventBossId,
        session.roomCode,
        session.joinCode,
        session.numberOfTeams,
        session.players.size,
        playerId,
        this.reviveCodes
      );
      const expiresAt = new Date(Date.now() + 60000); // 60 seconds

      // Store revival code with player information
      this.reviveCodes.set(code, {
        playerId,
        eventBossId,
        expiresAt,
        knockedOutAt: new Date(),
      });

      console.log("🔑 =============== REVIVAL CODE GENERATED ===============");
      console.log("🔑 Revival Code:", formatRevivalCodeForDisplay(code));
      console.log("🔑 Player ID:", playerId);
      console.log("🔑 Event Boss ID:", eventBossId);
      console.log("🔑 Expires At:", expiresAt);
      console.log("🔑 =======================================================");

      // Auto-cleanup expired code and handle timeout
      setTimeout(() => {
        const reviveData = this.reviveCodes.get(code);
        if (reviveData) {
          // If code still exists after 60 seconds, player is permanently dead
          // The actual death handling will be done by the socket handler
          this.reviveCodes.delete(code);

          // Mark this code as expired for potential socket handler use
          this.reviveCodes.set(`EXPIRED_${code}`, {
            ...reviveData,
            expiredAt: new Date(),
          });

          // Clean up expired marker after 5 minutes
          setTimeout(() => {
            this.reviveCodes.delete(`EXPIRED_${code}`);
          }, 300000);
        }
      }, 60000);

      return code;
    } catch (error) {
      console.error("Error generating revival code:", error);
      throw error;
    }
  }

  // **NEW: Handle player death when revival time expires**
  handlePlayerDeath(eventBossId, playerId) {
    const session = this.sessions.get(eventBossId);
    if (!session) return;

    const player = session.players.get(playerId);
    if (!player) return;

    // Mark player as permanently dead
    player.status = "dead";
    player.isKnockedOut = false; // No longer just knocked out, they're dead

    console.log("☠️ =============== PLAYER DEATH DEBUG ===============");
    console.log("☠️ Player died:", {
      playerId,
      playerNickname: player.nickname,
      status: player.status,
      timeOfDeath: new Date(),
    });
    console.log("☠️ ===================================================");

    // **NEW: Emit event to notify the dead player to return to boss preview**
    // This will be handled by the socket handlers
    return {
      session,
      player,
      isDead: true,
    };
  }

  // **ENHANCED: Revive player with improved validation and team notifications**
  revivePlayer(eventBossId, reviveCode, reviverPlayerId) {
    // Validate revival code format
    if (!validateRevivalCode(reviveCode)) {
      return { success: false, error: "Invalid revival code format" };
    }

    const reviveData = this.reviveCodes.get(reviveCode);
    if (!reviveData || reviveData.eventBossId !== eventBossId) {
      return { success: false, error: "Invalid revival code" };
    }

    if (new Date() > reviveData.expiresAt) {
      this.reviveCodes.delete(reviveCode);
      return { success: false, error: "Revival code expired" };
    }

    const session = this.sessions.get(eventBossId);
    if (!session) {
      return { success: false, error: "Session not found" };
    }

    const revivedPlayer = session.players.get(reviveData.playerId);
    const reviverPlayer = session.players.get(reviverPlayerId);

    if (!revivedPlayer || !reviverPlayer) {
      return { success: false, error: "Player not found" };
    }

    // Check if both players are on the same team
    if (revivedPlayer.teamId !== reviverPlayer.teamId) {
      return { success: false, error: "Can only revive teammates" };
    }

    if (!reviverPlayer.isKnockedOut && reviverPlayer.status === "active") {
      // **ENHANCED: Revive the player with full health restoration**
      revivedPlayer.hearts = 3; // Restore full hearts
      revivedPlayer.isKnockedOut = false;
      revivedPlayer.status = "active";

      // **NEW: Remove the revival code since it's been used**
      this.reviveCodes.delete(reviveCode);

      console.log("💚 =============== PLAYER REVIVAL DEBUG ===============");
      console.log("💚 Player revived:", {
        revivedPlayerId: revivedPlayer.id,
        revivedPlayerNickname: revivedPlayer.nickname,
        reviverPlayerId: reviverPlayer.id,
        reviverPlayerNickname: reviverPlayer.nickname,
        teamId: revivedPlayer.teamId,
        heartsRestored: revivedPlayer.hearts,
        revivalCode: formatRevivalCodeForDisplay(reviveCode),
        revivedAt: new Date(),
      });
      console.log("💚 ====================================================");

      return {
        success: true,
        revivedPlayer,
        reviverPlayer,
        message: `${revivedPlayer.nickname} has been revived by ${reviverPlayer.nickname}!`,
      };
    }

    return {
      success: false,
      error:
        "Reviver cannot perform revival (must be active and not knocked out)",
    };
  }

  // End boss fight
  async endBossFight(eventBossId, finalHitPlayerId = null, io = null) {
    console.log(
      `🏁 [END BOSS] Starting endBossFight for ${eventBossId}, finalHit: ${finalHitPlayerId}`
    );

    const session = this.sessions.get(eventBossId);
    if (!session) {
      console.log(`❌ [END BOSS] No session found for ${eventBossId}`);
      return null;
    }

    // **DUPLICATE CALL PROTECTION**: Check if boss fight already ended
    if (session.bossData.status === "cooldown") {
      console.log(
        `⚠️ [END BOSS] Boss fight for ${eventBossId} already ended - skipping duplicate call`
      );
      return null;
    }

    // Set the end time for session tracking
    session.endTime = new Date();

    session.isStarted = false;
    session.bossData.isActive = false;

    // Set cooldown
    const cooldownDuration = session.bossData.cooldownDuration || 300000; // 5 minutes default
    session.bossData.cooldownUntil = new Date(Date.now() + cooldownDuration);

    // Reset boss HP for next fight
    session.bossData.currentHp = session.bossData.maxHp;

    // Determine winning team and MVP
    let winningTeam = null;
    let maxDamage = 0;
    let mvpPlayer = null;
    let mvpDamage = 0;

    session.teams.forEach((team) => {
      if (team.totalDamage > maxDamage) {
        maxDamage = team.totalDamage;
        winningTeam = team;
      }
    });

    // Find MVP (player with most damage)
    session.players.forEach((player) => {
      if (player.totalDamage > mvpDamage) {
        mvpDamage = player.totalDamage;
        mvpPlayer = player;
      }
    });

    // **AWARD BADGES**
    try {
      const sessionToken = session.badges.sessionId;
      console.log(
        `🎖️ [BADGE START] Badge awarding session ${sessionToken} for ${eventBossId}`
      );

      // **AWARD BADGES using new Badge System**
      console.log(`🏆 ======= END-OF-BATTLE BADGE AWARDS (NEW SYSTEM) =======`);
      console.log(`🏆 Boss Defeated! Final HP: ${session.bossData.currentHp}`);
      console.log(`🏆 EventBoss ID: ${eventBossId}`);
      console.log(`🏆 Event ID: ${session.eventId}`);
      console.log(`🏆 Final Hit by: ${finalHitPlayerId}`);

      // 🐛 DEBUG: Check badge session data before awarding
      const badgeSessionData = badgeManager.getSessionStats(
        session.badges.sessionId
      );
      console.log(`🐛 Badge session data:`, {
        sessionId: session.badges.sessionId,
        sessionExists: !!badgeSessionData,
        mvpCandidate: badgeSessionData?.mvpCandidate,
        lastHitPlayer: badgeSessionData?.lastHitPlayer,
        playersCount: badgeSessionData?.players?.size || 0,
      });

      // Determine winning team player IDs for Boss Defeated badge
      let winningTeamPlayerIds = [];
      if (winningTeam) {
        winningTeam.players.forEach((playerId) => {
          const player = session.players.get(playerId);
          if (player) {
            winningTeamPlayerIds.push(player.playerId); // Use player.playerId for badge system
          }
        });
        console.log(
          `🏅 Winning team: ${winningTeam.name} with ${winningTeamPlayerIds.length} players`
        );
        console.log(
          `🏅 Winning team player IDs: ${winningTeamPlayerIds.join(", ")}`
        );
      }

      // Award battle result badges using our new badge system
      const battleResultBadges = await badgeManager.awardBattleResultBadges(
        session.badges.sessionId,
        session.eventId,
        winningTeamPlayerIds // Pass winning team player IDs
      );

      console.log(
        `🏆 Battle result badges awarded: ${battleResultBadges.length}`
      );
      console.log(
        `🏆 Badge details:`,
        battleResultBadges.map((b) => ({
          id: b.id,
          name: b.name,
          playerId: b.playerId,
          playerNickname: b.playerNickname,
        }))
      );

      // Debug: Check session data
      console.log(`🔍 Badge session debug:`, {
        sessionId: session.badges.sessionId,
        sessionExists: badgeManager.sessionBadges.has(session.badges.sessionId),
        sessionData: badgeManager.getSessionStats(session.badges.sessionId),
      });

      // Emit badge notifications for MVP, Last Hit, and Boss Defeated badges
      battleResultBadges.forEach((badge) => {
        const player = Array.from(session.players.values()).find(
          (p) => p.id === badge.playerId
        );
        if (player) {
          console.log(
            `🏆 Awarding ${badge.name} badge to ${badge.playerNickname}`
          );

          // Find player's socket ID
          let playerSocketId = player.socketId;
          if (!playerSocketId) {
            // Fallback: find socket ID from playerSessions mapping
            for (const [
              socketId,
              playerSession,
            ] of this.playerSessions.entries()) {
              if (
                playerSession.playerId === player.id &&
                playerSession.eventBossId === eventBossId
              ) {
                playerSocketId = socketId;
                break;
              }
            }
          }

          if (playerSocketId && io) {
            // Emit to the specific player using the same event as milestones
            io.to(playerSocketId).emit("badge-earned", {
              type: badge.name, // Use badge.name instead of checking old hardcoded IDs
              badgeId: badge.id,
              badgeName: badge.name,
              badgeIcon: badge.icon,
              message: `🏆 Congratulations! You earned the ${badge.name} badge!`,
              eventBossId,
              isBattleEnd: true,
            });
          } else {
            console.warn(
              `⚠️ Could not emit battle badge notification: socketId=${playerSocketId}, io=${!!io}`
            );
          }

          // Emit to all players for celebration
          if (io) {
            io.to(`boss-${eventBossId}`).emit("badge:battle-celebration", {
              playerNickname: badge.playerNickname,
              badge,
              message: `🎉 ${badge.playerNickname} earned the ${badge.name} badge!`,
            });
          }
        }
      });

      // Store badges in session for reference
      session.badges.earnedBadges.push(...battleResultBadges);

      console.log(
        `🏆 Badge awarding completed - ${battleResultBadges.length} badges awarded`
      );

      // **SAVE BADGES TO DATABASE**
      try {
        for (const badge of battleResultBadges) {
          // The badge.id now contains the actual database badge ID
          await UserBadge.create({
            playerId: badge.playerId,
            badgeId: badge.id, // This is now the actual database badge ID
            eventBossId: eventBossId,
            eventId: badge.eventId,
            earnedAt: badge.earnedAt || new Date(),
          });

          console.log(
            `💾 Saved ${badge.name} badge for ${badge.playerNickname} to database`
          );
        }
      } catch (dbError) {
        console.error("❌ Error saving badges to database:", dbError);
        // Don't fail the entire process for database errors
      }

      const awardedBadges = {
        mvp: battleResultBadges.find((b) => b.id === "mvp"),
        lastHit: battleResultBadges.find((b) => b.id === "last_hit"),
        bossDefeated: battleResultBadges.filter(
          (b) => b.id === "boss_defeated"
        ),
        milestones: session.badges.earnedBadges.filter(
          (b) => b.type === "milestone"
        ),
      };

      // Clean up the badge manager session - MOVED TO END OF METHOD
      // badgeManager.clearSession(session.badges.sessionId);

      console.log(`�️ ===== NEW BADGE SYSTEM RESULTS =====`);
      console.log(
        `🎖️   🏆 MVP Badge: ${
          awardedBadges.mvp ? awardedBadges.mvp.playerNickname : "None"
        }`
      );
      console.log(
        `🎖️   � Last Hit Badge: ${
          awardedBadges.lastHit ? awardedBadges.lastHit.playerNickname : "None"
        }`
      );
      console.log(
        `🎖️   🏅 Boss Defeated Badges: ${awardedBadges.bossDefeated.length} awarded`
      );
      console.log(
        `�️   🎯 Milestone Badges: ${awardedBadges.milestones.length} milestone badges in session`
      );
      console.log(`🎖️ =====================================\n`);

      // 🚫 OLD BADGE SYSTEM DISABLED - Using new badge system above
      /*
      // Award Last Hit badge
      if (finalHitPlayerId) {
        const finalHitPlayer = session.players.get(finalHitPlayerId);
        if (finalHitPlayer && finalHitPlayer.userId) {
          console.log(`\n🎯 --- LAST HIT BADGE AWARD ---`);
          console.log(
            `🎯 Last Hit Player: ${finalHitPlayer.nickname} (${finalHitPlayer.userId})`
          );
          console.log(
            `🎯 Awarding Last Hit badge to ${finalHitPlayer.nickname}`
          );

          awardedBadges.lastHit = await BadgeService.awardLastHitBadge(
            finalHitPlayer.userId,
            eventBossId, // Use eventBossId instead of bossSessionId
            session.eventId // Pass actual eventId
          );
          console.log(
            `🎯 [RESULT] Last Hit Badge Service Result:`,
            awardedBadges.lastHit
          );
        } else {
          console.log(
            `🎯 No Last Hit badge awarded - no valid user ID for final hit player`
          );
        }
      } else {
        console.log(
          `🎯 No Last Hit badge awarded - no final hit player identified`
        );
      }

      // Award Boss Defeated badges to winning team
      if (winningTeam) {
        const winningPlayerIds = [];
        winningTeam.players.forEach((playerId) => {
          const player = session.players.get(playerId);
          if (player && player.userId) {
            winningPlayerIds.push(player.userId);
          }
        });

        console.log(`\n🏅 --- BOSS DEFEATED BADGES AWARD ---`);
        console.log(`🏅 Winning Team: ${winningTeam.name}`);
        console.log(`🏅 Team Damage: ${winningTeam.totalDamage}`);
        console.log(`🏅 Players with User IDs: ${winningPlayerIds.length}`);
        console.log(`🏅 Player IDs: ${winningPlayerIds.join(", ")}`);
        console.log(
          `🏅 Awarding Boss Defeated badges to ${winningPlayerIds.length} players`
        );

        awardedBadges.bossDefeated = await BadgeService.awardBossDefeatedBadges(
          winningPlayerIds,
          eventBossId, // Use eventBossId instead of bossSessionId
          session.eventId // Pass actual eventId
        );
        console.log(
          `🏅 [RESULT] Boss Defeated Badge Service Result:`,
          awardedBadges.bossDefeated
        );
      } else {
        console.log(
          `🏅 No Boss Defeated badges awarded - no winning team identified`
        );
      }

      // Award milestone badges based on event-wide progress
      // Note: This requires eventId - you may need to add this to session data
      if (session.eventId) {
        for (const [playerId, player] of session.players) {
          if (player.userId) {
            // Get total correct answers across all bosses in this event
            const eventStats = await BadgeService.getPlayerEventStats(
              player.userId,
              session.eventId,
              this
            );

            const milestoneRewards = await BadgeService.awardMilestoneBadge(
              player.userId,
              session.eventId,
              eventStats.totalCorrectAnswers
            );

            if (milestoneRewards.length > 0) {
              awardedBadges.milestones.push({
                playerId: player.userId,
                playerNickname: player.nickname,
                badges: milestoneRewards,
              });
            }
          }
        }
      }

      // END OF OLD BADGE SYSTEM COMMENT BLOCK
      */

      // Simple completion log for new badge system
      console.log("🎖️ Badge awarding completed:", {
        mvp: !!awardedBadges.mvp,
        lastHit: !!awardedBadges.lastHit,
        bossDefeated: awardedBadges.bossDefeated.length,
        milestones: awardedBadges.milestones.length,
      });

      // 🎖️ FINAL BADGE SUMMARY FOR FRONTEND
      console.log(`\n🎖️ ======= FINAL BADGE SUMMARY =======`);
      console.log(`🎖️ Total badges awarded this battle:`);

      // Find MVP badge from the new badge system results
      const mvpBadge = battleResultBadges.find((b) => b.id === "mvp");
      if (mvpBadge) {
        console.log(
          `🎖️   ✅ MVP Badge: ${mvpBadge.name} → Player ${mvpBadge.playerNickname} (${mvpBadge.playerId})`
        );
      } else {
        console.log(`🎖️   ❌ MVP Badge: Not awarded`);
      }

      // Find Last Hit badge from the new badge system results
      const lastHitBadge = battleResultBadges.find((b) => b.id === "last_hit");
      if (lastHitBadge) {
        console.log(
          `🎖️   ✅ Last Hit Badge: ${lastHitBadge.name} → Player ${lastHitBadge.playerNickname} (${lastHitBadge.playerId})`
        );
      } else {
        console.log(`🎖️   ❌ Last Hit Badge: Not awarded`);
      }

      // Find Boss Defeated badges from the new badge system results
      const bossDefeatedBadges = battleResultBadges.filter(
        (b) => b.id === "boss_defeated"
      );
      console.log(
        `🎖️   🏅 Boss Defeated Badges: ${bossDefeatedBadges.length} awarded`
      );
      bossDefeatedBadges.forEach((badge, index) => {
        console.log(
          `🎖️     ${index + 1}. ${badge.playerNickname} (${badge.playerId})`
        );
      });

      // Find milestone badges from session data
      const milestoneBadges = session.badges.earnedBadges.filter(
        (b) => b.type === "milestone"
      );
      console.log(
        `🎖️   🎯 Milestone Badges: ${milestoneBadges.length} badge(s) awarded`
      );
      milestoneBadges.forEach((badge, index) => {
        console.log(
          `🎖️     ${index + 1}. ${badge.playerNickname}: ${badge.name}`
        );
      });

      console.log(`🎖️ =====================================\n`);

      // **PLAYER SESSIONS ARE NOW CREATED WHEN PLAYERS JOIN**
      // No need to insert here - they were created in addPlayer method
      console.log(
        "💾 Player sessions already created when players joined the battle"
      );

      // **UPDATE FINAL LEADERBOARD DATA**
      try {
        console.log("📊 Performing final leaderboard updates...");

        // Final leaderboard update for all players with their accumulated stats
        const leaderboardPromises = [];
        for (const [playerId, player] of session.players) {
          // Use playerSessionId if available, otherwise use userId for authenticated users
          const leaderboardPlayerId = player.playerSessionId || player.userId;

          if (leaderboardPlayerId) {
            const leaderboardPromise = this.updatePlayerLeaderboard(
              leaderboardPlayerId,
              eventBossId,
              player.totalDamage || 0,
              player.correctAnswers || 0
            );
            leaderboardPromises.push(leaderboardPromise);

            const playerType = player.userId ? "authenticated" : "guest";
            console.log(
              `📈 Final leaderboard update for: ${player.nickname} (${playerType}, ID: ${leaderboardPlayerId})`
            );
          } else {
            console.warn(
              `⚠️ Could not update final leaderboard for ${player.nickname} - no valid ID`
            );
          }
        }

        // Execute all final leaderboard updates
        if (leaderboardPromises.length > 0) {
          await Promise.all(leaderboardPromises);
          console.log(
            `📈 Final leaderboard updated for ${leaderboardPromises.length} players`
          );
        }
      } catch (leaderboardError) {
        console.error(
          "❌ Error with final leaderboard updates:",
          leaderboardError.message
        );
      }

      // **GENERATE AND BROADCAST FINAL LEADERBOARDS**
      try {
        console.log("📊 Generating final leaderboards for broadcast...");

        // Generate final leaderboard data for broadcast
        const finalLeaderboards = await this.generateFinalLeaderboards(
          session,
          eventBossId
        );

        // Broadcast final leaderboards to all clients
        if (finalLeaderboards && io) {
          io.to(`boss-${eventBossId}`).emit("final-leaderboards", {
            eventBossId,
            teamLeaderboard: finalLeaderboards.teamLeaderboard,
            individualLeaderboard: finalLeaderboards.individualLeaderboard,
            winningTeam: winningTeam
              ? {
                  id: winningTeam.id,
                  name: winningTeam.name,
                  totalDamage: winningTeam.totalDamage,
                }
              : null,
            mvpPlayer: mvpPlayer
              ? {
                  id: mvpPlayer.id,
                  nickname: mvpPlayer.nickname,
                  totalDamage: mvpPlayer.totalDamage,
                }
              : null,
          });
          console.log("📡 Broadcasted final leaderboards to all clients");
        }
      } catch (leaderboardError) {
        console.error("Error generating final leaderboards:", leaderboardError);
        // Don't fail the entire boss defeat process for leaderboard errors
      }

      // **UPDATE BOSS STATUS TO COOLDOWN**
      try {
        const eventBoss = await EventBoss.findByPk(eventBossId);
        if (eventBoss) {
          const cooldownEndTime = new Date(
            Date.now() + eventBoss.cooldownDuration * 1000
          );

          await EventBoss.update(
            {
              status: "cooldown",
              cooldownEndTime: cooldownEndTime,
            },
            { where: { id: eventBossId } }
          );

          console.log(
            `🔄 [BOSS STATUS] Updated boss ${eventBossId} to 'cooldown' until ${cooldownEndTime}`
          );
        }
      } catch (error) {
        console.error("Error updating boss status to cooldown:", error);
      }

      // Reset players for next round but keep them in session
      session.players.forEach((player) => {
        player.hearts = 3;
        player.isKnockedOut = false;
        player.status = "waiting";
        // Keep totalDamage and other stats for overall tracking
      });

      // Move all active players back to waiting
      session.activePlayers.forEach((playerId) => {
        session.waitingPlayers.add(playerId);
      });
      session.activePlayers.clear();

      // Reset team stats for next round
      session.teams.forEach((team) => {
        team.totalDamage = 0;
      });

      // **CLEANUP: Clear badge session data at the very end**
      badgeManager.clearSession(session.badges.sessionId);
      console.log(
        `🧹 Badge session ${session.badges.sessionId} cleared after successful battle end`
      );

      return {
        session,
        winningTeam,
        mvpPlayer,
        cooldownUntil: session.bossData.cooldownUntil,
        awardedBadges,
      };
    } catch (error) {
      console.error("Error awarding badges:", error);

      // Still complete the boss fight even if badge awarding fails
      session.players.forEach((player) => {
        player.hearts = 3;
        player.isKnockedOut = false;
        player.status = "waiting";
      });

      session.activePlayers.forEach((playerId) => {
        session.waitingPlayers.add(playerId);
      });
      session.activePlayers.clear();

      session.teams.forEach((team) => {
        team.totalDamage = 0;
      });

      return {
        session,
        winningTeam,
        mvpPlayer,
        cooldownUntil: session.bossData.cooldownUntil,
        awardedBadges: null,
        badgeError: error.message,
      };
    }
  }

  // **NEW: Generate live leaderboard data for real-time updates**
  generateLiveLeaderboard(eventBossId) {
    const session = this.sessions.get(eventBossId);
    if (!session) return null;

    // Generate team leaderboard
    const teamLeaderboard = Array.from(session.teams.values())
      .map((team) => {
        // Calculate team totals
        let teamTotalQuestions = 0;
        let teamTotalCorrect = 0;

        const teamPlayers = Array.from(team.players)
          .map((playerId) => {
            const player = session.players.get(playerId);
            if (player) {
              teamTotalQuestions += player.questionsAnswered;
              teamTotalCorrect += player.correctAnswers;
            }
            return player
              ? {
                  id: player.id,
                  nickname: player.nickname,
                  username: player.username || player.nickname,
                  totalDamage: player.totalDamage,
                  questionsAnswered: player.questionsAnswered,
                  correctAnswers: player.correctAnswers,
                  accuracy:
                    player.questionsAnswered > 0
                      ? (
                          (player.correctAnswers / player.questionsAnswered) *
                          100
                        ).toFixed(1)
                      : 0,
                  hearts: player.hearts,
                  isKnockedOut: player.isKnockedOut,
                  status: player.status,
                }
              : null;
          })
          .filter(Boolean)
          .sort((a, b) => b.totalDamage - a.totalDamage); // Sort players within team by damage

        return {
          rank: 0, // Will be calculated after sorting
          teamId: team.id,
          teamName: team.name,
          totalDamage: team.totalDamage,
          playerCount: team.players.size,
          totalQuestions: teamTotalQuestions,
          totalCorrectAnswers: teamTotalCorrect,
          teamAccuracy:
            teamTotalQuestions > 0
              ? ((teamTotalCorrect / teamTotalQuestions) * 100).toFixed(1)
              : 0,
          players: teamPlayers,
        };
      })
      .sort((a, b) => b.totalDamage - a.totalDamage); // Sort teams by total damage

    // Add ranks to teams
    teamLeaderboard.forEach((team, index) => {
      team.rank = index + 1;
    });

    // Generate individual player leaderboard (across all teams)
    // Include all players who have participated (answered questions or dealt damage)
    const playerLeaderboard = Array.from(session.players.values())
      .filter(
        (player) => player.questionsAnswered > 0 || player.totalDamage > 0
      )
      .map((player) => ({
        rank: 0, // Will be calculated after sorting
        playerId: player.id,
        nickname: player.nickname,
        username: player.username || player.nickname,
        teamId: player.teamId,
        teamName: session.teams.get(player.teamId)?.name || "Unassigned",
        totalDamage: player.totalDamage,
        questionsAnswered: player.questionsAnswered,
        correctAnswers: player.correctAnswers,
        accuracy:
          player.questionsAnswered > 0
            ? (
                (player.correctAnswers / player.questionsAnswered) *
                100
              ).toFixed(1)
            : 0,
        hearts: player.hearts,
        isKnockedOut: player.isKnockedOut,
        status: player.status,
        damagePerQuestion:
          player.questionsAnswered > 0
            ? (player.totalDamage / player.questionsAnswered).toFixed(2)
            : 0,
      }))
      .sort((a, b) => b.totalDamage - a.totalDamage); // Sort by damage

    // Add ranks to players
    playerLeaderboard.forEach((player, index) => {
      player.rank = index + 1;
    });

    return {
      eventBossId,
      timestamp: new Date(),
      teamLeaderboard,
      playerLeaderboard,
      battleStats: {
        totalPlayers: session.players.size,
        activePlayers: session.activePlayers.size,
        totalDamageDealt: session.bossData.maxHp - session.bossData.currentHp,
        bossHpRemaining: session.bossData.currentHp,
        bossMaxHp: session.bossData.maxHp,
        bossHpPercentage: (
          (session.bossData.currentHp / session.bossData.maxHp) *
          100
        ).toFixed(1),
      },
    };
  }

  // **NEW: Broadcast live leaderboard update to all players**
  broadcastLeaderboardUpdate(io, eventBossId) {
    const leaderboardData = this.generateLiveLeaderboard(eventBossId);
    if (leaderboardData) {
      io.to(`boss-${eventBossId}`).emit("leaderboard-update", leaderboardData);
      console.log(`📊 Live leaderboard broadcasted for session ${eventBossId}`);
      return true;
    }
    return false;
  }

  // Get session by eventBossId
  getSession(eventBossId) {
    return this.sessions.get(eventBossId);
  }

  // Get player session by socketId
  getPlayerSession(socketId) {
    return this.playerSessions.get(socketId);
  }

  // Get all active sessions
  getAllSessions() {
    return Array.from(this.sessions.values());
  }

  // Check if enough players to start
  canStartBattle(eventBossId) {
    const session = this.sessions.get(eventBossId);
    if (!session) return false;

    // Need at least 2 players (1 per team minimum)
    const readyPlayers = session.waitingPlayers.size;
    const canStart =
      readyPlayers >= GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED &&
      !session.isStarted &&
      (!session.bossData.cooldownUntil ||
        new Date() >= session.bossData.cooldownUntil);

    console.log("🔍 =============== CAN START BATTLE CHECK ===============");
    console.log(`📊 Ready players: ${readyPlayers}`);
    console.log(
      `🎯 Required players: ${GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED}`
    );
    console.log(`🔄 Session started: ${session.isStarted}`);
    console.log(
      `❄️ On cooldown: ${session.bossData.cooldownUntil ? "Yes" : "No"}`
    );
    console.log(`✅ Can start: ${canStart}`);
    console.log("🔍 ========================================================");

    return canStart;
  }

  // Scale boss HP based on player count and team count using GAME_CONSTANTS (improved method)
  scaleBossHp(eventBossId) {
    const session = this.sessions.get(eventBossId);
    if (!session) return;

    const playerCount = session.players.size;
    const numberOfTeams = session.numberOfTeams;

    // Use the combat system's calculation method
    let calculatedHP = Math.max(
      GAME_CONSTANTS.MINIMUM_HP_THRESHOLD,
      playerCount * GAME_CONSTANTS.HP_SCALING_PER_PLAYER
    );

    // Scale based on team count for balanced team competition
    if (numberOfTeams > 2) {
      calculatedHP *=
        1 + (numberOfTeams - 2) * GAME_CONSTANTS.TEAM_SCALING_FACTOR;
    }

    const scaledHp = Math.floor(calculatedHP);

    session.bossData.maxHp = scaledHp;
    session.bossData.currentHp = scaledHp;

    console.log(`⚖️  [HP SCALING] Boss HP scaled using combat system method:`, {
      playerCount,
      numberOfTeams,
      baseCalculation: playerCount * GAME_CONSTANTS.HP_SCALING_PER_PLAYER,
      teamScalingMultiplier:
        numberOfTeams > 2
          ? 1 + (numberOfTeams - 2) * GAME_CONSTANTS.TEAM_SCALING_FACTOR
          : 1,
      finalHp: scaledHp,
      minimumThreshold: GAME_CONSTANTS.MINIMUM_HP_THRESHOLD,
      formula: `max(${GAME_CONSTANTS.MINIMUM_HP_THRESHOLD}, ${playerCount} × ${
        GAME_CONSTANTS.HP_SCALING_PER_PLAYER
      }${
        numberOfTeams > 2
          ? ` × ${(
              1 +
              (numberOfTeams - 2) * GAME_CONSTANTS.TEAM_SCALING_FACTOR
            ).toFixed(2)}`
          : ""
      }) = ${scaledHp}`,
    });
  }

  // **NEW: Update boss HP when players join/leave during battle (from combat system)**
  updateBossHP(eventBossId, newPlayerCount, numberOfTeams) {
    const session = this.sessions.get(eventBossId);
    if (!session) {
      throw new Error("Boss session not found");
    }

    // Calculate new HP using the same method as scaleBossHp
    let newCalculatedHP = Math.max(
      GAME_CONSTANTS.MINIMUM_HP_THRESHOLD,
      newPlayerCount * GAME_CONSTANTS.HP_SCALING_PER_PLAYER
    );

    if (numberOfTeams > 2) {
      newCalculatedHP *=
        1 + (numberOfTeams - 2) * GAME_CONSTANTS.TEAM_SCALING_FACTOR;
    }

    const newMaxHP = Math.floor(newCalculatedHP);

    // Only increase HP if new calculation is higher (players joined)
    if (newMaxHP > session.bossData.maxHp) {
      const hpIncrease = newMaxHP - session.bossData.maxHp;
      session.bossData.maxHp = newMaxHP;
      session.bossData.currentHp += hpIncrease;

      console.log(`📈 [HP UPDATE] Boss HP increased due to player join:`, {
        previousMaxHP: session.bossData.maxHp - hpIncrease,
        newMaxHP: session.bossData.maxHp,
        hpIncrease,
        newCurrentHP: session.bossData.currentHp,
        newPlayerCount,
      });
    }

    return {
      maxHp: session.bossData.maxHp,
      currentHp: session.bossData.currentHp,
      changed:
        newMaxHP >
        session.bossData.maxHp - (newMaxHP - session.bossData.maxHp || 0),
    };
  }

  // **Helper method to calculate player rank based on damage**
  calculatePlayerRank(session, playerId) {
    const players = Array.from(session.players.values())
      .filter((p) => p.totalDamage >= 0)
      .sort((a, b) => b.totalDamage - a.totalDamage);

    const playerIndex = players.findIndex((p) => p.id === playerId);
    return playerIndex >= 0 ? playerIndex + 1 : players.length + 1;
  }

  // **Generate final leaderboards for post-battle display**
  async generateFinalLeaderboards(session, eventBossId) {
    try {
      // Generate team leaderboard
      const teamLeaderboard = Array.from(session.teams.values())
        .map((team) => ({
          rank: 0,
          teamId: team.id,
          teamName: team.name,
          totalDamage: team.totalDamage,
          playerCount: team.players.size,
          players: Array.from(team.players)
            .map((playerId) => {
              const player = session.players.get(playerId);
              return player
                ? {
                    id: player.id,
                    nickname: player.nickname,
                    username: player.username || player.nickname,
                    totalDamage: player.totalDamage || 0,
                    questionsAnswered: player.questionsAnswered || 0,
                    correctAnswers: player.correctAnswers || 0,
                    // Remove accuracy calculation - show just correct answers
                  }
                : null;
            })
            .filter(Boolean)
            .sort((a, b) => b.totalDamage - a.totalDamage),
        }))
        .sort((a, b) => b.totalDamage - a.totalDamage);

      // Add ranks to teams
      teamLeaderboard.forEach((team, index) => {
        team.rank = index + 1;
      });

      // Generate individual leaderboard
      const individualLeaderboard = Array.from(session.players.values())
        .filter((player) => player.totalDamage >= 0)
        .map((player) => ({
          rank: 0,
          playerId: player.id,
          userId: player.userId,
          nickname: player.nickname,
          username: player.username || player.nickname,
          teamId: player.teamId,
          teamName: session.teams.get(player.teamId)?.name || "Unassigned",
          totalDamage: player.totalDamage || 0,
          questionsAnswered: player.questionsAnswered || 0,
          correctAnswers: player.correctAnswers || 0,
          // Remove accuracy calculation - show just correct answers
          damagePerQuestion:
            player.questionsAnswered > 0
              ? (player.totalDamage / player.questionsAnswered).toFixed(2)
              : 0,
        }))
        .sort((a, b) => b.totalDamage - a.totalDamage);

      // Add ranks to individual players
      individualLeaderboard.forEach((player, index) => {
        player.rank = index + 1;
      });

      // Get all-time leaderboard data if session has eventId
      let allTimeLeaderboard = null;
      if (session.eventId) {
        try {
          // Get event-specific leaderboard directly from database
          const leaderboardEntries = await Leaderboard.findAll({
            where: { eventBossId: eventBossId },
            order: [
              ["totalDamageDealt", "DESC"],
              ["totalCorrectAnswers", "DESC"],
            ],
          });

          allTimeLeaderboard = leaderboardEntries.map((entry, index) => ({
            rank: index + 1,
            playerId: entry.playerId,
            totalDamage: entry.totalDamageDealt,
            correctAnswers: entry.totalCorrectAnswers,
            // Note: We'll need to get player names from session or additional query
            // For now, showing IDs
            nickname: `Player ${entry.playerId.substring(0, 8)}...`,
          }));
        } catch (error) {
          console.error("Error fetching event leaderboard:", error);
        }
      }

      return {
        teamLeaderboard,
        individualLeaderboard,
        allTimeLeaderboard,
        battleStats: {
          totalPlayers: session.players.size,
          totalDamageDealt: session.bossData.maxHp - session.bossData.currentHp,
          bossMaxHp: session.bossData.maxHp,
          sessionDuration:
            session.endTime && session.startTime
              ? Math.floor((session.endTime - session.startTime) / 1000)
              : 0,
        },
      };
    } catch (error) {
      console.error("Error generating final leaderboards:", error);
      return null;
    }
  }

  // **Real-time milestone badge checking during battle**
  async checkAndAwardMilestoneBadges(
    eventBossId,
    playerId,
    currentCorrectAnswers
  ) {
    try {
      const session = this.sessions.get(eventBossId);
      if (!session) {
        console.log(`🎖️ [MILESTONE] No session found for ${eventBossId}`);
        return [];
      }

      const player = session.players.get(playerId);
      if (!player) {
        console.log(`🎖️ [MILESTONE] No player found for ${playerId}`);
        return [];
      }

      // Calculate event-wide total correct answers for this player
      const eventWideTotal =
        await BadgeService.calculateEventWideCorrectAnswers(
          player.userId || playerId, // Use userId for auth users, playerId for guests
          session.eventId,
          this
        );

      console.log(
        `🎖️ [MILESTONE CHECK] Player ${player.nickname} (${
          player.userId || "GUEST"
        })`
      );
      console.log(
        `🎖️ [MILESTONE CHECK] Current session correct: ${currentCorrectAnswers}`
      );
      console.log(`🎖️ [MILESTONE CHECK] Event-wide total: ${eventWideTotal}`);

      // Check for milestone badges using event-wide total
      const milestoneBadges = await BadgeService.checkMilestoneProgress(
        player.userId || playerId, // Use userId for auth users, playerId for guests
        session.eventId,
        eventWideTotal,
        (badgeNotification) => {
          // Real-time socket notification callback
          this.broadcastBadgeNotification(eventBossId, badgeNotification);
        }
      );

      if (milestoneBadges.length > 0) {
        console.log(
          `🎖️ [NEW MILESTONES] ${milestoneBadges.length} new milestone badges awarded!`
        );
        milestoneBadges.forEach((badge) => {
          console.log(
            `🎖️ [FRONTEND] Badge Name: ${badge.badge.name}, Player: ${player.nickname}, Milestone: ${badge.badge.milestone}`
          );
        });
      }

      return milestoneBadges;
    } catch (error) {
      console.error("Error checking milestone badges:", error);
      return [];
    }
  }

  // Broadcast badge notification to all players in the session
  broadcastBadgeNotification(eventBossId, badgeNotification) {
    try {
      const session = this.sessions.get(eventBossId);
      if (!session) return;

      console.log(
        `📢 [BADGE BROADCAST] Broadcasting badge notification: ${badgeNotification.badge.name}`
      );

      // Emit to all players in the session
      for (const [socketId, playerSessionInfo] of this.playerSessions) {
        if (playerSessionInfo.eventBossId === eventBossId) {
          // This would need to be connected to your socket.io instance
          // For now, we'll log it for frontend visibility
          console.log(
            `📢 [FRONTEND NOTIFICATION] Sending to ${
              playerSessionInfo.nickname
            }: ${JSON.stringify(badgeNotification)}`
          );
        }
      }
    } catch (error) {
      console.error("Error broadcasting badge notification:", error);
    }
  }

  // Helper method to get all sessions (for badge service)
  getAllSessions() {
    return this.sessions;
  }

  // **NEW: Get current session team leaderboard**
  getSessionTeamLeaderboard(eventBossId) {
    const session = this.sessions.get(eventBossId);
    if (!session) return [];

    const teamLeaderboard = [];
    for (const [teamId, team] of session.teams) {
      // Calculate team stats from players
      let totalDamage = 0;
      let totalCorrectAnswers = 0;
      let playerCount = 0;

      for (const playerId of team.players) {
        const player = session.players.get(playerId);
        if (player) {
          totalDamage += player.totalDamage || 0;
          totalCorrectAnswers += player.correctAnswers || 0;
          playerCount++;
        }
      }

      teamLeaderboard.push({
        rank: 0, // Will be set after sorting
        teamId: teamId,
        teamName: team.name,
        totalDamage: totalDamage,
        totalCorrectAnswers: totalCorrectAnswers,
        playerCount: playerCount,
        averageDamage:
          playerCount > 0 ? Math.round(totalDamage / playerCount) : 0,
      });
    }

    // Sort by total damage (descending) and assign ranks
    teamLeaderboard.sort((a, b) => b.totalDamage - a.totalDamage);
    teamLeaderboard.forEach((team, index) => {
      team.rank = index + 1;
    });

    return teamLeaderboard;
  }

  // **NEW: Get current session individual player leaderboard**
  getSessionPlayerLeaderboard(eventBossId) {
    const session = this.sessions.get(eventBossId);
    if (!session) return [];

    const playerLeaderboard = [];
    for (const [playerId, player] of session.players) {
      // Get team name for this player
      const team = session.teams.get(player.teamId);
      const teamName = team ? team.name : "No Team";

      playerLeaderboard.push({
        rank: 0, // Will be set after sorting
        playerId: playerId,
        playerName: player.nickname || player.username || "Unknown",
        teamId: player.teamId,
        teamName: teamName,
        totalDamage: player.totalDamage || 0,
        correctAnswers: player.correctAnswers || 0,
        isGuest: player.isGuest || false,
        avatar: player.avatar || "/src/assets/Placeholder/Profile1.jpg",
      });
    }

    // Sort by total damage (descending) and assign ranks
    playerLeaderboard.sort((a, b) => b.totalDamage - a.totalDamage);
    playerLeaderboard.forEach((player, index) => {
      player.rank = index + 1;
    });

    return playerLeaderboard;
  }

  // **NEW: Get comprehensive leaderboard data for boss preview**
  async getComprehensiveLeaderboardData(eventBossId) {
    try {
      const session = this.sessions.get(eventBossId);
      if (!session) {
        // If no active session, try to get historical data
        return {
          teamLeaderboard: [],
          individualLeaderboard: [],
          allTimeLeaderboard: await this.getAllTimeLeaderboard(eventBossId),
          sessionActive: false,
        };
      }

      return {
        teamLeaderboard: this.getSessionTeamLeaderboard(eventBossId),
        individualLeaderboard: this.getSessionPlayerLeaderboard(eventBossId),
        allTimeLeaderboard: await this.getAllTimeLeaderboard(eventBossId),
        sessionActive: true,
        bossInfo: {
          eventBossId: eventBossId,
          bossName: session.bossName,
          roomCode: session.roomCode,
          joinCode: session.joinCode,
          isStarted: session.isStarted,
          bossHP: session.bossHP,
          maxBossHP: session.maxBossHP,
          playerCount: session.players.size,
          teamCount: session.numberOfTeams,
        },
      };
    } catch (error) {
      console.error("Error getting comprehensive leaderboard data:", error);
      return {
        teamLeaderboard: [],
        individualLeaderboard: [],
        allTimeLeaderboard: [],
        sessionActive: false,
        error: error.message,
      };
    }
  }

  // **NEW: Get all-time leaderboard for this boss**
  async getAllTimeLeaderboard(eventBossId) {
    try {
      // Temporarily simplified query to avoid User model issues
      const allTimeLeaderboard = await Leaderboard.findAll({
        where: {
          eventBossId: eventBossId,
        },
        attributes: [
          "id",
          "playerName",
          "playerNickname",
          "totalDamageDealt",
          "totalCorrectAnswers",
          "createdAt",
        ],
        order: [["totalDamageDealt", "DESC"]],
        limit: 10,
      });

      return allTimeLeaderboard.map((entry, index) => ({
        rank: index + 1,
        playerId: entry.playerId,
        playerName:
          entry.playerName ||
          entry.playerNickname ||
          `Player ${entry.playerId}`,
        totalDamage: entry.totalDamageDealt,
        correctAnswers: entry.totalCorrectAnswers,
        avatar: "/src/assets/Placeholder/Profile1.jpg",
      }));
    } catch (error) {
      console.error("Error getting all-time leaderboard:", error);
      return [];
    }
  }

  // **NEW: Broadcast leaderboard updates to boss preview viewers**
  async broadcastLeaderboardUpdate(io, eventBossId) {
    try {
      const leaderboardData = await this.getComprehensiveLeaderboardData(
        eventBossId
      );

      // Broadcast to all boss preview viewers
      io.to(`boss-preview-${eventBossId}`).emit(
        "boss-preview:leaderboard-update",
        {
          leaderboardData: leaderboardData,
        }
      );

      console.log(
        `📊 Broadcasted leaderboard update to boss-preview-${eventBossId}`
      );
    } catch (error) {
      console.error("Error broadcasting leaderboard update:", error);
    }
  }
}

// Singleton instance
const bossSessionManager = new BossSessionManager();
export default bossSessionManager;
