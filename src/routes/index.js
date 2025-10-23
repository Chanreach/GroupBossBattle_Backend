import express from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import eventRoutes from "./event.routes.js";
import categoryRoutes from "./category.routes.js";
import questionRoutes from "./question.routes.js";
import bossRoutes from "./boss.routes.js";
import eventBossRoutes from "./event-boss.routes.js";
import badgeRoutes from "./badge.routes.js";
import userBadgeRoutes from "./user-badge.routes.js";
import leaderboardRoutes from "./leaderboard.routes.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/events", eventRoutes);
router.use("/categories", categoryRoutes);
router.use("/questions", questionRoutes);
router.use("/bosses", bossRoutes);
router.use("/event-bosses", eventBossRoutes);
router.use("/badges", badgeRoutes);
router.use("/user-badges", userBadgeRoutes);
router.use("/leaderboards", leaderboardRoutes);

export default router;
