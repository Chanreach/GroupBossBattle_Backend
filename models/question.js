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
        text: this.text,
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
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Category ID cannot be empty." },
          isUUID: {
            args: 4,
            msg: "Category ID must be a valid UUID.",
          },
        },
      },
      text: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Question text cannot be empty." },
          len: {
            args: [1, 200],
            msg: "Question text length must be between 1 and 200 characters.",
          },
        },
      },
      timeLimit: {
        type: DataTypes.INTEGER,
        defaultValue: 20,
        validate: {
          min: {
            args: [5],
            msg: "Time limit must be at least 5 seconds.",
          },
          max: {
            args: [120],
            msg: "Time limit cannot exceed 120 seconds.",
          },
        },
      },
      authorId: {
        type: DataTypes.UUID,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Author ID cannot be empty." },
          isUUID: {
            args: 4,
            msg: "Author ID must be a valid UUID.",
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
      defaultScope: {
        attributes: { exclude: ["createdAt", "updatedAt"] },
        order: [["updatedAt", "DESC"]],
      },
      scopes: {
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
