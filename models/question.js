import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class Question extends Model {
    static associate(models) {
      Question.belongsTo(models.User, { foreignKey: "authorId", as: "author" });
      Question.belongsTo(models.Category, {
        foreignKey: "categoryId",
        as: "category",
      });
      Question.hasMany(models.AnswerChoice, {
        foreignKey: "questionId",
        as: "answerChoices",
      });
    }

    getDetails() {
      const details = {
        id: this.id,
        categoryId: this.categoryId,
        questionText: this.questionText,
        timeLimit: this.timeLimit,
        authorId: this.authorId,
        author: this.author ? this.author.getFullProfile() : null,
      };
      if (this.category) {
        details.categoryName = this.category.name;
      }
      if (this.answerChoices) {
        details.answerChoices = this.answerChoices.map((choice) =>
          choice.getDetails()
        );
      }
      return details;
    }
  }

  Question.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      categoryId: {
        type: DataTypes.UUID,
        validate: {
          notEmpty: { msg: "Category ID cannot be empty" },
          isUUID: {
            args: 4,
            msg: "Category ID must be a valid UUID",
          },
        },
      },
      questionText: {
        type: DataTypes.STRING,
        validate: {
          notEmpty: { msg: "Question text cannot be empty" },
          len: {
            args: [1, 100],
            msg: "Question text length must be between 1 and 100 characters",
          },
        },
      },
      timeLimit: {
        type: DataTypes.INTEGER,
        validate: {
          len: {
            args: [5, 60],
            msg: "Time limit must be between 5 and 60 seconds",
          },
        },
      },
      authorId: {
        type: DataTypes.UUID,
        validate: {
          notEmpty: { msg: "Author ID cannot be empty" },
          isUUID: {
            args: 4,
            msg: "Author ID must be a valid UUID",
          },
        },
      },
    },
    {
      sequelize,
      modelName: "Question",
      tableName: "questions",
      timestamps: true,
      underscored: true,
      scopes: {
        withAuthor: {
          include: [{ model: sequelize.models.User, as: "author" }],
        },
        withCategory: {
          include: [{ model: sequelize.models.Category, as: "category" }],
        },
        withAnswerChoices: {
          include: [
            { model: sequelize.models.AnswerChoice, as: "answerChoices" },
          ],
        },
        byCategory: (categoryId) => ({
          where: { categoryId },
        }),
        byAuthor: (authorId) => ({
          where: { authorId },
        }),
      },
    }
  );
  return Question;
};
