import express from "express";
import categoryController from "../controllers/category.controller.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { getCategoryFilter } from "../middleware/resourceOwnership.js";

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Apply role authorization - only hosts and admins can access categories
router.use(authorizeRoles('host', 'admin'));

// Apply category filtering middleware
router.use(getCategoryFilter);

// Category routes
router.get("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);
router.post("/", categoryController.createCategory);
router.put("/:id", categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);

export default router;
