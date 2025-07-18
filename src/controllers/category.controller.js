import { Category, User } from "../models/index.js";
import { Op } from "sequelize";

const getAllCategories = async (req, res) => {
  try {
    const filter = req.categoryFilter || {};
    const { page = 1, limit = 10 } = req.query;

    const offset = (page - 1) * limit;

    const categories = await Category.findAndCountAll({
      where: filter,
      include: [
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
      categories: categories.rows,
      totalCount: categories.count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(categories.count / limit),
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    const filter = req.categoryFilter || {};
    filter.id = id;

    const category = await Category.findOne({
      where: filter,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"],
        },
      ],
    });

    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json(category);
  } catch (error) {
    console.error("Error fetching category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const creatorId = req.user.id;

    // Validate required fields
    if (!name || name.trim() === "") {
      return res.status(400).json({ message: "Category name is required" });
    }

    // Check for duplicate category name for this user
    const existingCategory = await Category.findOne({
      where: {
        name: name.trim(),
        creatorId,
      },
    });

    if (existingCategory) {
      return res.status(409).json({ message: "Category with this name already exists" });
    }

    const newCategory = await Category.create({
      name: name.trim(),
      creatorId,
    });

    // Fetch the category with creator info
    const categoryWithCreator = await Category.findByPk(newCategory.id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"],
        },
      ],
    });

    res.status(201).json(categoryWithCreator);
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const creatorId = req.user.id;

    // Find category with ownership check
    const categoryFilter = req.user.role === 'admin' ? { id } : { id, creatorId };
    const category = await Category.findOne({ where: categoryFilter });

    if (!category) {
      return res.status(404).json({ message: "Category not found or access denied" });
    }

    // Validate name if provided
    if (name !== undefined) {
      if (!name || name.trim() === "") {
        return res.status(400).json({ message: "Category name cannot be empty" });
      }

      // Check for duplicate name (excluding current category)
      const existingCategory = await Category.findOne({
        where: {
          name: name.trim(),
          creatorId: category.creatorId,
          id: { [Op.ne]: id },
        },
      });

      if (existingCategory) {
        return res.status(409).json({ message: "Category with this name already exists" });
      }

      category.name = name.trim();
    }

    await category.save();

    // Fetch updated category with creator info
    const updatedCategory = await Category.findByPk(id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username"],
        },
      ],
    });

    res.status(200).json(updatedCategory);
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const creatorId = req.user.id;

    // Find category with ownership check
    const categoryFilter = req.user.role === 'admin' ? { id } : { id, creatorId };
    const category = await Category.findOne({ where: categoryFilter });

    if (!category) {
      return res.status(404).json({ message: "Category not found or access denied" });
    }

    await category.destroy();
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
