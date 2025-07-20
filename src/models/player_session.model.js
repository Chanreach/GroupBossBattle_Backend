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
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "user_id",
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "event_id",
    },
  },
  {
    tableName: "player_sessions",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["user_id"],
      },
      {
        fields: ["event_id"],
      },
    ],
  }
);

export default PlayerSession;
