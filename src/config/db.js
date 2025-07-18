import { Sequelize } from "sequelize";
import dotenv from "dotenv";
dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || "groupbossbattle",
  process.env.DB_USER || "root",
  process.env.DB_PASSWORD || "",
  {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    dialect: "mysql",
    timezone: process.env.DB_TIMEZONE || "+07:00",
    charset: process.env.DB_CHARSET || "utf8mb4",
    collate: process.env.DB_COLLATION || "utf8mb4_general_ci",
    logging: false,
  }
);

export default sequelize;
