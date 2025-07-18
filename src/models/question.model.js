import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";
import Category from "./category.model.js";

const Question = sequelize.define(
  "Question",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    categoryId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    questionText: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    timeLimit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
    },
    authorId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  },
  {
    tableName: "questions",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["category_id"],
      },
    ],
  }
);

export default Question;
