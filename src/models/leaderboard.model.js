import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Leaderboard = sequelize.define(
  "Leaderboard",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    eventBossId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    totalDamageDealt: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },
    totalCorrectAnswers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalQuestionsAnswered: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalBattlesParticipated: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "leaderboards",
    timestamps: true,
    underscored: true,
  }
);

export default Leaderboard;
