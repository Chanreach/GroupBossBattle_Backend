import express from "express";
import categoryController from "../controllers/category.controller.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware.js";
import {
  checkCategoryOwnership,
  getCategoryFilter,
} from "../middleware/resource.middleware.js";

const router = express.Router();

router.use(
  authenticateToken,
  authorizeRoles("superadmin", "admin", "host"),
  getCategoryFilter
);

router.get("/", categoryController.getAllCategories);
router.get("/:id", categoryController.getCategoryById);
router.post("/", categoryController.createCategory);

router.use(checkCategoryOwnership);
router.put("/:id", categoryController.updateCategory);
router.delete("/:id", categoryController.deleteCategory);

export default router;
