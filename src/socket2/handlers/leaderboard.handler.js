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

  socket.on(SOCKET_EVENTS.PODIUM.JOIN, (payload) => {
    const { eventBossId, playerId } = payload;
    if (!eventBossId || !playerId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId or playerId.",
      });
      return;
    }

    const player = battleSessionManager.reconnectPlayerToBattleSession(
      eventBossId,
      playerId,
      socket.id
    );
    if (player) {
      socket.join(SOCKET_ROOMS.BATTLE_SESSION(eventBossId));
      const { teamId } = battleSessionManager.getPlayerTeamInfo(
        eventBossId,
        playerId
      );
      socket.join(SOCKET_ROOMS.TEAM(eventBossId, teamId));
    }

    socket.join(SOCKET_ROOMS.PODIUM(eventBossId));

    const eventBoss = battleSessionManager.getEventBoss(eventBossId);
    const battleState = battleSessionManager.getBattleState(eventBossId);
    socket.emit(SOCKET_EVENTS.PODIUM.JOINED, {
      data: { eventBoss, battleState },
    });

    const playerBadges = battleSessionManager.getPlayerBadgesFromBattleSession(
      eventBossId,
      playerId
    );
    if (playerBadges && playerBadges.length > 0) {
      for (const playerBadge of playerBadges) {
        socket.emit(SOCKET_EVENTS.BADGE.EARNED, {
          message: SOCKET_MESSAGES.BADGE_EARNED[playerBadge.badge.code](
            playerBadge.player?.nickname || playerBadge.team?.teamName
          ),
          data: {
            playerBadge,
          },
        });
      }
    }
  });

  socket.on(SOCKET_EVENTS.PODIUM.REQUEST, async (payload) => {
    const { eventBossId } = payload;
    if (!eventBossId) {
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Invalid eventBossId.",
      });
      return;
    }

    try {
      const { leaderboard, podium } =
        await battleSessionManager.getBattlePodium(eventBossId);
      socket.emit(SOCKET_EVENTS.PODIUM.RESPONSE, {
        data: { leaderboard, podium },
      });
    } catch (error) {
      console.log(error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        code: SOCKET_ERRORS.INTERNAL_SERVER,
        message: "An error occurred while fetching the podium.",
      });
    }
  });
};

export default handleLeaderboard;
