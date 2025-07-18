import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const EventBoss = sequelize.define(
  "EventBoss",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    bossId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    joinCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    cooldownDuration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 60,
    },
    numberOfTeams: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
    },
    status: {
      type: DataTypes.ENUM("active", "cooldown"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "event_bosses",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["event_id", "boss_id"],
      },
    ],
  }
);

export default EventBoss;
