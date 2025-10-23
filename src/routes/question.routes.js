import express from "express";
import questionController from "../controllers/question.controller.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware.js";
import { checkQuestionOwnership, getQuestionFilter } from "../middleware/resource.middleware.js";

const router = express.Router();

router.use(authenticateToken, authorizeRoles("superadmin", "admin", "host"));

router.get("/", getQuestionFilter, questionController.getAllQuestions);
router.get("/:id", getQuestionFilter, questionController.getQuestionById);
router.post("/", questionController.createQuestion);

router.use(checkQuestionOwnership);
router.put("/:id", questionController.updateQuestion);
router.delete("/:id", questionController.deleteQuestion);

export default router;
