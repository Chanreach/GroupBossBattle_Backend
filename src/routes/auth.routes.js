import express from "express";
import authController from "../controllers2/auth.controller.js";
import { authenticateToken } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/guest-login", authController.guestLogin);
router.post("/logout", authController.logout);
router.get("/me", authenticateToken, authController.me);
router.post("/refresh", authController.refresh);

export default router;
