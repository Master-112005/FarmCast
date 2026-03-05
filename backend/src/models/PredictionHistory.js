"use strict";

const { PREDICTION } = require("../utils/constants");

module.exports = (sequelize, DataTypes) => {
  const PredictionHistory = sequelize.define(
    "PredictionHistory",
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

      predictionType: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: {
          isIn: [
            Object.values(PREDICTION.TYPE),
          ],
        },
      },

      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: PREDICTION.STATUS.SUCCESS,
        validate: {
          isIn: [
            Object.values(PREDICTION.STATUS),
          ],
        },
      },

      summary: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      requestId: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },

      inputPayload: {
        type: DataTypes.JSON,
        allowNull: true,
      },

      resultPayload: {
        type: DataTypes.JSON,
        allowNull: true,
      },
    },
    {
      tableName: "prediction_histories",
      timestamps: true,
      paranoid: false,
      indexes: [
        { fields: ["userId"] },
        { fields: ["predictionType"] },
        { fields: ["createdAt"] },
      ],
    }
  );

  return PredictionHistory;
};
