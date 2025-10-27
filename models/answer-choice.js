import { Model } from "sequelize";

export default (sequelize, DataTypes) => {
  class AnswerChoice extends Model {
    static associate(models) {
      AnswerChoice.belongsTo(models.Question, {
        foreignKey: "questionId",
        as: "question",
      });
    }

    getDetails() {
      return {
        id: this.id,
        text: this.text,
        isCorrect: this.isCorrect,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
      };
    }
  }

  AnswerChoice.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      questionId: {
        type: DataTypes.UUID,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Question ID cannot be empty." },
          isUUID: {
            args: 4,
            msg: "Question ID must be a valid UUID.",
          },
        },
      },
      text: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: "Choice text cannot be empty." },
          len: {
            args: [1, 50],
            msg: "Choice text length must be between 1 and 50 characters.",
          },
        },
      },
      isCorrect: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        validate: {
          notEmpty: { msg: "isCorrect cannot be empty." },
          isIn: {
            args: [[true, false]],
            msg: "isCorrect must be either true or false.",
          },
        },
      },
    },
    {
      sequelize,
      modelName: "AnswerChoice",
      tableName: "answer_choices",
      timestamps: true,
      underscored: true,
      defaultScope: {
        attributes: { exclude: ["createdAt", "updatedAt"] },
        order: [["createdAt", "ASC"]],
      },
      scopes: {
        byQuestion: (questionId) => ({
          where: { questionId },
        }),
      },
    }
  );
  return AnswerChoice;
};
