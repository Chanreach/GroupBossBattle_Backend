import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import apiRoutes from "./routes/index.js";
import errorHandler from "./middleware/error.middleware.js";

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

server.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});
