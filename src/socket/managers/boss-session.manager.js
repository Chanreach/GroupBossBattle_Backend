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
import LeaderboardService from "../../services/leaderboard.service.js";
import { BossSession, EventBoss } from "../../models/index.js";
import {
  generateUniqueRevivalCode,
  validateRevivalCode,
  formatRevivalCodeForDisplay,
} from "../../utils/generateRevivalCode.js"; // **NEW: Import revival code utilities**

function createPlayerSeed(playerId, sessionId, contexts = []) {
  const contextString = contexts.join("_");
  const seedString = `${playerId}_${sessionId}_${contextString}`;
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
        bossSessionId: null, // Will be set when battle starts and DB record is created
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
      };

      // Initialize teams with generated names
      const teamNames = TeamNameGenerator.generateUniqueTeamNames(
        session.numberOfTeams,
        [eventBossId, "team_names"]
      );

      for (let i = 1; i <= session.numberOfTeams; i++) {
        session.teams.set(i, {
          id: i,
          name: teamNames[i - 1], // Use generated team name
          totalDamage: 0,
          players: new Set(),
        });
      }

      this.sessions.set(eventBossId, session);
    }
    return this.sessions.get(eventBossId);
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
    const player = {
      id: playerId,
      socketId,
      nickname: playerData.nickname,
      userId: playerData.id || null,
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

    // ===== PLAYER CREATION DEBUG =====
    console.log("👤 =============== PLAYER CREATION DEBUG ===============");
    console.log("🆔 Session Info:");
    console.log(`   Event Boss ID: ${eventBossId}`);
    console.log(`   Session Started: ${session.isStarted}`);
    console.log(`   Current Players: ${session.players.size}`);
    console.log("👤 New Player Created:");
    console.log(`   Player ID: ${playerId}`);
    console.log(`   Socket ID: ${socketId}`);
    console.log(`   Nickname: ${player.nickname}`);
    console.log(`   Initial Hearts: ${player.hearts}`);
    console.log(`   Status: ${player.status}`);
    console.log(`   Is Knocked Out: ${player.isKnockedOut}`);
    console.log(`   Team ID: ${player.teamId || "Not assigned yet"}`);
    console.log("👤 ====================================================");

    session.players.set(playerId, player);
    session.waitingPlayers.add(playerId);

    // Store socket to player mapping with user info for reconnection
    this.playerSessions.set(socketId, {
      playerId,
      eventBossId,
      nickname: playerData.nickname,
      userId: playerData.id || null,
      username: playerData.username || playerData.nickname,
      isGuest: playerData.isGuest || false,
    });

    // **AUTO-ASSIGN TO TEAM if battle has already started (mid-game join)**
    if (session.isStarted) {
      console.log(
        `🔄 [MID-GAME JOIN] Processing mid-game join for ${player.nickname}`
      );
      this.assignPlayerToTeam(session, playerId);
      // Also move player to active players
      session.waitingPlayers.delete(playerId);
      session.activePlayers.add(playerId);
      player.status = "active";

      console.log(
        `👤 [MID-GAME JOIN] Player ${player.nickname} status updated:`,
        {
          teamId: player.teamId,
          status: player.status,
          hearts: player.hearts,
          isActive: session.activePlayers.has(playerId),
          isWaiting: session.waitingPlayers.has(playerId),
        }
      );

      // **UPDATE BOSS HP for mid-game join**
      const hpUpdateResult = this.updateBossHP(
        eventBossId,
        session.players.size,
        session.numberOfTeams
      );
      if (hpUpdateResult.changed) {
        console.log(
          `🔄 [MID-GAME JOIN] Boss HP updated for player ${player.nickname}`
        );
      }
    }

    // **AUTO-ASSIGN QUESTION POOL when player joins**
    // If battle is already started (mid-game join) or if we want to pre-assign
    const questionPoolResult = await this.assignQuestionPool(
      eventBossId,
      playerId
    );

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
        console.warn(`⚠️  No questions data found for boss ${eventBossId}`);
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
      const playerSeed = createPlayerSeed(playerId, eventBossId, [
        "question_pool",
      ]);
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

      console.log(
        `📝 [QUESTION POOL] Assigned ${questionsWithPreparedChoices.length} questions to ${playerNickname} (${playerId})`
      );
      console.log(
        `🎲 [QUESTION POOL] Sample questions for ${playerNickname}:`,
        questionsWithPreparedChoices
          .slice(0, 3)
          .map(
            (q, index) =>
              `${index + 1}. [${q.categoryName}] "${q.text}" [Choices: ${
                q.choices.length
              }] [Correct Index: ${q.correctAnswerIndex}]`
          )
          .join("\n   ")
      );

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
  prepareQuestionForPlayer(question, playerId, sessionId, questionIndex) {
    const allChoices = question.answerChoices;
    if (allChoices.length < 4) {
      throw new Error(
        `Question ${question.id} must have at least 4 answer choices, found ${allChoices.length}`
      );
    }

    // Create seed for this specific question and player
    const questionSeed = createPlayerSeed(playerId, sessionId, [
      "question_choices",
      question.id,
      questionIndex,
    ]);
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
      const loopSeed = createPlayerSeed(playerId, eventBossId, [
        "question_pool",
        `loop_${playerPool.loopCount}`,
      ]);
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
      // **1. CREATE BOSS SESSION DATABASE RECORD**
      const bossSessionRecord = await BossSession.create({
        eventBossId: eventBossId,
        startTime: new Date(),
        totalParticipants: playerCount,
        finalDamageDealt: 0,
      });

      // Store the database session ID in our memory session
      session.bossSessionId = bossSessionRecord.id;

      console.log(`🎲 [BOSS SESSION] Created database record:`, {
        sessionId: session.bossSessionId,
        eventBossId: eventBossId,
        participants: playerCount,
      });

      // **UPDATE BOSS STATUS TO IN-BATTLE**
      await EventBoss.update(
        { status: "in-battle" },
        { where: { id: eventBossId } }
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
        bossSessionId: session.bossSessionId,
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
          const seed = createTeamAssignmentSeed(session.eventBossId, index);
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
        session.eventBossId,
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
  processAttack(
    eventBossId,
    playerId,
    isCorrect,
    responseTime,
    questionTimeLimit,
    damage = null
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
    }

    // Update team damage
    const team = session.teams.get(player.teamId);
    if (team) {
      team.totalDamage += calculatedDamage;
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
      this.endBossFight(eventBossId, playerId); // Pass playerId as finalHitPlayerId
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
      // Generate a unique revival code for this session
      const code = generateUniqueRevivalCode(this.reviveCodes);
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
  async endBossFight(eventBossId, finalHitPlayerId = null) {
    const session = this.sessions.get(eventBossId);
    if (!session) return null;

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
      const awardedBadges = {
        mvp: null,
        lastHit: null,
        bossDefeated: [],
        milestones: [],
      };

      // Use the correct boss session ID for badge references
      const bossSessionId = session.bossSessionId;
      if (!bossSessionId) {
        console.error("No boss session ID found - cannot award badges");
        throw new Error("Missing boss session ID");
      }

      // Award MVP badge
      if (mvpPlayer && mvpPlayer.userId) {
        console.log(
          `🏆 Awarding MVP badge to ${mvpPlayer.nickname} with ${mvpDamage} damage`
        );
        awardedBadges.mvp = await BadgeService.awardMVPBadge(
          mvpPlayer.userId,
          bossSessionId,
          mvpDamage
        );
      }

      // Award Last Hit badge
      if (finalHitPlayerId) {
        const finalHitPlayer = session.players.get(finalHitPlayerId);
        if (finalHitPlayer && finalHitPlayer.userId) {
          console.log(
            `🎯 Awarding Last Hit badge to ${finalHitPlayer.nickname}`
          );
          awardedBadges.lastHit = await BadgeService.awardLastHitBadge(
            finalHitPlayer.userId,
            bossSessionId
          );
        }
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

        console.log(
          `🏅 Awarding Boss Defeated badges to ${winningPlayerIds.length} players`
        );
        awardedBadges.bossDefeated = await BadgeService.awardBossDefeatedBadges(
          winningPlayerIds,
          bossSessionId
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

      console.log("🎖️ Badge awarding completed:", {
        mvp: !!awardedBadges.mvp,
        lastHit: !!awardedBadges.lastHit,
        bossDefeated: awardedBadges.bossDefeated.length,
        milestones: awardedBadges.milestones.length,
      });

      // **UPDATE LEADERBOARD DATA**
      try {
        console.log("📊 Updating leaderboard data for boss defeat...");

        // Collect player performance data for leaderboard updates
        const leaderboardUpdates = [];
        for (const [playerId, player] of session.players) {
          if (player.userId) {
            leaderboardUpdates.push({
              userId: player.userId,
              eventId: session.eventId,
              eventBossId: eventBossId,
              totalDamage: player.totalDamage || 0,
              questionsAnswered: player.questionsAnswered || 0,
              correctAnswers: player.correctAnswers || 0,
              sessionDuration: session.endTime
                ? Math.floor((session.endTime - session.startTime) / 1000)
                : 0,
              isWinner: winningTeam && winningTeam.players.has(playerId),
              rank: this.calculatePlayerRank(session, playerId),
            });
          }
        }

        // Update leaderboard data in database
        if (leaderboardUpdates.length > 0) {
          await LeaderboardService.updateBattleLeaderboards(
            session.eventId,
            eventBossId, 
            leaderboardUpdates
          );
          console.log(
            `📈 Updated leaderboard data for ${leaderboardUpdates.length} players`
          );
        }

        // Generate final leaderboard data for broadcast
        const finalLeaderboards = await this.generateFinalLeaderboards(
          session,
          eventBossId
        );

        // Broadcast final leaderboards to all clients
        if (finalLeaderboards) {
          this.io.to(`boss-${eventBossId}`).emit("final-leaderboards", {
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
        console.error("Error updating leaderboard data:", leaderboardError);
        // Don't fail the entire boss defeat process for leaderboard errors
      }

      // **UPDATE DATABASE BOSS SESSION RECORD**
      if (session.bossSessionId) {
        try {
          const totalDamageDealt = Array.from(session.teams.values()).reduce(
            (sum, team) => sum + team.totalDamage,
            0
          );

          await BossSession.update(
            {
              endTime: new Date(),
              finalDamageDealt: totalDamageDealt,
            },
            {
              where: { id: session.bossSessionId },
            }
          );

          console.log(`📊 [BOSS SESSION] Updated database record:`, {
            sessionId: session.bossSessionId,
            endTime: new Date(),
            finalDamageDealt: totalDamageDealt,
          });
        } catch (dbError) {
          console.error("Error updating boss session record:", dbError);
        }
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
      .map((team) => ({
        rank: 0, // Will be calculated after sorting
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
          .sort((a, b) => b.totalDamage - a.totalDamage), // Sort players within team by damage
      }))
      .sort((a, b) => b.totalDamage - a.totalDamage); // Sort teams by total damage

    // Add ranks to teams
    teamLeaderboard.forEach((team, index) => {
      team.rank = index + 1;
    });

    // Generate individual player leaderboard (across all teams)
    const playerLeaderboard = Array.from(session.players.values())
      .filter(
        (player) => player.status === "active" || player.status === "waiting"
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
                    accuracy:
                      player.questionsAnswered > 0
                        ? (
                            (player.correctAnswers / player.questionsAnswered) *
                            100
                          ).toFixed(1)
                        : 0,
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
          accuracy:
            player.questionsAnswered > 0
              ? (
                  (player.correctAnswers / player.questionsAnswered) *
                  100
                ).toFixed(1)
              : 0,
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
          allTimeLeaderboard = await LeaderboardService.getAllTimeLeaderboard(
            session.eventId
          );
        } catch (error) {
          console.error("Error fetching all-time leaderboard:", error);
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
}

// Singleton instance
const bossSessionManager = new BossSessionManager();
export default bossSessionManager;
