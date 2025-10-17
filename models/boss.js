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
      return {
        id: this.id,
        name: this.name,
        image: this.getImageUrl(),
        description: this.description,
        cooldownDuration: this.cooldownDuration,
        numberOfTeams: this.numberOfTeams,
        creatorId: this.creatorId,
        creator: this.creator ? this.creator.getFullProfile() : null,
      };
    }
  }

  Boss.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING,
        validate: {
          notEmpty: { msg: "Name cannot be empty" },
          len: {
            args: [3, 100],
            msg: "Name length must be between 3 and 100 characters",
          },
        },
      },
      image: {
        type: DataTypes.STRING,
        validate: {
          notEmpty: { msg: "Image cannot be empty" },
        },
      },
      description: DataTypes.TEXT,
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
      creatorId: {
        type: DataTypes.UUID,
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
      scopes: {
        withCreator: {
          include: [{ model: sequelize.models.User, as: "creator" }],
        },
        byCreator: (creatorId) => ({
          where: { creatorId },
        }),
      },
    }
  );
  return Boss;
};
