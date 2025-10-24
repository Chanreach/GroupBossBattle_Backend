import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import { sequelize } from "../models/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import apiRoutes from "./routes/index.js";
import errorHandler from "./middleware/error.middleware.js";
import "./schedulers/index.js";
import eventManager from "./managers/event.manager.js";
import setupSocket from "./socket/index.js";
import "./utils/logger.js";
import dotenv from "dotenv";
dotenv.config();

const PORT = process.env.PORT || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(process.cwd(), "uploads");
const profilesDir = path.join(uploadsDir, "profiles");
const bossesDir = path.join(uploadsDir, "bosses");

[uploadsDir, profilesDir, bossesDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

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
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api", apiRoutes);
app.use(errorHandler);

const io = new Server(server, {
  cors: {
    origin: [process.env.CORS_ORIGIN, "http://localhost:5173"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

setupSocket(io);

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log("[Database] Connection has been established successfully.");

    try {
      await eventManager.initializeEvents();
      console.log("[EventManager] Events initialized successfully.");
    } catch (error) {
      console.error("[EventManager] Error initializing events:", error);
    }

    setTimeout(async () => {
      try {
        await eventManager.refreshEvents();
      } catch (error) {
        console.error("[EventManager] Error refreshing events:", error);
      }
    }, 5 * 60 * 1000);

    server.listen(PORT, () => {
      console.log(`Server is running on port: ${PORT}`);
    });
  } catch (error) {
    console.error("[Server] Error starting server:", error);
    process.exit(1);
  }
};

startServer();
