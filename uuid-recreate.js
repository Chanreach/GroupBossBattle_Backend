import sequelize from "./src/config/db.js";

async function recreateWithExplicitUUIDs() {
  try {
    console.log("🗄️ Recreating database with explicit UUID structure...");

    await sequelize.authenticate();
    console.log("✅ Database connection established");

    const args = process.argv.slice(2);
    if (!args.includes("--force")) {
      console.log("\n⚠️  WARNING: This will DELETE ALL existing data!");
      console.log(
        "💡 Use --force flag to proceed: node uuid-recreate.js --force"
      );
      process.exit(0);
    }

    console.log("🔥 Dropping all tables...");

    // Disable foreign key checks
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0;");

    const tablesToDrop = [
      "user_badges",
      "leaderboards",
      "player_sessions",
      "question_attempts",
      "answer_choices",
      "questions",
      "teams",
      "event_bosses",
      "events",
      "badges",
      "bosses",
      "categories",
      "users",
    ];

    for (const table of tablesToDrop) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS ${table};`);
        console.log(`  ✅ Dropped ${table}`);
      } catch (error) {
        console.log(`  ⚠️ Could not drop ${table}`);
      }
    }

    console.log("\n🏗️ Creating tables with explicit CHAR(36) UUIDs...");

    // Create badges table first (no dependencies)
    await sequelize.query(`
      CREATE TABLE badges (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        image VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    console.log("  ✅ Created badges table");

    // Create events table
    await sequelize.query(`
      CREATE TABLE events (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        start_time DATETIME NOT NULL,
        end_time DATETIME NOT NULL,
        status ENUM('upcoming', 'ongoing', 'completed') NOT NULL DEFAULT 'upcoming',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    console.log("  ✅ Created events table");

    // Create users table
    await sequelize.query(`
      CREATE TABLE users (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        profile_picture VARCHAR(255),
        role ENUM('student', 'instructor', 'admin') NOT NULL DEFAULT 'student',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    console.log("  ✅ Created users table");

    // Create bosses table
    await sequelize.query(`
      CREATE TABLE bosses (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        image VARCHAR(255),
        health INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `);
    console.log("  ✅ Created bosses table");

    // Create event_bosses table
    await sequelize.query(`
      CREATE TABLE event_bosses (
        id CHAR(36) PRIMARY KEY,
        event_id CHAR(36) NOT NULL,
        boss_id CHAR(36) NOT NULL,
        join_code VARCHAR(255) UNIQUE NOT NULL,
        cooldown_duration INTEGER NOT NULL DEFAULT 60,
        number_of_teams INTEGER NOT NULL DEFAULT 2,
        time_limit INTEGER NOT NULL DEFAULT 120,
        current_health INTEGER NOT NULL,
        status ENUM('waiting', 'active', 'defeated', 'expired') NOT NULL DEFAULT 'waiting',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (boss_id) REFERENCES bosses(id) ON DELETE CASCADE,
        INDEX idx_event_id (event_id),
        INDEX idx_boss_id (boss_id)
      );
    `);
    console.log("  ✅ Created event_bosses table");

    // Create player_sessions table (based on your updated model)
    await sequelize.query(`
      CREATE TABLE player_sessions (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NULL,
        username VARCHAR(255) NOT NULL,
        event_id CHAR(36) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_event_id (event_id)
      );
    `);
    console.log("  ✅ Created player_sessions table");

    // Create leaderboards table (based on your updated model)
    await sequelize.query(`
      CREATE TABLE leaderboards (
        id CHAR(36) PRIMARY KEY,
        player_id CHAR(36) NOT NULL,
        total_damage_dealt INTEGER NOT NULL DEFAULT 0,
        total_correct_answers INTEGER NOT NULL DEFAULT 0,
        event_boss_id CHAR(36) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (event_boss_id) REFERENCES event_bosses(id) ON DELETE CASCADE,
        INDEX idx_player_id (player_id),
        INDEX idx_event_boss_id (event_boss_id),
        INDEX idx_total_damage_dealt (total_damage_dealt),
        INDEX idx_total_correct_answers (total_correct_answers)
      );
    `);
    console.log("  ✅ Created leaderboards table");

    // Create user_badges table (based on your updated model)
    await sequelize.query(`
      CREATE TABLE user_badges (
        id CHAR(36) PRIMARY KEY,
        player_id CHAR(36) NOT NULL,
        badge_id CHAR(36) NOT NULL,
        event_boss_id CHAR(36) NULL,
        event_id CHAR(36) NOT NULL,
        earned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
        FOREIGN KEY (event_boss_id) REFERENCES event_bosses(id) ON DELETE CASCADE,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        INDEX idx_player_id (player_id),
        INDEX idx_badge_id (badge_id),
        INDEX idx_event_boss_id (event_boss_id),
        INDEX idx_event_id (event_id)
      );
    `);
    console.log("  ✅ Created user_badges table");

    // Re-enable foreign key checks
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1;");

    console.log("\n📊 Verifying table structures...");

    const tables = ["user_badges", "leaderboards", "player_sessions"];
    for (const table of tables) {
      const [desc] = await sequelize.query(`DESCRIBE ${table};`);
      console.log(`\n🔍 ${table}:`);
      desc.forEach((col) => {
        const keyInfo = col.Key ? `[${col.Key}]` : "";
        console.log(
          `  ${col.Field}: ${col.Type} ${
            col.Null === "NO" ? "NOT NULL" : "NULL"
          } ${keyInfo}`
        );
      });
    }

    console.log("\n🎉 Database recreated with consistent CHAR(36) UUIDs!");
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

recreateWithExplicitUUIDs();
