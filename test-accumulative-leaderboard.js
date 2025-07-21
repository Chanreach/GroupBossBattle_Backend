import { Leaderboard, PlayerSession, EventBoss } from "./src/models/index.js";
import "./src/config/db.js";
import { v4 as uuidv4 } from "uuid";

async function testAccumulativeLeaderboard() {
  try {
    console.log("🧪 ===== TESTING ACCUMULATIVE LEADERBOARD =====");

    // Test scenario: Same player plays same boss fight twice
    const testPlayerId = uuidv4();
    const testEventBossId = "4b193084-d104-4138-8592-f261e03402cc"; // Use existing eventBoss

    console.log(`\n📊 Testing player: ${testPlayerId}`);
    console.log(`📊 Testing eventBoss: ${testEventBossId}`);

    // Simulate first battle session
    console.log(`\n🎮 === FIRST BATTLE SESSION ===`);
    const [entry1, created1] = await Leaderboard.findOrCreate({
      where: {
        playerId: testPlayerId,
        eventBossId: testEventBossId,
      },
      defaults: {
        id: uuidv4(),
        playerId: testPlayerId,
        eventBossId: testEventBossId,
        totalDamageDealt: 50, // First session: 50 damage
        totalCorrectAnswers: 10, // First session: 10 correct
      },
    });

    console.log(`✅ First session: created=${created1}`);
    console.log(
      `   Damage: ${entry1.totalDamageDealt}, Correct: ${entry1.totalCorrectAnswers}`
    );

    // Simulate second battle session (same player, same boss)
    console.log(`\n🎮 === SECOND BATTLE SESSION ===`);
    const [entry2, created2] = await Leaderboard.findOrCreate({
      where: {
        playerId: testPlayerId,
        eventBossId: testEventBossId,
      },
      defaults: {
        id: uuidv4(),
        playerId: testPlayerId,
        eventBossId: testEventBossId,
        totalDamageDealt: 30, // Second session: 30 damage
        totalCorrectAnswers: 8, // Second session: 8 correct
      },
    });

    if (!created2) {
      // Add session 2 values to existing values (accumulative)
      await entry2.update({
        totalDamageDealt: entry2.totalDamageDealt + 30, // 50 + 30 = 80
        totalCorrectAnswers: entry2.totalCorrectAnswers + 8, // 10 + 8 = 18
      });
    }

    console.log(`✅ Second session: created=${created2}`);
    console.log(
      `   Final Damage: ${entry2.totalDamageDealt}, Final Correct: ${entry2.totalCorrectAnswers}`
    );

    // Verify final results
    const finalEntry = await Leaderboard.findOne({
      where: {
        playerId: testPlayerId,
        eventBossId: testEventBossId,
      },
    });

    console.log(`\n🏆 === FINAL VERIFICATION ===`);
    console.log(`   Player ID: ${finalEntry.playerId}`);
    console.log(
      `   Total Damage: ${finalEntry.totalDamageDealt} (expected: 80)`
    );
    console.log(
      `   Total Correct: ${finalEntry.totalCorrectAnswers} (expected: 18)`
    );

    const expectedDamage = 80;
    const expectedCorrect = 18;

    if (
      finalEntry.totalDamageDealt === expectedDamage &&
      finalEntry.totalCorrectAnswers === expectedCorrect
    ) {
      console.log(`✅ TEST PASSED: Accumulative leaderboard works correctly!`);
    } else {
      console.log(
        `❌ TEST FAILED: Expected ${expectedDamage}/${expectedCorrect}, got ${finalEntry.totalDamageDealt}/${finalEntry.totalCorrectAnswers}`
      );
    }

    // Cleanup test data
    await Leaderboard.destroy({
      where: {
        playerId: testPlayerId,
        eventBossId: testEventBossId,
      },
    });
    console.log(`🧹 Cleaned up test data`);
  } catch (error) {
    console.error("❌ Test error:", error);
  } finally {
    process.exit(0);
  }
}

testAccumulativeLeaderboard();
