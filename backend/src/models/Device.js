"use strict";

const { DataTypes } = require("sequelize");
const { DEVICE } = require("../utils/constants");

module.exports = (sequelize) => {
  const Device = sequelize.define(
    "Device",
    {



      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },




      userId: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      cropId: {
        type: DataTypes.UUID,
        allowNull: true,
      },




      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      type: {
        type: DataTypes.ENUM(
          DEVICE.TYPES.SOIL_SENSOR,
          DEVICE.TYPES.WEATHER_SENSOR,
          DEVICE.TYPES.MULTI_SENSOR
        ),
        allowNull: false,
        defaultValue: DEVICE.TYPES.SOIL_SENSOR,
      },

      deviceCode: {




        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },

      deviceSecretHash: {




        type: DataTypes.STRING(255),
        allowNull: true,
      },




      status: {
        type: DataTypes.ENUM(
          DEVICE.STATUS.ACTIVE,
          DEVICE.STATUS.INACTIVE,
          DEVICE.STATUS.OFFLINE,
          DEVICE.STATUS.MAINTENANCE
        ),
        allowNull: false,
        defaultValue: DEVICE.STATUS.ACTIVE,
      },

      isOnline: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      moistureMinThreshold: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },

      moistureMaxThreshold: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },




      latitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        validate: {
          min: -90,
          max: 90,
        },
      },

      longitude: {
        type: DataTypes.DECIMAL(10, 7),
        allowNull: true,
        validate: {
          min: -180,
          max: 180,
        },
      },




      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      firmwareVersion: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: "firmware_version",
      },

      lastSeenAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      pendingWifiSsid: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },

      pendingWifiPassword: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },

      pendingWifiRequestedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      deletionPending: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      deletionPendingAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: "devices",
      timestamps: true,
      paranoid: true,
      defaultScope: {
        attributes: {
          exclude: [
            "deviceSecretHash",
            "pendingWifiPassword",
            "pendingWifiSsid",
            "pendingWifiRequestedAt",
          ],
        },
      },

      indexes: [
        {
          unique: true,
          fields: ["deviceCode"],
        },
        {
          fields: ["userId"],
        },
        {
          fields: ["cropId"],
        },
        {
          fields: ["type"],
        },
        {
          fields: ["status"],
        },
        {
          fields: ["isOnline", "lastSeenAt"],
        },
        {
          fields: ["deletionPending"],
        },
        {
          fields: ["pendingWifiRequestedAt"],
        },
      ],
    }
  );

  return Device;
};
