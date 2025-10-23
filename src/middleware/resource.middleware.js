import {
  Event,
  Boss,
  EventBoss,
  Category,
  Question,
} from "../../models/index.js";
import { Op } from "sequelize";

export const checkEventOwnership = async (req, res, next) => {
  const { id } = req.params;
  const requester = req.user;

  if (req.method === "POST") return next();

  try {
    if (["superadmin"].includes(requester.role)) return next();

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    if (event.creatorId !== requester.id) {
      return res.status(403).json({
        message: "Forbidden: You are not allowed to perform this action.",
      });
    }

    next();
  } catch (error) {
    console.error("Checking event ownership error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error.", error: error.message });
  }
};

export const checkBossOwnership = async (req, res, next) => {
  const { id } = req.params;
  const requester = req.user;

  try {
    if (["superadmin", "admin"].includes(requester.role)) return next();

    const boss = await Boss.findByPk(id);
    if (!boss) return res.status(404).json({ message: "Boss not found." });

    if (boss.creatorId !== requester.id) {
      return res
        .status(403)
        .json({
          message: "Forbidden: You are not allowed to perform this action.",
        });
    }

    next();
  } catch (error) {
    console.error("Checking boss ownership error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error.", error: error.message });
  }
};

export const checkBossesOwnership = async (req, res, next) => {
  const { bossIds } = req.body;
  const requester = req.user;

  try {
    if (["superadmin", "admin"].includes(requester.role)) return next();

    const bosses = await Boss.findAll({ where: { id: bossIds } });
    const unauthorizedBosses = bosses.filter(
      (boss) => boss.creatorId !== requester.id
    );
    if (unauthorizedBosses.length > 0) {
      return res.status(403).json({
        message: "Forbidden: You are not allowed to perform this action.",
      });
    }

    next();
  } catch (error) {
    console.error("Checking bosses ownership error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error.", error: error.message });
  }
};

export const checkEventBossesOwnership = async (req, res, next) => {
  const { eventBossIds } = req.body;
  const requester = req.user;

  try {
    if (["superadmin", "admin"].includes(requester.role)) return next();

    const eventBosses = await EventBoss.findAll({
      where: { id: { [Op.in]: eventBossIds } },
      include: [{ model: Boss, as: "boss" }],
    });
    const unauthorizedEventBosses = eventBosses.filter(
      (eb) => eb.boss.creatorId !== requester.id
    );
    if (unauthorizedEventBosses.length > 0) {
      return res.status(403).json({
        message: "Forbidden: You are not allowed to perform this action.",
      });
    }

    next();
  } catch (error) {
    console.error("Checking event bosses ownership error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error.", error: error.message });
  }
};

export const checkCategoryOwnership = async (req, res, next) => {
  const { id } = req.params;
  const requester = req.user;

  try {
    if (["superadmin", "admin"].includes(requester.role)) return next();

    const category = await Category.findByPk(id);
    if (!category)
      return res.status(404).json({ message: "Category not found." });

    if (category.creatorId !== requester.id) {
      return res.status(403).json({
        message: "Forbidden: You are not allowed to perform this action.",
      });
    }

    next();
  } catch (error) {
    console.error("Checking category ownership error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error.", error: error.message });
  }
};

export const checkQuestionOwnership = async (req, res, next) => {
  const { id } = req.params;
  const requester = req.user;

  try {
    if (["superadmin", "admin"].includes(requester.role)) return next();

    const question = await Question.findByPk(id, {
      include: [
        {
          model: Category,
          as: "category",
          include: [{ model: User, as: "creator" }],
        },
      ],
    });
    if (!question)
      return res.status(404).json({ message: "Question not found." });

    if (
      question.creatorId !== requester.id &&
      question.category.creatorId !== requester.id
    ) {
      return res.status(403).json({
        message: "Forbidden: You are not allowed to perform this action.",
      });
    }

    next();
  } catch (error) {
    console.error("Checking question ownership error:", error);
    res
      .status(500)
      .json({ message: "Internal Server Error.", error: error.message });
  }
};

export const getEventFilter = (req, res, next) => {
  req.eventFilter = {};
  next();
};

export const getBossFilter = (req, res, next) => {
  const requester = req.user;

  if (requester.role === "host") {
    req.bossFilter = { creatorId: requester.id };
  } else {
    req.bossFilter = {};
  }

  next();
};

export const getCategoryFilter = (req, res, next) => {
  req.categoryFilter = {};
  next();
};

export const getQuestionFilter = (req, res, next) => {
  req.questionFilter = {};
  next();
};
