import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
} from "../../utils/socket.constants.js";
import battleSessionManager from "../../managers/battle-session.manager.js";
import { GAME_CONSTANTS } from "../../utils/game.constants.js";

const handleKnockout = (io, socket) => {
  socket.on(SOCKET_EVENTS.BATTLE_SESSION.REVIVAL_CODE.SUBMIT, (payload) => {
    const { eventBossId, playerId, revivalCode } = payload;
    if (!eventBossId || !playerId || !revivalCode) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId, playerId, or revivalCode.",
      });
      return;
    }

    try {
      const response = battleSessionManager.attemptPlayerRevival(
        eventBossId,
        playerId,
        revivalCode
      );
      if (response.isRevived) {
        const knockedOutPlayer =
          battleSessionManager.getPlayerFromBattleSession(
            eventBossId,
            response.knockedOutPlayerId
          );
        if (!knockedOutPlayer) {
          socket.emit(SOCKET_EVENTS.ERROR, {
            message: "Player not found for revival.",
          });
          return;
        }
        io.to(knockedOutPlayer.socketId).emit(
          SOCKET_EVENTS.BATTLE_SESSION.PLAYER.REVIVED,
          {
            message: "You have been revived!",
            data: {
              playerHearts: battleSessionManager.getPlayerHearts(
                eventBossId,
                response.knockedOutPlayerId
              ),
            },
          }
        );
        socket.emit(SOCKET_EVENTS.BATTLE_SESSION.REVIVAL_CODE.SUCCESS, {
          message:
            "You have revived " + knockedOutPlayer.nickname + " successfully!",
        });
      } else {
        socket.emit(SOCKET_EVENTS.BATTLE_SESSION.REVIVAL_CODE.FAILURE, {
          message:
            response.reason === GAME_CONSTANTS.REVIVAL_CODE.EXPIRED
              ? "Revival code has expired."
              : "Incorrect revival code.",
        });
      }
    } catch (error) {
      console.log(error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "An error occurred while submitting the revival code.",
      });
    }
  });

  socket.on(SOCKET_EVENTS.BATTLE_SESSION.REVIVAL_CODE.EXPIRED, (payload) => {
    const { eventBossId, playerId } = payload;
    if (!eventBossId || !playerId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId or playerId.",
      });
      return;
    }

    try {
      battleSessionManager.handleRevivalCodeExpiry(eventBossId, playerId);
      socket.emit(SOCKET_EVENTS.BATTLE_SESSION.REVIVAL_CODE.EXPIRED_RESPONSE, {
        message: "Revival code has expired.",
      });
      socket.emit(SOCKET_EVENTS.BATTLE_SESSION.PLAYER.DEAD, {
        message: "You are out of the battle.",
      });
      const { teamId } = battleSessionManager.getPlayerTeamInfo(
        eventBossId,
        playerId
      );
      socket.broadcast
        .to(SOCKET_ROOMS.TEAM(eventBossId, teamId))
        .emit(SOCKET_EVENTS.BATTLE_SESSION.TEAMMATE.DEAD, {
          message: "A teammate is out of the battle.",
        });
    } catch (error) {
      console.log(error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "An error occurred while handling revival code expiry.",
      });
    }
  });
};

export default handleKnockout;
