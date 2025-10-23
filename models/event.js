import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Event extends Model {
    static associate(models) {
      Event.belongsTo(models.User, { foreignKey: "creatorId", as: "creator" });
      Event.hasMany(models.EventBoss, {
        foreignKey: "eventId",
        as: "eventBosses",
      });
      Event.hasMany(models.UserBadge, {
        foreignKey: "eventId",
        as: "userBadges",
      });
      Event.hasMany(models.Leaderboard, {
        foreignKey: "eventId",
        as: "leaderboardEntries",
      });
    }

    getSummary() {
      const summary = {
        id: this.id,
        name: this.name,
        description: this.description,
        startAt: this.startAt,
        endAt: this.endAt,
        status: this.status,
        creatorId: this.creatorId,
        creator: this.creator ? this.creator.getFullProfile() : null,
      };

      if (this.eventBosses) {
        summary.eventBosses = this.eventBosses.map((eb) => eb.getSummary());
        summary.eventBossCount = this.eventBosses.length;
      }

      return summary;
    }
  }

  Event.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: { msg: "Name cannot be empty." },
          len: {
            args: [1, 100],
            msg: "Name length must be between 1 and 100 characters.",
          },
          isUnique: async function (value) {
            const event = await Event.findOne({ where: { name: value } });
            if (event && event.id !== this.id) {
              throw new Error("Event name must be unique.");
            }
          },
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      startAt: {
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
          isDate: { msg: "Start time must be a valid date." },
          isInFuture(value) {
            if (new Date(value) <= new Date()) {
              throw new Error("Start time must be in the future.");
            }
          },
        },
      },
      endAt: {
        type: DataTypes.DATE,
        allowNull: false,
        validate: {
          isDate: { msg: "End time must be a valid date." },
          isAfterStartTime(value) {
            if (this.startAt && new Date(value) <= new Date(this.startAt)) {
              throw new Error("End time must be after start time.");
            }
          },
        },
      },
      status: {
        type: DataTypes.ENUM("upcoming", "ongoing", "completed"),
        defaultValue: "upcoming",
        validate: {
          isIn: {
            args: [["upcoming", "ongoing", "completed"]],
            msg: "Status must be one of: upcoming, ongoing, completed.",
          },
        },
      },
      creatorId: {
        type: DataTypes.UUID,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Creator ID cannot be empty." },
          isUUID: {
            args: 4,
            msg: "Creator ID must be a valid UUID.",
          },
        },
      },
    },
    {
      sequelize,
      modelName: "Event",
      tableName: "events",
      timestamps: true,
      underscored: true,
      hooks: {
        beforeCreate: (event) => {
          if (new Date(event.startAt) <= new Date()) {
            event.status = "ongoing";
          }
        },
        beforeUpdate: (event) => {
          const now = new Date();
          if (event.startAt && event.endAt) {
            if (now >= new Date(event.endAt)) {
              event.status = "completed";
            } else if (now >= new Date(event.startAt)) {
              event.status = "ongoing";
            } else {
              event.status = "upcoming";
            }
          }
        },
      },
      defaultScope: {
        attributes: { exclude: ["createdAt", "updatedAt"] },
        order: [["startAt", "ASC"]],
      },
      scopes: {
        upcoming: {
          where: { status: "upcoming" },
        },
        ongoing: {
          where: { status: "ongoing" },
        },
        completed: {
          where: { status: "completed" },
        },
      },
    }
  );
  return Event;
};
