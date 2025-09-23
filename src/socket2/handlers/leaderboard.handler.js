import {
  SOCKET_EVENTS,
  SOCKET_ERRORS,
  SOCKET_MESSAGES,
  SOCKET_ROOMS,
} from "../../utils/socket.constants.js";
import battleSessionManager from "../../managers/battle-session.manager.js";

const handleLeaderboard = (io, socket) => {
  socket.on(SOCKET_EVENTS.BOSS_PREVIEW.LEADERBOARD.REQUEST, async (payload) => {
    const { eventBossId } = payload;
    if (!eventBossId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId.",
      });
      return;
    }

    try {
      const leaderboard = await battleSessionManager.getPreviewLiveLeaderboard(
        eventBossId
      );
      socket.emit(SOCKET_EVENTS.BOSS_PREVIEW.LEADERBOARD.RESPONSE, {
        data: { leaderboard },
      });
    } catch (error) {
      console.log(error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INTERNAL_SERVER,
        message: "An error occurred while fetching the leaderboard.",
      });
    }
  });

  socket.on(SOCKET_EVENTS.BATTLE_SESSION.LEADERBOARD.REQUEST, (payload) => {
    const { eventBossId } = payload;
    if (!eventBossId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId.",
      });
      return;
    }

    try {
      const leaderboard =
        battleSessionManager.getBattleLiveLeaderboard(eventBossId);
      socket.emit(SOCKET_EVENTS.BATTLE_SESSION.LEADERBOARD.RESPONSE, {
        data: { leaderboard },
      });
    } catch (error) {
      console.log(error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INTERNAL_SERVER,
        message: "An error occurred while fetching the leaderboard.",
      });
    }
  });
};

export default handleLeaderboard;
