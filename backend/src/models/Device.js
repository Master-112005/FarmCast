/**
 * src/models/Device.js
 * ------------------------------------------------------
 * Device Model
 *
 * CRITICAL FILE (IOT OWNERSHIP & MAP CONTEXT)
 *
 * Responsibilities:
 * - Define device identity & ownership
 * - Store device metadata & location
 * - Support map rendering & telemetry
 *
 * Rules:
 * - NO business logic
 * - NO request handling
 * - NO IoT ingestion logic
 *
 * If this file is wrong → device security & maps break
 */

"use strict";

const { DataTypes } = require("sequelize");
const { DEVICE } = require("../utils/constants");

module.exports = (sequelize) => {
  const Device = sequelize.define(
    "Device",
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
         OWNERSHIP
      ------------------------------------ */
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      cropId: {
        type: DataTypes.UUID,
        allowNull: true,
      },

      /* ------------------------------------
         DEVICE IDENTITY
      ------------------------------------ */
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
        /**
         * Human / firmware-visible identifier
         * (printed on device casing)
         */
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
      },

      deviceSecretHash: {
        /**
         * Hashed device credential used for
         * hardware-level authentication.
         */
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      /* ------------------------------------
         STATUS & LIFECYCLE
      ------------------------------------ */
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

      /* ------------------------------------
         LOCATION (MAP SUPPORT)
      ------------------------------------ */
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

      /* ------------------------------------
         OPTIONAL METADATA
      ------------------------------------ */
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
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
