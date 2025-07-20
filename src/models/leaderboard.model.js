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
    playerId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "player_id",
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
    eventBossId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "event_boss_id",
    },
  },
  {
    tableName: "leaderboards",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["player_id"],
      },
      {
        fields: ["event_boss_id"],
      },
      {
        fields: ["total_damage_dealt"],
      },
      {
        fields: ["total_correct_answers"],
      },
    ],
  }
);

export default Leaderboard;
