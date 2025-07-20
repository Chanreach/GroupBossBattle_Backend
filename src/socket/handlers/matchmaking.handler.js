import {
  EventBoss,
  Boss,
  Category,
  Question,
  AnswerChoice,
  Event,
} from "../../models/index.js";
import bossSessionManager from "../managers/boss-session.manager.js";
import { GAME_CONSTANTS } from "../../utils/game.constants.js";

const handleMatchmaking = (io, socket) => {
  // Join boss preview (when player scans QR and enters the preview page)
  socket.on("boss-preview:join", async (data) => {
    try {
      const { eventBossId, joinCode } = data;

      if (!eventBossId || !joinCode) {
        socket.emit("error", { message: "Missing required data" });
        return;
      }
      const boss = await EventBoss.findOne({
        where: { id: eventBossId, joinCode },
      });
      if (!boss) {
        socket.emit("error", { message: "Boss not found" });
        return;
      }

      socket.join(`boss-${eventBossId}`);

      // Get current session data and send to the new viewer
      const session = bossSessionManager.getSession(eventBossId);
      const sessionData = session
        ? {
            eventBossId: session.eventBossId,
            bossData: session.bossData,
            playersNeededToStart:
              GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED - session.players.size,
            playerCount: session.players.size,
            isStarted: session.isStarted,
            canStart: bossSessionManager.canStartBattle(eventBossId),
          }
        : {
            eventBossId: eventBossId,
            bossData: null,
            playersNeededToStart: GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED,
            playerCount: 0,
            isStarted: false,
            canStart: false,
          };

      socket.emit("boss-preview:joined", {
        message: "Successfully joined boss preview",
        session: sessionData,
      });
    } catch (error) {
      console.error("Error in boss-preview:join:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });

  socket.on("boss-fight:join", async (data) => {
    try {
      const { eventBossId, joinCode, playerData } = data;

      if (!eventBossId || !joinCode || !playerData) {
        socket.emit("error", { message: "Missing required data" });
        return;
      }

      // Get boss information including categories and their questions
      const boss = await EventBoss.findOne({
        where: { id: eventBossId, joinCode },
        include: [
          {
            model: Boss,
            as: "boss",
            include: [
              {
                model: Category,
                as: "Categories",
                include: [
                  {
                    model: Question,
                    as: "questions",
                    include: [
                      {
                        model: AnswerChoice,
                        as: "answerChoices",
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            model: Event,
            as: "event",
          },
        ],
      });
      console.log("Boss data fetched:", boss);
      if (!boss) {
        socket.emit("error", { message: "Boss not found" });
        return;
      }

      // Extract questions and answer choices
      const questionsData = boss.boss.Categories.map((category) => ({
        categoryId: category.id,
        categoryName: category.name,
        questions: category.questions.map((question) => ({
          questionId: question.id,
          questionText: question.questionText,
          timeLimit: question.timeLimit,
          answerChoices: question.answerChoices.map((choice) => ({
            choiceId: choice.id,
            choiceText: choice.choiceText,
            isCorrect: choice.isCorrect,
          })),
        })),
      }));

      const bossData = {
        id: boss.id,
        name: boss.boss.name,
        cooldownDuration: boss.cooldownDuration,
        numberOfTeams: boss.numberOfTeams,
        questionsData: questionsData,
      };

      // Create or get session
      const session = bossSessionManager.createSession(eventBossId, bossData);
      if (!session) {
        socket.emit("nickname-check-response", {
          success: false,
          message: "Boss session not found",
        });
        return;
      }

      // Check nickname uniqueness
      if (
        !bossSessionManager.isNicknameUnique(eventBossId, playerData.nickname)
      ) {
        socket.emit("nickname-check-response", {
          success: false,
          message:
            "This nickname is already taken in this session. Please choose a different one.",
        });
        return;
      }

      // Add player to session
      const result = await bossSessionManager.addPlayer(
        eventBossId,
        socket.id,
        playerData
      );

      if (!result) {
        socket.emit("nickname-check-response", {
          success: false,
          message: "Failed to join session",
        });
        return;
      }

      socket.join(`boss-${eventBossId}`);

      // Send success response
      socket.emit("nickname-check-response", {
        success: true,
        message: "Successfully joined boss fight",
      });

      socket.emit("boss-fight:joined", {
        message: "Successfully joined boss fight",
        player: {
          id: result.player.id,
          nickname: result.player.nickname,
          userId: result.player.userId,
          username: result.player.username,
          isGuest: result.player.isGuest,
          hearts: result.player.hearts,
          status: result.player.status,
          teamId: result.player.teamId,
        },
        session: {
          eventBossId: session.eventBossId,
          bossData: session.bossData,
          playersNeededToStart:
            GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED - session.players.size,
          playerCount: session.players.size,
          isStarted: session.isStarted,
          canStart: bossSessionManager.canStartBattle(eventBossId),
        },
      });

      io.to(`boss-${eventBossId}`).emit("player-count:updated", {
        session: {
          eventBossId: session.eventBossId,
          bossData: session.bossData,
          playersNeededToStart:
            GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED - session.players.size,
          playerCount: session.players.size,
          isStarted: session.isStarted,
          canStart: bossSessionManager.canStartBattle(eventBossId),
        },
        player: result.player,
      });

      if (session.isStarted) {
        socket.emit("battle:already-started", {
          message: "Battle has already started",
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

        // Send team information for mid-game join ONLY
        if (result.player.teamId) {
          bossSessionManager.sendTeamInfoToPlayer(
            io,
            eventBossId,
            result.player.id,
            "mid-game-join-preview"
          );
        }

        // Send current battle status to the new player for immediate HP sync
        socket.emit("battle-status-sync", {
          bossCurrentHp: session.bossData.currentHp,
          bossMaxHp: session.bossData.maxHp,
          bossHpPercentage: (
            (session.bossData.currentHp / session.bossData.maxHp) *
            100
          ).toFixed(1),
        });

        // **NEW: Notify all other players about the new player joining**
        const team = session.teams.get(result.player.teamId);
        socket.to(`boss-${eventBossId}`).emit("player:joined-battle", {
          message: `${result.player.nickname} joined the battle and increased boss HP!`,
          playerNickname: result.player.nickname,
          teamName: team?.name || `Team ${result.player.teamId}`,
          bossCurrentHp: session.bossData.currentHp,
          bossMaxHp: session.bossData.maxHp,
        });

        return;
      }

      // Check if there are enough players to start the battle
      if (bossSessionManager.canStartBattle(eventBossId)) {
        console.log(
          "🎮 =============== BATTLE START CONDITION CHECK ==============="
        );
        console.log(
          `✅ Minimum players met: ${session.players.size}/${GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED}`
        );
        console.log(`🔄 Session started: ${session.isStarted}`);
        console.log(
          `❄️ Cooldown status: ${
            session.bossData.cooldownUntil ? "Active" : "None"
          }`
        );

        // Notify players that countdown has started
        io.to(`boss-${eventBossId}`).emit("battle:countdown-started", {
          message: "Battle countdown started! Get ready!",
          eventBossId: eventBossId,
        });
        console.log("🚀 Starting battle now...");

        // Start the battle
        const battleStartResult = await bossSessionManager.startBossFight(
          eventBossId
        );

        if (battleStartResult && battleStartResult.success) {
          // Prepare session data for battle:start event
          const battleStartData = {
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
          };

          // Notify all players that battle has started
          io.to(`boss-${eventBossId}`).emit("battle:start", battleStartData);

          // Notify all players in the boss preview room about status change
          io.to(`boss-${eventBossId}`).emit("boss-status:updated", {
            status: "in-battle",
            eventBossId: eventBossId,
          });

          // Use centralized team info sending
          bossSessionManager.sendTeamInfoToAllPlayers(
            io,
            eventBossId,
            "battle-start"
          );
        }
      } else {
        console.log(
          "⏳ =============== BATTLE START REQUIREMENT NOT MET ==============="
        );
        console.log(
          `❌ Current players: ${session.players.size}/${GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED}`
        );
        console.log(`🔄 Session started: ${session.isStarted}`);
        console.log(
          `❄️ Cooldown status: ${
            session.bossData.cooldownUntil ? "Active" : "None"
          }`
        );
        console.log("⏳ Waiting for more players...");
      }
    } catch (error) {
      console.error("Error in boss-fight:join:", error);
      socket.emit("error", { message: "Internal server error" });
    }
  });

  // **NEW: Handle player reconnection**
  socket.on("boss-fight:reconnect", async (data) => {
    try {
      const { eventBossId, joinCode, userInfo } = data;

      if (!eventBossId || !joinCode || !userInfo) {
        socket.emit("error", { message: "Missing required data" });
        return;
      }

      // Verify boss exists
      const boss = await EventBoss.findOne({
        where: { id: eventBossId, joinCode },
      });
      if (!boss) {
        socket.emit("error", { message: "Boss not found" });
        return;
      }

      // Attempt reconnection
      const reconnectResult = bossSessionManager.reconnectPlayer(
        eventBossId,
        socket.id,
        userInfo
      );

      if (reconnectResult && reconnectResult.success) {
        // **JOIN SOCKET ROOM**
        socket.join(`boss-${eventBossId}`);

        // Send reconnection success with full session data
        socket.emit("boss-fight:reconnected", {
          message: "Successfully reconnected to boss fight",
          session: {
            eventBossId: reconnectResult.session.eventBossId,
            bossData: reconnectResult.session.bossData,
            isStarted: reconnectResult.session.isStarted,
            playerCount: reconnectResult.session.players.size,
            teams: Array.from(reconnectResult.session.teams.values()).map(
              (team) => ({
                id: team.id,
                name: team.name,
                playerCount: team.players.size,
                totalDamage: team.totalDamage,
              })
            ),
            players: Array.from(reconnectResult.session.players.values()).map(
              (p) => ({
                id: p.id,
                nickname: p.nickname,
                teamId: p.teamId,
                hearts: p.hearts,
                status: p.status,
              })
            ),
          },
          player: {
            id: reconnectResult.player.id,
            nickname: reconnectResult.player.nickname,
            teamId: reconnectResult.player.teamId,
            hearts: reconnectResult.player.hearts,
            status: reconnectResult.player.status,
          },
        });

        // Send team info if player has been assigned to a team
        if (reconnectResult.player.teamId) {
          bossSessionManager.sendTeamInfoToPlayer(
            io,
            eventBossId,
            reconnectResult.player.id,
            "reconnect"
          );
        }

        // Notify other players about the reconnection
        socket.to(`boss-${eventBossId}`).emit("player-reconnected", {
          player: {
            nickname: reconnectResult.player.nickname,
            teamId: reconnectResult.player.teamId,
          },
          playerCount: reconnectResult.session.players.size,
        });
      } else {
        // Silent fail - don't emit error for failed reconnection attempts
      }
    } catch (error) {
      console.error("Error in boss-fight:reconnect:", error);
      // Silent fail for reconnection errors
    }
  });

  // Player confirms they want to join the battle
  // socket.on("join-boss-fight", async (data) => {
  //   try {
  //     const { eventBossId } = data;
  //     const playerSession = bossSessionManager.getPlayerSession(socket.id);

  //     if (!playerSession || playerSession.eventBossId !== eventBossId) {
  //       socket.emit("error", { message: "Player session not found" });
  //       return;
  //     }

  //     const session = bossSessionManager.getSession(eventBossId);
  //     if (!session) {
  //       socket.emit("error", { message: "Boss session not found" });
  //       return;
  //     }

  //     // Check if boss is on cooldown
  //     if (
  //       session.bossData.cooldownUntil &&
  //       new Date() < session.bossData.cooldownUntil
  //     ) {
  //       const remainingTime = Math.ceil(
  //         (session.bossData.cooldownUntil - new Date()) / 1000
  //       );
  //       socket.emit("boss-on-cooldown", {
  //         message: "Boss is on cooldown",
  //         remainingTime,
  //       });
  //       return;
  //     }

  //     // Check if battle is already started
  //     if (session.isStarted) {
  //       socket.emit("error", { message: "Battle already in progress" });
  //       return;
  //     }

  //     // Player is ready to fight
  //     const player = session.players.get(playerSession.playerId);
  //     if (player) {
  //       player.status = "ready";
  //     }

  //     socket.emit("joined-boss-fight", {
  //       message: "Ready to fight! Waiting for other players...",
  //       session: {
  //         eventBossId: session.eventBossId,
  //         bossData: session.bossData,
  //         playerCount: session.players.size,
  //       },
  //     });

  //     // Check if we can start the battle
  //     if (bossSessionManager.canStartBattle(eventBossId)) {
  //       // Start the battle
  //       const battleStartResult = await bossSessionManager.startBossFight(
  //         eventBossId
  //       );

  //       if (battleStartResult && battleStartResult.success) {
  //         // Notify all players that battle has started
  //         io.to(`boss-${eventBossId}`).emit("battle-started", {
  //           session: {
  //             eventBossId: session.eventBossId,
  //             bossData: session.bossData,
  //             teams: Array.from(session.teams.values()).map((team) => ({
  //               id: team.id,
  //               name: team.name,
  //               playerCount: team.players.size,
  //               totalDamage: team.totalDamage,
  //             })),
  //             players: Array.from(session.players.values()).map((p) => ({
  //               id: p.id,
  //               nickname: p.nickname,
  //               teamId: p.teamId,
  //               hearts: p.hearts,
  //               status: p.status,
  //             })),
  //           },
  //           questionPoolAssignments: battleStartResult.questionPoolAssignments,
  //         });

  //         console.log(`Battle started for boss ${eventBossId}`);
  //       }
  //     }
  //   } catch (error) {
  //     console.error("Error in join-boss-fight:", error);
  //     socket.emit("error", { message: "Internal server error" });
  //   }
  // });

  // Player leaves the session
  socket.on("leave-boss-session", () => {
    const playerSession = bossSessionManager.getPlayerSession(socket.id);
    if (playerSession) {
      const { eventBossId } = playerSession;

      // Leave socket room
      socket.leave(`boss-${eventBossId}`);

      // Remove player from session
      const removedPlayer = bossSessionManager.removePlayer(socket.id);

      // Notify remaining players about updated count
      const session = bossSessionManager.getSession(eventBossId);
      if (session) {
        io.to(`boss-${eventBossId}`).emit("player-count:updated", {
          session: {
            eventBossId: session.eventBossId,
            bossData: session.bossData,
            playersNeededToStart:
              GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED - session.players.size,
            playerCount: session.players.size,
            isStarted: session.isStarted,
            canStart: bossSessionManager.canStartBattle(eventBossId),
          },
        });
      }

      socket.emit("left-boss-session", {
        success: true,
        message: "Successfully left boss session",
      });
    } else {
      socket.emit("left-boss-session", {
        success: false,
        message: "No active session found",
      });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const playerSession = bossSessionManager.getPlayerSession(socket.id);
    if (playerSession) {
      const { eventBossId, nickname } = playerSession;

      // Remove player from session
      bossSessionManager.removePlayer(socket.id);

      // Notify remaining players
      const session = bossSessionManager.getSession(eventBossId);
      if (session) {
        io.to(`boss-${eventBossId}`).emit("player-disconnected", {
          nickname,
          playerCount: session.players.size,
          canStart: bossSessionManager.canStartBattle(eventBossId),
        });

        // Also emit player-count:updated for consistency
        io.to(`boss-${eventBossId}`).emit("player-count:updated", {
          session: {
            eventBossId: session.eventBossId,
            bossData: session.bossData,
            playersNeededToStart:
              GAME_CONSTANTS.MINIMUM_PLAYERS_REQUIRED - session.players.size,
            playerCount: session.players.size,
            isStarted: session.isStarted,
            canStart: bossSessionManager.canStartBattle(eventBossId),
          },
        });
      }
    }
  });
};

export default handleMatchmaking;
