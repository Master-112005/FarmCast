"use strict";

const { DataTypes } = require("sequelize");

module.exports = (sequelize) => {
  const SoilRecord = sequelize.define(
    "SoilRecord",
    {
      /* ------------------------------------
         PRIMARY KEY
      ------------------------------------ */
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      /* ------------------------------------
         DEVICE ASSOCIATION
      ------------------------------------ */
      deviceId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "device_id",
      },

      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: "user_id",
      },

      /* ------------------------------------
         TELEMETRY METRICS
      ------------------------------------ */
      moisture: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
          min: 0,
          max: 100,
        },
      },

      temperature: {
        type: DataTypes.FLOAT,
        allowNull: false,
      },

      latitude: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
          min: -90,
          max: 90,
        },
      },

      longitude: {
        type: DataTypes.FLOAT,
        allowNull: false,
        validate: {
          min: -180,
          max: 180,
        },
      },

      battery: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
    },
    {
      tableName: "soil_records",
      timestamps: true,  // keeps created_at & updated_at
      underscored: true,
      paranoid: true,
      indexes: [
        {
          fields: ["deviceId"],
        },
        {
          fields: ["createdAt"],
        },
      ],
    }
  );

  return SoilRecord;
};
