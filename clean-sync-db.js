import { sequelize } from "./src/models/index.js";

/**
 * Clean Database Sync Script
 *
 * This script will drop the entire database and recreate it
 * with all models using consistent UUID structure.
 *
 * ⚠️ WARNING: This will DELETE ALL existing data!
 *
 * Usage:
 *   node clean-sync-db.js --force
 */

async function cleanSyncDatabase() {
  try {
    console.log("🗄️ Starting clean database synchronization...");

    // Test connection
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    // Check command line arguments
    const args = process.argv.slice(2);
    if (!args.includes("--force")) {
      console.log("\n⚠️  WARNING: This will DELETE ALL existing data!");
      console.log(
        "📋 This will recreate all tables with consistent UUID structure:"
      );
      console.log("  - users (id: UUID)");
      console.log("  - events (id, creator_id: UUID)");
      console.log("  - bosses (id, creator_id: UUID)");
      console.log("  - categories (id, creator_id: UUID)");
      console.log("  - questions (id, category_id, author_id: UUID)");
      console.log("  - answer_choices (id, question_id: UUID)");
      console.log("  - event_bosses (id, event_id, boss_id: UUID)");
      console.log("  - player_sessions (id, user_id, event_id: UUID)");
      console.log("  - badges (id: UUID)");
      console.log(
        "  - user_badges (id, player_id, badge_id, event_boss_id, event_id: UUID)"
      );
      console.log("  - leaderboards (id, player_id, event_boss_id: UUID)");
      console.log(
        "  - boss_categories (junction table with UUID foreign keys)"
      );
      console.log(
        "\n💡 Use --force flag to proceed: node clean-sync-db.js --force"
      );
      return;
    }

    console.log(
      "\n🔥 FORCE mode enabled - dropping database and recreating..."
    );

    // Drop the entire database and recreate it
    await dropAndRecreateDatabase();

    // Sync all models (this will create tables based on our model definitions)
    console.log("\n🏗️ Creating tables from model definitions...");
    await sequelize.sync({ force: true });

    console.log("✅ All tables created successfully!");

    // Verify table structures
    await verifyTableStructures();

    console.log("\n🎉 Database synchronization completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("  1. Run: node init-badges.js");
    console.log("  2. Test the system with some sample data");
  } catch (error) {
    console.error("❌ Error during database synchronization:", error.message);
    console.error("Stack:", error.stack);
  } finally {
    await sequelize.close();
  }
}

async function dropAndRecreateDatabase() {
  console.log("🗑️ Dropping database 'group_boss_battle'...");

  try {
    // Drop the database
    await sequelize.query("DROP DATABASE IF EXISTS group_boss_battle;");
    console.log("✅ Database dropped");

    // Recreate the database
    await sequelize.query("CREATE DATABASE group_boss_battle;");
    console.log("✅ Database recreated");

    // Use the database
    await sequelize.query("USE group_boss_battle;");
    console.log("✅ Using group_boss_battle database");
  } catch (error) {
    console.error("❌ Error dropping/recreating database:", error.message);
    throw error;
  }
}

async function verifyTableStructures() {
  console.log("\n📊 Verifying table structures...");

  const tablesToCheck = [
    "users",
    "events",
    "bosses",
    "categories",
    "questions",
    "answer_choices",
    "event_bosses",
    "player_sessions",
    "badges",
    "user_badges",
    "leaderboards",
  ];

  for (const table of tablesToCheck) {
    try {
      const [desc] = await sequelize.query(`DESCRIBE ${table};`);
      console.log(`\n🔍 ${table} structure:`);
      desc.forEach((col) => {
        const keyInfo = col.Key ? `[${col.Key}]` : "";
        const nullInfo = col.Null === "NO" ? "NOT NULL" : "NULL";
        const extra = col.Extra ? `{${col.Extra}}` : "";
        console.log(
          `  ${col.Field}: ${col.Type} ${nullInfo} ${keyInfo} ${extra}`
        );
      });

      // Count UUID fields in the table
      const uuidFields = desc.filter(
        (col) =>
          col.Type.includes("char(36)") ||
          (col.Type.includes("varchar(255)") && col.Field.includes("id"))
      );
      console.log(`  📊 UUID fields: ${uuidFields.length}`);
    } catch (error) {
      console.log(`  ❌ Could not describe ${table}: ${error.message}`);
    }
  }
}

// Run the clean sync
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanSyncDatabase();
}
