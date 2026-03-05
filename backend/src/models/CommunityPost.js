"use strict";

module.exports = (sequelize, DataTypes) => {
  const CommunityPost = sequelize.define(
    "CommunityPost",
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

      caption: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },

      imagePath: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      tableName: "community_posts",
      timestamps: true,
      paranoid: false,
      indexes: [
        { fields: ["userId"] },
        { fields: ["createdAt"] },
      ],
    }
  );

  return CommunityPost;
};
