import {
  SOCKET_EVENTS,
  SOCKET_ERRORS,
  SOCKET_MESSAGES,
  SOCKET_ROOMS,
} from "../../utils/socket.constants.js";
import battleSessionManager from "../../managers/battle-session.manager.js";
import { GAME_CONSTANTS } from "../../utils/game.constants.js";

const handleBattleSession = (io, socket) => {
  socket.on(SOCKET_EVENTS.BATTLE_SESSION.JOIN, async (payload) => {
    const { eventBossId, joinCode, playerId } = payload;
    if (!eventBossId || !joinCode || !playerId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INVALID_PAYLOAD,
        message: "Invalid eventBossId, joinCode, or playerId.",
      });
      return;
    }

    try {
      const eventBoss = battleSessionManager.getEventBoss(eventBossId);
      const player = battleSessionManager.getPlayerFromBattleSession(
        eventBossId,
        playerId
      );

      if (!player) {
        socket.emit(SOCKET_EVENTS.BATTLE_SESSION.PLAYER.NOT_FOUND, {
          message: "Player not found in this battle session.",
        });
        return;
      }

      const { teamId, teamName } = battleSessionManager.getPlayerTeamInfo(
        eventBossId,
        playerId
      );
      socket.join(SOCKET_ROOMS.BATTLE_SESSION(eventBossId));
      socket.join(SOCKET_ROOMS.TEAM(eventBossId, teamId));

      const playerHearts = battleSessionManager.getPlayerHearts(
        eventBossId,
        playerId
      );
      const playerBattleState = battleSessionManager.getPlayerBattleState(
        eventBossId,
        playerId
      );
      if (
        playerBattleState === GAME_CONSTANTS.PLAYER.BATTLE_STATE.KNOCKED_OUT
      ) {
        const knockoutInfo = battleSessionManager.getKnockedOutPlayerInfo(
          eventBossId,
          playerId
        );
        socket.emit(SOCKET_EVENTS.BATTLE_SESSION.PLAYER.KNOCKED_OUT, {
          message: "You have been knocked out!",
          data: knockoutInfo,
        });
        return;
      }
      socket.emit(SOCKET_EVENTS.BATTLE_SESSION.JOINED, {
        status: "success",
        message: `You are in team ${teamName}`,
        data: {
          eventBoss,
          player: {
            ...player,
            hearts: playerHearts,
            teamName,
          },
        },
      });

      socket.broadcast
        .to(SOCKET_ROOMS.BATTLE_SESSION(eventBossId))
        .emit(SOCKET_EVENTS.BATTLE_SESSION.BOSS.HP_UPDATED, {
          data: {
            eventBoss: {
              currentHP: eventBoss.currentHP,
              maxHP: eventBoss.maxHP,
            },
          },
        });

      if (
        battleSessionManager.getBattleSessionSize(eventBossId) >
        GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED
      ) {
        socket.broadcast
          .to(SOCKET_ROOMS.BATTLE_SESSION(eventBossId))
          .emit(SOCKET_EVENTS.BATTLE_SESSION.PLAYER.JOINED, {
            message: `${player.nickname} joined battle session.`,
          });

        io.to(SOCKET_ROOMS.BATTLE_SESSION(eventBossId)).emit(
          SOCKET_EVENTS.BATTLE_SESSION.LEADERBOARD.UPDATED,
          {
            data: {
              leaderboard:
                battleSessionManager.getBattleLiveLeaderboard(eventBossId),
            },
          }
        );

        io.to(SOCKET_ROOMS.BATTLE_MONITOR(eventBossId)).emit(
          SOCKET_EVENTS.BATTLE_SESSION.PLAYER.JOINED,
          {
            data: {
              eventBoss: {
                currentHP: eventBoss.currentHP,
                maxHP: eventBoss.maxHP,
              },
              activePlayers:
                battleSessionManager.getActivePlayersCount(eventBossId),
              leaderboard:
                battleSessionManager.getPreviewLiveLeaderboard(eventBossId),
            },
          }
        );
      }

      if (battleSessionManager.isEventBossDefeated(eventBossId)) {
        io.to(SOCKET_ROOMS.BATTLE_SESSION(eventBossId)).emit(
          SOCKET_EVENTS.BATTLE_SESSION.ENDED,
          {
            message: "The event boss has been defeated!",
            data: {
              podiumEndTime:
                battleSessionManager.getBattleSession(eventBossId)
                  .podiumEndTime,
            },
          }
        );
      }

      const knockedOutPlayers = battleSessionManager.getKnockedOutPlayersByTeam(
        eventBossId,
        teamId
      );
      if (knockedOutPlayers && knockedOutPlayers.length > 0) {
        socket.emit(SOCKET_EVENTS.BATTLE_SESSION.TEAMMATE.KNOCKED_OUT_COUNT, {
          message: "Your team has knocked out players.",
          data: { knockedOutPlayersCount: knockedOutPlayers.length },
        });
      }

      io.to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId)).emit(
        SOCKET_EVENTS.BOSS_PREVIEW.LEADERBOARD.UPDATED,
        {
          data: {
            leaderboard: await battleSessionManager.getPreviewLiveLeaderboard(
              eventBossId
            ),
          },
        }
      );
    } catch (error) {
      console.log(error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        error: SOCKET_ERRORS.INTERNAL_SERVER,
        message: SOCKET_MESSAGES.INTERNAL_SERVER_ERROR,
      });
    }
  });

  socket.on(SOCKET_EVENTS.BATTLE_SESSION.LEAVE, (payload) => {
    const { eventBossId, playerId } = payload;
    if (!eventBossId || !playerId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId or playerId.",
      });
      return;
    }

    if (
      !battleSessionManager.getPlayerFromBattleSession(eventBossId, playerId)
    ) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.NOT_FOUND,
        message: SOCKET_MESSAGES.NOT_FOUND_ERROR,
      });
      return;
    }

    socket.leave(SOCKET_ROOMS.BATTLE_SESSION(eventBossId));

    socket.emit(SOCKET_EVENTS.BATTLE_SESSION.LEFT, {
      message: "You have left the battle session.",
    });

    io.to(SOCKET_ROOMS.BATTLE_MONITOR(eventBossId)).emit(
      SOCKET_EVENTS.BATTLE_SESSION.PLAYER.LEFT,
      {
        message: `A player has left the battle session.`,
        data: {
          activePlayers:
            battleSessionManager.getActivePlayersCount(eventBossId),
        },
      }
    );
  });

  socket.on(SOCKET_EVENTS.BATTLE_SESSION.SIZE.REQUEST, (eventBossId) => {
    if (!eventBossId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId.",
      });
      return;
    }

    try {
      const eventBossStatus = battleSessionManager.getEventBossStatus(eventBossId);
      let sessionSize = 0;
      if (eventBossStatus && eventBossStatus === "in-battle") {
        sessionSize = battleSessionManager.getBattleSessionSize(eventBossId);
      }
      socket.emit(SOCKET_EVENTS.BATTLE_SESSION.SIZE.RESPONSE, {
        data: { sessionSize },
      });
    } catch (error) {
      console.log(error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INTERNAL_SERVER,
        message: "An error occurred while fetching the session size.",
      });
    }
  });

  socket.on(SOCKET_EVENTS.BATTLE_SESSION.REQUEST, (eventBossId) => {
    if (!eventBossId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId.",
      });
      return;
    }

    try {
      const session = battleSessionManager.findBattleSession(eventBossId);

      let sessionSize = 0;
      if (session && session.status !== "ended") {
        sessionSize = battleSessionManager.getBattleSessionSize(eventBossId);
      }
      socket.emit(SOCKET_EVENTS.BATTLE_SESSION.RESPONSE, {
        data: { session, sessionSize },
      });
    } catch (error) {
      console.log(error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INTERNAL_SERVER,
        message: "An error occurred while fetching the session size.",
      });
    }
  });

  socket.on(SOCKET_EVENTS.BATTLE_SESSION.MID_GAME.JOIN, async (payload) => {
    const { eventBossId, playerInfo } = payload;
    if (!eventBossId || !playerInfo) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId or playerInfo.",
      });
      return;
    }

    try {
      if (!battleSessionManager.hasBattleSession(eventBossId)) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: SOCKET_ERRORS.NOT_FOUND,
          message:
            "Battle session not found. The battle may have ended or not started yet.",
        });
        return;
      }

      if (!battleSessionManager.canJoinMidGame(eventBossId)) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: SOCKET_ERRORS.NOT_FOUND,
          message:
            "Cannot join this battle. The battle may have ended or not started yet.",
        });
        return;
      }

      const player = {
        id: playerInfo.id,
        username: playerInfo.username,
        nickname: playerInfo.nickname,
        isGuest: playerInfo.isGuest,
        contextStatus: null,
        battleState: null,
        socketId: socket.id,
        isConnected: true,
      };
      const response = await battleSessionManager.addPlayerToBattleSession(
        eventBossId,
        player
      );
      socket.emit(SOCKET_EVENTS.BATTLE_SESSION.MID_GAME.JOINED, {
        status: "success",
        message: "Successfully joined mid-game.",
        data: {
          playerInfo: response.player,
        },
      });
      socket.emit(SOCKET_EVENTS.BATTLE_SESSION.COUNTDOWN, {
        message: "Battle is starting!",
        data: {
          battleSessionId: response.battleSessionId,
          countdownEndTime: Date.now() + GAME_CONSTANTS.BATTLE_COUNTDOWN,
        },
      });
      io.to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId)).emit(
        SOCKET_EVENTS.BATTLE_SESSION.SIZE.UPDATED,
        {
          data: {
            sessionSize: response.sessionSize,
          },
        }
      );
      battleSessionManager.addPlayerToLeaderboard(eventBossId, player.id);

      io.to(SOCKET_ROOMS.BATTLE_MONITOR(eventBossId)).emit(
        SOCKET_EVENTS.BATTLE_SESSION.PLAYER.JOINED,
        {
          data: {
            leaderboard:
              battleSessionManager.getBattleLiveLeaderboard(eventBossId),
          },
        }
      );
    } catch (error) {
      console.log(error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INTERNAL_SERVER,
        message: "An error occurred while joining mid-game.",
      });
    }
  });

  socket.on(SOCKET_EVENTS.BATTLE_SESSION.PLAYER.RECONNECT, (payload) => {
    const { eventBossId, playerId } = payload;
    if (!eventBossId || !playerId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId or playerId.",
      });
      return;
    }

    try {
      const player = battleSessionManager.reconnectPlayerToBattleSession(
        eventBossId,
        playerId,
        socket.id
      );
      if (!player) {
        socket.emit(SOCKET_EVENTS.BATTLE_SESSION.PLAYER.RECONNECT_FAILED, {
          message: "Reconnection failed. Player not found in session.",
        });
        return;
      }
      socket.join(SOCKET_ROOMS.BATTLE_SESSION(eventBossId));
      const { teamId } = battleSessionManager.getPlayerTeamInfo(
        eventBossId,
        playerId
      );
      socket.join(SOCKET_ROOMS.TEAM(eventBossId, teamId));
      const currentQuestion = battleSessionManager.getCurrentQuestionForPlayer(
        eventBossId,
        playerId
      );
      const data = currentQuestion
        ? {
            currentQuestion,
            currentQuestionNumber:
              battleSessionManager.getCurrentQuestionNumberForPlayer(
                eventBossId,
                playerId
              ),
            questionEndTime: currentQuestion.endTime,
          }
        : {
            currentQuestion: null,
            currentQuestionNumber: 0,
            questionEndTime: null,
          };
      socket.emit(SOCKET_EVENTS.BATTLE_SESSION.PLAYER.RECONNECTED, {
        message: `Reconnected to battle session.`,
        data,
      });
    } catch (error) {
      console.log(error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INTERNAL_SERVER,
        message: "An error occurred while reconnecting to the battle session.",
      });
    }
  });
};

export default handleBattleSession;
