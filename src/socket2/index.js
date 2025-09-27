import handleBossPreview from "./handlers/boss-preview.handler.js";
import handleMatchmaking from "./handlers/matchmaking.handler.js";
import handleBattleSession from "./handlers/battle-session.handler.js";
import handleCombat from "./handlers/combat.handler.js";
import handleKnockout from "./handlers/knockout.handler.js";
import handleLeaderboard from "./handlers/leaderboard.handler.js";
import handleBattleMonitor from "./handlers/battle-monitor.handler.js";

const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("New user connected:", socket.id);

    handleBossPreview(io, socket);
    handleMatchmaking(io, socket);
    handleBattleSession(io, socket);
    handleCombat(io, socket);
    handleKnockout(io, socket);
    handleLeaderboard(io, socket);
    handleBattleMonitor(io, socket);

    socket.on("disconnect", (reason) => {
      console.log("User disconnected:", socket.id, "Reason:", reason);
    });
  });
};

export default setupSocket;
