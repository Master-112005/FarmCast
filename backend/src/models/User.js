/**
 * src/models/User.js
 * ------------------------------------------------------
 * User Model (Enterprise Hardened)
 *
 * CRITICAL FILE (IDENTITY & ACCESS CONTROL)
 *
 * Responsibilities:
 * - Define user schema
 * - Enforce integrity
 * - Support RBAC
 *
 * NON-Responsibilities:
 * - NO hashing
 * - NO auth logic
 */

"use strict";

const { ROLES } = require("../utils/constants");

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
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
         CORE IDENTITY
      ================================================== */
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },

      email: {
        type: DataTypes.STRING(150),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },

      password: {
        type: DataTypes.STRING(255), // bcrypt length safe
        allowNull: false,
      },

      /* ==================================================
         ROLE & STATUS
      ================================================== */
      role: {
        type: DataTypes.ENUM(
          ROLES.USER,
          ROLES.ADMIN
        ),
        defaultValue: ROLES.USER,
        allowNull: false,
      },

      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      /* ==================================================
         PROFILE
      ================================================== */
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },

      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      fieldSize: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },

      profileImage: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: "users",
      timestamps: true,
      paranoid: true,

      indexes: [
        { unique: true, fields: ["email"] },
        { fields: ["role"] },
      ],

      defaultScope: {
        attributes: {
          exclude: ["password"],
        },
      },

      scopes: {
        withPassword: {
          attributes: {},
        },
      },
    }
  );

  return User;
};
