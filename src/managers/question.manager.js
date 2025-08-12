import QuestionService from "../services/question.service.js";
import RandomGenerator from "../utils/random-generator.js";
import { generateSeed } from "../utils/generate-seed.js";
import { GAME_CONSTANTS } from "../utils/game.constants.js";

class QuestionManager {
  constructor() {
    this.questionBanks = [];
    this.questionPools = new Map();
  }

  async initializeQuestionBank(eventBossId) {
    try {
      const questions = await QuestionService.getQuestionsByEventBossId(
        eventBossId
      );
      this.questionBanks = questions;

      if (this.questionBanks.length === 0) {
        throw new Error("No questions found for the specified event boss.");
      }
    } catch (error) {
      console.error("Error initializing question bank:", error);
      throw error;
    }
  }

  prepareQuestionPoolForPlayer(battleSessionId, playerId) {
    if (!this.questionPools.has(playerId)) {
      this.questionPools.set(playerId, {
        questions: [],
        currentIndex: 0,
        loopCount: 0,
      });
    }

    const seed = generateSeed([battleSessionId, playerId, "question_pool"]);
    const processedQuestions = this.prepareQuestionsForPlayer(
      battleSessionId,
      playerId,
      seed
    );

    this.questionPools.set(playerId, {
      questions: processedQuestions,
      currentIndex: 0,
      loopCount: 0,
    });
  }

  prepareQuestionsForPlayer(battleSessionId, playerId, seed) {
    const questions = this.questionBanks;

    if (!questions || questions.length === 0) {
      throw new Error("No questions available in the question bank.");
    }

    const questionRng = new RandomGenerator(seed);
    const shuffledQuestions = questionRng.shuffleArray(questions);

    const processedQuestions = shuffledQuestions.map(
      (question, questionIndex) => {
        return this.prepareQuestionForPlayer(
          battleSessionId,
          playerId,
          question,
          questionIndex
        );
      }
    );

    return processedQuestions;
  }

  prepareQuestionForPlayer(battleSessionId, playerId, question, questionIndex) {
    const allAnswerChoices = question.answerChoices;
    const seed = generateSeed([
      battleSessionId,
      playerId,
      question.id,
      questionIndex,
      "answer_choices",
    ]);
    
    const { formattedAnswerChoices, correctAnswerIndex } = this.shuffleAnswerChoices(
      allAnswerChoices,
      seed
    );

    return {
      id: question.id,
      questionText: question.questionText,
      timeLimit:
        question.timeLimit * 1000 || GAME_CONSTANTS.DEFAULT_QUESTION_TIME_LIMIT,
      categoryId: question.categoryId,
      categoryName: question.categoryName,
      answerChoices: formattedAnswerChoices,
      correctAnswerIndex,
    };
  }

  getNextQuestion(battleSessionId, playerId) {
    if (!this.questionPools.has(playerId)) {
      throw new Error(`No question pool found for player ${playerId}`);
    }

    const questionPool = this.questionPools.get(playerId);
    if (!questionPool || questionPool.questions.length === 0) {
      throw new Error(`No questions available for player ${playerId}`);
    }

    if (questionPool.currentIndex >= questionPool.questions.length) {
      questionPool.currentIndex = 0;
      questionPool.loopCount += 1;

      const seed = generateSeed([
        battleSessionId,
        playerId,
        "question_pool",
        questionPool.loopCount,
      ]);
      questionPool.questions = this.prepareQuestionsForPlayer(
        battleSessionId,
        playerId,
        seed
      );
    }

    const question = questionPool.questions[questionPool.currentIndex];
    questionPool.currentIndex += 1;

    return {
      id: question.id,
      questionText: question.questionText,
      timeLimit: question.timeLimit,
      categoryId: question.categoryId,
      categoryName: question.categoryName,
      answerChoices: question.answerChoices.map((choice) => ({
        text: choice.text,
        index: choice.index,
      })),
      deliveredAt: Date.now()
    };
  }

  shuffleAnswerChoices(allAnswerChoices, seed) {
    const answerChoiceRng = new RandomGenerator(seed);

    const correctAnswerChoice = allAnswerChoices.find(
      (choice) => choice.isCorrect
    );
    const incorrectAnswerChoices = allAnswerChoices.filter(
      (choice) => !choice.isCorrect
    );

    const shuffledIncorrectChoices = answerChoiceRng.shuffleArray(
      incorrectAnswerChoices
    );
    const selectedIncorrectChoices = shuffledIncorrectChoices.slice(0, 3);

    const answerChoices = [correctAnswerChoice, ...selectedIncorrectChoices];
    const shuffledAnswerChoices = answerChoiceRng.shuffleArray(answerChoices);

    const correctAnswerIndex = shuffledAnswerChoices.findIndex(
      (choice) => choice.isCorrect
    );

    const formattedAnswerChoices = shuffledAnswerChoices.map(
      (choice, index) => ({
        id: choice.id,
        text: choice.text,
        isCorrect: choice.isCorrect,
        index,
      })
    );

    return {
      formattedAnswerChoices,
      correctAnswerIndex
    }
  }

  validatePlayerAnswer(playerId, choiceIndex) {
    const questionPool = this.questionPools.get(playerId);
    if (!questionPool || questionPool.questions.length === 0) {
      throw new Error(`No questions available for player ${playerId}`);
    }

    const currentQuestion = questionPool.questions[questionPool.currentIndex - 1];
    if (!currentQuestion) {
      throw new Error(`No current question found for player ${playerId}`);
    }

    const isCorrect = currentQuestion.correctAnswerIndex === choiceIndex;
    return isCorrect;
  }

  clearQuestionPool() {
    this.questionBanks = [];
    this.questionPools.clear();
  }

  validateQuestionStructure(question) {
    
  }
}

const questionManager = new QuestionManager();
export default questionManager;
