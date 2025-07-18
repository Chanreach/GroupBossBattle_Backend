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

import { handleMatchmaking } from "./sockets/matchmaking.socket.js";
import userRoutes from "./routes/user.routes.js";
import eventRoutes from "./routes/event.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import questionRoutes from "./routes/question.routes.js";
import bossRoutes from "./routes/boss.routes.js";
import eventBossRoutes from "./routes/event_boss.routes.js";
import joinRoutes from "./routes/join.routes.js";
import authRoutes from "./routes/auth.routes.js";

import "./schedulers/event-status-updater.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser()); // Add cookie-parser middleware

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));

// app.use((req, res, next) => {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   next();
// });
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/bosses", bossRoutes);
app.use("/api/event-bosses", eventBossRoutes);
app.use("/api/join", joinRoutes);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Adjust this to your frontend URL
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Setup matchmaking
  handleMatchmaking(io, socket);

  // Global disconnect handling
  socket.on("disconnect", (reason) => {
    console.log(`User disconnected: ${socket.id}, reason: ${reason}`);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
