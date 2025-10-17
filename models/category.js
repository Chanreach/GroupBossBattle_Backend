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
      }
      return details;
    }
  }

  Category.init(
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
            args: [2, 50],
            msg: "Name length must be between 2 and 50 characters",
          },
          isUnique: async function (value, next) {
            const exists = await Category.findOne({ where: { name: value } });
            if (exists && exists.id !== this.id) {
              return next("Category name must be unique");
            }
            return next();
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
      modelName: "Category",
      tableName: "categories",
      timestamps: true,
      underscored: true,
      scopes: {
        withBosses: {
          include: [{ model: sequelize.models.Boss, as: "bosses" }],
        },
        withQuestions: {
          include: [{ model: sequelize.models.Question, as: "questions" }],
        },
        withQuestionsAndChoices: {
          include: [
            {
              model: sequelize.models.Question,
              as: "questions",
              include: [
                {
                  model: sequelize.models.AnswerChoice,
                  as: "answerChoices",
                },
              ],
            },
          ],
        },
        byCreator: (creatorId) => ({
          where: { creatorId },
        }),
      },
    }
  );
  return Category;
};
