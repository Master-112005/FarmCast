"use strict";

const { DataTypes } = require("sequelize");
const { AUDIT } = require("../utils/constants");

module.exports = (sequelize) => {
  const AuditLog = sequelize.define(
    "AuditLog",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      eventType: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      actorType: {
        type: DataTypes.ENUM(
          AUDIT.ACTOR_TYPES.USER,
          AUDIT.ACTOR_TYPES.DEVICE,
          AUDIT.ACTOR_TYPES.SYSTEM
        ),
        allowNull: false,
      },
      actorId: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      targetDeviceId: {
        type: DataTypes.STRING(128),
        allowNull: true,
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: "audit_logs",
      timestamps: false,
      indexes: [
        { fields: ["eventType"] },
        { fields: ["actorType"] },
        { fields: ["targetDeviceId"] },
        { fields: ["timestamp"] },
      ],
    }
  );

  return AuditLog;
};
