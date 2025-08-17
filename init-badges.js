import BadgeService from "./src/services/badge.service.js";
import sequelize from "./src/config/db.js";

async function initializeBadges() {
  try {
    // Ensure database connection is established
    await sequelize.authenticate();
    console.log("Database connection established");

    // Sync the database models
    await sequelize.sync();
    console.log("Database models synced");

    // Initialize the badges
    await BadgeService.initializeBadges();
  } catch (error) {
    console.error("Error initializing badges:", error);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log("Database connection closed");
    process.exit(0);
  }
}

// Run the initialization
initializeBadges();

export default initializeBadges;
