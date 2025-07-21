import {
  Leaderboard,
  User,
  PlayerSession,
  EventBoss,
} from "./src/models/index.js";
import "./src/config/db.js";

async function debugLeaderboardNames() {
  try {
    console.log("🔍 ===== LEADERBOARD NAME RESOLUTION DEBUG =====");

    // Get some leaderboard entries
    const entries = await Leaderboard.findAll({
      limit: 10,
      order: [["createdAt", "DESC"]],
    });

    console.log(`Found ${entries.length} leaderboard entries`);

    for (const entry of entries) {
      console.log(`\n📊 Entry ID: ${entry.id}`);
      console.log(`   Player ID: ${entry.playerId}`);
      console.log(`   EventBoss ID: ${entry.eventBossId}`);
      console.log(`   Damage: ${entry.totalDamageDealt}`);
      console.log(`   Correct: ${entry.totalCorrectAnswers}`);

      // Try to resolve name
      let resolvedName = "NOT_FOUND";
      let resolvedType = "NONE";

      // Try as User first
      const user = await User.findByPk(entry.playerId);
      if (user) {
        resolvedName = user.username;
        resolvedType = "USER";
        console.log(`   ✅ Resolved as User: ${resolvedName}`);
      } else {
        // Try as PlayerSession
        const playerSession = await PlayerSession.findByPk(entry.playerId);
        if (playerSession) {
          resolvedName = playerSession.username;
          resolvedType = "PLAYER_SESSION";
          console.log(`   ✅ Resolved as PlayerSession: ${resolvedName}`);
          console.log(`   Session User ID: ${playerSession.userId}`);
          console.log(`   Session Event ID: ${playerSession.eventId}`);
        } else {
          console.log(
            `   ❌ Could not resolve name for player ID: ${entry.playerId}`
          );
        }
      }

      console.log(`   Final: ${resolvedType} - ${resolvedName}`);
    }

    // Also check PlayerSession table
    console.log(`\n👤 ===== PLAYER SESSIONS DEBUG =====`);
    const playerSessions = await PlayerSession.findAll({
      limit: 10,
      order: [["createdAt", "DESC"]],
    });

    console.log(`Found ${playerSessions.length} player sessions`);
    for (const session of playerSessions) {
      console.log(`\n👤 Session ID: ${session.id}`);
      console.log(`   Username: ${session.username}`);
      console.log(`   User ID: ${session.userId}`);
      console.log(`   Event ID: ${session.eventId}`);
      console.log(`   Created: ${session.createdAt}`);
    }

    console.log(`\n🔍 ===== END DEBUG =====`);
  } catch (error) {
    console.error("❌ Debug error:", error);
  } finally {
    process.exit(0);
  }
}

debugLeaderboardNames();
