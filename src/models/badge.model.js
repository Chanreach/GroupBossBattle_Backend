import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Badge = sequelize.define(
  "Badge",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    image: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "badges",
    timestamps: true,
    underscored: true,
  }
);

export default Badge;
