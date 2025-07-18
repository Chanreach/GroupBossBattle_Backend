import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Boss = sequelize.define(
  "Boss",
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
    cooldownDuration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 60,
    },
    numberOfTeams: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
    },
    creatorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "bosses",
    timestamps: true,
    underscored: true,
  }
);

export default Boss;
