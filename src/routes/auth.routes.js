import express from "express";
import authController from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";
import { activityTracker } from "../middleware/activity.middleware.js";

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/guest-login", authController.guestLogin);
router.post("/logout", authController.logout);
router.get("/me", authenticateToken, activityTracker, authController.me);
router.post("/refresh", authController.refresh);

export default router;
