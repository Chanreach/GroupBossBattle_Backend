import {
  sequelize,
  Question,
  AnswerChoice,
  Category,
  User,
} from "../../models/index.js";
import { questionIncludes } from "../../models/includes.js";
import ApiError from "../utils/api-error.util.js";
import { normalizeText, normalizeInteger } from "../utils/helper.js";

const validateAnswerChoices = (answerChoices) => {
  if (!Array.isArray(answerChoices) || answerChoices.length !== 8) {
    throw new ApiError(400, "Exactly 8 answer choices are required.");
  }

  const choiceTexts = answerChoices.map((choice) =>
    normalizeText(choice.choiceText)
  );
  const uniqueChoiceTexts = new Set(choiceTexts);
  if (uniqueChoiceTexts.size !== choiceTexts.length) {
    throw new ApiError(400, "Answer choice texts must be unique.");
  }

  const correctChoices = answerChoices.filter((choice) => choice.isCorrect);
  if (correctChoices.length !== 1) {
    throw new ApiError(400, "There must be exactly one correct answer choice.");
  }
};

const getAllQuestions = async (req, res, next) => {
  const filter = req.questionFilter || {};

  try {
    const questions = await Question.findAll({
      where: filter,
      include: questionIncludes({
        includeAuthor: true,
        includeCategory: true,
      }),
    });

    res.status(200).json(questions);
  } catch (error) {
    next(error);
  }
};

const getQuestionById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const question = await Question.findOne({
      where: { id },
      include: questionIncludes({
        includeAuthor: true,
        includeCategory: true,
        includeAnswerChoices: true,
      }),
    });
    if (!question) {
      throw new ApiError(404, "Question not found.");
    }

    res.status(200).json(question);
  } catch (error) {
    next(error);
  }
};

const createQuestion = async (req, res, next) => {
  const { categoryId, questionText, timeLimit, answerChoices } = req.body;
  const user = req.user;

  console.log("Creating question with data:", req.body);
  console.log("Time Limit: ", normalizeInteger(timeLimit) || 20);

  const transaction = await sequelize.transaction();
  try {
    const category = await Category.findByPk(categoryId, { transaction });
    if (!category) {
      throw new ApiError(404, "Category not found.");
    }

    const newQuestion = await Question.create(
      {
        categoryId,
        questionText: normalizeText(questionText),
        timeLimit: normalizeInteger(timeLimit) || 20,
        authorId: user.id,
      },
      { transaction }
    );

    validateAnswerChoices(answerChoices);

    for (const choice of answerChoices) {
      await AnswerChoice.create(
        {
          questionId: newQuestion.id,
          choiceText: choice.choiceText,
          isCorrect: choice.isCorrect,
        },
        { transaction }
      );
    }

    await transaction.commit();

    res.status(201).json({
      message: "Question created successfully!",
      question: newQuestion,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const updateQuestion = async (req, res, next) => {
  const { id } = req.params;
  const { categoryId, questionText, timeLimit, answerChoices } = req.body;

  const transaction = await sequelize.transaction();
  try {
    const question = await Question.findByPk(id, {
      include: questionIncludes({
        includeAuthor: true,
        includeCategory: true,
        includeAnswerChoices: true,
      }),
    });
    if (!question) {
      throw new ApiError(404, "Question not found.");
    }

    const category = await Category.findByPk(categoryId);
    if (!category) {
      throw new ApiError(404, "Category not found.");
    }

    validateAnswerChoices(answerChoices);

    const updatedFields = {};
    if (categoryId) updatedFields.categoryId = categoryId;
    if (questionText) updatedFields.questionText = questionText;
    if (timeLimit) updatedFields.timeLimit = timeLimit;

    if (Object.keys(updatedFields).length > 0) {
      await question.update(updatedFields, { transaction });
    }

    const currentAnswerChoices = question.answerChoices;
    const isSameAnswerChoices =
      currentAnswerChoices.length === answerChoices.length &&
      currentAnswerChoices.every((currentChoice) =>
        answerChoices.some(
          (newChoice) =>
            newChoice.choiceText === currentChoice.choiceText &&
            newChoice.isCorrect === currentChoice.isCorrect
        )
      );

    if (!isSameAnswerChoices) {
      await AnswerChoice.destroy({
        where: { questionId: question.id },
        transaction,
      });
      for (const choice of answerChoices) {
        await AnswerChoice.create(
          {
            questionId: question.id,
            choiceText: choice.choiceText,
            isCorrect: choice.isCorrect,
          },
          { transaction }
        );
      }
    }

    if (Object.keys(updatedFields).length === 0 && isSameAnswerChoices) {
      await transaction.rollback();
      return res.status(200).json({
        message: "No changes detected. Question remains unchanged.",
        question,
      });
    }

    await transaction.commit();

    res.status(200).json({
      message: "Question updated successfully!",
      question,
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const deleteQuestion = async (req, res, next) => {
  const { id } = req.params;

  const transaction = await sequelize.transaction();
  try {
    const question = await Question.findByPk(id);
    if (!question) {
      throw new ApiError(404, "Question not found.");
    }

    await question.destroy({ transaction });

    await transaction.commit();

    res.status(204).send();
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

export default {
  getAllQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
};
