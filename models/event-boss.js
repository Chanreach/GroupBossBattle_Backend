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
        summary.creatorId = this.boss.creatorId;
        summary.creator = this.boss.creator
          ? this.boss.creator.getFullProfile()
          : null;

        if (this.boss.categories) {
          summary.categories = this.boss.categories.map((category) =>
            category.getDetails()
          );
        }
      }

      return summary;
    }
  }

  EventBoss.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      eventId: {
        type: DataTypes.UUID,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Event ID cannot be empty." },
          isUUID: {
            args: 4,
            msg: "Event ID must be a valid UUID.",
          },
        },
      },
      bossId: {
        type: DataTypes.UUID,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Boss ID cannot be empty." },
          isUUID: {
            args: 4,
            msg: "Boss ID must be a valid UUID.",
          },
        },
      },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "pending",
        validate: {
          isIn: {
            args: [["pending", "active", "in-battle", "cooldown"]],
            msg: "Status must be one of: pending, active, in-battle, cooldown.",
          },
        },
      },
      joinCode: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Join code cannot be empty." },
          len: {
            args: 6,
            msg: "Join code must be exactly 6 characters.",
          },
          isAlphanumeric: {
            msg: "Join code must be alphanumeric.",
          },
          isUnique: async function (value) {
            const exists = await EventBoss.findOne({
              where: { eventId: this.eventId, joinCode: value },
            });
            if (exists && exists.id !== this.id) {
              throw new Error("Join code must be unique.");
            }
          },
        },
      },
      cooldownDuration: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Cooldown duration cannot be empty." },
          min: {
            args: [1],
            msg: "Cooldown duration must be at least 1 second.",
          },
        },
      },
      numberOfTeams: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
        validate: {
          notEmpty: { msg: "Number of teams cannot be empty." },
          min: {
            args: [2],
            msg: "There must be at least 2 teams.",
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
      defaultScope: {
        attributes: { exclude: ["createdAt", "updatedAt"] },
        order: [["createdAt", "ASC"]],
      },
      hooks: {
        beforeCreate: async (eventBoss) => {
          const event = await sequelize.models.Event.findByPk(
            eventBoss.eventId
          );
          if (event?.status === "ongoing") eventBoss.status = "active";
        },
        beforeUpdate: async (eventBoss) => {
          const event = await sequelize.models.Event.findByPk(
            eventBoss.eventId
          );
          if (event?.status === "ongoing" && eventBoss.status === "pending") {
            eventBoss.status = "active";
          }
        },
      },
      scopes: {
        byEvent: (eventId) => ({
          where: { eventId },
        }),
        byBoss: (bossId) => ({
          where: { bossId },
        }),
      },
    }
  );
  return EventBoss;
};
