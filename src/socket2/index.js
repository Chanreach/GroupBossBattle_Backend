import handleMatchmaking from "./handlers/matchmaking.handler";
import handleBattleSession from "./handlers/battle.handler.js";
import handleQuestion from "./handlers/question.handler.js";
import handleCombat from "./handlers/combat.handler.js";
import handleKnockout from "./handlers/knockout.handler.js";
import handleLeaderboard from "./handlers/leaderboard.handler.js";

const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("New user connected:", socket.id);

    handleMatchmaking(io, socket);
    handleBattleSession(io, socket);
    handleQuestion(io, socket);
    handleCombat(io, socket);
    handleKnockout(io, socket);
    handleLeaderboard(io, socket);

    socket.on("disconnect", (reason) => {
      console.log("User disconnected:", socket.id, "Reason:", reason);
    });
  });
};

export default setupSocket;
