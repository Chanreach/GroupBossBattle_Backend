import EventBoss from "../models/event_boss.model.js";
import Boss from "../models/boss.model.js";
// import { BossEngine } from "../engines/boss-engine-refactored.js";

// For now, we'll use a simple in-memory boss engine mock
// TODO: Replace with actual boss engine integration
class SimpleBossEngine {
  constructor() {
    this.activeBossFights = new Map();
  }

  getBossFight(bossId) {
    const session = this.activeBossFights.get(bossId);
    if (!session) {
      throw new Error("Boss fight not found");
    }
    return session;
  }

  async createBossFight(bossId, hostId) {
    const sessionId = `session_${bossId}_${Date.now()}`;
    const session = {
      sessionId,
      bossId,
      hostId,
      status: "waiting",
      players: new Map(),
      teams: new Map(),
      startTime: null,
    };
    
    this.activeBossFights.set(bossId, session);
    return session;
  }

  async joinBossFight(bossId, playerId, nickname) {
    let session = this.activeBossFights.get(bossId);
    if (!session) {
      session = await this.createBossFight(bossId, "system");
    }

    const playerSession = {
      playerId,
      nickname,
      teamId: Math.floor(Math.random() * 4) + 1, // Random team assignment for now
      status: "waiting",
    };

    session.players.set(playerId, playerSession);
    return playerSession;
  }

  async playerReady(playerId) {
    // Mock implementation
    return true;
  }

  startBossFight(session) {
    session.status = "active";
    session.startTime = new Date();
    return true;
  }
}

// Store boss preview sessions
const previewSessions = new Map(); // Map<bossId, PreviewSession>
const playerPreviewSessions = new Map(); // Map<socketId, playerData>
const viewerPreviewSessions = new Map(); // Map<socketId, viewerData>
const activeCountdowns = new Map(); // Map<bossId, intervalId> - Track active countdowns

// Initialize boss engine
const bossEngine = new SimpleBossEngine();

/**
 * Create or get a preview session and ensure boss fight exists
 */
async function ensureSessionAndBossFight(bossId, eventBoss) {
  if (!previewSessions.has(bossId)) {
    previewSessions.set(bossId, {
      bossId,
      eventBossId: eventBoss.id,
      boss: eventBoss.boss,
      status: eventBoss.status,
      players: new Map(), // Map<playerId, playerData> - actual joined players
      playerSockets: new Map(), // Map<playerId, Set<socketId>> for players with multiple tabs
      viewers: new Map(), // Map<viewerId, viewerData> - people just viewing
      viewerSockets: new Map(), // Map<viewerId, Set<socketId>> for viewers with multiple tabs
      readyPlayers: new Set(),
      cooldownEnd: null,
      createdAt: new Date(),
    });

    // Also create the boss fight session
    try {
      await bossEngine.createBossFight(bossId, "system");
      console.log(`Created boss fight for boss ${bossId}`);
    } catch (error) {
      console.error(`Failed to create boss fight for boss ${bossId}:`, error);
    }
  }
  
  return previewSessions.get(bossId);
}

/**
 * Check if a player is already joined to any boss battle
 */
function findPlayerInAnyBoss(playerId) {
  for (const [bossId, session] of previewSessions) {
    if (session.players.has(playerId)) {
      return { bossId, session };
    }
  }
  return null;
}

/**
 * Cancel battle countdown if active
 */
function cancelBattleCountdown(io, bossId) {
  const countdownInterval = activeCountdowns.get(bossId);
  if (countdownInterval) {
    clearInterval(countdownInterval);
    activeCountdowns.delete(bossId);
    
    // Notify all players that countdown was cancelled
    io.to(`boss-preview-${bossId}`).emit("boss-preview:countdown-cancelled", {
      message: "Battle countdown cancelled - not enough players",
    });
    
    console.log(`Cancelled battle countdown for boss ${bossId}`);
    return true;
  }
  return false;
}

export const handleBossPreview = (io, socket) => {
  /**
   * Player views boss preview page (just viewing, not joining)
   */
  socket.on("boss-preview:view", async (data) => {
    try {
      const { bossId, eventId, token } = data;

      // Validate input
      if (!bossId || !token) {
        socket.emit("boss-preview:error", {
          message: "Boss ID and authentication token are required",
        });
        return;
      }

      // Find event boss
      const eventBoss = await EventBoss.findOne({
        where: { bossId, eventId },
        include: [
          {
            model: Boss,
            as: "boss",
          },
        ],
      });

      if (!eventBoss) {
        socket.emit("boss-preview:error", {
          message: "Boss not found",
        });
        return;
      }

      // Generate unique viewer ID based on token
      const viewerId = `viewer_${token.slice(-8)}_${bossId}`;

      // Ensure session and boss fight exist
      const session = await ensureSessionAndBossFight(bossId, eventBoss);

      // Check if this viewer (by token) is already viewing
      let viewerData = session.viewers.get(viewerId);
      
      if (!viewerData) {
        // Create new viewer data
        viewerData = {
          viewerId,
          token,
          bossId,
          eventBossId: eventBoss.id,
          status: "viewing",
          joinedAt: new Date(),
        };
        session.viewers.set(viewerId, viewerData);
      }

      // Track socket connections for this viewer (for multiple tabs)
      if (!session.viewerSockets.has(viewerId)) {
        session.viewerSockets.set(viewerId, new Set());
      }
      session.viewerSockets.get(viewerId).add(socket.id);

      // Store viewer data by socket ID for cleanup
      viewerPreviewSessions.set(socket.id, { ...viewerData, bossId });

      // Join socket room
      socket.join(`boss-preview-${bossId}`);

      // Check cooldown status
      const cooldownInfo = await checkBossCooldown(eventBoss);

      // Total online = viewers + joined players
      const totalOnline = session.viewers.size + session.players.size;

      // Send successful view response
      socket.emit("boss-preview:viewing", {
        success: true,
        boss: {
          id: eventBoss.boss.id,
          name: eventBoss.boss.name,
          description: eventBoss.boss.description,
          image: eventBoss.boss.image,
          numberOfTeams: eventBoss.boss.numberOfTeams,
          cooldownDuration: eventBoss.boss.cooldownDuration,
        },
        session: {
          totalPlayers: totalOnline,
          readyPlayers: session.readyPlayers.size,
          status: session.status,
          cooldown: cooldownInfo,
        },
      });

      // Notify other users in the preview (only if this is a new viewer)
      const isNewViewer = session.viewerSockets.get(viewerId).size === 1;
      if (isNewViewer) {
        socket.to(`boss-preview-${bossId}`).emit("boss-preview:viewer-joined", {
          totalPlayers: totalOnline,
        });
        console.log(`New viewer joined boss preview for ${eventBoss.boss.name} (total online: ${totalOnline})`);
      } else {
        console.log(`Viewer opened additional tab for boss preview ${eventBoss.boss.name}`);
      }
    } catch (error) {
      console.error("Error in boss preview view:", error);
      socket.emit("boss-preview:error", {
        message: "Failed to view boss preview. Please try again.",
      });
    }
  });
  /**
   * Player joins boss preview page (with nickname, ready to participate)
   */
  socket.on("boss-preview:join", async (data) => {
    try {
      const { bossId, nickname, eventId, token } = data;

      // Validate input
      if (!bossId || !nickname || !token) {
        socket.emit("boss-preview:error", {
          message: "Boss ID, nickname, and authentication token are required",
        });
        return;
      }

      if (nickname.length < 2 || nickname.length > 20) {
        socket.emit("boss-preview:error", {
          message: "Nickname must be between 2-20 characters",
        });
        return;
      }

      // Generate unique player ID based on token (to prevent duplicates across tabs)
      const playerId = `player_${token.slice(-8)}_${bossId}`;

      // Check if this player (by token) is already in another boss battle
      for (const [sessionBossId, session] of previewSessions) {
        if (sessionBossId !== bossId && session.players.has(playerId)) {
          socket.emit("boss-preview:error", {
            message: "You are already in another boss battle. Please leave that battle first.",
          });
          return;
        }
      }

      // Find event boss
      const eventBoss = await EventBoss.findOne({
        where: { bossId, eventId },
        include: [
          {
            model: Boss,
            as: "boss",
          },
        ],
      });

      if (!eventBoss) {
        socket.emit("boss-preview:error", {
          message: "Boss not found",
        });
        return;
      }

      // Get or create session
      const session = await ensureSessionAndBossFight(bossId, eventBoss);

      // Check if this user was a viewer and remove them from viewers
      const viewerId = `viewer_${token.slice(-8)}_${bossId}`;
      const wasViewer = session.viewers.has(viewerId);
      if (wasViewer) {
        // Remove from viewers since they're now joining as a player
        session.viewers.delete(viewerId);
        if (session.viewerSockets.has(viewerId)) {
          session.viewerSockets.delete(viewerId);
        }
        // Remove from viewer sessions
        viewerPreviewSessions.delete(socket.id);
      }

      // Check if player is already joined to ANY boss battle
      const existingBoss = findPlayerInAnyBoss(playerId);
      if (existingBoss && existingBoss.bossId !== bossId) {
        socket.emit("boss-preview:error", {
          message: `You are already joined to another boss battle. Please leave that battle first.`,
        });
        return;
      }

      // Check if this player is already joined
      let playerData = session.players.get(playerId);
      
      if (!playerData) {
        // Create new player data
        playerData = {
          playerId,
          token,
          nickname,
          bossId,
          eventBossId: eventBoss.id,
          status: "ready", // Automatically ready when joining
          teamId: null,
          joinedAt: new Date(),
        };
        session.players.set(playerId, playerData);
        
        // Automatically add to ready players
        session.readyPlayers.add(playerId);
      } else {
        // Update existing player's nickname if different
        playerData.nickname = nickname;
        // Ensure they're marked as ready
        playerData.status = "ready";
        session.readyPlayers.add(playerId);
      }

      // Track socket connections for this player (for multiple tabs)
      if (!session.playerSockets.has(playerId)) {
        session.playerSockets.set(playerId, new Set());
      }
      session.playerSockets.get(playerId).add(socket.id);

      // Store player data by socket ID for cleanup
      playerPreviewSessions.set(socket.id, { ...playerData, bossId });

      // Join socket room (might already be in if was viewer)
      socket.join(`boss-preview-${bossId}`);

      // Check cooldown status
      const cooldownInfo = await checkBossCooldown(eventBoss);

      // Total online = viewers + joined players
      const totalOnline = session.viewers.size + session.players.size;

      // Send successful join response
      socket.emit("boss-preview:joined", {
        success: true,
        player: {
          playerId,
          nickname,
          status: playerData.status,
        },
        boss: {
          id: eventBoss.boss.id,
          name: eventBoss.boss.name,
          description: eventBoss.boss.description,
          image: eventBoss.boss.image,
          numberOfTeams: eventBoss.boss.numberOfTeams,
          cooldownDuration: eventBoss.boss.cooldownDuration,
        },
        session: {
          totalPlayers: totalOnline,
          readyPlayers: session.readyPlayers.size,
          status: session.status,
          cooldown: cooldownInfo,
        },
      });

      // Notify other users in the preview (only if this is a new player)
      const isNewPlayer = session.playerSockets.get(playerId).size === 1;
      if (isNewPlayer) {
        socket.to(`boss-preview-${bossId}`).emit("boss-preview:player-joined", {
          player: {
            playerId,
            nickname,
          },
          totalPlayers: totalOnline,
          readyPlayers: session.readyPlayers.size,
        });
        console.log(`New player ${nickname} joined and ready for boss preview ${eventBoss.boss.name} (total online: ${totalOnline}, ready: ${session.readyPlayers.size})`);
        
        // Check if we can start the battle
        const minPlayersToStart = 2;
        if (session.readyPlayers.size >= minPlayersToStart) {
          console.log(`Enough players ready (${session.readyPlayers.size}/${minPlayersToStart}), starting battle countdown...`);
          startBattleCountdown(io, bossId, session);
        }
      } else {
        console.log(`Player ${nickname} opened additional tab for boss preview ${eventBoss.boss.name}`);
      }
    } catch (error) {
      console.error("Error in boss preview join:", error);
      socket.emit("boss-preview:error", {
        message: "Failed to join boss preview. Please try again.",
      });
    }
  });

  /**
   * NOTE: Ready functionality is now automatic when joining.
   * Players are automatically ready when they join the battle.
   * Keeping these handlers commented for potential future use.
   */
  
  /*
  // Player clicks "Join Boss Fight" button (ready to battle)
  socket.on("boss-preview:ready", async (data) => {
    // This is now handled automatically in the join event
  });

  // Player cancels ready status  
  socket.on("boss-preview:cancel-ready", () => {
    // This is no longer needed since joining = ready
  });
  */
  /**
   * Get current leaderboard data
   */
  socket.on("boss-preview:get-leaderboard", async (data) => {
    try {
      // First check if player has a session
      let playerData = playerPreviewSessions.get(socket.id);
      let eventBossId = null;

      if (playerData) {
        // Player is already in a session
        eventBossId = playerData.eventBossId;
      } else if (data && data.bossId && data.eventId) {
        // No session yet, but we have boss/event IDs from the request
        // Find the eventBoss to get eventBossId
        const eventBoss = await EventBoss.findOne({
          where: { bossId: data.bossId, eventId: data.eventId }
        });
        
        if (eventBoss) {
          eventBossId = eventBoss.id;
        }
      }

      if (!eventBossId) {
        socket.emit("boss-preview:error", {
          message: "Unable to load leaderboard - missing boss information",
        });
        return;
      }

      // Get leaderboard data (this would come from database)
      const leaderboardData = await getLeaderboardData(eventBossId);

      // Get current session info if available
      let sessionInfo = null;
      if (data && data.bossId) {
        const session = previewSessions.get(data.bossId);
        if (session) {
          // Total online = viewers + joined players
          const totalOnline = session.viewers.size + session.players.size;
          sessionInfo = {
            totalPlayers: totalOnline,
            readyPlayers: session.readyPlayers.size,
          };
        }
      }

      socket.emit("boss-preview:leaderboard-data", {
        ...leaderboardData,
        session: sessionInfo,
      });
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      socket.emit("boss-preview:error", {
        message: "Failed to load leaderboard data",
      });
    }
  });

  /**
   * Player leaves preview (but stays on page as viewer)
   */
  socket.on("boss-preview:leave", () => {
    const playerData = playerPreviewSessions.get(socket.id);
    
    if (playerData) {
      const { bossId, token } = playerData;
      
      // Convert player back to viewer since they're still on the page
      handlePlayerToViewerConversion(socket, playerData);
      
      // Send confirmation to the leaving player with updated session info
      const session = previewSessions.get(bossId);
      const totalOnline = session ? (session.viewers.size + session.players.size) : 0;
      const readyPlayers = session ? session.readyPlayers.size : 0;
      
      socket.emit("boss-preview:left", {
        success: true,
        message: "You have left the battle preview",
        session: {
          totalPlayers: totalOnline,
          readyPlayers: readyPlayers,
        },
      });
    }
  });

  /**
   * Handle disconnect
   */
  socket.on("disconnect", () => {
    handlePlayerLeave(socket);
  });
};

/**
 * Handle player/viewer leaving preview
 */
function handlePlayerLeave(socket) {
  try {
    const playerData = playerPreviewSessions.get(socket.id);
    const viewerData = viewerPreviewSessions.get(socket.id);

    if (playerData) {
      // Handle player leaving
      const session = previewSessions.get(playerData.bossId);

      if (session) {
        const { playerId } = playerData;
        
        // Remove this socket from the player's socket set
        if (session.playerSockets.has(playerId)) {
          session.playerSockets.get(playerId).delete(socket.id);
          
          // Only remove player completely if no more sockets are connected
          if (session.playerSockets.get(playerId).size === 0) {
            session.playerSockets.delete(playerId);
            session.players.delete(playerId);
            session.readyPlayers.delete(playerId);

            // Total online = viewers + joined players
            const totalOnline = session.viewers.size + session.players.size;

            // Notify other users only when the player completely leaves
            socket.to(`boss-preview-${playerData.bossId}`).emit("boss-preview:player-left", {
              player: {
                playerId: playerData.playerId,
                nickname: playerData.nickname,
              },
              session: {
                totalPlayers: totalOnline,
                readyPlayers: session.readyPlayers.size,
              },
            });

            console.log(`Player ${playerData.nickname} completely left boss preview (total online: ${totalOnline})`);
            
            // Check if countdown should be cancelled due to insufficient players
            const minPlayersToStart = 2;
            if (session.readyPlayers.size < minPlayersToStart && activeCountdowns.has(playerData.bossId)) {
              console.log(`Not enough ready players after leave (${session.readyPlayers.size}/${minPlayersToStart}), cancelling countdown...`);
              cancelBattleCountdown(socket.server, playerData.bossId);
            }
          } else {
            console.log(`Player ${playerData.nickname} closed one tab, still has ${session.playerSockets.get(playerId).size} tabs open`);
          }
        }

        // Clean up empty sessions
        if (session.players.size === 0 && session.viewers.size === 0) {
          previewSessions.delete(playerData.bossId);
        }
      }

      // Clean up player session for this socket
      playerPreviewSessions.delete(socket.id);
    }

    if (viewerData) {
      // Handle viewer leaving
      const session = previewSessions.get(viewerData.bossId);

      if (session) {
        const { viewerId } = viewerData;
        
        // Remove this socket from the viewer's socket set
        if (session.viewerSockets.has(viewerId)) {
          session.viewerSockets.get(viewerId).delete(socket.id);
          
          // Only remove viewer completely if no more sockets are connected
          if (session.viewerSockets.get(viewerId).size === 0) {
            session.viewerSockets.delete(viewerId);
            session.viewers.delete(viewerId);

            // Total online = viewers + joined players
            const totalOnline = session.viewers.size + session.players.size;

            // Notify other users only when the viewer completely leaves
            socket.to(`boss-preview-${viewerData.bossId}`).emit("boss-preview:viewer-left", {
              session: {
                totalPlayers: totalOnline,
              },
            });

            console.log(`Viewer completely left boss preview (total online: ${totalOnline})`);
          } else {
            console.log(`Viewer closed one tab, still has ${session.viewerSockets.get(viewerId).size} tabs open`);
          }
        }

        // Clean up empty sessions
        if (session.players.size === 0 && session.viewers.size === 0) {
          previewSessions.delete(viewerData.bossId);
        }
      }

      // Clean up viewer session for this socket
      viewerPreviewSessions.delete(socket.id);
    }
  } catch (error) {
    console.error("Error handling player/viewer leave:", error);
  }
}

/**
 * Convert player back to viewer (when they leave but stay on page)
 */
function handlePlayerToViewerConversion(socket, playerData) {
  try {
    const { bossId, token, playerId } = playerData;
    const session = previewSessions.get(bossId);
    
    if (session) {
      // Remove from player session
      if (session.playerSockets.has(playerId)) {
        session.playerSockets.get(playerId).delete(socket.id);
        
        // Only remove player completely if no more sockets are connected
        if (session.playerSockets.get(playerId).size === 0) {
          session.playerSockets.delete(playerId);
          session.players.delete(playerId);
          session.readyPlayers.delete(playerId);
          
          console.log(`Player ${playerData.nickname} left and converted to viewer`);
          
          // Check if countdown should be cancelled due to insufficient players
          const minPlayersToStart = 2;
          if (session.readyPlayers.size < minPlayersToStart && activeCountdowns.has(bossId)) {
            console.log(`Not enough ready players after leave (${session.readyPlayers.size}/${minPlayersToStart}), cancelling countdown...`);
            cancelBattleCountdown(socket.server, bossId);
          }
        }
      }
      
      // Convert to viewer
      const viewerId = `viewer_${token.slice(-8)}_${bossId}`;
      const viewerData = {
        viewerId,
        token,
        bossId,
        joinedAt: new Date(),
      };
      
      // Add to viewers
      session.viewers.set(viewerId, viewerData);
      
      // Add socket to viewer sockets
      if (!session.viewerSockets.has(viewerId)) {
        session.viewerSockets.set(viewerId, new Set());
      }
      session.viewerSockets.get(viewerId).add(socket.id);
      
      // Update session mappings
      playerPreviewSessions.delete(socket.id);
      viewerPreviewSessions.set(socket.id, viewerData);
      
      // Total online = viewers + joined players
      const totalOnline = session.viewers.size + session.players.size;
      
      // Notify other users about the change
      socket.to(`boss-preview-${bossId}`).emit("boss-preview:player-left", {
        player: {
          playerId: playerData.playerId,
          nickname: playerData.nickname,
        },
        session: {
          totalPlayers: totalOnline,
          readyPlayers: session.readyPlayers.size,
        },
      });
      
      console.log(`Converted player to viewer (total online: ${totalOnline})`);
    }
  } catch (error) {
    console.error("Error converting player to viewer:", error);
  }
}

/**
 * Start battle countdown
 */
function startBattleCountdown(io, bossId, session) {
  // Cancel any existing countdown for this boss
  cancelBattleCountdown(io, bossId);
  
  const COUNTDOWN_SECONDS = 5;
  let countdown = COUNTDOWN_SECONDS;

  // Notify all players that battle is starting
  io.to(`boss-preview-${bossId}`).emit("boss-preview:battle-starting", {
    countdown: COUNTDOWN_SECONDS,
    message: "Battle starting soon!",
  });

  const countdownInterval = setInterval(() => {
    countdown--;

    // Check if we still have enough players before continuing countdown
    const minPlayersToStart = 2;
    if (session.readyPlayers.size < minPlayersToStart) {
      console.log(`Not enough ready players (${session.readyPlayers.size}/${minPlayersToStart}), cancelling countdown...`);
      cancelBattleCountdown(io, bossId);
      return;
    }

    io.to(`boss-preview-${bossId}`).emit("boss-preview:battle-countdown", {
      countdown,
    });

    if (countdown <= 0) {
      clearInterval(countdownInterval);
      activeCountdowns.delete(bossId);

      // Start the actual battle
      try {
        bossEngine.startBossFight(bossEngine.getBossFight(bossId));

        // Redirect all ready players to battle page
        io.to(`boss-preview-${bossId}`).emit("boss-preview:battle-started", {
          message: "Battle has begun!",
          redirectTo: `/boss-battle?bossId=${bossId}`,
        });

        // Clean up preview session
        previewSessions.delete(bossId);
      } catch (error) {
        console.error("Error starting battle:", error);
        io.to(`boss-preview-${bossId}`).emit("boss-preview:error", {
          message: "Failed to start battle. Please try again.",
        });
      }
    }
  }, 1000);

  // Store the interval so it can be cancelled if needed
  activeCountdowns.set(bossId, countdownInterval);
}

/**
 * Check if boss is on cooldown
 */
async function checkBossCooldown(eventBoss) {
  // This would integrate with your cooldown system
  // For now, returning mock data based on status
  const isOnCooldown = eventBoss.status === "cooldown";
  
  if (isOnCooldown) {
    // Calculate time remaining (mock calculation)
    const cooldownDuration = eventBoss.boss.cooldownDuration * 1000; // Convert to milliseconds
    const timeRemaining = cooldownDuration; // This should be calculated from actual cooldown start time
    
    return {
      isOnCooldown: true,
      timeRemaining,
      formattedTime: formatTimeRemaining(timeRemaining),
    };
  }

  return {
    isOnCooldown: false,
    timeRemaining: 0,
    formattedTime: "00:00",
  };
}

/**
 * Format time remaining in MM:SS format
 */
function formatTimeRemaining(milliseconds) {
  const totalSeconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Get leaderboard data for the event boss
 */
async function getLeaderboardData(eventBossId) {
  // This would query your database for actual leaderboard data
  // For now, returning mock data
  return {
    teamLeaderboard: [
      { rank: 1, team: 'Kangaroo', dmg: 100, correct: 9, avatar: '/src/assets/Placeholder/Profile1.jpg' },
      { rank: 2, team: 'Koala', dmg: 85, correct: 8, avatar: '/src/assets/Placeholder/Profile2.jpg' },
      { rank: 3, team: 'Shellfish', dmg: 68, correct: 7, avatar: '/src/assets/Placeholder/Profile3.jpg' },
      { rank: 4, team: 'Dolphins', dmg: 55, correct: 6, avatar: '/src/assets/Placeholder/Profile4.jpg' },
    ],
    individualLeaderboard: [
      { rank: 1, player: 'Sovitep', dmg: 100, correct: 9, avatar: '/src/assets/Placeholder/Profile1.jpg' },
      { rank: 2, player: 'Visoth', dmg: 90, correct: 8, avatar: '/src/assets/Placeholder/Profile2.jpg' },
      { rank: 3, player: 'Roth', dmg: 75, correct: 7, avatar: '/src/assets/Placeholder/Profile3.jpg' },
      { rank: 4, player: 'Alice', dmg: 65, correct: 6, avatar: '/src/assets/Placeholder/Profile4.jpg' },
    ],
    allTimeLeaderboard: [
      { rank: 1, player: 'Python', dmg: 300, correct: 25, avatar: '/src/assets/Placeholder/Profile1.jpg' },
      { rank: 2, player: 'Sovitep', dmg: 280, correct: 22, avatar: '/src/assets/Placeholder/Profile2.jpg' },
      { rank: 3, player: 'Visoth', dmg: 250, correct: 20, avatar: '/src/assets/Placeholder/Profile3.jpg' },
    ],
  };
}
