import EventBoss from "../models/event_boss.model.js";
import Boss from "../models/boss.model.js";

// Store active matchmaking sessions
const matchmakingQueue = new Map(); // Map<bossId, Set<socketId>>
const playerSessions = new Map(); // Map<socketId, playerData>

export const handleMatchmaking = (io, socket) => {
  socket.on("matchmaking:find", async (data) => {
    try {
      const { joinCode, nickname, userId } = data;

      // Validate input
      if (!joinCode || !nickname) {
        socket.emit("error", {
          message: "Join code and nickname are required",
        });
        return;
      }

      if (nickname.length < 2 || nickname.length > 20) {
        socket.emit("error", {
          message: "Nickname must be between 2-20 characters",
        });
        return;
      }

      // Find the event boss by join code (from QR code)
      const eventBoss = await EventBoss.findOne({
        where: { joinCode },
        include: [
          {
            model: Boss,
            as: "boss",
          },
        ],
      });

      if (!eventBoss) {
        socket.emit("error", {
          message: "Invalid join code",
        });
        return;
      }

      // Check if event is active
      if (eventBoss.status !== "active") {
        socket.emit("error", {
          message: "This boss fight is not currently available",
        });
        return;
      }

      // Generate unique player ID
      const playerId = userId || `guest_${socket.id}_${Date.now()}`;

      // Check if player is already in a game
      if (playerSessions.has(socket.id)) {
        socket.emit("error", {
          message: "You are already in a game session",
        });
        return;
      }

      // Create player session data
      const playerData = {
        socketId: socket.id,
        playerId,
        nickname,
        userId: userId || null,
        status: "searching",
        bossId: eventBoss.bossId,
        eventBossId: eventBoss.id,
        joinCode,
        joinedAt: new Date(),
        lastActivity: new Date(),
      };

      // Store player session
      playerSessions.set(socket.id, playerData);
      socket.data.player = playerData;

      // Add to matchmaking queue
      if (!matchmakingQueue.has(eventBoss.bossId)) {
        matchmakingQueue.set(eventBoss.bossId, new Set());
      }

      const queue = matchmakingQueue.get(eventBoss.bossId);
      queue.add(socket.id);

      // Join the boss room for real-time updates
      socket.join(`boss_${eventBoss.bossId}`);

      // STEP 2: Check if enough players to start
      const playersInQueue = queue.size;
      const MIN_PLAYERS = 2;

      if (playersInQueue >= MIN_PLAYERS) {
        // Enough players - start boss fight immediately
        socket.emit("matchmaking:found", {
          success: true,
          action: "start_fight",
          bossId: eventBoss.bossId,
          eventBossId: eventBoss.id,
          playerId,
          boss: {
            id: eventBoss.boss.id,
            name: eventBoss.boss.name,
            description: eventBoss.boss.description,
            numberOfTeams: eventBoss.boss.numberOfTeams,
            difficulty: eventBoss.boss.difficulty || "normal",
          },
          player: {
            playerId,
            nickname,
            status: "ready_to_fight",
          },
          queueInfo: {
            playersInQueue,
            position: Array.from(queue).indexOf(socket.id) + 1,
          },
        });

        // Notify all players in this boss queue to start
        io.to(`boss_${eventBoss.bossId}`).emit("lobby:fight-starting", {
          message: "Boss fight is starting!",
          playersReady: playersInQueue,
          countdown: 5, // 5 seconds to prepare
        });

        console.log(
          `Boss fight starting for ${eventBoss.boss.name} with ${playersInQueue} players`
        );
      } else {
        // Not enough players - send to waiting lobby
        socket.emit("matchmaking:found", {
          success: true,
          action: "join_lobby",
          bossId: eventBoss.bossId,
          eventBossId: eventBoss.id,
          playerId,
          boss: {
            id: eventBoss.boss.id,
            name: eventBoss.boss.name,
            description: eventBoss.boss.description,
            numberOfTeams: eventBoss.boss.numberOfTeams,
            difficulty: eventBoss.boss.difficulty || "normal",
          },
          player: {
            playerId,
            nickname,
            status: "waiting",
          },
          queueInfo: {
            playersInQueue,
            position: Array.from(queue).indexOf(socket.id) + 1,
            playersNeeded: MIN_PLAYERS - playersInQueue,
          },
        });

        // Notify other waiting players about new player
        socket.to(`boss_${eventBoss.bossId}`).emit("lobby:player-joined", {
          player: {
            playerId,
            nickname,
          },
          queueInfo: {
            playersInQueue,
            playersNeeded: MIN_PLAYERS - playersInQueue,
          },
        });

        console.log(
          `Player ${nickname} waiting in lobby. ${playersInQueue}/${MIN_PLAYERS} players ready`
        );
      }
    } catch (error) {
      console.error("Error in matchmaking find game:", error);
      socket.emit("error", {
        message: "Failed to find game. Please try again.",
      });
    }
  });

  /**
   * STEP 3: Player cancels while waiting in lobby
   */
  socket.on("matchmaking:cancel", () => {
    try {
      const playerData = playerSessions.get(socket.id);

      if (!playerData) {
        socket.emit("error", {
          message: "No active search to cancel",
        });
        return;
      }

      // Remove from queue
      const queue = matchmakingQueue.get(playerData.bossId);
      if (queue) {
        queue.delete(socket.id);

        // Notify other players about player leaving
        socket.to(`boss_${playerData.bossId}`).emit("lobby:player-left", {
          player: {
            playerId: playerData.playerId,
            nickname: playerData.nickname,
          },
          queueInfo: {
            playersInQueue: queue.size,
            playersNeeded: Math.max(0, 2 - queue.size),
          },
        });

        // Clean up empty queues
        if (queue.size === 0) {
          matchmakingQueue.delete(playerData.bossId);
        }
      }

      // Leave room
      socket.leave(`boss_${playerData.bossId}`);

      // Clean up player session
      playerSessions.delete(socket.id);
      delete socket.data.player;

      socket.emit("success", {
        message: "Left the lobby successfully",
      });

      console.log(
        `Player ${playerData.nickname} left lobby for boss ${playerData.bossId}`
      );
    } catch (error) {
      console.error("Error cancelling search:", error);
      socket.emit("error", {
        message: "Failed to leave lobby",
      });
    }
  });

  /**
   * STEP 4: Get current lobby/queue status
   */
  socket.on("matchmaking:status", () => {
    try {
      const playerData = playerSessions.get(socket.id);

      if (!playerData) {
        socket.emit("matchmaking:status-result", {
          inQueue: false,
          status: "idle",
          message: "Not currently in any lobby",
        });
        return;
      }

      const queue = matchmakingQueue.get(playerData.bossId);
      const queueSize = queue ? queue.size : 0;
      const position = queue ? Array.from(queue).indexOf(socket.id) + 1 : 0;

      socket.emit("matchmaking:status-result", {
        inQueue: true,
        status: playerData.status,
        player: {
          playerId: playerData.playerId,
          nickname: playerData.nickname,
        },
        game: {
          bossId: playerData.bossId,
          eventBossId: playerData.eventBossId,
          joinCode: playerData.joinCode,
        },
        queue: {
          size: queueSize,
          position,
          joinedAt: playerData.joinedAt,
          playersNeeded: Math.max(0, 2 - queueSize),
        },
      });
    } catch (error) {
      console.error("Error getting matchmaking status:", error);
      socket.emit("error", {
        message: "Failed to get lobby status",
      });
    }
  });

  /**
   * STEP 5: Handle disconnect during lobby wait
   */
  socket.on("disconnect", () => {
    handleMatchmakingDisconnect(socket.id);
  });
};

/**
 * Handle player disconnect cleanup
 */
function handleMatchmakingDisconnect(socketId) {
  try {
    const playerData = playerSessions.get(socketId);

    if (playerData) {
      // Remove from queue
      const queue = matchmakingQueue.get(playerData.bossId);
      if (queue) {
        queue.delete(socketId);

        // Clean up empty queues
        if (queue.size === 0) {
          matchmakingQueue.delete(playerData.bossId);
        }
      }

      console.log(
        `Player ${playerData.nickname} disconnected from matchmaking`
      );
    }

    // Clean up player session
    playerSessions.delete(socketId);
  } catch (error) {
    console.error("Error handling matchmaking disconnect:", error);
  }
}

/**
 * Get current matchmaking statistics
 */
export const getMatchmakingStats = () => {
  const stats = {
    totalQueues: matchmakingQueue.size,
    totalPlayers: playerSessions.size,
    queues: {},
  };

  for (const [bossId, queue] of matchmakingQueue.entries()) {
    stats.queues[bossId] = {
      players: queue.size,
      socketIds: Array.from(queue),
    };
  }

  return stats;
};

/**
 * Get player data from socket ID
 */
export const getPlayerFromSocket = (socketId) => {
  return playerSessions.get(socketId) || null;
};

/**
 * Remove player from all matchmaking queues
 */
export const removePlayerFromAllQueues = (socketId) => {
  handleMatchmakingDisconnect(socketId);
};
