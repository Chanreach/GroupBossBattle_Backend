import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Badge extends Model {
    static associate(models) {
      Badge.hasMany(models.UserBadge, {
        foreignKey: "badgeId",
        as: "userBadges",
      });
    }

    getSummary() {
      return {
        id: this.id,
        name: this.name,
        image: this.image,
        description: this.description,
        code: this.code,
        type: this.type,
        threshold: this.threshold,
      };
    }
  }

  Badge.init(
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
          isUnique: async function (value, next) {
            const exists = await Badge.findOne({ where: { name: value } });
            if (exists && exists.id !== this.id) {
              return next("Badge name must be unique.");
            }
            return next();
          },
        },
      },
      image: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Code cannot be empty." },
          len: {
            args: [3, 50],
            msg: "Code length must be between 3 and 50 characters.",
          },
          isUnique: async function (value, next) {
            const exists = await Badge.findOne({ where: { code: value } });
            if (exists && exists.id !== this.id) {
              return next("Badge code must be unique.");
            }
            return next();
          },
        },
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Type cannot be empty." },
          isIn: {
            args: [["milestone", "achievement"]],
            msg: "Type must be one of: milestone, achievement.",
          },
        },
      },
      threshold: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: {
            args: [1],
            msg: "Threshold must be at least 1.",
          },
        },
      },
    },
    {
      sequelize,
      modelName: "Badge",
      tableName: "badges",
      timestamps: true,
      underscored: true,
      defaultScope: {
        attributes: { exclude: ["createdAt", "updatedAt"] },
      },
      scopes: {
        milestone: {
          where: { type: "milestone" },
        },
        achievement: {
          where: { type: "achievement" },
        },
      },
    }
  );
  return Badge;
};
