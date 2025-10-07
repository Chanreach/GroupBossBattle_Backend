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
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    badgeId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    eventBossId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    eventId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    earnedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    isRedeemed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    tableName: "user_badges",
    timestamps: true,
    underscored: true,
  }
);

export default UserBadge;
