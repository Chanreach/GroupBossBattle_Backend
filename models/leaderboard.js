import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Leaderboard extends Model {
    static associate(models) {
      Leaderboard.belongsTo(models.User, { foreignKey: "userId", as: "user" });
      Leaderboard.belongsTo(models.EventBoss, {
        foreignKey: "eventBossId",
        as: "eventBoss",
      });
      Leaderboard.belongsTo(models.Event, {
        foreignKey: "eventId",
        as: "event",
      });
    }

    getAccuracy() {
      const accuracy = this.totalQuestionsAnswered
        ? (this.totalCorrectAnswers / this.totalQuestionsAnswered) * 100
        : 0;
      return Math.round(accuracy * 100) / 100;
    }

    getSummary() {
      return {
        id: this.id,
        userId: this.userId,
        eventBossId: this.eventBossId,
        eventId: this.eventId,
        totalDamageDealt: this.totalDamageDealt,
        totalCorrectAnswers: this.totalCorrectAnswers,
        totalQuestionsAnswered: this.totalQuestionsAnswered,
        accuracy: this.getAccuracy(),
        totalBattlesParticipated: this.totalBattlesParticipated,
        user: this.user ? this.user.getFullProfile() : null,
        eventBoss: this.eventBoss ? this.eventBoss.getSummary() : null,
        event: this.event ? this.event.getSummary() : null,
      };
    }
  }
  
  Leaderboard.init(
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
      eventBossId: {
        type: DataTypes.UUID,
        validate: {
          notEmpty: { msg: "Event Boss ID cannot be empty" },
          isUUID: {
            args: 4,
            msg: "Event Boss ID must be a valid UUID",
          },
        },
      },
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
      totalDamageDealt: {
        type: DataTypes.INTEGER,
        validate: {
          min: {
            args: 0,
            msg: "Total damage dealt must be a positive integer",
          },
        },
      },
      totalCorrectAnswers: {
        type: DataTypes.INTEGER,
        validate: {
          min: {
            args: 0,
            msg: "Total correct answers must be a positive integer",
          },
        },
      },
      totalQuestionsAnswered: {
        type: DataTypes.INTEGER,
        validate: {
          min: {
            args: 0,
            msg: "Total questions answered must be a positive integer",
          },
        },
      },
      totalBattlesParticipated: {
        type: DataTypes.INTEGER,
        validate: {
          min: {
            args: 0,
            msg: "Total battles participated must be a positive integer",
          },
        },
      },
    },
    {
      sequelize,
      modelName: "Leaderboard",
      tableName: "leaderboards",
      timestamps: true,
      underscored: true,
      defaultScope: {
        order: [["totalDamageDealt", "DESC"]],
        attributes: { exclude: ["createdAt", "updatedAt"] },
      },
      scopes: {
        byUser: (userId) => ({
          where: { userId },
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
  return Leaderboard;
};
