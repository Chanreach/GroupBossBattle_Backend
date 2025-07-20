import bossSessionManager from "../managers/boss-session.manager.js";

const handleKnockout = (io, socket) => {
  // Attempt to revive a teammate
  socket.on("revive-teammate", async (data) => {
    try {
      const { eventBossId, reviveCode } = data;
      const playerSession = bossSessionManager.getPlayerSession(socket.id);

      if (!playerSession || playerSession.eventBossId !== eventBossId) {
        socket.emit("error", { message: "Player session not found" });
        return;
      }

      const session = bossSessionManager.getSession(eventBossId);
      if (!session || !session.isStarted) {
        socket.emit("error", { message: "Battle not active" });
        return;
      }

      const reviverPlayer = session.players.get(playerSession.playerId);
      if (
        !reviverPlayer ||
        reviverPlayer.isKnockedOut ||
        reviverPlayer.status !== "active"
      ) {
        socket.emit("revive-failed", {
          message: "You cannot revive teammates while knocked out or inactive",
        });
        return;
      }

      if (!reviveCode || typeof reviveCode !== "string") {
        socket.emit("revive-failed", { message: "Invalid revive code format" });
        return;
      }

      // Attempt revival
      const result = bossSessionManager.revivePlayer(
        eventBossId,
        reviveCode,
        playerSession.playerId
      );

      if (result.success) {
        const { revivedPlayer, reviverPlayer } = result;

        // Notify the revived player
        const revivedSocket = io.sockets.sockets.get(revivedPlayer.socketId);
        if (revivedSocket) {
          revivedSocket.emit("player-revived", {
            message: `You have been revived by ${reviverPlayer.nickname}!`,
            hearts: revivedPlayer.hearts,
            revivedBy: reviverPlayer.nickname,
          });
        }

        // Notify the reviver
        socket.emit("revive-successful", {
          message: `Successfully revived ${revivedPlayer.nickname}!`,
          revivedPlayer: revivedPlayer.nickname,
        });

        // Broadcast to team about successful revival
        const team = session.teams.get(revivedPlayer.teamId);
        if (team) {
          team.players.forEach((playerId) => {
            const teamPlayer = session.players.get(playerId);
            if (
              teamPlayer &&
              teamPlayer.id !== revivedPlayer.id &&
              teamPlayer.id !== reviverPlayer.id
            ) {
              const teamPlayerSocket = io.sockets.sockets.get(
                teamPlayer.socketId
              );
              if (teamPlayerSocket) {
                teamPlayerSocket.emit("teammate-revived", {
                  message: `${revivedPlayer.nickname} has been revived by ${reviverPlayer.nickname}!`,
                  revivedPlayer: revivedPlayer.nickname,
                  reviverPlayer: reviverPlayer.nickname,
                });
              }
            }
          });
        }

        // Broadcast general revival info to all players in session
        io.to(`boss-${eventBossId}`).emit("player-revival-update", {
          playerNickname: revivedPlayer.nickname,
          reviverNickname: reviverPlayer.nickname,
          teamId: revivedPlayer.teamId,
          hearts: revivedPlayer.hearts,
        });

        console.log(
          `Player ${revivedPlayer.nickname} revived by ${reviverPlayer.nickname} in session ${eventBossId}`
        );
      } else {
        socket.emit("revive-failed", {
          message: result.error || "Revival failed",
        });
      }
    } catch (error) {
      console.error("Error in revive-teammate:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });

  // Get current knockout status (for UI updates)
  socket.on("get-knockout-status", (data) => {
    try {
      const { eventBossId } = data;
      const playerSession = bossSessionManager.getPlayerSession(socket.id);

      if (!playerSession || playerSession.eventBossId !== eventBossId) {
        socket.emit("error", { message: "Player session not found" });
        return;
      }

      const session = bossSessionManager.getSession(eventBossId);
      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      const player = session.players.get(playerSession.playerId);
      if (!player) {
        socket.emit("error", { message: "Player not found" });
        return;
      }

      // Get team members and their status
      const team = session.teams.get(player.teamId);
      const teammates = [];

      if (team) {
        team.players.forEach((playerId) => {
          if (playerId !== player.id) {
            const teammate = session.players.get(playerId);
            if (teammate) {
              teammates.push({
                id: teammate.id,
                nickname: teammate.nickname,
                hearts: teammate.hearts,
                isKnockedOut: teammate.isKnockedOut,
                status: teammate.status,
              });
            }
          }
        });
      }

      socket.emit("knockout-status", {
        player: {
          hearts: player.hearts,
          isKnockedOut: player.isKnockedOut,
          status: player.status,
        },
        teammates,
        canRevive: !player.isKnockedOut && player.status === "active",
      });
    } catch (error) {
      console.error("Error in get-knockout-status:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });

  // Check if player has any revival requests (for showing revive button)
  socket.on("check-revival-requests", (data) => {
    try {
      const { eventBossId } = data;
      const playerSession = bossSessionManager.getPlayerSession(socket.id);

      if (!playerSession || playerSession.eventBossId !== eventBossId) {
        socket.emit("error", { message: "Player session not found" });
        return;
      }

      const session = bossSessionManager.getSession(eventBossId);
      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      const player = session.players.get(playerSession.playerId);
      if (!player || player.isKnockedOut) {
        socket.emit("revival-requests", {
          hasRequests: false,
          knockedOutTeammates: [],
        });
        return;
      }

      // Check for knocked out teammates
      const team = session.teams.get(player.teamId);
      const knockedOutTeammates = [];

      if (team) {
        team.players.forEach((playerId) => {
          if (playerId !== player.id) {
            const teammate = session.players.get(playerId);
            if (teammate && teammate.isKnockedOut) {
              knockedOutTeammates.push({
                id: teammate.id,
                nickname: teammate.nickname,
              });
            }
          }
        });
      }

      socket.emit("revival-requests", {
        hasRequests: knockedOutTeammates.length > 0,
        knockedOutTeammates,
      });
    } catch (error) {
      console.error("Error in check-revival-requests:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });

  // Handle revival timeout (when revival code expires)
  socket.on("revival-timeout", (data) => {
    try {
      const { eventBossId } = data;
      const playerSession = bossSessionManager.getPlayerSession(socket.id);

      if (!playerSession || playerSession.eventBossId !== eventBossId) {
        return; // Silently fail as player might have left
      }

      const session = bossSessionManager.getSession(eventBossId);
      if (!session) {
        return;
      }

      const player = session.players.get(playerSession.playerId);
      if (!player || !player.isKnockedOut) {
        return;
      }

      // Player's revival window has expired
      // In a real game, you might want to remove them from active players
      // or handle this differently based on game rules

      // Notify team about revival timeout
      const team = session.teams.get(player.teamId);
      if (team) {
        team.players.forEach((playerId) => {
          if (playerId !== player.id) {
            const teamPlayer = session.players.get(playerId);
            if (teamPlayer && !teamPlayer.isKnockedOut) {
              const teamPlayerSocket = io.sockets.sockets.get(
                teamPlayer.socketId
              );
              if (teamPlayerSocket) {
                teamPlayerSocket.emit("teammate-revival-expired", {
                  message: `${player.nickname}'s revival window has expired`,
                  expiredPlayer: player.nickname,
                });
              }
            }
          }
        });
      }

      socket.emit("revival-expired", {
        message:
          "Revival window expired. You will need to wait for the next round.",
      });

      console.log(
        `Revival timeout for player ${player.nickname} in session ${eventBossId}`
      );
    } catch (error) {
      console.error("Error in revival-timeout:", error);
    }
  });
};

export default handleKnockout;
