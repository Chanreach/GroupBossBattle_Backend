import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
} from "../../utils/socket.constants.js";
import EventBossService from "../../services/event-boss.service.js";

const handleEventBoss = (io, socket) => {
  socket.on(SOCKET_EVENTS.BOSS.REQUEST, async (payload) => {
    const { eventBossId } = payload;
    
    if (!eventBossId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId.",
      });
      return;
    }

    try {
      const eventBoss = await EventBossService.getEventBossById(eventBossId);
      if (!eventBoss) {
        socket.emit(SOCKET_EVENTS.BOSS.NOT_FOUND, {
          message: "Event boss not found.",
        });
        return;
      }

      socket.emit(SOCKET_EVENTS.BOSS.RESPONSE, {
        message: "Successfully retrieved event boss.",
        data: { eventBoss },
      });
    } catch (error) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: error.message || "Internal server error. Please try again later.",
      });
    }
  });
};

export default handleEventBoss;
