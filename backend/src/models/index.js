/**
 * src/models/index.js
 * ------------------------------------------------------
 * Enterprise Sequelize Model Registry (Enterprise Hardened)
 *
 * Responsibilities:
 * - Initialize all Sequelize models
 * - Register model associations
 * - Expose a single, consistent DB object
 *
 * Rules:
 * - ZERO business logic
 * - ZERO queries
 * - Associations ONLY
 */

"use strict";

const { sequelize, Sequelize } = require("../config/db");
const logger = require("../utils/logger");

if (
  !sequelize ||
  typeof sequelize.define !== "function"
) {
  throw new Error(
    "Invalid Sequelize instance. Check src/config/db.js export."
  );
}

const { DataTypes } = Sequelize;

const UserFactory = require("./User");
const DeviceFactory = require("./Device");
const CropFactory = require("./Crop");
const SoilRecordFactory = require("./SoilRecord");
const AlertFactory = require("./Alert");
const AuditLogFactory = require("./AuditLog");
const RefreshTokenFactory = require("./RefreshToken");
const ChatMessageFactory = require("./ChatMessage");
const PredictionHistoryFactory = require("./PredictionHistory");
const CommunityPostFactory = require("./CommunityPost");

[
  UserFactory,
  DeviceFactory,
  CropFactory,
  SoilRecordFactory,
  AlertFactory,
  AuditLogFactory,
  RefreshTokenFactory,
  ChatMessageFactory,
  PredictionHistoryFactory,
  CommunityPostFactory,
].forEach((factory, index) => {
  if (typeof factory !== "function") {
    throw new Error(
      `Model factory at index ${index} is invalid`
    );
  }
});

const db = {
  sequelize,
  Sequelize,
};

db.User = UserFactory(sequelize, DataTypes);
db.Device = DeviceFactory(sequelize, DataTypes);
db.Crop = CropFactory(sequelize, DataTypes);
db.SoilRecord = SoilRecordFactory(
  sequelize,
  DataTypes
);
db.Alert = AlertFactory(sequelize, DataTypes);
db.AuditLog = AuditLogFactory(
  sequelize,
  DataTypes
);
db.RefreshToken = RefreshTokenFactory(
  sequelize,
  DataTypes
);
db.ChatMessage = ChatMessageFactory(
  sequelize,
  DataTypes
);
db.PredictionHistory = PredictionHistoryFactory(
  sequelize,
  DataTypes
);
db.CommunityPost = CommunityPostFactory(
  sequelize,
  DataTypes
);

// USER -> DEVICES
if (db.User && db.Device) {
  db.User.hasMany(db.Device, {
    foreignKey: "userId",
    as: "devices",
    onDelete: "CASCADE",
  });

  db.Device.belongsTo(db.User, {
    foreignKey: "userId",
    as: "owner",
  });
}

// CROP -> DEVICES
if (db.Crop && db.Device) {
  db.Crop.hasMany(db.Device, {
    foreignKey: "cropId",
    as: "devices",
    onDelete: "SET NULL",
  });

  db.Device.belongsTo(db.Crop, {
    foreignKey: "cropId",
    as: "crop",
  });
}

// DEVICE -> SOIL RECORDS
if (db.Device && db.SoilRecord) {
  db.Device.hasMany(db.SoilRecord, {
    foreignKey: "deviceId",
    as: "soilRecords",
    onDelete: "CASCADE",
  });

  db.SoilRecord.belongsTo(db.Device, {
    foreignKey: "deviceId",
    as: "device",
  });
}

// USER -> ALERTS
if (db.User && db.Alert) {
  db.User.hasMany(db.Alert, {
    foreignKey: "userId",
    as: "alerts",
    onDelete: "CASCADE",
  });

  db.Alert.belongsTo(db.User, {
    foreignKey: "userId",
    as: "user",
  });
}

// DEVICE -> ALERTS
if (db.Device && db.Alert) {
  db.Device.hasMany(db.Alert, {
    foreignKey: "deviceId",
    as: "alerts",
    onDelete: "CASCADE",
  });

  db.Alert.belongsTo(db.Device, {
    foreignKey: "deviceId",
    as: "device",
  });
}

// USER -> REFRESH TOKENS
if (db.User && db.RefreshToken) {
  db.User.hasMany(db.RefreshToken, {
    foreignKey: "userId",
    as: "refreshTokens",
    onDelete: "CASCADE",
  });

  db.RefreshToken.belongsTo(db.User, {
    foreignKey: "userId",
    as: "user",
  });
}

// USER -> CHAT MESSAGES
if (db.User && db.ChatMessage) {
  db.User.hasMany(db.ChatMessage, {
    foreignKey: "senderId",
    as: "sentMessages",
    onDelete: "CASCADE",
  });

  db.User.hasMany(db.ChatMessage, {
    foreignKey: "recipientId",
    as: "receivedMessages",
    onDelete: "CASCADE",
  });

  db.ChatMessage.belongsTo(db.User, {
    foreignKey: "senderId",
    as: "sender",
  });

  db.ChatMessage.belongsTo(db.User, {
    foreignKey: "recipientId",
    as: "recipient",
  });
}

// USER -> PREDICTION HISTORIES
if (db.User && db.PredictionHistory) {
  db.User.hasMany(db.PredictionHistory, {
    foreignKey: "userId",
    as: "predictionHistories",
    onDelete: "CASCADE",
  });

  db.PredictionHistory.belongsTo(db.User, {
    foreignKey: "userId",
    as: "user",
  });
}

// USER -> COMMUNITY POSTS
if (db.User && db.CommunityPost) {
  db.User.hasMany(db.CommunityPost, {
    foreignKey: "userId",
    as: "communityPosts",
    onDelete: "CASCADE",
  });

  db.CommunityPost.belongsTo(db.User, {
    foreignKey: "userId",
    as: "author",
  });
}

if (process.env.NODE_ENV === "development") {
  logger.debug("Sequelize models loaded", {
    models: Object.keys(db).filter(
      (k) =>
        !["sequelize", "Sequelize"].includes(k)
    ),
  });
}

module.exports = Object.freeze(db);
