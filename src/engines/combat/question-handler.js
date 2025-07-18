import { v4 as uuidv4 } from "uuid";
import { GAME_CONSTANTS } from "../utils/constants.js";

export class QuestionHandler {
  /**
   * Randomize answers for display (4 out of 8, with correct answer always included)
   */
  static randomizeAnswers(answers) {
    const shuffled = [...answers].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 4).map((answer, index) => ({
      ...answer,
      index,
    }));
  }

  /**
   * Create question object for player
   */
  static createPlayerQuestion(question) {
    const randomizedAnswers = this.randomizeAnswers(question.answers);

    return {
      questionId: question.id,
      question: question.question_text,
      answers: randomizedAnswers,
      correctIndex: randomizedAnswers.findIndex((a) => a.is_correct),
      timeLimit: question.time_limit || 30000,
      sentAt: new Date(),
    };
  }

  /**
   * Format question for client
   */
  static formatQuestionForClient(playerQuestion) {
    return {
      id: playerQuestion.questionId,
      text: playerQuestion.question,
      answers: playerQuestion.answers.map((a) => ({
        text: a.choice_text,
        index: a.index,
      })),
      timeLimit: playerQuestion.timeLimit,
    };
  }

  /**
   * Validate answer submission
   */
  static validateAnswer(playerSession, session, answerIndex) {
    const { PLAYER_STATUSES, BOSS_STATUSES } = GAME_CONSTANTS;

    if (!playerSession) {
      return { valid: false, error: "Player session not found" };
    }

    if (!session || session.status !== BOSS_STATUSES.ACTIVE) {
      return { valid: false, error: "Boss fight not active" };
    }

    if (
      playerSession.status !== PLAYER_STATUSES.ACTIVE ||
      !playerSession.currentQuestion
    ) {
      return { valid: false, error: "Player not in active question state" };
    }

    if (
      typeof answerIndex !== "number" ||
      answerIndex < 0 ||
      answerIndex >= 4
    ) {
      return { valid: false, error: "Invalid answer index" };
    }

    return { valid: true };
  }

  /**
   * Process answer submission
   */
  static processAnswer(playerSession, answerIndex) {
    const question = playerSession.currentQuestion;
    const responseTime = new Date() - question.sentAt;
    const isCorrect = answerIndex === question.correctIndex;

    // Update player stats
    playerSession.questionsAnswered++;
    playerSession.lastAnswerTime = new Date();

    if (isCorrect) {
      playerSession.correctAnswers++;
    } else {
      playerSession.incorrectAnswers++;
      playerSession.hearts--;
    }

    // Clear current question
    playerSession.currentQuestion = null;

    return {
      isCorrect,
      responseTime,
      heartsRemaining: playerSession.hearts,
      questionId: question.questionId,
      correctIndex: question.correctIndex,
    };
  }

  /**
   * Handle question timeout
   */
  static handleTimeout(playerSession) {
    if (!playerSession.currentQuestion) {
      return { timedOut: false };
    }

    playerSession.questionsAnswered++;
    playerSession.incorrectAnswers++;
    playerSession.hearts--;
    playerSession.currentQuestion = null;

    return {
      timedOut: true,
      heartsRemaining: playerSession.hearts,
      playerId: playerSession.playerId,
    };
  }

  /**
   * Get random question from category (mock implementation)
   */
  static async getRandomQuestion(categoryId, playerId) {
    // This would integrate with your actual question system
    // For now, returning a mock question structure
    return {
      id: uuidv4(),
      question_text: `Sample question for category ${categoryId}?`,
      category_id: categoryId,
      time_limit: 30000,
      answers: [
        { choice_text: "Correct Answer", is_correct: true },
        { choice_text: "Wrong Answer 1", is_correct: false },
        { choice_text: "Wrong Answer 2", is_correct: false },
        { choice_text: "Wrong Answer 3", is_correct: false },
        { choice_text: "Wrong Answer 4", is_correct: false },
        { choice_text: "Wrong Answer 5", is_correct: false },
        { choice_text: "Wrong Answer 6", is_correct: false },
        { choice_text: "Wrong Answer 7", is_correct: false },
      ],
    };
  }

  /**
   * Check if player should receive another question
   */
  static shouldSendNextQuestion(playerSession, session) {
    const { PLAYER_STATUSES, BOSS_STATUSES } = GAME_CONSTANTS;

    return (
      session.status === BOSS_STATUSES.ACTIVE &&
      playerSession.status === PLAYER_STATUSES.ACTIVE &&
      playerSession.hearts > 0 &&
      session.currentHP > 0
    );
  }

  /**
   * Set up question timeout
   */
  static setupQuestionTimeout(playerSession, session, timeLimit, onTimeout) {
    return setTimeout(() => {
      if (playerSession.currentQuestion) {
        const result = this.handleTimeout(playerSession);
        if (result.timedOut && onTimeout) {
          onTimeout(playerSession, session, result);
        }
      }
    }, timeLimit);
  }
}
