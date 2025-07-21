import { Badge } from "./src/models/index.js";
import sequelize from "./src/config/db.js";

async function testBadges() {
  try {
    console.log("🔍 Checking badges in database...");

    // Ensure database connection is established
    await sequelize.authenticate();
    console.log("✅ Database connection established");

    // Get all badges
    const badges = await Badge.findAll({
      order: [["name", "ASC"]],
    });

    console.log(`\n📊 Found ${badges.length} badges in database:`);

    if (badges.length === 0) {
      console.log("❌ No badges found! Need to run init-badges.js");
    } else {
      badges.forEach((badge, index) => {
        console.log(
          `  ${index + 1}. ${badge.name} (ID: ${badge.id}) - Image: ${
            badge.image
          }`
        );
      });
    }
  } catch (error) {
    console.error("❌ Error checking badges:", error);
  } finally {
    // Close the database connection
    await sequelize.close();
    console.log("\n🔌 Database connection closed");
    process.exit(0);
  }
}

// Run the test
testBadges();
