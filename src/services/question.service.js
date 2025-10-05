import {
  Boss,
  EventBoss,
  Category,
  Question,
  AnswerChoice,
} from "../models/index.js";

class QuestionService {
  static async getQuestionsByEventBossId(eventBossId) {
    if (!eventBossId) {
      console.error("Event boss ID is required");
      return null;
    }

    const eventBoss = await EventBoss.findByPk(eventBossId, {
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
                  attributes: { exclude: ["createdAt", "updatedAt"] },
                  include: [
                    {
                      model: AnswerChoice,
                      as: "answerChoices",
                      attributes: { exclude: ["createdAt", "updatedAt"] },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    
    if (!eventBoss) {
      console.error("Event boss not found");
      return null;
    }

    const questions = eventBoss.boss.Categories.flatMap((category) =>
      category.questions.map((question) => ({
        ...question.toJSON(),
        categoryId: category.id,
        categoryName: category.name,
      }))
    );
    
    return questions;
  }
}

export default QuestionService;
