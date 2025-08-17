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
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    code: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM("milestone", "achievement"),
      allowNull: false,
    },
    threshold: {
      type: DataTypes.INTEGER,
      allowNull: true,
    }
  },
  {
    tableName: "badges",
    timestamps: true,
    underscored: true,
  }
);

export default Badge;
