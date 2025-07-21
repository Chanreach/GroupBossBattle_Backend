import LeaderboardService from "./src/services/leaderboard.service.js";
import { sequelize } from "./src/models/index.js";

// Test script to verify our LeaderboardService fixes work correctly
async function testLeaderboardService() {
  console.log("🧪 Testing LeaderboardService methods...");

  try {
    // Test the getAllTimeLeaderboard method (the one that was failing)
    console.log("\n1. Testing getAllTimeLeaderboard...");
    const allTimeLeaderboard = await LeaderboardService.getAllTimeLeaderboard();
    console.log(
      "✅ getAllTimeLeaderboard works! Entries found:",
      allTimeLeaderboard.length
    );

    if (allTimeLeaderboard.length > 0) {
      console.log("Sample entry:", {
        playerId: allTimeLeaderboard[0].playerId,
        playerName: allTimeLeaderboard[0].playerName,
        totalDamageDealt: allTimeLeaderboard[0].totalDamageDealt,
        totalCorrectAnswers: allTimeLeaderboard[0].totalCorrectAnswers,
      });
    }

    // Test other methods
    console.log(
      "\n2. Testing getBossSpecificLeaderboard with dummy eventBossId..."
    );
    const dummyEventBossId = "00000000-0000-0000-0000-000000000000";
    const bossLeaderboard = await LeaderboardService.getBossSpecificLeaderboard(
      "dummy",
      dummyEventBossId,
      10
    );
    console.log(
      "✅ getBossSpecificLeaderboard works! Entries found:",
      bossLeaderboard.length
    );

    console.log(
      "\n3. Testing getEventOverallLeaderboard with dummy eventId..."
    );
    const dummyEventId = "00000000-0000-0000-0000-000000000000";
    const eventLeaderboard =
      await LeaderboardService.getEventOverallLeaderboard(dummyEventId, 10);
    console.log(
      "✅ getEventOverallLeaderboard works! Entries found:",
      eventLeaderboard.length
    );

    console.log("\n🎉 All LeaderboardService tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Full error:", error);
  } finally {
    // Close database connection
    await sequelize.close();
  }
}

// Run the test
testLeaderboardService()
  .then(() => {
    console.log("Test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test script error:", error);
    process.exit(1);
  });
