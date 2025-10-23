import express from "express";
import userBadgeController from "../controllers/user-badge.controller.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(authenticateToken);
router.get("/", userBadgeController.getAllUserBadges);

router.use(authorizeRoles("superadmin", "admin", "host"));
router.put("/:id/update", userBadgeController.updateUserBadge);
router.get("/:eventId", userBadgeController.getAllUserBadgesByEventId);

export default router;
