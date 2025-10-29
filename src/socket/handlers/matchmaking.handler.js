import matchmakingManager from "../../managers/matchmaking.manager.js";
import battleSessionManager from "../../managers/battle-session.manager.js";
import { SOCKET_EVENTS, SOCKET_ROOMS } from "../../utils/socket.constants.js";
import { GAME_CONSTANTS } from "../../utils/game.constants.js";

const handleMatchmaking = (io, socket) => {
  socket.on(SOCKET_EVENTS.PLAYER_SESSION.REQUEST, (payload) => {
    const { eventBossId, playerId } = payload;
    if (!eventBossId || !playerId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId or playerId.",
      });
      return;
    }

    try {
      let playerSession = matchmakingManager.getPlayerInfo(
        eventBossId,
        playerId
      );
      if (!playerSession) {
        playerSession = battleSessionManager.findPlayerFromBattleSession(
          eventBossId,
          playerId
        );

        if (playerSession) {
          battleSessionManager.reconnectPlayerToBattleSession(
            eventBossId,
            playerId,
            socket.id
          );
        }
      }
      if (
        playerSession &&
        playerSession.contextStatus ===
          GAME_CONSTANTS.PLAYER.CONTEXT_STATUS.IN_QUEUE
      ) {
        socket.join(SOCKET_ROOMS.BATTLE_QUEUE(eventBossId));
      }

      socket.emit(SOCKET_EVENTS.PLAYER_SESSION.RESPONSE, {
        message: "Successfully fetched player session.",
        data: {
          playerSession,
          countdownEndAt: playerSession?.countdownEndAt || null,
        },
      });
    } catch (error) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Internal server error while retrieving player session.",
      });
    }
  });

  socket.on(SOCKET_EVENTS.BATTLE_QUEUE.JOIN, async (payload) => {
    const { eventBossId, playerInfo } = payload;
    if (!eventBossId || !playerInfo) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId or playerInfo.",
      });
      return;
    }

    try {
      if (matchmakingManager.isPlayerInAnyQueue(playerInfo.id)) {
        console.log(
          "[MatchmakingHandler] Player is already in another battle queue."
        );
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: "You are already in another battle queue.",
        });
        return;
      }

      if (battleSessionManager.isPlayerInAnyBattleSession(playerInfo.id)) {
        console.log(
          "[MatchmakingHandler] Player is already in another active battle session."
        );
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: "You are already in another active battle session.",
        });
        return;
      }

      if (
        matchmakingManager.isNicknameTaken(eventBossId, playerInfo.nickname)
      ) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: "Nickname is already taken.",
        });
        return;
      }

      const data = await matchmakingManager.addPlayerToQueue(
        eventBossId,
        playerInfo,
        socket.id
      );
      if (!data) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: "Failed to join the battle queue. Try again later.",
        });
        return;
      }

      socket.join(SOCKET_ROOMS.BATTLE_QUEUE(eventBossId));
      socket.emit(SOCKET_EVENTS.BATTLE_QUEUE.JOINED, {
        message: "Successfully joined the battle queue.",
        data,
      });
      socket.broadcast
        .to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId))
        .emit(SOCKET_EVENTS.BATTLE_QUEUE.QUEUE_SIZE.UPDATED, { data });

      if (data.isBattleStarted) {
        const countdownEndAt = Date.now() + GAME_CONSTANTS.BATTLE_COUNTDOWN;
        const players =
          battleSessionManager.getAllPlayersFromBattleSession(eventBossId);
        for (const player of players) {
          player.countdownEndAt = countdownEndAt;
        }

        io.to(SOCKET_ROOMS.BATTLE_QUEUE(eventBossId)).emit(
          SOCKET_EVENTS.BATTLE_SESSION.COUNTDOWN,
          {
            message: "Battle is starting!",
            data: {
              battleSessionId: data.battleSessionId,
              countdownEndAt,
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
      console.error(
        "[MatchmakingHandler] Failed to join the battle queue: ",
        error
      );
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Internal server error while joining the battle queue.",
      });
    }
  });

  socket.on(SOCKET_EVENTS.BATTLE_QUEUE.LEAVE, (payload) => {
    const { eventBossId, playerId } = payload;
    if (!eventBossId || !playerId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId or playerId.",
      });
      return;
    }

    try {
      const data = matchmakingManager.removePlayerFromQueue(
        eventBossId,
        playerId
      );
      if (!data) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: "Failed to leave the battle queue. Try again later.",
        });
        return;
      }

      socket.leave(SOCKET_ROOMS.BATTLE_QUEUE(eventBossId));
      socket.emit(SOCKET_EVENTS.BATTLE_QUEUE.LEFT, {
        message: "Successfully left the battle queue.",
        data,
      });
      socket.broadcast
        .to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId))
        .emit(SOCKET_EVENTS.BATTLE_QUEUE.QUEUE_SIZE.UPDATED, { data });

      const playerSession = matchmakingManager.getPlayerInfo(
        eventBossId,
        playerId
      );
      socket.emit(SOCKET_EVENTS.PLAYER_SESSION.UPDATED, {
        message: "Successfully updated player session.",
        data: { playerSession },
      });
    } catch (error) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Internal server error while leaving the battle queue.",
      });
    }
  });

  socket.on(SOCKET_EVENTS.BATTLE_QUEUE.QUEUE_SIZE.REQUEST, (payload) => {
    const { eventBossId } = payload;
    if (!eventBossId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId.",
      });
      return;
    }

    try {
      const queueSize = matchmakingManager.getQueueSize(eventBossId);
      socket.emit(SOCKET_EVENTS.BATTLE_QUEUE.QUEUE_SIZE.RESPONSE, {
        message: "Successfully fetched queue size.",
        data: { queueSize },
      });
    } catch (error) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Internal server error while retrieving queue size.",
      });
    }
  });
};

export default handleMatchmaking;
