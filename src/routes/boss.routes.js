import express from "express";
import bossController from "../controllers/boss.controller.js";
import {
  authenticateToken,
  authorizeRoles,
} from "../middleware/auth.middleware.js";
import { uploadBossImage } from "../middleware/upload.middleware.js";
import {
  checkBossOwnership,
  getBossFilter,
} from "../middleware/resource.middleware.js";

const router = express.Router();

router.use(authenticateToken, authorizeRoles("superadmin", "admin", "host"));

router.get("/", getBossFilter, bossController.getAllBosses);
router.post("/", uploadBossImage, bossController.createBoss);

router.use(checkBossOwnership);
router.get("/:id", bossController.getBossById);
router.put("/:id", uploadBossImage, bossController.updateBoss);
router.delete("/:id", bossController.deleteBoss);

export default router;
