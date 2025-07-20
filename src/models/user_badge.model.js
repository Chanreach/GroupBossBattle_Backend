import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const UserBadge = sequelize.define(
  "UserBadge",
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
    badgeId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "badge_id",
    },
    eventBossId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: "event_boss_id",
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: "event_id",
    },
    earnedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    }
  },
  {
    tableName: "user_badges",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["player_id"],
      },
      {
        fields: ["badge_id"],
      },
      {
        fields: ["event_boss_id"],
      },
      {
        fields: ["event_id"],
      },
    ],
  }
);

export default UserBadge;
