/**
 * src/models/RefreshToken.js
 * ------------------------------------------------------
 * Refresh Token Model (Enterprise Hardened)
 *
 * Responsibilities:
 * - Persist hashed refresh tokens
 * - Enable logout & revocation
 * - Support multi-device sessions
 */

"use strict";

module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define(
    "RefreshToken",
    {
      /* ==================================================
         PRIMARY KEY
      ================================================== */
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      /* ==================================================
         FOREIGN KEY
      ================================================== */
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      /* ==================================================
         TOKEN DATA
      ================================================== */
      token: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },

      /* ==================================================
         SECURITY METADATA
      ================================================== */
      userAgent: {
        type: DataTypes.STRING,
        allowNull: true,
      },

      ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },

      isRevoked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      tableName: "refresh_tokens",
      timestamps: true,
      underscored: true,

      indexes: [
        { fields: ["user_id"] },
        { fields: ["expires_at"] },
        { fields: ["is_revoked"] },
        { fields: ["token"] },
      ],
    }
  );

  return RefreshToken;
};
