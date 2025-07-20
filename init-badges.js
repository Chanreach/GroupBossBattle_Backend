import BadgeService from "./src/services/badge.service.js";
import { sequelize } from "./src/config/db.js";

/**
 * Initialize Default Badges Script
 *
 * This script creates the default badges in the database.
 * Run this script once after setting up the database to populate
 * the badges table with the required badge types.
 *
 * Usage: node init-badges.js
 */

async function initializeBadges() {
  try {
    console.log("🎖️  Initializing default badges...");

    // Ensure database connection is established
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    // Sync the database models (if needed)
    await sequelize.sync();
    console.log("✅ Database models synced");

    // Initialize the default badges
    await BadgeService.initializeDefaultBadges();

    console.log("🎉 Badge initialization completed successfully!");
    console.log("");
    console.log("Available badges:");
    console.log("  🏆 MVP - Awarded to the player who deals the most damage");
    console.log(
      "  🎯 Last Hit - Awarded to the player who delivers the final blow"
    );
    console.log(
      "  🏅 Boss Defeated - Awarded to all players who defeat a boss"
    );
    console.log(
      "  📊 10 Questions - Awarded for answering 10 questions correctly in an event"
    );
    console.log(
      "  📈 25 Questions - Awarded for answering 25 questions correctly in an event"
    );
    console.log(
      "  📊 50 Questions - Awarded for answering 50 questions correctly in an event"
    );
    console.log(
      "  🎓 100 Questions - Awarded for answering 100 questions correctly in an event"
    );
  } catch (error) {
    console.error("❌ Error initializing badges:", error);
    process.exit(1);
  } finally {
    // Close the database connection
    await sequelize.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  }
}

// Run the initialization
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeBadges();
}

export default initializeBadges;
