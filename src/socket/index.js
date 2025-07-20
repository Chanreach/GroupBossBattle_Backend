import handleMatchmaking from "./handlers/matchmaking.handler.js";
import handleCombat from "./handlers/combat.handler.js";
import handleKnockout from "./handlers/knockout.handler.js";
import handleBoss from "./handlers/boss.handler.js";
import bossSessionManager from "./managers/boss-session.manager.js";

const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Setup all handlers
    handleMatchmaking(io, socket);
    handleCombat(io, socket);
    handleKnockout(io, socket);
    handleBoss(io, socket);

    // Ping/Pong for connection health check
    socket.on("ping", () => {
      socket.emit("pong");
    });

    // Get socket connection info
    socket.on("get-connection-info", () => {
      socket.emit("connection-info", {
        socketId: socket.id,
        connectedAt: new Date().toISOString(),
      });
    });

    // Global disconnect handling
    socket.on("disconnect", (reason) => {
      console.log(`User disconnected: ${socket.id}, reason: ${reason}`);

      // Clean up player session if exists
      const playerSession = bossSessionManager.getPlayerSession(socket.id);
      if (playerSession) {
        const { eventBossId, nickname } = playerSession;

        // Remove player from session
        bossSessionManager.removePlayer(socket.id);

        // Notify remaining players in the session
        const session = bossSessionManager.getSession(eventBossId);
        if (session) {
          socket.to(`boss-${eventBossId}`).emit("player-disconnected", {
            nickname,
            playerCount: session.players.size,
            canStart: bossSessionManager.canStartBattle(eventBossId),
          });
        }

        console.log(`Cleaned up session for disconnected player: ${nickname}`);
      }
    });

    // Error handling
    socket.on("error", (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
      socket.emit("error", { message: "Socket error occurred" });
    });
  });

  // Global error handling for the socket server
  io.engine.on("connection_error", (err) => {
    console.log("Socket.IO connection error:", err.req);
    console.log("Error code:", err.code);
    console.log("Error message:", err.message);
    console.log("Error context:", err.context);
  });

  console.log("Socket.IO server setup complete");
};

export default setupSocket;
