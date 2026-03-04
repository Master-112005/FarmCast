"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const Alert = sequelize.define(
    "Alert",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      deviceId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM(
          "MOISTURE_LOW",
          "MOISTURE_HIGH",
          "DEVICE_OFFLINE"
        ),
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      value: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      threshold: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      resolved: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      tableName: "alerts",
      timestamps: true,
      underscored: true,
      indexes: [
        { fields: ["userId"] },
        { fields: ["deviceId"] },
        { fields: ["resolved"] },
        { fields: ["deviceId", "type", "resolved"] },
      ],
    }
  );

  return Alert;
};
