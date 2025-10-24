import QuestionService from "../services/question.service.js";
import { RandomGenerator, generateSeed } from "../utils/random.util.js";
import { GAME_CONSTANTS } from "../utils/game.constants.js";

class QuestionManager {
  async initializeQuestionBank(questionBank, eventBossId) {
    if (!questionBank || !eventBossId) {
      console.error(
        "[QuestionManager] Question bank or event boss ID is missing."
      );
      return null;
    }

    const questions = await QuestionService.getQuestionsByEventBossId(
      eventBossId
    );
    if (!questions || questions.length === 0) {
      console.error(
        "[QuestionManager] No questions found for the given event boss ID."
      );
      return null;
    }

    questionBank.push(...questions);
    return questions;
  }

  prepareQuestionPoolForPlayer(questions, battleSessionId, playerId) {
    if (!questions.pools.has(playerId)) {
      questions.pools.set(playerId, {
        questions: [],
        currentIndex: 0,
        loopCount: 0,
      });
    }

    const seed = generateSeed([battleSessionId, playerId, "question_pool"]);
    const processedQuestions = this.prepareQuestionsForPlayer(
      questions.bank,
      battleSessionId,
      playerId,
      seed
    );
    if (!processedQuestions || processedQuestions.length === 0) {
      console.error(`No processed questions available for player ${playerId}`);
      return null;
    }

    questions.pools.set(playerId, {
      questions: processedQuestions,
      currentIndex: 0,
      loopCount: 0,
    });
    return questions.pools.get(playerId);
  }

  prepareQuestionsForPlayer(questionBank, battleSessionId, playerId, seed) {
    if (!questionBank || questionBank.length === 0) {
      console.error("No questions available in the question bank.");
      return [];
    }

    const questionRng = new RandomGenerator(seed);
    const shuffledQuestions = questionRng.shuffleArray(questionBank);

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

    const { formattedAnswerChoices, correctAnswerIndex } =
      this.shuffleAnswerChoices(allAnswerChoices, seed);

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

  getNextQuestion(questions, battleSessionId, playerId) {
    if (!questions.pools.has(playerId)) {
      console.error(`No question pool found for player ${playerId}`);
      return null;
    }

    const questionPool = questions.pools.get(playerId);
    if (!questionPool || questionPool.questions.length === 0) {
      console.error(`No questions available for player ${playerId}`);
      return null;
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
        questions.bank,
        battleSessionId,
        playerId,
        seed
      );
    }

    const question = questionPool.questions[questionPool.currentIndex];
    questionPool.currentIndex += 1;
    question.startTime = Date.now();
    question.endTime = question.startTime + question.timeLimit;

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
      startTime: question.startTime,
      endTime: question.endTime,
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
        text: choice.choiceText,
        isCorrect: choice.isCorrect,
        index,
      })
    );

    return {
      formattedAnswerChoices,
      correctAnswerIndex,
    };
  }

  getCurrentQuestion(questionPool) {
    if (!questionPool || questionPool.questions.length === 0) {
      console.error("No questions available");
      return null;
    }
    return questionPool.questions[questionPool.currentIndex - 1];
  }

  validatePlayerAnswer(question, choiceIndex) {
    if (!question) {
      console.error("No question provided");
      return null;
    }
    return question.correctAnswerIndex === choiceIndex;
  }
}

export default QuestionManager;
