import { Question, Category, Boss, Event } from "../models/index.js";

export function checkQuestionOwnership(req, res, next) {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Admins can access all questions
      if (userRole === 'admin') {
        return next();
      }

      // Find the question and check ownership
      const question = await Question.findByPk(id);
      if (!question) {
        return res.status(404).json({ message: "Question not found" });
      }

      // Check if user owns the question
      if (question.authorId !== userId) {
        return res.status(403).json({ 
          message: "Forbidden: You can only manage your own questions" 
        });
      }

      next();
    } catch (error) {
      console.error("Error checking question ownership:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

export function checkCategoryOwnership(req, res, next) {
  return async (req, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.id;
      const userRole = req.user.role;

      // Admins can access all categories
      if (userRole === 'admin') {
        return next();
      }

      // Find the category and check ownership
      const category = await Category.findByPk(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      // Check if user owns the category
      if (category.creatorId !== userId) {
        return res.status(403).json({ 
          message: "Forbidden: You can only manage your own categories" 
        });
      }

      next();
    } catch (error) {
      console.error("Error checking category ownership:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
}

export async function checkBossOwnership(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admins can access all bosses
    if (userRole === 'admin') {
      return next();
    }

    // Find the boss and check ownership
    const boss = await Boss.findByPk(id);
    if (!boss) {
      return res.status(404).json({ message: "Boss not found" });
    }

    // Check if user owns the boss
    if (boss.creatorId !== userId) {
      return res.status(403).json({ 
        message: "Forbidden: You can only manage your own bosses" 
      });
    }

    next();
  } catch (error) {
    console.error("Error checking boss ownership:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function checkEventOwnership(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Admins can access all events
    if (userRole === 'admin') {
      return next();
    }

    // Find the event and check ownership
    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if user owns the event
    if (event.creatorId !== userId) {
      return res.status(403).json({ 
        message: "Forbidden: You can only manage your own events" 
      });
    }

    next();
  } catch (error) {
    console.error("Error checking event ownership:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

export function getQuestionFilter(req, res, next) {
  // Both hosts and admins can see all questions
  req.questionFilter = {};
  next();
}

export function getCategoryFilter(req, res, next) {
  // Both hosts and admins can see all categories
  req.categoryFilter = {};
  next();
}

export function getBossFilter(req, res, next) {
  const userRole = req.user.role;
  const userId = req.user.id;

  if (userRole === 'admin') {
    // Admins can see all bosses
    req.bossFilter = {};
  } else {
    // Hosts can only see their own bosses
    req.bossFilter = { creatorId: userId };
  }
  
  next();
}

export function getEventFilter(req, res, next) {
  // Both hosts and admins can see all events
  req.eventFilter = {};
  next();
}
