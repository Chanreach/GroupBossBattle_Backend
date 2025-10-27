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

    getSummary() {
      return {
        id: this.id,
        userId: this.userId,
        badgeId: this.badgeId,
        eventBossId: this.eventBossId,
        eventId: this.eventId,
        earnedAt: this.earnedAt,
        isRedeemed: this.isRedeemed,
        user: this.user ? this.user.getFullProfile() : null,
        badge: this.badge ? this.badge.getSummary() : null,
        eventBoss: this.eventBoss ? this.eventBoss.getSummary() : null,
        event: this.event ? this.event.getSummary() : null,
      };
    }
  }
  
  UserBadge.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
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
        allowNull: false,
        validate: {
          notEmpty: { msg: "Badge ID cannot be empty" },
          isUUID: {
            args: 4,
            msg: "Badge ID must be a valid UUID",
          },
        },
      },
      eventBossId: {
        type: DataTypes.UUID,
        allowNull: true,
        validate: {
          isUUID: {
            args: 4,
            msg: "Event Boss ID must be a valid UUID",
          },
        },
      },
      eventId: {
        type: DataTypes.UUID,
        allowNull: false,
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
        defaultValue: DataTypes.NOW,
        validate: {
          isDate: { msg: "Earned At must be a valid date" },
        },
      },
      isRedeemed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
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
