import bossSessionManager from "../managers/boss-session.manager.js";
import { GAME_CONSTANTS } from "../../utils/game.constants.js";

const handleBoss = (io, socket) => {
  // Host manually starts a boss fight
  socket.on("host-start-boss-fight", async (data) => {
    try {
      const { eventBossId, hostId } = data;

      // In a real app, you'd verify that the user is the host of this boss
      // For now, we'll allow any user to start the fight

      const session = bossSessionManager.getSession(eventBossId);
      if (!session) {
        socket.emit("error", { message: "Boss session not found" });
        return;
      }

      if (session.isStarted) {
        socket.emit("error", { message: "Battle already in progress" });
        return;
      }

      // Check if boss is on cooldown
      if (
        session.bossData.cooldownUntil &&
        new Date() < session.bossData.cooldownUntil
      ) {
        const remainingTime = Math.ceil(
          (session.bossData.cooldownUntil - new Date()) / 1000
        );
        socket.emit("boss-on-cooldown", {
          message: "Boss is on cooldown",
          remainingTime,
        });
        return;
      }

      // Check if there are any players waiting
      if (session.waitingPlayers.size === 0) {
        socket.emit("error", { message: "No players waiting to fight" });
        return;
      }

      // Check if there are enough players to start (same requirement as auto-start)
      if (!bossSessionManager.canStartBattle(eventBossId)) {
        const playersNeeded =
          GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED - session.players.size;
        socket.emit("error", {
          message: `Not enough players to start battle. Need ${playersNeeded} more player(s).`,
        });
        return;
      }

      // Force start the battle
      const started = bossSessionManager.startBossFight(eventBossId);

      if (started) {
        // Notify all players that battle has started
        io.to(`boss-${eventBossId}`).emit("battle-started", {
          message: "Battle started by host!",
          session: {
            eventBossId: session.eventBossId,
            bossData: session.bossData,
            teams: Array.from(session.teams.values()).map((team) => ({
              id: team.id,
              name: team.name,
              playerCount: team.players.size,
              totalDamage: team.totalDamage,
            })),
            players: Array.from(session.players.values()).map((p) => ({
              id: p.id,
              nickname: p.nickname,
              teamId: p.teamId,
              hearts: p.hearts,
              status: p.status,
            })),
          },
        });

        socket.emit("host-battle-started", {
          message: "Battle started successfully",
          eventBossId,
        });

        console.log(`Host manually started battle for boss ${eventBossId}`);
      } else {
        socket.emit("error", { message: "Failed to start battle" });
      }
    } catch (error) {
      console.error("Error in host-start-boss-fight:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });

  // Host manually stops a boss fight
  socket.on("host-stop-boss-fight", async (data) => {
    try {
      const { eventBossId, hostId } = data;

      const session = bossSessionManager.getSession(eventBossId);
      if (!session) {
        socket.emit("error", { message: "Boss session not found" });
        return;
      }

      if (!session.isStarted) {
        socket.emit("error", { message: "No battle in progress" });
        return;
      }

      // End the battle
      const result = bossSessionManager.endBossFight(eventBossId, null, io);

      if (result) {
        // Notify all players that battle has ended
        io.to(`boss-${eventBossId}`).emit("battle-ended-by-host", {
          message: "Battle ended by host",
          cooldownUntil: result.cooldownUntil,
          nextBattleIn: result.cooldownUntil
            ? Math.ceil((result.cooldownUntil - new Date()) / 1000)
            : 0,
        });

        socket.emit("host-battle-stopped", {
          message: "Battle stopped successfully",
          eventBossId,
        });

        console.log(`Host manually stopped battle for boss ${eventBossId}`);
      } else {
        socket.emit("error", { message: "Failed to stop battle" });
      }
    } catch (error) {
      console.error("Error in host-stop-boss-fight:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });

  // Get boss session info (for hosts/admins)
  socket.on("get-boss-session-info", (data) => {
    try {
      const { eventBossId } = data;
      const session = bossSessionManager.getSession(eventBossId);

      if (!session) {
        socket.emit("error", { message: "Boss session not found" });
        return;
      }

      // Prepare detailed session information
      const sessionInfo = {
        eventBossId: session.eventBossId,
        bossData: session.bossData,
        isStarted: session.isStarted,
        startedAt: session.startedAt,
        playerCount: session.players.size,
        activePlayerCount: session.activePlayers.size,
        waitingPlayerCount: session.waitingPlayers.size,
        teams: Array.from(session.teams.values()).map((team) => ({
          id: team.id,
          name: team.name,
          totalDamage: team.totalDamage,
          playerCount: team.players.size,
          players: Array.from(team.players)
            .map((playerId) => {
              const player = session.players.get(playerId);
              return player
                ? {
                    id: player.id,
                    nickname: player.nickname,
                    hearts: player.hearts,
                    totalDamage: player.totalDamage,
                    isKnockedOut: player.isKnockedOut,
                    status: player.status,
                    questionsAnswered: player.questionsAnswered,
                    correctAnswers: player.correctAnswers,
                  }
                : null;
            })
            .filter(Boolean),
        })),
        canStart: bossSessionManager.canStartBattle(eventBossId),
      };

      socket.emit("boss-session-info", sessionInfo);
    } catch (error) {
      console.error("Error in get-boss-session-info:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });

  // Update boss parameters (for hosts/admins)
  socket.on("update-boss-parameters", async (data) => {
    try {
      const { eventBossId, parameters } = data;

      const session = bossSessionManager.getSession(eventBossId);
      if (!session) {
        socket.emit("error", { message: "Boss session not found" });
        return;
      }

      // Update allowed parameters
      if (
        parameters.cooldownDuration &&
        typeof parameters.cooldownDuration === "number"
      ) {
        session.bossData.cooldownDuration = parameters.cooldownDuration;
      }

      if (
        parameters.teamCount &&
        typeof parameters.teamCount === "number" &&
        parameters.teamCount >= 2
      ) {
        // Only allow team count changes when battle is not active
        if (!session.isStarted) {
          const oldTeamCount = session.teamCount;
          session.teamCount = parameters.teamCount;

          // Add new teams if needed
          for (let i = oldTeamCount + 1; i <= parameters.teamCount; i++) {
            session.teams.set(i, {
              id: i,
              name: `Team ${i}`,
              totalDamage: 0,
              players: new Set(),
            });
          }

          // Remove excess teams if reducing count
          for (let i = parameters.teamCount + 1; i <= oldTeamCount; i++) {
            const team = session.teams.get(i);
            if (team) {
              // Move players from removed teams to existing teams
              team.players.forEach((playerId) => {
                const player = session.players.get(playerId);
                if (player) {
                  player.teamId = null; // Will be reassigned when battle starts
                }
              });
            }
            session.teams.delete(i);
          }
        }
      }

      if (parameters.maxHp && typeof parameters.maxHp === "number") {
        session.bossData.baseMaxHp = parameters.maxHp;
        bossSessionManager.scaleBossHp(eventBossId); // Recalculate based on current players
      }

      socket.emit("boss-parameters-updated", {
        message: "Boss parameters updated successfully",
        updatedParameters: parameters,
      });

      // Notify all players about parameter changes if relevant
      io.to(`boss-${eventBossId}`).emit("boss-updated", {
        bossData: session.bossData,
        teamCount: session.teamCount,
      });

      console.log(`Boss parameters updated for ${eventBossId}:`, parameters);
    } catch (error) {
      console.error("Error in update-boss-parameters:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });

  // Get all active boss sessions (for admins)
  socket.on("get-all-boss-sessions", () => {
    try {
      const allSessions = bossSessionManager.getAllSessions();

      const sessionsInfo = allSessions.map((session) => ({
        eventBossId: session.eventBossId,
        bossName: session.bossData.name,
        isStarted: session.isStarted,
        playerCount: session.players.size,
        isOnCooldown:
          session.bossData.cooldownUntil &&
          new Date() < session.bossData.cooldownUntil,
        cooldownRemaining: session.bossData.cooldownUntil
          ? Math.max(
              0,
              Math.ceil((session.bossData.cooldownUntil - new Date()) / 1000)
            )
          : 0,
      }));

      socket.emit("all-boss-sessions", sessionsInfo);
    } catch (error) {
      console.error("Error in get-all-boss-sessions:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });

  // Reset boss session (for hosts/admins)
  socket.on("reset-boss-session", (data) => {
    try {
      const { eventBossId } = data;

      const session = bossSessionManager.getSession(eventBossId);
      if (!session) {
        socket.emit("error", { message: "Boss session not found" });
        return;
      }

      // End current battle if active
      if (session.isStarted) {
        bossSessionManager.endBossFight(eventBossId, null, io);
      }

      // Reset boss data
      session.bossData.currentHp = session.bossData.maxHp;
      session.bossData.isActive = false;
      session.bossData.cooldownUntil = null;

      // Reset all players
      session.players.forEach((player) => {
        player.hearts = 3;
        player.isKnockedOut = false;
        player.status = "waiting";
        player.totalDamage = 0;
        player.questionsAnswered = 0;
        player.correctAnswers = 0;
        player.teamId = null;
      });

      // Reset teams
      session.teams.forEach((team) => {
        team.totalDamage = 0;
        team.players.clear();
      });

      // Move all players to waiting
      session.activePlayers.forEach((playerId) => {
        session.waitingPlayers.add(playerId);
      });
      session.activePlayers.clear();

      session.isStarted = false;
      session.startedAt = null;

      // Notify all players about the reset
      io.to(`boss-${eventBossId}`).emit("boss-session-reset", {
        message: "Boss session has been reset",
        bossData: session.bossData,
      });

      socket.emit("boss-session-reset-success", {
        message: "Boss session reset successfully",
        eventBossId,
      });

      console.log(`Boss session ${eventBossId} reset`);
    } catch (error) {
      console.error("Error in reset-boss-session:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });
};

export default handleBoss;
