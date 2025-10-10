import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
} from "../../utils/socket.constants.js";

const handleBossPreview = (io, socket) => {
  socket.on(SOCKET_EVENTS.BOSS_PREVIEW.JOIN, (payload) => {
    const { eventBossId, joinCode } = payload;

    if (!eventBossId || !joinCode) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId or joinCode.",
      });
      return;
    }

    socket.join(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId));
    socket.emit(SOCKET_EVENTS.BOSS_PREVIEW.JOINED, {
      message: "Successfully joined boss preview.",
    });
  });

  socket.on(SOCKET_EVENTS.BOSS_PREVIEW.LEAVE, (payload) => {
    const { eventBossId } = payload;

    if (!eventBossId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId.",
      });
      return;
    }

    socket.leave(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId));
    socket.emit(SOCKET_EVENTS.BOSS_PREVIEW.LEFT, {
      message: "Successfully left boss preview.",
    });
  });
};

export default handleBossPreview;
