import express from "express";
import authController from "../controllers/auth.controller.js";
import { authenticateToken } from "../middleware/auth.js";

const router = express.Router();

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh); // New refresh endpoint
router.post("/logout", authController.logout);   // New logout endpoint
router.get("/me", authenticateToken, authController.me);
router.post("/guest-login", authController.guestLogin);

export default router; 