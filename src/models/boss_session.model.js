import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const BossSession = sequelize.define(
  "BossSession",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    eventBossId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    totalParticipants: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    finalDamageDealt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "boss_sessions",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["event_boss_id"],
      },
      {
        fields: ["start_time"],
      },
    ],
  }
);

export default BossSession;
