import express from "express";
import questionController from "../controllers/question.controller.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { getQuestionFilter } from "../middleware/resourceOwnership.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Apply role authorization - only hosts and admins can access questions
router.use(authorizeRoles('host', 'admin'));

// Apply question filtering middleware
router.use(getQuestionFilter);

// Question routes
router.get("/", questionController.getAllQuestions);
router.get("/stats", questionController.getQuestionStats);
router.get("/category/:categoryId/count", questionController.getQuestionCountByCategory);
router.get("/category/:categoryId", questionController.getQuestionsByCategory);
router.get("/:id", questionController.getQuestionById);
router.post("/", questionController.createQuestion);
router.put("/:id", questionController.updateQuestion);
router.delete("/:id", questionController.deleteQuestion);

export default router;
