import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
} from "../../utils/socket.constants.js";
import battleSessionManager from "../../managers/battle-session.manager.js";
import EventBossService from "../../services/event-boss.service.js";
import { GAME_CONSTANTS } from "../../utils/game.constants.js";

const handleBattleMonitor = (io, socket) => {
  socket.on(SOCKET_EVENTS.BATTLE_MONITOR.JOIN, async (payload) => {
    try {
      const { eventId, eventBossId, spectatorId } = payload;
      if (!eventId || !eventBossId || !spectatorId) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: SOCKET_ERRORS.MISSING_DATA,
        });
        return;
      }

      const event = await EventBossService.getEventById(eventId);
      const response = await EventBossService.getEventBossById(eventBossId);

      const isAllowedToSpectate = await EventBossService.isAllowedToSpectate(
        eventBossId,
        spectatorId
      );
      if (!isAllowedToSpectate) {
        socket.emit(SOCKET_EVENTS.BATTLE_MONITOR.UNAUTHORIZED, {
          message: "You are not authorized to spectate this battle session.",
        });
        return;
      }

      socket.join(SOCKET_ROOMS.BATTLE_MONITOR(eventBossId));

      const battleSession = battleSessionManager.getBattleSession(eventBossId);
      let eventBoss = null;
      let battleState = null;
      let activePlayers = 0;
      let leaderboard = {
        teamLeaderboard: [],
        individualLeaderboard: [],
        allTimeLeaderboard: [],
      };
      if (battleSession) {
        eventBoss = battleSession.eventBoss;
        battleState = battleSession.battleState;
        activePlayers = battleSessionManager.getActivePlayersCount(eventBossId);
        const { teamLeaderboard, individualLeaderboard, allTimeLeaderboard } =
          await battleSessionManager.getPreviewLiveLeaderboard(eventBossId);
        leaderboard = {
          teamLeaderboard,
          individualLeaderboard,
          allTimeLeaderboard,
        };
      } else {
        eventBoss = {
          ...response.eventBoss,
          maxHP: 0,
          currentHP: 0,
        }
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
      socket.emit(SOCKET_EVENTS.BATTLE_MONITOR.JOINED, {
        message: `Joined battle monitor for eventBossId: ${eventBossId}`,
        data: {
          event,
          eventBoss,
          battleState,
          activePlayers,
          leaderboard,
        },
      });
    } catch (error) {
      console.error("Error handling battle monitor join:", error);
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
          message: SOCKET_ERRORS.MISSING_DATA,
        });
        return;
      }

      socket.leave(SOCKET_ROOMS.BATTLE_MONITOR(eventBossId));
      socket.emit(SOCKET_EVENTS.BATTLE_MONITOR.LEFT, {
        message: `Left battle monitor for eventBossId: ${eventBossId}`,
      });
    } catch (error) {
      console.error("Error handling battle monitor leave:", error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: error.message,
      });
    }
  });
};

export default handleBattleMonitor;
