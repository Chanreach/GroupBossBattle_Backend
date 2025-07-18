import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const AnswerChoice = sequelize.define(
  "AnswerChoice",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    questionId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    choiceText: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    isCorrect: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "answer_choices",
    timestamps: true,
    underscored: true,
  }
);

export default AnswerChoice;
