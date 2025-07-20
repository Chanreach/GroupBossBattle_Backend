// ===== ENHANCED BOSS BATTLE TEST CLIENT ===== //
// Test our enhanced boss battle system with real-time combat

import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

// Test data
const testEventBossId = "test-boss-battle-2025";
const testPlayers = [
  { id: "player1", nickname: "Alice", socketId: "socket1" },
  { id: "player2", nickname: "Bob", socketId: "socket2" },
  { id: "player3", nickname: "Charlie", socketId: "socket3" },
];

console.log("🚀 Starting Enhanced Boss Battle System Test...");

// Test sequence
socket.on("connect", () => {
  console.log("✅ Connected to server");

  // Test 1: Join boss battle directly (this will create session if needed)
  console.log("\n📝 Test 1: Joining boss battle...");
  socket.emit("join-boss", {
    eventBossId: testEventBossId,
    playerName: "TestPlayer",
    playerId: "test-player-1",
  });
});

// Listen for boss join confirmations
socket.on("boss-joined", (data) => {
  console.log("👤 Boss joined confirmed:", data);

  console.log("\n⚔️ Test 2: Starting combat simulation...");
  setTimeout(() => {
    console.log("� Requesting first question...");
    socket.emit("request-question", {
      eventBossId: testEventBossId,
    });
  }, 1000);
});

// Listen for session updates
socket.on("session-debug", (data) => {
  console.log("🔍 Session Debug Info:", JSON.stringify(data, null, 2));
});

// Listen for questions
socket.on("question-received", (data) => {
  console.log("❓ Question received:", {
    questionId: data.question.id,
    text: data.question.text,
    choices: data.question.choices,
    timeLimit: data.question.timeLimit,
    battleStatus: data.battleStatus,
  });

  // Simulate answering after 2 seconds (FAST response)
  setTimeout(() => {
    console.log("📝 Submitting answer...");
    socket.emit("submit-answer", {
      eventBossId: testEventBossId,
      questionId: data.question.id,
      choiceIndex: data.question.correctIndex, // Correct answer
      responseTime: 2000, // 2 seconds - should be FAST
    });
  }, 2000);
});

// Listen for answer results
socket.on("answer-result", (data) => {
  console.log("🎯 Answer Result:", {
    isCorrect: data.isCorrect,
    damage: data.damage,
    responseCategory: data.responseCategory,
    battleStatus: data.battleStatus,
    message: data.message,
  });

  // Request another question if we want to continue testing
  if (data.isCorrect && data.battleStatus.bossCurrentHp > 0) {
    setTimeout(() => {
      console.log("🔄 Requesting next question...");
      socket.emit("request-question", {
        eventBossId: testEventBossId,
      });
    }, 2000);
  }
});

// Listen for attack broadcasts
socket.on("player-attacked", (data) => {
  console.log("💥 Player Attack Broadcast:", {
    player: data.playerNickname,
    teamId: data.teamId,
    damage: data.damage,
    responseCategory: data.responseCategory,
    bossHp: `${data.bossCurrentHp}/${data.bossMaxHp}`,
    bossHpPercentage: data.bossHpPercentage,
  });
});

// Listen for boss defeated
socket.on("boss-defeated", (data) => {
  console.log("🏆 BOSS DEFEATED!", {
    winningTeam: data.winningTeam,
    finalHitBy: data.finalHitBy,
    nextBattleIn: data.nextBattleIn,
  });
});

// Listen for player status updates
socket.on("player-status-update", (data) => {
  console.log("👤 Player Status Update:", data);
});

// Error handling
socket.on("error", (error) => {
  console.error("❌ Socket Error:", error);
  console.log("💡 This might be because:");
  console.log("   - Player session not found (need to join first)");
  console.log("   - Invalid eventBossId");
  console.log("   - Session not created properly");
});

socket.on("join-error", (error) => {
  console.error("❌ Join Error:", error);
  console.log("💡 This might be because:");
  console.log("   - Session doesn't exist");
  console.log("   - Invalid player data");
  console.log("   - Boss battle not active");
});

// Handle disconnection
socket.on("disconnect", () => {
  console.log("🔌 Disconnected from server");
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down test client...");
  socket.disconnect();
  process.exit(0);
});

console.log("⏳ Test client ready. Connecting to server...");
