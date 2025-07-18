import express from "express";
import userController from "../controllers/user.controller.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { uploadProfileImage } from "../middleware/upload.js";

const router = express.Router();

// Profile routes (authenticated users can access their own profile)
router.get("/profile", authenticateToken, userController.getProfile);
router.put("/profile", authenticateToken, uploadProfileImage, userController.updateProfile);

// Admin-only user management routes
router.get("/", authenticateToken, authorizeRoles('admin'), userController.getAllUsers);
router.get("/:id", authenticateToken, authorizeRoles('admin'), userController.getUserById);
router.put("/:id", authenticateToken, authorizeRoles('admin'), userController.updateUser);
router.delete("/:id", authenticateToken, authorizeRoles('admin'), userController.deleteUser);

export default router;
