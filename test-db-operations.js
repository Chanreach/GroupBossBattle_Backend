import { v4 as uuidv4 } from "uuid";
import { PlayerSession, Leaderboard } from "./src/models/index.js";

// Test script to verify our database operations work correctly
async function testDatabaseOperations() {
  console.log("🧪 Testing database operations...");

  const testEventId = uuidv4();
  const testEventBossId = uuidv4();
  const testUserId = uuidv4();

  try {
    // Test 1: Create PlayerSession
    console.log("\n1. Testing PlayerSession creation...");
    const playerSession = await PlayerSession.create({
      id: uuidv4(),
      userId: testUserId,
      username: "testplayer",
      eventId: testEventId,
    });
    console.log("✅ PlayerSession created:", playerSession.id);

    // Test 2: Check for existing PlayerSession
    const existingSession = await PlayerSession.findOne({
      where: {
        userId: testUserId,
        eventId: testEventId,
        username: "testplayer",
      },
    });
    console.log("✅ PlayerSession found:", !!existingSession);

    // Test 3: Create Leaderboard entry
    console.log("\n2. Testing Leaderboard creation...");
    const [leaderboardEntry, created] = await Leaderboard.findOrCreate({
      where: {
        playerId: playerSession.id,
        eventBossId: testEventBossId,
      },
      defaults: {
        id: uuidv4(),
        playerId: playerSession.id,
        eventBossId: testEventBossId,
        totalDamageDealt: 100,
        totalCorrectAnswers: 5,
      },
    });
    console.log("✅ Leaderboard entry created:", created);
    console.log("   Entry ID:", leaderboardEntry.id);

    // Test 4: Update Leaderboard entry
    console.log("\n3. Testing Leaderboard update...");
    await leaderboardEntry.update({
      totalDamageDealt: 200,
      totalCorrectAnswers: 10,
    });
    console.log("✅ Leaderboard entry updated");

    // Test 5: Query Leaderboard
    console.log("\n4. Testing Leaderboard query...");
    const leaderboardEntries = await Leaderboard.findAll({
      where: { eventBossId: testEventBossId },
      order: [["totalDamageDealt", "DESC"]],
    });
    console.log(
      "✅ Leaderboard query successful, entries:",
      leaderboardEntries.length
    );

    // Cleanup
    console.log("\n5. Cleaning up test data...");
    await Leaderboard.destroy({ where: { eventBossId: testEventBossId } });
    await PlayerSession.destroy({ where: { eventId: testEventId } });
    console.log("✅ Test data cleaned up");

    console.log("\n🎉 All database operations test passed!");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Full error:", error);
  }
}

// Run the test
testDatabaseOperations()
  .then(() => {
    console.log("Test completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Test script error:", error);
    process.exit(1);
  });
