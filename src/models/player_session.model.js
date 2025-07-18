import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const PlayerSession = sequelize.define(
  "PlayerSession",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    bossSessionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    nickname: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    damageDealt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    correctAnswers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "player_sessions",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["boss_session_id"],
      },
      {
        fields: ["user_id"],
      },
    ],
  }
);

export default PlayerSession;
