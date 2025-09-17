import {
  Boss,
  EventBoss,
  Category,
  Question,
  AnswerChoice,
} from "../models/index.js";

class QuestionService {
  static async getQuestionsByEventBossId(eventBossId) {
    try {
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
                        attributes: { exclude: ["createdAt", "updatedAt"] }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      });
      if (!eventBoss) {
        throw new Error("Event boss not found");
      }

      const questions = eventBoss.boss.Categories.flatMap(category => 
        category.questions.map(question => ({
          ...question.toJSON(),
          categoryId: category.id,
          categoryName: category.name,
        }))
      );
      return questions;
    } catch (error) {
      console.error("Error fetching questions by event boss ID:", error);
      throw error;
    }
  }
}

export default QuestionService;
