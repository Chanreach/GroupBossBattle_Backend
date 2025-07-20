import {
  EventBoss,
  Boss,
  Category,
  Question,
  AnswerChoice,
} from "../models/index.js";

/**
 * Fetch questions and answer choices for a boss by eventBossId and joinCode
 * @param {number} eventBossId - The ID of the event boss
 * @param {string} joinCode - The join code for the boss
 * @returns {Object|null} - Object containing questions data or null if not found
 */
export const getBossQuestionsAndAnswers = async (eventBossId, joinCode) => {
  try {
    const boss = await EventBoss.findOne({
      where: { id: eventBossId, joinCode },
      include: [
        {
          model: Boss,
          as: "boss",
          include: [
            {
              model: Category,
              as: "Categories",
              include: [
                {
                  model: Question,
                  as: "questions",
                  include: [
                    {
                      model: AnswerChoice,
                      as: "answerChoices",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!boss) {
      return null;
    }

    // Structure the questions data
    const questionsData = boss.boss.Categories.map((category) => ({
      categoryId: category.id,
      categoryName: category.name,
      questions: category.questions.map((question) => ({
        questionId: question.id,
        questionText: question.questionText,
        questionType: question.questionType,
        difficulty: question.difficulty,
        timeLimit: question.timeLimit,
        answerChoices: question.answerChoices.map((choice) => ({
          choiceId: choice.id,
          choiceText: choice.choiceText,
          isCorrect: choice.isCorrect,
        })),
      })),
    }));

    return {
      bossId: boss.id,
      bossName: boss.boss.name,
      questionsData: questionsData,
    };
  } catch (error) {
    console.error("Error fetching boss questions and answers:", error);
    throw error;
  }
};

/**
 * Get random questions from each category for a boss battle
 * @param {number} eventBossId - The ID of the event boss
 * @param {string} joinCode - The join code for the boss
 * @param {number} questionsPerCategory - Number of questions to get per category
 * @returns {Object|null} - Object containing random questions or null if not found
 */
export const getRandomBossQuestions = async (
  eventBossId,
  joinCode,
  questionsPerCategory = 5
) => {
  try {
    const bossData = await getBossQuestionsAndAnswers(eventBossId, joinCode);

    if (!bossData) {
      return null;
    }

    // Get random questions from each category
    const randomQuestionsData = bossData.questionsData.map((category) => {
      const shuffledQuestions = [...category.questions].sort(
        () => 0.5 - Math.random()
      );
      const selectedQuestions = shuffledQuestions.slice(
        0,
        questionsPerCategory
      );

      return {
        ...category,
        questions: selectedQuestions,
      };
    });

    return {
      bossId: bossData.bossId,
      bossName: bossData.bossName,
      questionsData: randomQuestionsData,
    };
  } catch (error) {
    console.error("Error fetching random boss questions:", error);
    throw error;
  }
};
