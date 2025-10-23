import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Category extends Model {
    static associate(models) {
      Category.belongsTo(models.User, {
        foreignKey: "creatorId",
        as: "creator",
      });
      Category.belongsToMany(models.Boss, {
        through: "boss_categories",
        foreignKey: "category_id",
        otherKey: "boss_id",
        as: "bosses",
      });
      Category.hasMany(models.Question, {
        foreignKey: "categoryId",
        as: "questions",
      });
    }

    getDetails() {
      const details = {
        id: this.id,
        name: this.name,
        creatorId: this.creatorId,
        creator: this.creator ? this.creator.getFullProfile() : null,
      };

      if (this.bosses) {
        details.bosses = this.bosses.map((boss) => boss.getSummary());
      }

      if (this.questions) {
        details.questions = this.questions.map((question) =>
          question.getDetails()
        );
        details.questionCount = this.questions.length;
      }
      return details;
    }
  }

  Category.init(
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
            args: [2, 32],
            msg: "Name length must be between 2 and 32 characters.",
          },
          isUnique: async function (value) {
            const exists = await Category.findOne({ where: { name: value } });
            if (exists && exists.id !== this.id) {
              throw new Error("Category name must be unique.");
            }
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
      modelName: "Category",
      tableName: "categories",
      timestamps: true,
      underscored: true,
      defaultScope: {
        attributes: { exclude: ["createdAt", "updatedAt"] },
        order: [["name", "ASC"]],
      },
      scopes: {
        byCreator: (creatorId) => ({
          where: { creatorId },
        }),
      },
    }
  );
  return Category;
};
