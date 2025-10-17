import express from "express";
import userController from "../controllers2/user.controller.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware.js";
import { uploadProfileImage } from "../middleware/upload.middleware.js";

const router = express.Router();
router.use(authenticateToken);

router.get("/profile", userController.getProfile);
router.put("/profile", uploadProfileImage, userController.updateProfile);

router.use(authorizeRoles("admin", "superadmin"));
router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.put("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);

export default router;
