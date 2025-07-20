import bossSessionManager from "../managers/boss-session.manager.js";
import { formatRevivalCodeForDisplay } from "../../utils/generateRevivalCode.js"; // **FIXED: Import at top of file**

const handleCombat = (io, socket) => {
  // Handle join-boss event (for direct battle joining)
  socket.on("join-boss", async (data) => {
    try {
      const { eventBossId, playerName } = data;

      // Check if session exists, if not create one for testing
      let session = bossSessionManager.getSession(eventBossId);
      if (!session) {
        console.log("🔧 Creating new session for testing...");
        // Create a test session
        session = bossSessionManager.createSession(eventBossId, {
          name: "Test Boss",
          maxHp: 10,
          currentHp: 10, // Set initial HP to full
          numberOfTeams: 2,
          // Add other boss data as needed
        });
      }

      // Start the session if it's not started
      if (!session.isStarted) {
        console.log("🔧 Starting session for testing...");
        const startResult = await bossSessionManager.startBossFight(
          eventBossId
        );
        console.log("Start result:", startResult);
      }

      // Add player to session
      const result = await bossSessionManager.addPlayer(
        eventBossId,
        socket.id,
        {
          nickname: playerName || `Player_${socket.id.substring(0, 6)}`,
          // Additional player data as needed
        }
      );

      console.log("🔧 Add player result:", {
        success: !!result,
        playerId: result?.player?.id,
        playerNickname: result?.player?.nickname,
      });

      if (result && result.player) {
        // Join the socket room
        socket.join(`boss-${eventBossId}`);

        console.log("✅ Player successfully joined battle");
        socket.emit("boss-joined", {
          message: "Successfully joined battle",
          playerId: result.player.id,
          sessionData: result.session,
        });

        // Send team info ONLY if this is a mid-game join (battle already started)
        if (result.session.isStarted && result.player.teamId) {
          bossSessionManager.sendTeamInfoToPlayer(
            io,
            eventBossId,
            result.player.id,
            "mid-game-join"
          );
        }
      } else {
        console.log("❌ Failed to add player to session");
        socket.emit("join-error", { message: "Failed to join battle" });
      }
    } catch (error) {
      console.error("Error in join-boss:", error);
      socket.emit("join-error", { message: "Internal server error" });
    }
  });

  // Debug: Check player session
  socket.on("check-player-session", (data) => {
    try {
      const { eventBossId } = data;
      const playerSession = bossSessionManager.getPlayerSession(socket.id);
      const session = bossSessionManager.getSession(eventBossId);

      console.log("🔍 Session debug requested:", {
        socketId: socket.id,
        eventBossId,
        playerSession,
        sessionExists: !!session,
        sessionStatus: session
          ? {
              isStarted: session.isStarted,
              playerCount: session.players.size,
              questionPoolsCount: session.questionPools.size,
            }
          : null,
      });

      socket.emit("session-debug", {
        socketId: socket.id,
        eventBossId,
        playerSession,
        sessionExists: !!session,
        sessionStatus: session
          ? {
              isStarted: session.isStarted,
              playerCount: session.players.size,
              questionPoolsCount: session.questionPools.size,
            }
          : null,
      });
    } catch (error) {
      console.error("Error in check-player-session:", error);
      socket.emit("session-debug", { error: error.message });
    }
  });

  // Request a new question
  socket.on("question:request", async (data) => {
    try {
      const { eventBossId } = data;
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

      const player = session.players.get(playerSession.playerId);

      if (!player) {
        socket.emit("error", { message: "Player not found in session" });
        return;
      }

      if (player.isKnockedOut) {
        socket.emit("error", { message: "Player is knocked out" });
        return;
      }

      // Get next question from player's pre-assigned question pool
      const questionData = bossSessionManager.getNextQuestionForPlayer(
        eventBossId,
        playerSession.playerId
      );

      if (!questionData) {
        socket.emit("error", { message: "No more questions available" });
        return;
      }

      // Send question with current boss HP and battle status
      socket.emit("question:received", {
        question: questionData,
        battleStatus: getBattleStatusWithTeamName(session, player),
      });
    } catch (error) {
      console.error("Error in request-question:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });

  // Submit answer to question
  socket.on("submit-answer", async (data) => {
    try {
      const { eventBossId, questionId, choiceIndex, responseTime } = data;
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

      const player = session.players.get(playerSession.playerId);
      if (!player || player.isKnockedOut) {
        socket.emit("error", { message: "Player cannot submit answer" });
        return;
      }

      // Get the question for this player
      const questionData = session.questions.get(playerSession.playerId);

      if (!questionData || questionData.id !== questionId) {
        socket.emit("error", { message: "Invalid question" });
        return;
      }

      // Question validation completed

      // Check if time limit exceeded or explicit timeout
      const timeTaken = responseTime || Date.now() - questionData.startTime;

      // FIXED: Ensure timeLimit is in milliseconds for comparison
      const timeLimitMs = questionData.timeLimit * 1000; // Convert seconds to milliseconds
      const isTimeout = parseInt(choiceIndex) === -1 || timeTaken > timeLimitMs;

      if (isTimeout) {
        console.log("⏰ TIMEOUT DETECTED:");
        console.log("   Choice Index:", choiceIndex);
        console.log("   Time Taken:", timeTaken + "ms");
        console.log("   Time Limit (seconds):", questionData.timeLimit);
        console.log("   Time Limit (milliseconds):", timeLimitMs);
        console.log(
          "   Is Explicit Timeout (choiceIndex -1):",
          parseInt(choiceIndex) === -1
        );
        console.log(
          "   Timeout reason:",
          parseInt(choiceIndex) === -1
            ? "Explicit timeout"
            : timeTaken > timeLimitMs
            ? "Time exceeded"
            : "Unknown"
        );

        socket.emit("answer-result", {
          isCorrect: false,
          message:
            parseInt(choiceIndex) === -1 ? "Time's up!" : "Time limit exceeded",
          timeTaken,
          battleStatus: getBattleStatusWithTeamName(session, player),
        });

        // Process as incorrect answer (lose heart) - should only lose 1 heart
        console.log(
          "💔 =============== TIMEOUT HEART DEDUCTION DEBUG ==============="
        );
        console.log(`🎯 Player: ${player.nickname} (${player.teamId})`);
        console.log(
          `⏱️  Question Time Limit: ${questionData.timeLimit} seconds (${
            questionData.timeLimit * 1000
          } milliseconds)`
        );
        console.log(
          `⚡ Response Time: ${timeTaken} milliseconds (${(
            timeTaken / 1000
          ).toFixed(2)} seconds)`
        );
        console.log(`💔 Hearts Before Processing: ${player.hearts}`);
        console.log(
          `⚠️  Reason: ${
            parseInt(choiceIndex) === -1
              ? "Explicit timeout"
              : "Time limit exceeded"
          }`
        );
        console.log(
          "💔 =============================================================="
        );

        const result = bossSessionManager.processIncorrectAnswer(
          eventBossId,
          playerSession.playerId
        );

        console.log(
          `💔 Hearts After Processing: ${result?.player?.hearts || "N/A"}`
        );

        if (result) {
          // Send updated battle status after processing
          socket.emit("battle-status-update", {
            battleStatus: {
              bossCurrentHp: session.bossData.currentHp,
              bossMaxHp: session.bossData.maxHp,
              playerHearts: result.player.hearts, // Send actual heart count after processing
              playerTeamId: player.teamId,
              isKnockedOut: result.isKnockedOut,
            },
          });

          handleIncorrectAnswerResult(io, eventBossId, result);
        }
        return; // **FIXED: Return here to prevent double processing**
      }

      // Check if answer is correct
      const isCorrect =
        parseInt(choiceIndex) === parseInt(questionData.correctAnswerIndex);

      if (isCorrect) {
        // **Use enhanced processAttack with response time-based damage**
        const result = bossSessionManager.processAttack(
          eventBossId,
          playerSession.playerId,
          isCorrect,
          timeTaken,
          questionData.timeLimit
        );

        if (result) {
          // ===== DAMAGE CALCULATION DEBUG =====
          console.log(
            "💥 =============== DAMAGE CALCULATION DEBUG ==============="
          );
          console.log(`🎯 Player: ${player.nickname} (${player.teamId})`);
          console.log(
            `⏱️  Question Time Limit: ${questionData.timeLimit} seconds (${
              questionData.timeLimit * 1000
            } milliseconds)`
          );
          console.log(
            `⚡ Response Time: ${timeTaken} milliseconds (${(
              timeTaken / 1000
            ).toFixed(2)} seconds)`
          );
          console.log(`📊 Response Category: ${result.responseCategory}`);
          console.log(`⚔️  Damage Dealt: ${result.damage}`);
          console.log(
            `🎮 Boss HP: ${result.bossCurrentHP}/${result.bossMaxHP} (${(
              (result.bossCurrentHP / result.bossMaxHP) *
              100
            ).toFixed(1)}%)`
          );
          console.log(
            "💥 ========================================================="
          );

          // Send response to player with enhanced data
          socket.emit("answer-result", {
            isCorrect: true,
            damage: result.damage,
            responseCategory: result.responseCategory,
            timeTaken,
            battleStatus: {
              bossCurrentHp: result.bossCurrentHP,
              bossMaxHp: result.bossMaxHP,
              playerHearts: player.hearts,
              playerTeamId: player.teamId,
              totalDamageDealt: result.player.totalDamage,
            },
            message: `Correct! You dealt ${result.damage} damage! (${result.responseCategory} response)`,
          });

          // Broadcast attack to all players in session with enhanced data
          io.to(`boss-${eventBossId}`).emit("player-attacked", {
            playerNickname: player.nickname,
            teamId: player.teamId,
            damage: result.damage,
            responseCategory: result.responseCategory,
            responseTime: timeTaken,
            bossCurrentHp: result.bossCurrentHP,
            bossMaxHp: result.bossMaxHP,
            bossHpPercentage: (
              (result.bossCurrentHP / result.bossMaxHP) *
              100
            ).toFixed(1),
            battleUpdate: {
              totalDamageDealt: session.bossData.maxHp - result.bossCurrentHP,
              questionsAnswered: Array.from(session.players.values()).reduce(
                (sum, p) => sum + p.questionsAnswered,
                0
              ),
            },
          });

          // **NEW: Broadcast live leaderboard update after each attack**
          bossSessionManager.broadcastLeaderboardUpdate(io, eventBossId);

          // Check if boss was defeated
          if (result.isBossDefeated) {
            await handleBossDefeated(io, eventBossId, result);
          }
        }
      } else {
        // **Incorrect answer - use enhanced processIncorrectAnswer**
        console.log(
          "❌ =============== INCORRECT ANSWER DEBUG ==============="
        );
        console.log(`🎯 Player: ${player.nickname} (${player.teamId})`);
        console.log(
          `⏱️  Question Time Limit: ${questionData.timeLimit} seconds (${
            questionData.timeLimit * 1000
          } milliseconds)`
        );
        console.log(
          `⚡ Response Time: ${timeTaken} milliseconds (${(
            timeTaken / 1000
          ).toFixed(2)} seconds)`
        );
        console.log(
          `❌ Selected Answer: ${questionData.choices[choiceIndex]?.text}`
        );
        console.log(
          `✅ Correct Answer: ${
            questionData.choices[questionData.correctAnswerIndex]?.text
          }`
        );
        console.log(
          `💔 Hearts Before: ${player.hearts} → Hearts After: ${Math.max(
            0,
            player.hearts - 1
          )}`
        );
        console.log(`⚔️  Damage Dealt: 0 (incorrect answer)`);
        console.log(
          "❌ ======================================================"
        );

        socket.emit("answer-result", {
          isCorrect: false,
          correctIndex: questionData.correctAnswerIndex,
          correctAnswer: questionData.choices[questionData.correctAnswerIndex],
          playerAnswer: questionData.choices[choiceIndex],
          timeTaken,
          battleStatus: {
            bossCurrentHp: session.bossData.currentHp,
            bossMaxHp: session.bossData.maxHp,
            playerHearts: player.hearts, // Show current hearts, not preview
            playerTeamId: player.teamId,
          },
          message: "Incorrect answer! You lost a heart.",
        });

        // Process incorrect answer (lose heart)
        console.log(`💔 Hearts Before Processing: ${player.hearts}`);

        const result = bossSessionManager.processIncorrectAnswer(
          eventBossId,
          playerSession.playerId
        );

        console.log(
          `💔 Hearts After Processing: ${result?.player?.hearts || "N/A"}`
        );

        if (result) {
          // Send updated battle status after processing
          socket.emit("battle-status-update", {
            battleStatus: {
              bossCurrentHp: session.bossData.currentHp,
              bossMaxHp: session.bossData.maxHp,
              playerHearts: result.player.hearts, // Send actual heart count after processing
              playerTeamId: player.teamId,
              isKnockedOut: result.isKnockedOut,
            },
          });

          handleIncorrectAnswerResult(io, eventBossId, result);
        }
      }

      // Clear the question for this player
      session.questions.delete(playerSession.playerId);
    } catch (error) {
      console.error("Error in submit-answer:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });

  // Get current battle status
  socket.on("get-battle-status", (data) => {
    try {
      const { eventBossId } = data;
      const session = bossSessionManager.getSession(eventBossId);

      if (!session) {
        socket.emit("error", { message: "Session not found" });
        return;
      }

      socket.emit("battle-status", {
        isStarted: session.isStarted,
        bossData: session.bossData,
        playerCount: session.players.size,
        teams: Array.from(session.teams.values()).map((team) => ({
          id: team.id,
          name: team.name,
          totalDamage: team.totalDamage,
          playerCount: team.players.size,
        })),
      });
    } catch (error) {
      console.error("Error in get-battle-status:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });

  // **NEW: Handle request for current leaderboard data**
  socket.on("request-leaderboard-data", (data) => {
    try {
      const playerSession = bossSessionManager.getPlayerSession(socket.id);
      if (!playerSession) {
        socket.emit("error", { message: "Player session not found" });
        return;
      }

      const eventBossId = playerSession.eventBossId;
      const leaderboardData =
        bossSessionManager.generateLiveLeaderboard(eventBossId);

      if (leaderboardData) {
        socket.emit("leaderboard-update", leaderboardData);
        console.log(
          `📊 Sent current leaderboard data to ${playerSession.nickname}`
        );
      } else {
        socket.emit("error", { message: "No leaderboard data available" });
      }
    } catch (error) {
      console.error("Error in request-leaderboard-data:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });
};

// Helper functions
function getBattleStatusWithTeamName(session, player) {
  const team = session.teams.get(player.teamId);
  return {
    bossCurrentHp: session.bossData.currentHp,
    bossMaxHp: session.bossData.maxHp,
    playerHearts: player.hearts,
    playerTeamId: player.teamId,
    playerTeamName: team?.name || `Team ${player.teamId}`, // **NEW: Include team name**
    isKnockedOut: player.isKnockedOut,
  };
}

function handleIncorrectAnswerResult(io, eventBossId, result) {
  const { session, player, isKnockedOut, reviveCode } = result;

  // Send heart loss specifically to the player who lost it
  const playerSocket = io.sockets.sockets.get(player.socketId);
  if (playerSocket) {
    playerSocket.emit("player-lost-heart", {
      playerNickname: player.nickname,
      teamId: player.teamId,
      hearts: player.hearts,
      isKnockedOut,
    });
  }

  // Also broadcast to all players for leaderboard updates
  io.to(`boss-${eventBossId}`).emit("player-status-update", {
    playerNickname: player.nickname,
    teamId: player.teamId,
    hearts: player.hearts,
    isKnockedOut,
  });

  if (isKnockedOut) {
    // Send revival code to knocked out player
    if (playerSocket) {
      playerSocket.emit("player-knocked-out", {
        message: "You have been knocked out!",
        reviveCode,
        formattedReviveCode: formatRevivalCodeForDisplay(reviveCode), // **FIXED: Use ES import**
        expiresIn: 60000, // 60 seconds
      });
    }

    // **ENHANCED: Use the new team notification method**
    console.log("🔔 Calling notifyTeamAboutKnockout for player:", player.id);
    const notificationResult = bossSessionManager.notifyTeamAboutKnockout(
      io,
      eventBossId,
      player.id
    );
    console.log("🔔 Team notification result:", notificationResult);
  }
}

// **NEW: Handle player death when revival timer expires**
function handlePlayerDeath(io, eventBossId, playerId) {
  const session = bossSessionManager.getSession(eventBossId);
  if (!session) return;

  const player = session.players.get(playerId);
  if (!player) return;

  // Use the boss session manager to handle death
  const deathResult = bossSessionManager.handlePlayerDeath(
    eventBossId,
    playerId
  );

  if (deathResult && deathResult.isDead) {
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      // Notify the dead player to return to boss preview
      playerSocket.emit("player-died", {
        message:
          "Revival time expired. You are now permanently out of this battle.",
        shouldRedirect: true,
        redirectTo: "boss-preview",
        eventBossId: eventBossId,
      });
    }

    // Notify team members that the player is permanently dead
    const team = session.teams.get(player.teamId);
    if (team) {
      team.players.forEach((teamPlayerId) => {
        if (teamPlayerId !== playerId) {
          const teamPlayer = session.players.get(teamPlayerId);
          if (teamPlayer && teamPlayer.socketId) {
            const teamPlayerSocket = io.sockets.sockets.get(
              teamPlayer.socketId
            );
            if (teamPlayerSocket) {
              teamPlayerSocket.emit("teammate-died", {
                message: `${player.nickname} could not be revived and is permanently out of the battle.`,
                deadPlayerNickname: player.nickname,
                teamName: team.name,
              });
            }
          }
        }
      });
    }

    console.log(
      `Player ${player.nickname} permanently died in session ${eventBossId}`
    );
  }
}

async function handleBossDefeated(io, eventBossId, result) {
  try {
    const endResult = await bossSessionManager.endBossFight(
      eventBossId,
      result.finalHitBy
    );

    if (endResult && endResult.session) {
      const { session, winningTeam, mvpPlayer, cooldownUntil, awardedBadges } =
        endResult;

      // Broadcast boss defeated to all players with badge information
      io.to(`boss-${eventBossId}`).emit("boss-defeated", {
        message: "Boss defeated!",
        winningTeam: winningTeam
          ? {
              id: winningTeam.id,
              name: winningTeam.name,
              totalDamage: winningTeam.totalDamage,
            }
          : null,
        mvpPlayer: mvpPlayer
          ? {
              id: mvpPlayer.id,
              nickname: mvpPlayer.nickname,
              totalDamage: mvpPlayer.totalDamage,
            }
          : null,
        finalHitBy: result.finalHitBy,
        cooldownUntil,
        nextBattleIn: cooldownUntil
          ? Math.ceil((cooldownUntil - new Date()) / 1000)
          : 0,
        awardedBadges: awardedBadges
          ? {
              mvpAwarded: !!awardedBadges.mvp,
              lastHitAwarded: !!awardedBadges.lastHit,
              bossDefeatedCount: awardedBadges.bossDefeated.length,
              milestoneAwards: awardedBadges.milestones.map((m) => ({
                playerId: m.playerId,
                playerNickname: m.playerNickname,
                badgeCount: m.badges.length,
                badges: m.badges.map((b) => ({
                  name: b.badgeInfo.name,
                  milestone: b.milestone,
                })),
              })),
            }
          : null,
      });

      // **NEW: Generate and broadcast final leaderboards**
      const finalLeaderboards = bossSessionManager.generateLiveLeaderboard(eventBossId);
      if (finalLeaderboards) {
        io.to(`boss-${eventBossId}`).emit("final-leaderboards", {
          ...finalLeaderboards,
          eventBossId,
          completedAt: new Date().toISOString(),
          totalParticipants: session.players.size,
          battleDuration: Math.floor((new Date() - session.startedAt) / 1000), // Duration in seconds
        });
        console.log(`🏆 Final leaderboards broadcasted for session ${eventBossId}`);
      }

      // Broadcast boss status update to cooldown
      try {
        const { EventBoss } = await import("../../models/index.js");
        const eventBoss = await EventBoss.findByPk(eventBossId);

        if (eventBoss && eventBoss.cooldownEndTime) {
          io.to(`boss-${eventBossId}`).emit("boss-status:updated", {
            status: "cooldown",
            eventBossId: eventBossId,
            cooldownEndTime: eventBoss.cooldownEndTime,
          });
        }
      } catch (error) {
        console.error("Error broadcasting boss status update:", error);
      }

      // Send individual badge notifications to players
      if (awardedBadges) {
        // Notify MVP
        if (awardedBadges.mvp && mvpPlayer) {
          const mvpSocket = io.sockets.sockets.get(mvpPlayer.socketId);
          if (mvpSocket) {
            mvpSocket.emit("badge-earned", {
              type: "MVP",
              badgeId: awardedBadges.mvp.badgeId,
              message: `🏆 Congratulations! You earned the MVP badge with ${mvpPlayer.totalDamage} damage!`,
              eventBossId,
            });
          }
        }

        // Notify Last Hit player
        if (awardedBadges.lastHit && result.finalHitBy) {
          const finalHitPlayer = session.players.get(result.finalHitBy);
          if (finalHitPlayer) {
            const lastHitSocket = io.sockets.sockets.get(
              finalHitPlayer.socketId
            );
            if (lastHitSocket) {
              lastHitSocket.emit("badge-earned", {
                type: "Last Hit",
                badgeId: awardedBadges.lastHit.badgeId,
                message: "🎯 Congratulations! You earned the Last Hit badge!",
                eventBossId,
              });
            }
          }
        }

        // Notify Boss Defeated badge recipients
        if (awardedBadges.bossDefeated.length > 0 && winningTeam) {
          winningTeam.players.forEach((playerId) => {
            const player = session.players.get(playerId);
            if (player) {
              const playerSocket = io.sockets.sockets.get(player.socketId);
              if (playerSocket) {
                playerSocket.emit("badge-earned", {
                  type: "Boss Defeated",
                  badgeId: awardedBadges.bossDefeated[0]?.badgeId, // Same badge for all
                  message:
                    "🏅 Congratulations! You earned the Boss Defeated badge!",
                  eventBossId,
                });
              }
            }
          });
        }

        // Notify milestone badge recipients
        awardedBadges.milestones.forEach((milestonePlayer) => {
          const player = session.players.get(milestonePlayer.playerId);
          if (player) {
            const playerSocket = io.sockets.sockets.get(player.socketId);
            if (playerSocket) {
              milestonePlayer.badges.forEach((badgeInfo) => {
                playerSocket.emit("badge-earned", {
                  type: "Milestone",
                  badgeId: badgeInfo.badge.badgeId,
                  message: `🎖️ Congratulations! You earned the ${badgeInfo.badgeInfo.name} milestone badge!`,
                  milestone: badgeInfo.milestone,
                  eventBossId,
                });
              });
            }
          }
        });
      }

      console.log(
        `Boss ${eventBossId} defeated! Winning team: ${
          winningTeam?.name || "None"
        }, MVP: ${mvpPlayer?.nickname || "None"}`
      );

      if (awardedBadges) {
        console.log(
          `🎖️ Badges awarded: MVP(${!!awardedBadges.mvp}), LastHit(${!!awardedBadges.lastHit}), BossDefeated(${
            awardedBadges.bossDefeated.length
          }), Milestones(${awardedBadges.milestones.length})`
        );
      }
    }
  } catch (error) {
    console.error("Error handling boss defeat:", error);

    // Still broadcast boss defeated even if badge awarding fails
    io.to(`boss-${eventBossId}`).emit("boss-defeated", {
      message: "Boss defeated!",
      error: "Badge awarding failed",
    });
  }
}

export default handleCombat;
