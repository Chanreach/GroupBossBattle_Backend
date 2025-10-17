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
        choiceText: this.choiceText,
        isCorrect: this.isCorrect,
      };
    }
  }
  
  AnswerChoice.init(
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
      },
      questionId: {
        type: DataTypes.UUID,
        validate: {
          notEmpty: { msg: "Question ID cannot be empty" },
          isUUID: {
            args: 4,
            msg: "Question ID must be a valid UUID",
          },
        },
      },
      choiceText: {
        type: DataTypes.STRING,
        validate: {
          notEmpty: { msg: "Choice text cannot be empty" },
          len: {
            args: [1, 100],
            msg: "Choice text length must be between 1 and 100 characters",
          },
        },
      },
      isCorrect: DataTypes.BOOLEAN,
    },
    {
      sequelize,
      modelName: "AnswerChoice",
      tableName: "answer_choices",
      timestamps: true,
      underscored: true,
      scopes: {
        byQuestion: (questionId) => ({
          where: { questionId },
        }),
      },
    }
  );
  return AnswerChoice;
};
