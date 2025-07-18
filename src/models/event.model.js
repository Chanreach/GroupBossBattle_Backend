import { DataTypes } from "sequelize";
import sequelize from "../config/db.js";

const Event = sequelize.define(
  "Event",
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
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("upcoming", "ongoing", "completed"),
      allowNull: false,
      defaultValue: "upcoming",
    },
    creatorId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    tableName: "events",
    timestamps: true,
    underscored: true,
  }
);

export default Event;
