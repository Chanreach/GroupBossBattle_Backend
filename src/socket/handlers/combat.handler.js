import { SOCKET_EVENTS, SOCKET_ROOMS } from "../../utils/socket.constants.js";
import battleSessionManager from "../../managers/battle-session.manager.js";
import { GAME_CONSTANTS } from "../../utils/game.constants.js";

const handleCombat = (io, socket) => {
  socket.on(SOCKET_EVENTS.BATTLE_SESSION.QUESTION.REQUEST, (payload) => {
    const { eventBossId, playerId } = payload;

    if (!eventBossId || !playerId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId or playerId.",
      });
      return;
    }

    try {
      const currentQuestion = battleSessionManager.getNextQuestionForPlayer(
        eventBossId,
        playerId
      );
      if (!currentQuestion) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: "No more questions available.",
        });
        return;
      }

      socket.emit(SOCKET_EVENTS.BATTLE_SESSION.QUESTION.NEXT, {
        data: { currentQuestion },
      });
    } catch (error) {
      console.error("[CombatHandler] Error retrieving the next question:", error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Internal server error while retrieving the next question.",
      });
    }
  });

  socket.on(SOCKET_EVENTS.BATTLE_SESSION.ANSWER.SUBMIT, async (payload) => {
    const { eventBossId, playerId, choiceIndex, responseTime } = payload;

    if (
      !eventBossId ||
      !playerId ||
      choiceIndex === undefined ||
      responseTime === undefined
    ) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId, playerId, choiceIndex, or responseTime.",
      });
      return;
    }

    try {
      const response = await battleSessionManager.processPlayerAnswer(
        eventBossId,
        playerId,
        choiceIndex,
        responseTime
      );
      if (!response) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: "Failed to process answer. Please try again.",
        });
        return;
      }
      
      const {
        answerResult,
        isPlayerKnockedOut,
        isEventBossDefeated,
        playerBadge,
      } = response;
      if (!answerResult) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          message: "Failed to submit answer. Please try again.",
        });
        return;
      }

      socket.emit(SOCKET_EVENTS.BATTLE_SESSION.ANSWER.RESULT, {
        data: { answerResult },
      });
      if (answerResult.damage > 0) {
        socket.broadcast
          .to(SOCKET_ROOMS.BATTLE_SESSION(eventBossId))
          .emit(SOCKET_EVENTS.BATTLE_SESSION.BOSS.DAMAGED, {
            data: { answerResult },
          });

        const updateEventBoss = battleSessionManager.getEventBoss(eventBossId);
        io.to(SOCKET_ROOMS.BATTLE_MONITOR(eventBossId)).emit(
          SOCKET_EVENTS.BATTLE_SESSION.BOSS.DAMAGED,
          {
            data: {
              eventBoss: updateEventBoss,
              leaderboard: await battleSessionManager.getPreviewLiveLeaderboard(
                eventBossId
              ),
            },
          }
        );
      }

      if (isPlayerKnockedOut) {
        const knockoutInfo = battleSessionManager.getKnockedOutPlayerInfo(
          eventBossId,
          playerId
        );
        if (knockoutInfo) {
          socket.emit(SOCKET_EVENTS.BATTLE_SESSION.PLAYER.KNOCKED_OUT, {
            message:
              "You have been knocked out! Share your revival code with teammates.",
            data: { knockoutInfo },
          });
          const { teamId } = battleSessionManager.getPlayerTeamInfo(
            eventBossId,
            playerId
          );
          socket.broadcast
            .to(SOCKET_ROOMS.TEAM(eventBossId, teamId))
            .emit(SOCKET_EVENTS.BATTLE_SESSION.TEAMMATE.KNOCKED_OUT, {
              message: "A player has been knocked out!",
            });
        }
      }

      if (playerBadge && playerBadge.badge) {
        socket.emit(SOCKET_EVENTS.BADGE.EARNED, {
          message: `Congratulations! You've earned the ${playerBadge.badge.name} badge for reaching a milestone of ${playerBadge.badge.threshold} correct answers!`,
          data: {
            playerBadge,
          },
        });
      }

      if (isEventBossDefeated) {
        io.to(SOCKET_ROOMS.BATTLE_SESSION(eventBossId)).emit(
          SOCKET_EVENTS.BATTLE_SESSION.ENDED,
          {
            message: "The event boss has been defeated!",
            data: {
              podiumEndAt:
                battleSessionManager.getBattleSession(eventBossId)
                  ?.podiumEndAt,
            },
          }
        );

        io.to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId)).emit(
          SOCKET_EVENTS.BOSS_PREVIEW.BATTLE_SESSION.ENDED,
          {
            message: "The event boss has been defeated!",
            data: {
              session: battleSessionManager.getBattleSession(eventBossId),
            },
          }
        );

        const updateEventBoss = battleSessionManager.getEventBoss(eventBossId);
        io.to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId)).emit(
          SOCKET_EVENTS.BOSS_STATUS.UPDATED,
          {
            data: {
              eventBoss: updateEventBoss,
            },
          }
        );

        const reactivatedTimeout = updateEventBoss.cooldownEndAt - Date.now();
        setTimeout(async () => {
          const reactivatedEventBoss =
            await battleSessionManager.updateEventBossStatus(
              eventBossId,
              GAME_CONSTANTS.BOSS_STATUS.ACTIVE
            );

          io.to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId)).emit(
            SOCKET_EVENTS.BOSS_STATUS.UPDATED,
            {
              data: {
                eventBoss: reactivatedEventBoss,
              },
            }
          );

          io.to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId)).emit(
            SOCKET_EVENTS.BATTLE_SESSION.SIZE.UPDATED,
            {
              data: {
                sessionSize: 0,
              },
            }
          );
        }, reactivatedTimeout);
      }

      io.to(SOCKET_ROOMS.BATTLE_SESSION(eventBossId)).emit(
        SOCKET_EVENTS.BATTLE_SESSION.LEADERBOARD.UPDATED,
        {
          data: {
            leaderboard:
              battleSessionManager.getBattleLiveLeaderboard(eventBossId),
          },
        }
      );

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
      console.error("[CombatHandler] Error processing combat action:", error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Internal server error while processing combat action.",
      });
    }
  });
};

export default handleCombat;
