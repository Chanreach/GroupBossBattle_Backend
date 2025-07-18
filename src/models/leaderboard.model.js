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
      allowNull: true,
    },
    totalDamageDealt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalCorrectAnswers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    sessionsPlayed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    }
  },
  {
    tableName: "leaderboards",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["user_id"],
      },
      {
        fields: ["event_id"],
      },
      {
        fields: ["event_boss_id"],
      },
    ],
  }
);

export default Leaderboard;
