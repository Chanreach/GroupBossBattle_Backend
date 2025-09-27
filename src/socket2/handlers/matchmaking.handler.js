import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  SOCKET_ERRORS,
  SOCKET_MESSAGES,
} from "../../utils/socket.constants.js";
import { GAME_CONSTANTS } from "../../utils/game.constants.js";
import matchmakingManager from "../../managers/matchmaking.manager.js";
import battleSessionManager from "../../managers/battle-session.manager.js";

const handleMatchmaking = (io, socket) => {
  socket.on(SOCKET_EVENTS.BATTLE_QUEUE.JOIN, async (payload) => {
    const { eventBossId, playerInfo } = payload;

    if (!eventBossId || !playerInfo) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INVALID_PAYLOAD,
        message: "Invalid eventBossId or playerInfo.",
      });
      return;
    }

    try {
      const data = await matchmakingManager.addPlayerToQueue(
        eventBossId,
        playerInfo,
        socket.id
      );
      socket.join(SOCKET_ROOMS.BATTLE_QUEUE(eventBossId));
      socket.emit(SOCKET_EVENTS.BATTLE_QUEUE.JOINED, {
        message: SOCKET_MESSAGES.BATTLE_QUEUE.JOINED,
        data,
      });
      socket.broadcast
        .to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId))
        .emit(SOCKET_EVENTS.BATTLE_QUEUE.QUEUE_SIZE.UPDATED, { data });

      if (data.isBattleStarted) {
        io.to(SOCKET_ROOMS.BATTLE_QUEUE(eventBossId)).emit(
          SOCKET_EVENTS.BATTLE_SESSION.COUNTDOWN,
          {
            message: "Battle is starting!",
            data: {
              countdownEndTime: Date.now() + GAME_CONSTANTS.BATTLE_COUNTDOWN,
            },
          }
        );
        io.to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId)).emit(
          SOCKET_EVENTS.BOSS_STATUS.UPDATED,
          {
            data: {
              eventBoss: battleSessionManager.getEventBoss(eventBossId),
            },
          }
        );
        io.to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId)).emit(
          SOCKET_EVENTS.BATTLE_SESSION.SIZE.UPDATED,
          {
            data: {
              sessionSize:
                battleSessionManager.getBattleSessionSize(eventBossId),
            },
          }
        );
        io.to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId)).emit(
          SOCKET_EVENTS.BATTLE_QUEUE.QUEUE_SIZE.UPDATED,
          {
            data: {
              queueSize: 0,
              isBattleStarted: true,
            },
          }
        );
        io.to(SOCKET_ROOMS.BATTLE_MONITOR(eventBossId)).emit(
          SOCKET_EVENTS.BATTLE_SESSION.START,
          {
            message: "Battle has started!",
            data: {
              eventBoss: battleSessionManager.getEventBoss(eventBossId),
              battleState: battleSessionManager.getBattleState(eventBossId),
              activePlayers:
                battleSessionManager.getActivePlayersCount(eventBossId),
              leaderboard: await battleSessionManager.getPreviewLiveLeaderboard(
                eventBossId
              ),
            },
          }
        );
      }
    } catch (error) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.MATCHMAKING_ERROR,
        message: error.message,
      });
    }
  });

  socket.on(SOCKET_EVENTS.BATTLE_QUEUE.LEAVE, (payload) => {
    const { eventBossId, playerId } = payload;
    if (!eventBossId || !playerId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INVALID_PAYLOAD,
        message: "Invalid eventBossId or playerId.",
      });
      return;
    }

    try {
      const data = matchmakingManager.removePlayerFromQueue(
        eventBossId,
        playerId
      );
      socket.leave(SOCKET_ROOMS.BATTLE_QUEUE(eventBossId));
      socket.emit(SOCKET_EVENTS.BATTLE_QUEUE.LEFT, {
        message: SOCKET_MESSAGES.BATTLE_QUEUE.LEFT,
        data,
      });
      socket.broadcast
        .to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId))
        .emit(SOCKET_EVENTS.BATTLE_QUEUE.QUEUE_SIZE.UPDATED, { data });
    } catch (error) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.MATCHMAKING_ERROR,
        message: error.message,
      });
    }
  });

  socket.on(SOCKET_EVENTS.BATTLE_QUEUE.QUEUE_SIZE.REQUEST, (eventBossId) => {
    if (!eventBossId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INVALID_PAYLOAD,
        message: "Invalid eventBossId.",
      });
      return;
    }

    try {
      const data = matchmakingManager.getQueueSize(eventBossId);
      socket.emit(SOCKET_EVENTS.BATTLE_QUEUE.QUEUE_SIZE.RESPONSE, {
        message: SOCKET_MESSAGES.BATTLE_QUEUE.JOINED,
        data,
      });
    } catch (error) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.MATCHMAKING_ERROR,
        message: error.message,
      });
    }
  });
};

export default handleMatchmaking;
