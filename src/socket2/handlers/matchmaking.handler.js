import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  SOCKET_ERRORS,
  SOCKET_MESSAGES,
} from "../../utils/socket.constants.js";
import matchmakingManager from "../managers/matchmaking.manager.js";

const handleMatchmaking = (io, socket) => {
  socket.on(SOCKET_EVENTS.BATTLE_QUEUE.JOIN, (payload) => {
    const { eventBossId, playerInfo } = payload;

    if (!eventBossId || !playerInfo) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INVALID_PAYLOAD,
        message: "Invalid eventBossId or playerInfo.",
      });
      return;
    }
    
  })
};

export default handleMatchmaking;
