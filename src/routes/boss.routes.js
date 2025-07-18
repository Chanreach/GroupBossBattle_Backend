import express from "express";
import bossController from "../controllers/boss.controller.js";
import { authenticateToken, authorizeRoles } from "../middleware/auth.js";
import { uploadBossImage } from "../middleware/upload.js";
import { checkBossOwnership, getBossFilter } from "../middleware/resourceOwnership.js";

const router = express.Router();

// Protect all boss management routes
router.use(authenticateToken, authorizeRoles('host', 'admin'));

router.get("/", getBossFilter, bossController.getAllBosses);
router.get("/:id", checkBossOwnership, bossController.getBossById);
router.post("/", uploadBossImage, bossController.createBoss);
router.put("/:id", checkBossOwnership, uploadBossImage, bossController.updateBoss);
router.delete("/:id", checkBossOwnership, bossController.deleteBoss);

export default router;
