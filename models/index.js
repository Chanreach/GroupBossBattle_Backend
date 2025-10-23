import fs from "fs";
import path from "path";
import Sequelize from "sequelize";
import { fileURLToPath, pathToFileURL } from "url";
import configFile from "../config/config.cjs";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
const config = configFile[env];
const db = {};

let sequelize;
try {
  if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
  } else {
    sequelize = new Sequelize(
      config.database,
      config.username,
      config.password,
      config
    );
  }
} catch (error) {
  console.error("[Sequelize] Failed to initialize:", error);
  throw error;
}

const files = fs
  .readdirSync(__dirname)
  .filter(
    (file) =>
      file.indexOf(".") !== 0 &&
      file !== basename &&
      file !== "includes.js" &&
      file.endsWith(".js") &&
      !file.includes(".test.js")
  );

for (const file of files) {
  try {
    const modulePath = pathToFileURL(path.join(__dirname, file));
    const modelModule = await import(modulePath);
    const model = modelModule.default(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  } catch (error) {
    console.error(`[Model] Failed to import ${file}:`, error);
    throw error;
  }
}

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

export const {
  User,
  Event,
  Boss,
  EventBoss,
  Category,
  Question,
  AnswerChoice,
  Badge,
  UserBadge,
  Leaderboard,
} = db;

export { sequelize, Sequelize };

export default db;
