import {
  SOCKET_EVENTS,
  SOCKET_ERRORS,
  SOCKET_MESSAGES,
  SOCKET_ROOMS,
} from "../../utils/socket.constants.js";
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
          code: SOCKET_ERRORS.NOT_FOUND,
          message: "No more questions available.",
        });
        return;
      }

      socket.emit(SOCKET_EVENTS.BATTLE_SESSION.QUESTION.NEXT, {
        data: currentQuestion,
      });
    } catch (error) {
      console.log(error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INTERNAL_SERVER,
        message: "An error occurred while fetching the next question.",
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
      const {
        answerResult,
        isPlayerKnockedOut,
        isEventBossDefeated,
        badgeEarned,
      } = await battleSessionManager.processPlayerAnswer(
        eventBossId,
        playerId,
        choiceIndex,
        responseTime
      );
      if (!answerResult) {
        socket.emit(SOCKET_EVENTS.ERROR, {
          code: SOCKET_ERRORS.NOT_FOUND,
          message: "Failed to submit answer. Please try again.",
        });
        return;
      }

      socket.emit(SOCKET_EVENTS.BATTLE_SESSION.ANSWER.RESULT, {
        data: answerResult,
      });
      if (answerResult.damage > 0) {
        socket.broadcast
          .to(SOCKET_ROOMS.BATTLE_SESSION(eventBossId))
          .emit(SOCKET_EVENTS.BATTLE_SESSION.BOSS.DAMAGED, {
            data: answerResult,
          });
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
            data: {
              revivalCode: knockoutInfo.revivalCode,
              revivalEndTime: knockoutInfo.expiresAt,
            },
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

      if (badgeEarned) {
        socket.emit(SOCKET_EVENTS.BADGE.EARNED, {
          message: `Congratulations! You've earned the ${badgeEarned.name} badge for reaching a milestone of ${badgeEarned.threshold} correct answers!`,
          data: {
            badge: badgeEarned,
          },
        });
      }

      if (isEventBossDefeated) {
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

        io.to(SOCKET_ROOMS.BOSS_PREVIEW(eventBossId)).emit(
          SOCKET_EVENTS.BATTLE_SESSION.ENDED,
          { message: "The event boss has been defeated!" }
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

        const { mvpPlayer, mvpBadge } =
          battleSessionManager.getMVPPlayerBadge(eventBossId);
        if (mvpPlayer && mvpBadge) {
          io.to(mvpPlayer.socketId).emit(SOCKET_EVENTS.BADGE.EARNED, {
            message: `Congratulations ${mvpPlayer.nickname}! You've earned the MVP badge for your outstanding performance!`,
            data: {
              player: mvpPlayer,
              badge: mvpBadge,
            },
          });
        }

        const { lastHitPlayer, lastHitBadge } =
          battleSessionManager.getLastHitPlayerBadge(eventBossId);
        if (lastHitPlayer && lastHitBadge) {
          io.to(lastHitPlayer.socketId).emit(SOCKET_EVENTS.BADGE.EARNED, {
            message: `Congratulations ${lastHitPlayer.nickname}! You've earned the Last Hit badge for delivering the final blow to the boss!`,
            data: {
              player: lastHitPlayer,
              badge: lastHitBadge,
            },
          });
        }

        const { winnerTeam, teamVictoryBadge } =
          battleSessionManager.getWinnerTeamBadge(eventBossId);
        if (winnerTeam && teamVictoryBadge) {
          io.to(SOCKET_ROOMS.TEAM(eventBossId, winnerTeam.teamId)).emit(
            SOCKET_EVENTS.BADGE.EARNED,
            {
              message: `Congratulations Team ${winnerTeam.teamName}! You've earned the Team Victory badge for your collective effort!`,
              data: {
                team: winnerTeam,
                badge: teamVictoryBadge,
              },
            }
          );
        }

        const reactivatedTimeout = updateEventBoss.cooldownEndTime - Date.now();
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
            leaderboard:
              battleSessionManager.getPreviewLiveLeaderboard(eventBossId),
          },
        }
      );
    } catch (error) {
      console.log(error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INTERNAL_SERVER,
        message: "An error occurred while submitting the answer.",
      });
    }
  });
};

export default handleCombat;
