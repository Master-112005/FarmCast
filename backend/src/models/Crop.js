"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Crop = sequelize.define(
    "Crop",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      moistureMinThreshold: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      moistureMaxThreshold: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
    },
    {
      tableName: "crops",
      timestamps: true,
      underscored: true,
      indexes: [
        {
          fields: ["name"],
        },
      ],
    }
  );

  return Crop;
};
