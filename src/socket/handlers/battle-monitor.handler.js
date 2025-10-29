import battleSessionManager from "../../managers/battle-session.manager.js";
import EventService from "../../services/event.service.js";
import EventBossService from "../../services/event-boss.service.js";
import { SOCKET_EVENTS, SOCKET_ROOMS } from "../../utils/socket.constants.js";
import { GAME_CONSTANTS } from "../../utils/game.constants.js";

const handleBattleMonitor = (io, socket) => {
  socket.on(SOCKET_EVENTS.BATTLE_MONITOR.JOIN, async (payload) => {
    try {
      const { eventId, eventBossId, spectatorId } = payload;
      if (!eventId || !eventBossId || !spectatorId) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: "Invalid eventId, eventBossId, or spectatorId.",
        });
        return;
      }

      const event = await EventService.getEventById(eventId);
      const response = await EventBossService.getEventBossById(eventBossId);

      const isAllowedToSpectate = await EventBossService.isAllowedToSpectate(
        eventBossId,
        spectatorId
      );
      if (!isAllowedToSpectate) {
        socket.emit(SOCKET_EVENTS.BATTLE_MONITOR.UNAUTHORIZED, {
          message:
            "Forbidden: You are not authorized to spectate this battle session.",
        });
        return;
      }

      socket.join(SOCKET_ROOMS.BATTLE_MONITOR(eventBossId));

      const battleSession = battleSessionManager.findBattleSession(eventBossId);
      let eventBoss = null;
      let activePlayers = 0;
      let leaderboard = {
        teamLeaderboard: [],
        individualLeaderboard: [],
        allTimeLeaderboard: [],
      };
      if (battleSession) {
        const { teamLeaderboard, individualLeaderboard, allTimeLeaderboard } =
          await battleSessionManager.getPreviewLiveLeaderboard(eventBossId);
        leaderboard = {
          teamLeaderboard,
          individualLeaderboard,
          allTimeLeaderboard,
        };
      } else {
        const allTimeLeaderboard =
          await battleSessionManager.leaderboardManager.getEventBossAllTimeLeaderboard(
            eventBossId
          );
        leaderboard = {
          teamLeaderboard: [],
          individualLeaderboard: [],
          allTimeLeaderboard,
        };
      }

      if (battleSession && battleSession.state !== GAME_CONSTANTS.BATTLE_STATE.ENDED) {
        eventBoss = battleSession.eventBoss;
        activePlayers = battleSessionManager.getActivePlayersCount(eventBossId);
      } else {
        eventBoss = {
          ...response,
          currentHP: 0,
          maxHP: 0,
        };
        activePlayers = 0;
      }
      socket.emit(SOCKET_EVENTS.BATTLE_MONITOR.JOINED, {
        message: `Joined battle monitor for eventBossId: ${eventBossId}`,
        data: {
          event,
          eventBoss,
          activePlayers,
          leaderboard,
        },
      });
    } catch (error) {
      console.error(
        "[BattleMonitorHandler] Error handling battle monitor join:",
        error
      );
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: error.message,
      });
    }
  });

  socket.on(SOCKET_EVENTS.BATTLE_MONITOR.LEAVE, (payload) => {
    try {
      const { eventBossId } = payload;
      if (!eventBossId) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: "Invalid eventBossId.",
        });
        return;
      }

      socket.leave(SOCKET_ROOMS.BATTLE_MONITOR(eventBossId));
      socket.emit(SOCKET_EVENTS.BATTLE_MONITOR.LEFT, {
        message: "Left battle monitor successfully.",
      });
    } catch (error) {
      console.error(
        "[BattleMonitorHandler] Error handling battle monitor leave:",
        error
      );
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: error.message,
      });
    }
  });
};

export default handleBattleMonitor;
