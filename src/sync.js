import { sequelize } from "./models/index.js";

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connection established successfully.");

    // Sync all models with the database
    await sequelize.sync({ force: false });
    console.log("Database synchronized successfully.");
  } catch (error) {
    console.error("Error synchronizing the database:", error);
  }
}

syncDatabase();
