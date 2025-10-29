import { v4 as uuidv4 } from "uuid";

export const prepareSeedQuestions = (questions, categoryId, authorId) => {
  const seededQuestions = [];
  const seededAnswerChoices = [];

  for (const question of questions) {
    const questionId = uuidv4();
    seededQuestions.push({
      id: questionId,
      text: question.text,
      category_id: categoryId,
      author_id: authorId,
    });
    for (const answerChoice of question.answerChoices) {
      seededAnswerChoices.push({
        id: uuidv4(),
        question_id: questionId,
        text: answerChoice.text,
        is_correct: answerChoice.isCorrect,
        order: answerChoice.order,
      });
    }
  }

  return { seededQuestions, seededAnswerChoices };
};
