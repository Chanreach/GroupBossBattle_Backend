import { Question, AnswerChoice, Category, User } from "../models/index.js";
import { Op } from "sequelize";
import sequelize from "../config/db.js";

/**
 * Validation helper functions
 */
const validateQuestionData = (questionText, answerChoices, timeLimit) => {
  const errors = [];

  // Validate question text
  if (!questionText || questionText.trim() === "") {
    errors.push("Question text is required");
  }

  // Validate time limit
  if (!timeLimit || !Number.isInteger(timeLimit) || timeLimit <= 0) {
    errors.push("Time limit must be a positive integer");
  }

  // Validate answer choices
  if (!answerChoices || !Array.isArray(answerChoices) || answerChoices.length !== 8) {
    errors.push("Exactly 8 answer choices are required");
  } else {
    // Check for empty choices
    const emptyChoices = answerChoices.filter(choice => !choice.choiceText || choice.choiceText.trim() === "");
    if (emptyChoices.length > 0) {
      errors.push("All answer choices must have non-empty text");
    }

    // Check for duplicate choices
    const choiceTexts = answerChoices.map(choice => choice.choiceText?.trim().toLowerCase());
    const uniqueChoices = new Set(choiceTexts);
    if (uniqueChoices.size !== choiceTexts.length) {
      errors.push("Answer choices must be unique");
    }

    // Check for exactly one correct answer
    const correctAnswers = answerChoices.filter(choice => choice.isCorrect === true);
    if (correctAnswers.length !== 1) {
      errors.push("Exactly one answer choice must be marked as correct");
    }
  }

  return errors;
};

/**
 * Get all questions with filtering based on user role
 */
const getAllQuestions = async (req, res) => {
  try {
    const filter = req.questionFilter || {};
    const { categoryId, page = 1, limit = 10 } = req.query;

    // Add category filter if provided
    if (categoryId) {
      filter.categoryId = categoryId;
    }

    const offset = (page - 1) * limit;

    const questions = await Question.findAndCountAll({
      where: filter,
      include: [
        {
          model: AnswerChoice,
          as: "answerChoices",
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: parseInt(limit),
      offset,
    });

    res.status(200).json({
      questions: questions.rows,
      totalCount: questions.count, // This is now correctly filtered by categoryId if provided
      currentPage: parseInt(page),
      totalPages: Math.ceil(questions.count / limit),
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get question by ID
 */
const getQuestionById = async (req, res) => {
  try {
    const { id } = req.params;
    const filter = req.questionFilter || {};
    filter.id = id;

    const question = await Question.findOne({
      where: filter,
      include: [
        {
          model: AnswerChoice,
          as: "answerChoices",
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"],
        },
      ],
    });

    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.status(200).json(question);
  } catch (error) {
    console.error("Error fetching question:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Create a new question
 */
const createQuestion = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { categoryId, questionText, answerChoices, timeLimit = 30 } = req.body;
    const authorId = req.user.id;

    // Validate required fields
    if (!categoryId) {
      await transaction.rollback();
      return res.status(400).json({ message: "Category ID is required" });
    }

    // Check if category exists (hosts can use any category, not just their own)
    const category = await Category.findByPk(categoryId);
    if (!category) {
      await transaction.rollback();
      return res.status(404).json({ message: "Category not found" });
    }

    // Validate question data
    const validationErrors = validateQuestionData(questionText, answerChoices, timeLimit);
    if (validationErrors.length > 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: "Validation failed", 
        errors: validationErrors 
      });
    }

    // Create question
    const newQuestion = await Question.create({
      categoryId,
      questionText: questionText.trim(),
      timeLimit,
      authorId,
    }, { transaction });

    // Create answer choices
    const answerChoicePromises = answerChoices.map((choice) => {
      return AnswerChoice.create({
        questionId: newQuestion.id,
        choiceText: choice.choiceText.trim(),
        isCorrect: choice.isCorrect || false,
      }, { transaction });
    });

    await Promise.all(answerChoicePromises);

    await transaction.commit();

    // Fetch the complete question with associations
    const createdQuestion = await Question.findByPk(newQuestion.id, {
      include: [
        {
          model: AnswerChoice,
          as: "answerChoices",
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"],
        },
      ],
    });

    res.status(201).json(createdQuestion);
  } catch (error) {
    await transaction.rollback();
    console.error("Error creating question:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Update a question
 */
const updateQuestion = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { categoryId, questionText, answerChoices, timeLimit } = req.body;
    const authorId = req.user.id;

    // Find question with ownership check
    const questionFilter = req.user.role === 'admin' ? { id } : { id, authorId };
    const question = await Question.findOne({ where: questionFilter });

    if (!question) {
      await transaction.rollback();
      return res.status(404).json({ message: "Question not found or access denied" });
    }

    // If categoryId is being updated, check if new category exists
    if (categoryId && categoryId !== question.categoryId) {
      const category = await Category.findByPk(categoryId);
      if (!category) {
        await transaction.rollback();
        return res.status(404).json({ message: "Category not found" });
      }
    }

    // Validate question data if provided
    if (answerChoices) {
      const validationErrors = validateQuestionData(
        questionText || question.questionText, 
        answerChoices, 
        timeLimit || question.timeLimit
      );
      if (validationErrors.length > 0) {
        await transaction.rollback();
        return res.status(400).json({ 
          message: "Validation failed", 
          errors: validationErrors 
        });
      }
    }

    // Update question
    if (categoryId) question.categoryId = categoryId;
    if (questionText) question.questionText = questionText.trim();
    if (timeLimit) question.timeLimit = timeLimit;

    await question.save({ transaction });

    // Update answer choices if provided
    if (answerChoices) {
      // Delete existing answer choices
      await AnswerChoice.destroy({
        where: { questionId: id },
        transaction,
      });

      // Create new answer choices
      const answerChoicePromises = answerChoices.map((choice) => {
        return AnswerChoice.create({
          questionId: id,
          choiceText: choice.choiceText.trim(),
          isCorrect: choice.isCorrect || false,
        }, { transaction });
      });

      await Promise.all(answerChoicePromises);
    }

    await transaction.commit();

    // Fetch the updated question with associations
    const updatedQuestion = await Question.findByPk(id, {
      include: [
        {
          model: AnswerChoice,
          as: "answerChoices",
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"],
        },
      ],
    });

    res.status(200).json(updatedQuestion);
  } catch (error) {
    await transaction.rollback();
    console.error("Error updating question:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Delete a question
 */
const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const authorId = req.user.id;

    // Find question with ownership check
    const questionFilter = req.user.role === 'admin' ? { id } : { id, authorId };
    const question = await Question.findOne({ where: questionFilter });

    if (!question) {
      return res.status(404).json({ message: "Question not found or access denied" });
    }

    // Delete question (answer choices will be deleted via cascade)
    await question.destroy();

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting question:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get questions by category
 */
const getQuestionsByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const filter = req.questionFilter || {};
    filter.categoryId = categoryId;

    const questions = await Question.findAll({
      where: filter,
      include: [
        {
          model: AnswerChoice,
          as: "answerChoices",
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.status(200).json(questions);
  } catch (error) {
    console.error("Error fetching questions by category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get question count by category
 */
const getQuestionCountByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const filter = req.questionFilter || {};
    filter.categoryId = categoryId;

    const count = await Question.count({
      where: filter
    });

    res.status(200).json({ count });
  } catch (error) {
    console.error("Error fetching question count by category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Get question statistics
 */
const getQuestionStats = async (req, res) => {
  try {
    const filter = req.questionFilter || {};

    const stats = await Question.findAll({
      where: filter,
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('Question.id')), 'totalQuestions'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN Question.created_at >= NOW() - INTERVAL 30 DAY THEN 1 END')), 'recentQuestions'],
      ],
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["name"],
        },
      ],
      group: ["category.id", "category.name"],
      raw: true,
    });

    res.status(200).json(stats);
  } catch (error) {
    console.error("Error fetching question statistics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default {
  getAllQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getQuestionsByCategory,
  getQuestionCountByCategory,
  getQuestionStats,
};
