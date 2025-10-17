import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class EventBoss extends Model {
    static associate(models) {
      EventBoss.belongsTo(models.Event, { foreignKey: "eventId", as: "event" });
      EventBoss.belongsTo(models.Boss, { foreignKey: "bossId", as: "boss" });
      EventBoss.hasMany(models.UserBadge, {
        foreignKey: "eventBossId",
        as: "userBadges",
      });
      EventBoss.hasMany(models.Leaderboard, {
        foreignKey: "eventBossId",
        as: "leaderboardEntries",
      });
    }

    getSummary() {
      const summary = {
        id: this.id,
        eventId: this.eventId,
        bossId: this.bossId,
        status: this.status,
        joinCode: this.joinCode,
        cooldownDuration: this.cooldownDuration,
        numberOfTeams: this.numberOfTeams,
        event: this.event ? this.event.getSummary() : null,
      };
      if (this.boss) {
        summary.name = this.boss.name;
        summary.image = this.boss.getImageUrl();
        summary.description = this.boss.description;
      }
      return summary;
    }
  }

  EventBoss.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
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
      bossId: {
        type: DataTypes.UUID,
        validate: {
          notEmpty: { msg: "Boss ID cannot be empty" },
          isUUID: {
            args: 4,
            msg: "Boss ID must be a valid UUID",
          },
        },
      },
      status: DataTypes.STRING,
      joinCode: {
        type: DataTypes.STRING,
        validate: {
          notEmpty: { msg: "Join code cannot be empty" },
          len: {
            args: 6,
            msg: "Join code must be exactly 6 characters",
          },
          isAlphanumeric: {
            msg: "Join code must be alphanumeric",
          },
          isUnique: async function (value, next) {
            const exists = await EventBoss.findOne({
              where: { eventId: this.eventId, joinCode: value },
            });
            if (exists && exists.id !== this.id) {
              return next("Join code must be unique");
            }
            return next();
          },
        },
      },
      cooldownDuration: {
        type: DataTypes.INTEGER,
        validate: {
          min: {
            args: [1],
            msg: "Cooldown duration must be at least 1 second",
          },
        },
      },
      numberOfTeams: {
        type: DataTypes.INTEGER,
        validate: {
          min: {
            args: [2],
            msg: "There must be at least 2 teams",
          },
        },
      },
    },
    {
      sequelize,
      modelName: "EventBoss",
      tableName: "event_bosses",
      timestamps: true,
      underscored: true,
      scopes: {
        withEvent: {
          include: [{ model: sequelize.models.Event, as: "event" }],
        },
        withBoss: {
          include: [{ model: sequelize.models.Boss, as: "boss" }],
        },
        withEventAndBoss: {
          include: [
            { model: sequelize.models.Event, as: "event" },
            { model: sequelize.models.Boss, as: "boss" },
          ],
        },
      },
    }
  );
  return EventBoss;
};
