import { Category } from "../../models/index.js";
import { categoryIncludes } from "../../models/includes.js";
import ApiError from "../utils/api-error.util.js";
import { normalizeName } from "../utils/helper.js";

const getAllCategories = async (req, res, next) => {
  const filter = req.categoryFilter || {};

  try {
    const categories = await Category.findAll({
      where: filter,
      include: categoryIncludes({
        includeCreator: true,
        includeQuestions: true,
      }),
    });

    const summaries = categories.map((category) => category.getDetails());

    res.status(200).json(summaries);
  } catch (error) {
    next(error);
  }
};

const getCategoryById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const category = await Category.findOne({
      where: { id },
      include: categoryIncludes({ includeCreator: true }),
    });
    if (!category) {
      throw new ApiError(404, "Category not found.");
    }

    res.status(200).json(category.getDetails());
  } catch (error) {
    next(error);
  }
};

const createCategory = async (req, res, next) => {
  const { name } = req.body;
  const user = req.user;

  try {
    const newCategory = await Category.create({
      name: normalizeName(name),
      creatorId: user.id,
    });

    res.status(201).json({
      message: "Category created successfully!",
      category: newCategory.getDetails(),
    });
  } catch (error) {
    next(error);
  }
};

const updateCategory = async (req, res, next) => {
  const { id } = req.params;
  const { name } = req.body;

  try {
    const category = await Category.findByPk(id);
    if (!category) {
      throw new ApiError(404, "Category not found.");
    }

    const updatedFields = {};
    if (name) updatedFields.name = normalizeName(name);

    if (Object.keys(updatedFields).length === 0) {
      return res.status(200).json({
        message: "No changes detected. Category remains unchanged.",
        category: category.getDetails(),
      });
    }

    await category.update(updatedFields);

    res.status(200).json({
      message: "Category updated successfully!",
      category: category.getDetails(),
    });
  } catch (error) {
    next(error);
  }
};

const deleteCategory = async (req, res, next) => {
  const { id } = req.params;

  try {
    const category = await Category.findByPk(id);
    if (!category) {
      throw new ApiError(404, "Category not found.");
    }

    await category.destroy();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export default {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
