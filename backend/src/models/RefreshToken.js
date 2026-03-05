"use strict";

module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define(
    "RefreshToken",
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

      
      token: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },

      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },

      
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
