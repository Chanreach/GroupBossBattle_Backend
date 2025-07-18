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
    },
    badgeId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    bossSessionId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    earnedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
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
    ],
  }
);

export default UserBadge;
