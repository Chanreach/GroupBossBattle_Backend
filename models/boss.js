import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Boss extends Model {
    static associate(models) {
      Boss.belongsTo(models.User, { foreignKey: "creatorId", as: "creator" });
      Boss.belongsToMany(models.Category, {
        through: "boss_categories",
        foreignKey: "boss_id",
        otherKey: "category_id",
        as: "categories",
      });
      Boss.hasMany(models.EventBoss, {
        foreignKey: "bossId",
        as: "eventBosses",
      });
    }

    getImageUrl() {
      const baseUrl =
        process.env.NODE_ENV === "production"
          ? process.env.APP_URL
          : "http://localhost:3000";
      return this.image ? `${baseUrl}/api/uploads/${this.image}` : null;
    }

    getSummary() {
      const summary = {
        id: this.id,
        name: this.name,
        image: this.getImageUrl(),
        description: this.description,
        cooldownDuration: this.cooldownDuration,
        numberOfTeams: this.numberOfTeams,
        creatorId: this.creatorId,
        creator: this.creator ? this.creator.getFullProfile() : null,
        eventBosses: this.eventBosses ? this.eventBosses.map((eventBoss) => eventBoss.getDetails()) : [],
      };

      if (this.categories) {
        summary.categories = this.categories.map((category) =>
          category.getDetails()
        );
      }

      return summary;
    }
  }

  Boss.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Name cannot be empty." },
          len: {
            args: [3, 100],
            msg: "Name length must be between 3 and 100 characters.",
          },
        },
      },
      image: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Image cannot be empty." },
        },
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      cooldownDuration: {
        type: DataTypes.INTEGER,
        defaultValue: 60,
        validate: {
          min: {
            args: [1],
            msg: "Cooldown duration must be at least 1 second.",
          },
        },
      },
      numberOfTeams: {
        type: DataTypes.INTEGER,
        defaultValue: 2,
        validate: {
          min: {
            args: [2],
            msg: "There must be at least 2 teams",
          },
        },
      },
      creatorId: {
        type: DataTypes.UUID,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Creator ID cannot be empty" },
          isUUID: {
            args: 4,
            msg: "Creator ID must be a valid UUID",
          },
        },
      },
    },
    {
      sequelize,
      modelName: "Boss",
      tableName: "bosses",
      timestamps: true,
      underscored: true,
      defaultScope: {
        attributes: { exclude: ["createdAt", "updatedAt"] },
        order: [["createdAt", "ASC"]],
      },
      scopes: {
        byCreator: (creatorId) => ({
          where: { creatorId },
          order: [["createdAt", "ASC"]],
        }),
      },
    }
  );
  return Boss;
};
