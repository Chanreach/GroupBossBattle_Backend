import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import userRoutes from "./routes/user.routes.js";
import eventRoutes from "./routes/event.routes.js";
import publicEventRoutes from "./routes/public-event.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import questionRoutes from "./routes/question.routes.js";
import bossRoutes from "./routes/boss.routes.js";
import eventBossRoutes from "./routes/event_boss.routes.js";
import authRoutes from "./routes/auth.routes.js";
import badgeRoutes from "./routes/badge.routes.js";
import userBadgeRoutes from "./routes/user_badge.routes.js";
import leaderboardRoutes from "./routes/leaderboard.routes.js";
import heartBeatRoutes from "./routes/heartbeat.routes.js";

import "./schedulers/event-status-updater.js";
import "./schedulers/event-boss-status-updater.js";
import "./schedulers/cleanup-inactive-guests.js";
import setupSocket from "./socket/index.js";

import "./utils/logger.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: [process.env.CORS_ORIGIN, "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    transports: ["websocket"],
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser()); // Add cookie-parser middleware

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/uploads", express.static(path.join(__dirname, "../uploads")));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/public/events", publicEventRoutes); // Public events route (no auth required)
app.use("/api/events", eventRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/bosses", bossRoutes);
app.use("/api/event-bosses", eventBossRoutes);
app.use("/api/badges", badgeRoutes);
app.use("/api/user-badges", userBadgeRoutes);
app.use("/api/leaderboards", leaderboardRoutes);
app.use("/api/heartbeat", heartBeatRoutes);

const io = new Server(server, {
  cors: {
    origin: [process.env.CORS_ORIGIN, "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

setupSocket(io);

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
