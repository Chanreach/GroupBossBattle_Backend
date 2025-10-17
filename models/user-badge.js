import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class UserBadge extends Model {
    static associate(models) {
      UserBadge.belongsTo(models.User, { foreignKey: "userId", as: "user" });
      UserBadge.belongsTo(models.Badge, { foreignKey: "badgeId", as: "badge" });
      UserBadge.belongsTo(models.EventBoss, {
        foreignKey: "eventBossId",
        as: "eventBoss",
      });
      UserBadge.belongsTo(models.Event, { foreignKey: "eventId", as: "event" });
    }
  }
  
  UserBadge.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        validate: {
          notEmpty: { msg: "User ID cannot be empty" },
          isUUID: {
            args: 4,
            msg: "User ID must be a valid UUID",
          },
        },
      },
      badgeId: {
        type: DataTypes.UUID,
        validate: {
          notEmpty: { msg: "Badge ID cannot be empty" },
          isUUID: {
            args: 4,
            msg: "Badge ID must be a valid UUID",
          },
        },
      },
      eventBossId: DataTypes.UUID,
      eventId: {
        type: DataTypes.UUID,
        validate: {
          notEmpty: { msg: "Event ID cannot be empty" },
          isUUID: {
            args: 4,
            msg: "Event ID must be a valid UUID",
          },
        },
      },
      earnedAt: {
        type: DataTypes.DATE,
        validate: {
          isDate: { msg: "Earned At must be a valid date" },
        },
      },
      isRedeemed: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "UserBadge",
      tableName: "user_badges",
      timestamps: true,
      underscored: true,
      hooks: {
        beforeCreate: (userBadge) => {
          userBadge.earnedAt = new Date();
        },
      },
      scopes: {
        byUser: (userId) => ({
          where: { userId },
        }),
        byBadge: (badgeId) => ({
          where: { badgeId },
        }),
        byEventBoss: (eventBossId) => ({
          where: { eventBossId },
        }),
        byEvent: (eventId) => ({
          where: { eventId },
        }),
      },
    }
  );
  return UserBadge;
};
