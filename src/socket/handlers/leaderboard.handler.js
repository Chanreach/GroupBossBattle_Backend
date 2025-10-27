import battleSessionManager from "../../managers/battle-session.manager.js";
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  SOCKET_MESSAGES,
} from "../../utils/socket.constants.js";

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
      console.error(
        "[LeaderboardHandler] Error retrieving preview leaderboard:",
        error
      );
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Internal server error while retrieving preview leaderboard.",
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
      console.error(
        "[LeaderboardHandler] Error retrieving battle leaderboard:",
        error
      );
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Internal server error while retrieving battle leaderboard.",
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

    if (!battleState) return;

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
      console.error("[LeaderboardHandler] Error retrieving the podium:", error);
      socket.emit(SOCKET_EVENTS.ERROR, {
        message: "Internal server error while retrieving the podium.",
      });
    }
  });
};

export default handleLeaderboard;
