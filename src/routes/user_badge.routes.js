import express from "express";
import userBadgeController from "../controllers/user_badge.controller.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";

const router = express.Router();
router.use(authenticateToken);

router.get("/", userBadgeController.getAllUserBadges);
router.put(
  "/:id/update",
  authorizeRoles("host", "admin"),
  userBadgeController.updateUserBadge
);
router.get(
  "/:eventId",
  authorizeRoles("host", "admin"),
  userBadgeController.getAllUserBadgesByEventId
);

export default router;
