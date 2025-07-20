import sequelize from "./src/config/db.js";

async function recreateDatabase() {
  try {
    console.log("🗄️ Starting database recreation...");

    // Test connection
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    // Check for force flag
    const args = process.argv.slice(2);
    if (!args.includes("--force")) {
      console.log("\n⚠️  WARNING: This will DELETE ALL existing data!");
      console.log(
        "📋 This will recreate all tables with consistent UUID structure"
      );
      console.log(
        "💡 Use --force flag to proceed: node simple-recreate.js --force"
      );
      process.exit(0);
    }

    console.log("🔥 FORCE mode - recreating database...");

    // Drop and recreate all tables using sequelize sync
    await sequelize.sync({ force: true });
    console.log("✅ All tables recreated successfully!");

    // Show table structures
    console.log("\n📊 Checking key table structures...");

    const tables = ["user_badges", "leaderboards", "player_sessions"];
    for (const table of tables) {
      try {
        const [desc] = await sequelize.query(`DESCRIBE ${table};`);
        console.log(`\n🔍 ${table}:`);
        desc.forEach((col) => {
          console.log(
            `  ${col.Field}: ${col.Type} ${
              col.Null === "NO" ? "NOT NULL" : "NULL"
            }`
          );
        });
      } catch (error) {
        console.log(`  ❌ Error describing ${table}: ${error.message}`);
      }
    }

    console.log("\n🎉 Database recreation completed!");
    console.log(
      "📝 Next step: Run 'node init-badges.js' to create default badges"
    );
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

recreateDatabase();
