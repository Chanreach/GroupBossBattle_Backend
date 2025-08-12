import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  SOCKET_ERRORS,
  SOCKET_MESSAGES,
} from "../../utils/socket.constants.js";
import BossService from "../../services/boss.service.js";

const handleBossPreview = (io, socket) => {
  socket.on(SOCKET_EVENTS.BOSS_PREVIEW.JOIN, async (payload) => {
    const { eventBossId, joinCode } = payload;
    if (!eventBossId || !joinCode) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        error: SOCKET_ERRORS.MISSING_DATA,
        message: SOCKET_MESSAGES.INVALID_JOIN,
      });
      return;
    }

    try {
      const eventBoss = await BossService.getEventBossByIdAndJoinCode(eventBossId, joinCode);
      if (!eventBoss) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          error: SOCKET_ERRORS.NOT_FOUND,
          message: SOCKET_MESSAGES.NOT_FOUND_ERROR,
        });
        return;
      }

      socket.join(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId));

      socket.emit(SOCKET_EVENTS.BOSS_PREVIEW.JOINED, {
        status: "success",
        message: "Successfully joined boss preview.",
        data: {
          eventBoss
        }
      });
    } catch (error) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        error: SOCKET_ERRORS.INTERNAL_SERVER,
        message: SOCKET_MESSAGES.INTERNAL_SERVER_ERROR,
      });
      return;
    }
  });

  socket.on(SOCKET_EVENTS.BOSS_PREVIEW.LEAVE, (eventBossId) => {
    if (!eventBossId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        error: SOCKET_ERRORS.MISSING_DATA,
        message: SOCKET_MESSAGES.INVALID_JOIN,
      });
      return;
    }

    socket.leave(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId));
    socket.emit(SOCKET_EVENTS.BOSS_PREVIEW.LEFT, {
      status: "success",
      message: "Successfully left boss preview.",
    });
  });

  socket.on(SOCKET_EVENTS.BOSS.REQUEST_STATUS, (eventBossId) => {
    if (!eventBossId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        error: SOCKET_ERRORS.MISSING_DATA,
        message: SOCKET_MESSAGES.INVALID_JOIN,
      });
      return;
    }

    // Handle boss status request
  });

};

export default handleBossPreview;
