import {
  Boss,
  EventBoss,
  Category,
  Question,
  AnswerChoice,
} from "../../models/index.js";
import { eventBossIncludes } from "../../models/includes.js";

class QuestionService {
  static async getQuestionsByEventBossId(eventBossId) {
    if (!eventBossId) {
      console.error("[QuestionService] Event boss ID is required.");
      return null;
    }

    const eventBoss = await EventBoss.findByPk(eventBossId, {
      include: eventBossIncludes({
        includeBoss: true,
        includeCategories: true,
        includeQuestions: true,
        includeAnswerChoices: true,
      }),
    });
    if (!eventBoss) {
      console.error("[QuestionService] Event boss not found.");
      return null;
    }

    const questions = eventBoss.boss.categories.flatMap((category) =>
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
