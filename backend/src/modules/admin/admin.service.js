/**
 * src/modules/admin/admin.service.js
 * ------------------------------------------------------
 * Admin Domain Service
 */

"use strict";

const db = require("../../models");
const env = require("../../config/env");
const mailer = require("../../integrations/mailer");
const mlClient = require("../../integrations/mlClient");
const logger = require("../../utils/logger");
const {
  APP,
  ROLES,
  DEVICE,
  ERROR_CODES,
  PREDICTION,
} = require("../../utils/constants");

const { Op } = db.Sequelize;

const domainError = (
  code,
  message,
  status = 400
) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeDeleteMessage = (value) =>
  String(value || "")
    .trim()
    .replace(/\r\n/g, "\n");

const buildAccountDeletionMail = ({
  recipientName,
  adminName,
  message,
  deletedAt,
}) => {
  const appName = APP?.NAME || "FarmCast";
  const safeRecipient = recipientName
    ? String(recipientName).trim()
    : "User";
  const safeAdminName =
    String(adminName || "").trim() ||
    "Administrator";
  const safeMessage = normalizeDeleteMessage(
    message
  );
  const timestamp = new Date(
    deletedAt || Date.now()
  ).toISOString();

  const text = [
    `Hello ${safeRecipient},`,
    "",
    `Your ${appName} account has been removed by an administrator.`,
    "",
    "Admin message:",
    safeMessage,
    "",
    `Deleted at: ${timestamp}`,
    `Handled by: ${safeAdminName}`,
    "",
    `If you need support, reply to this email.`,
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;">
        <h1 style="margin:0 0 10px;font-size:20px;">Account Deleted</h1>
        <p style="margin:0 0 14px;font-size:14px;color:#334155;">
          Hello ${escapeHtml(
            safeRecipient
          )}, your ${escapeHtml(
            appName
          )} account has been removed by an administrator.
        </p>
        <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:10px;padding:12px;margin:0 0 14px;">
          <div style="font-size:12px;color:#64748b;margin:0 0 6px;">Admin message</div>
          <div style="white-space:pre-wrap;font-size:14px;color:#0f172a;">${escapeHtml(
            safeMessage
          )}</div>
        </div>
        <div style="font-size:12px;color:#64748b;">
          <div>Deleted at: ${escapeHtml(timestamp)}</div>
          <div>Handled by: ${escapeHtml(
            safeAdminName
          )}</div>
        </div>
      </div>
    </div>
  </body>
</html>`;

  return {
    subject: `${appName} Account Deletion Notice`,
    text,
    html,
  };
};

const getAdminUsers = async () => {
  const users = await db.User.findAll({
    where: {
      role: ROLES.USER,
      isActive: true,
    },
    attributes: [
      "id",
      "name",
      "email",
      "phone",
      "address",
      "fieldSize",
      "profileImage",
      "createdAt",
    ],
    include: [
      {
        model: db.Device,
        as: "devices",
        required: false,
        attributes: [
          "id",
          "name",
          "deviceCode",
          "type",
          "status",
          "lastSeenAt",
          "latitude",
          "longitude",
        ],
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  return users.map((user) => {
    const plain = user.get({ plain: true });
    const devices = Array.isArray(plain.devices)
      ? plain.devices
      : [];

    return {
      id: plain.id,
      name: plain.name,
      email: plain.email,
      phone: plain.phone,
      address: plain.address,
      fieldSize: plain.fieldSize,
      profileImage: plain.profileImage,
      deviceCount: devices.length,
      devices: devices.map((device) => ({
        id: device.id,
        deviceId: device.deviceCode || device.id,
        deviceName: device.name,
        type: device.type,
        status: device.status,
        lastSeenAt: device.lastSeenAt,
        latitude: device.latitude,
        longitude: device.longitude,
      })),
    };
  });
};

const normalizeLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 12;
  }
  return Math.min(Math.round(parsed), 50);
};

const formatPredictionType = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getUserPredictionHistory = async (
  userId,
  options = {}
) => {
  if (!userId) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "User ID is required",
      400
    );
  }

  const user = await db.User.findByPk(userId, {
    attributes: ["id", "role", "name"],
  });

  if (!user) {
    throw domainError(
      ERROR_CODES.RESOURCE_NOT_FOUND,
      "User not found",
      404
    );
  }

  if (user.role !== ROLES.USER) {
    throw domainError(
      ERROR_CODES.ACCESS_DENIED,
      "Prediction history is available only for regular users",
      403
    );
  }

  if (!db.PredictionHistory) {
    return [];
  }

  const limit = normalizeLimit(options.limit);
  const retentionCutoff = new Date(
    Date.now() -
      env.PREDICTION_HISTORY.RETENTION_DAYS *
        24 *
        60 *
        60 *
        1000
  );
  const history = await db.PredictionHistory.findAll({
    where: {
      userId,
      createdAt: {
        [Op.gte]: retentionCutoff,
      },
    },
    order: [["createdAt", "DESC"]],
    limit,
  });

  return history.map((entry) => {
    const plain = entry.get({ plain: true });
    const predictionType = formatPredictionType(
      plain.predictionType
    );
    const status = String(
      plain.status ||
        PREDICTION.STATUS.SUCCESS
    ).toLowerCase();

    return {
      id: plain.id,
      userId: plain.userId,
      predictionType,
      status,
      summary: plain.summary,
      requestId: plain.requestId,
      input: plain.inputPayload,
      result: plain.resultPayload,
      createdAt: plain.createdAt,
    };
  });
};

const deleteUserByAdmin = async (
  targetUserId,
  adminUserId,
  options = {}
) => {
  if (!targetUserId) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "User ID is required",
      400
    );
  }

  const deletionMessage = normalizeDeleteMessage(
    options.message
  );

  if (!deletionMessage) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "Deletion message is required",
      400
    );
  }

  if (deletionMessage.length < 5) {
    throw domainError(
      ERROR_CODES.VALIDATION_ERROR,
      "Deletion message must be at least 5 characters",
      400
    );
  }

  const tx = await db.sequelize.transaction();
  let deletedUser = null;
  let adminDisplayName = "Administrator";

  try {
    if (adminUserId) {
      const adminUser = await db.User.findByPk(
        adminUserId,
        {
          attributes: ["id", "name"],
          transaction: tx,
        }
      );

      if (
        adminUser?.name &&
        String(adminUser.name).trim()
      ) {
        adminDisplayName = String(
          adminUser.name
        ).trim();
      }
    }

    const user = await db.User.findByPk(targetUserId, {
      attributes: [
        "id",
        "name",
        "email",
        "role",
      ],
      transaction: tx,
    });

    if (!user) {
      throw domainError(
        ERROR_CODES.RESOURCE_NOT_FOUND,
        "User not found",
        404
      );
    }

    if (user.role !== ROLES.USER) {
      throw domainError(
        ERROR_CODES.ACCESS_DENIED,
        "Only regular users can be deleted from admin view",
        403
      );
    }

    if (adminUserId && user.id === adminUserId) {
      throw domainError(
        ERROR_CODES.ACCESS_DENIED,
        "You cannot delete your own account from admin view",
        403
      );
    }

    deletedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    const devices = await db.Device.findAll({
      where: { userId: targetUserId },
      attributes: ["id"],
      transaction: tx,
    });

    const deviceIds = devices.map((device) => device.id);

    if (deviceIds.length > 0) {
      await db.SoilRecord.destroy({
        where: { deviceId: deviceIds },
        force: true,
        transaction: tx,
      });

      await db.Device.destroy({
        where: { id: deviceIds },
        force: true,
        transaction: tx,
      });
    }

    await db.RefreshToken.destroy({
      where: { userId: targetUserId },
      transaction: tx,
    });

    if (db.ChatMessage) {
      await db.ChatMessage.destroy({
        where: {
          [Op.or]: [
            { senderId: targetUserId },
            { recipientId: targetUserId },
          ],
        },
        transaction: tx,
      });
    }

    if (db.PredictionHistory) {
      await db.PredictionHistory.destroy({
        where: { userId: targetUserId },
        transaction: tx,
      });
    }

    await user.destroy({ force: true, transaction: tx });

    await tx.commit();
  } catch (err) {
    if (!tx.finished) {
      await tx.rollback();
    }
    throw err;
  }

  let notification = {
    attempted: false,
    delivered: false,
    to: deletedUser?.email || null,
    message: null,
  };

  if (deletedUser?.email) {
    notification.attempted = true;
    const deletionMail = buildAccountDeletionMail({
      recipientName: deletedUser.name,
      adminName: adminDisplayName,
      message: deletionMessage,
      deletedAt: new Date().toISOString(),
    });

    try {
      await mailer.sendMail({
        to: deletedUser.email,
        subject: deletionMail.subject,
        text: deletionMail.text,
        html: deletionMail.html,
      });

      notification.delivered = true;
      notification.message =
        "Account deletion email sent.";
    } catch (mailErr) {
      notification.delivered = false;
      notification.message =
        mailErr?.message ||
        "Unable to send account deletion email.";

      logger.error(
        "Admin user deletion email failed",
        {
          targetUserId,
          adminUserId: adminUserId || null,
          to: deletedUser.email,
          message: notification.message,
        }
      );
    }
  }

  logger.warn("Admin deleted user", {
    adminUserId: adminUserId || null,
    targetUserId,
    notificationDelivered:
      notification.delivered,
  });

  return {
    deleted: true,
    userId: targetUserId,
    notification,
  };
};

const getAdminOverview = async () => {
  const [
    totalUsers,
    activeUsers,
    totalDevices,
    activeDevices,
  ] = await Promise.all([
    db.User.count({
      where: {
        role: ROLES.USER,
      },
    }),
    db.User.count({
      where: {
        role: ROLES.USER,
        isActive: true,
      },
    }),
    db.Device.count(),
    db.Device.count({
      where: {
        status: DEVICE.STATUS.ACTIVE,
      },
    }),
  ]);

  let mlStatus = "offline";
  let mlMessage = "Model service unavailable";

  try {
    await mlClient.healthCheck();
    mlStatus = "online";
    mlMessage = "Model service reachable";
  } catch (err) {
    mlStatus = "offline";
    mlMessage =
      err?.message ||
      "Model service unavailable";
  }

  return {
    totalUsers,
    activeUsers,
    totalDevices,
    activeDevices,
    backendStatus: "online",
    backendMessage: "Backend service reachable",
    mlStatus,
    mlMessage,
    checkedAt: new Date().toISOString(),
  };
};

module.exports = {
  getAdminUsers,
  getAdminOverview,
  getUserPredictionHistory,
  deleteUserByAdmin,
};
