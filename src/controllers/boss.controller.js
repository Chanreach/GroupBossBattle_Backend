import { sequelize, Boss, Category } from "../../models/index.js";
import { bossIncludes } from "../../models/includes.js";
import { Op } from "sequelize";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ApiError from "../utils/api-error.util.js";
import { normalizeName, normalizeText, normalizeInteger } from "../utils/helper.js";

const DEFAULT_COOLDOWN_DURATION = 60;
const DEFAULT_NUMBER_OF_TEAMS = 2;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getAllBosses = async (req, res, next) => {
  const filter = req.bossFilter || {};

  try {
    const bosses = await Boss.findAll({
      where: filter,
      include: bossIncludes({
        includeCreator: true,
        includeCategories: true,
      }),
    });

    const summaries = bosses.map((boss) => boss.getSummary());

    res.status(200).json(summaries);
  } catch (error) {
    next(error);
  }
};

const getBossById = async (req, res, next) => {
  const { id } = req.params;

  try {
    const boss = await Boss.findByPk(id, {
      include: bossIncludes({ includeCreator: true, includeCategories: true }),
    });
    if (!boss) {
      throw new ApiError(404, "Boss not found.");
    }

    res.status(200).json(boss.getSummary());
  } catch (error) {
    next(error);
  }
};

const createBoss = async (req, res, next) => {
  const { name, description, cooldownDuration, numberOfTeams, categoryIds } =
    req.body;
  const requesterId = req.user.id;

  const transaction = await sequelize.transaction();
  try {
    const newBoss = await Boss.create(
      {
        name: normalizeName(name),
        image: req.file ? `bosses/${req.file.filename}` : null,
        description: normalizeText(description),
        cooldownDuration: normalizeInteger(cooldownDuration) || DEFAULT_COOLDOWN_DURATION,
        numberOfTeams: normalizeInteger(numberOfTeams) || DEFAULT_NUMBER_OF_TEAMS,
        creatorId: requesterId,
      },
      { transaction }
    );

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      throw new ApiError(400, "Invalid category IDs.");
    }

    const uniqueCategoryIds = [...new Set(categoryIds)];
    const categories = await Category.findAll(
      {
        where: { id: { [Op.in]: uniqueCategoryIds } },
      },
      { transaction }
    );
    if (categories.length !== uniqueCategoryIds.length)
      throw new ApiError(400, "One or more categories not found.");

    await newBoss.setCategories(uniqueCategoryIds, { transaction });

    await transaction.commit();

    res.status(201).json({
      message: "Boss created successfully!",
      boss: newBoss.getSummary(),
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const updateBoss = async (req, res, next) => {
  const { id } = req.params;
  const { name, description, cooldownDuration, numberOfTeams, categoryIds } =
    req.body;

  const transaction = await sequelize.transaction();
  try {
    const boss = await Boss.findByPk(id, {
      include: bossIncludes({ includeCategories: true }),
      transaction,
    });
    if (!boss) {
      throw new ApiError(404, "Boss not found.");
    }

    const updatedFields = {};
    if (name) updatedFields.name = normalizeName(name);
    if (description) updatedFields.description = normalizeText(description);
    if (cooldownDuration) updatedFields.cooldownDuration = cooldownDuration;
    if (numberOfTeams) updatedFields.numberOfTeams = numberOfTeams;
    if (req.file) {
      if (boss.image) {
        const oldImagePath = path.join(
          __dirname,
          "../../uploads/",
          path.basename(boss.image)
        );
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath).catch((err) => {
            console.error("Deleting old boss image error:", err);
          });
        }
      }
      updatedFields.image = `bosses/${req.file.filename}`;
    }

    if (Object.keys(updatedFields).length > 0) {
      await boss.update(updatedFields, { transaction });
    }

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      throw new ApiError(400, "Invalid category IDs.");
    }

    const uniqueCategoryIds = [...new Set(categoryIds)];
    const categories = await Category.findAll(
      {
        where: { id: { [Op.in]: uniqueCategoryIds } },
      },
      { transaction }
    );

    if (categories.length !== uniqueCategoryIds.length)
      throw new ApiError(400, "One or more categories not found.");

    const currentCategories = boss.categories;
    const currentCategoryIds = currentCategories.map((cat) => cat.id);
    const isSameCategories =
      currentCategoryIds.length === uniqueCategoryIds.length &&
      currentCategoryIds.every((id) => uniqueCategoryIds.includes(id));

    if (!isSameCategories) {
      await boss.setCategories(uniqueCategoryIds, { transaction });
    }

    if (Object.keys(updatedFields).length === 0 && isSameCategories) {
      await transaction.rollback();
      return res.status(200).json({
        message: "No changes detected. Boss remains unchanged.",
        boss: boss.getSummary(),
      });
    }

    await transaction.commit();

    res.status(200).json({
      message: "Boss updated successfully!",
      boss: boss.getSummary(),
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

const deleteBoss = async (req, res, next) => {
  const { id } = req.params;

  try {
    const boss = await Boss.findByPk(id);
    if (!boss) {
      throw new ApiError(404, "Boss not found.");
    }

    if (boss.image) {
      const imagePath = path.join(
        __dirname,
        "../../uploads/",
        path.basename(boss.image)
      );
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath).catch((err) => {
          console.error("Deleting boss image error:", err);
        });
      }
    }

    await boss.destroy();

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export default {
  getAllBosses,
  getBossById,
  createBoss,
  updateBoss,
  deleteBoss,
};
