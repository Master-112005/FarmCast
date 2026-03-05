"use strict";

const db = require("../../models");
const logger = require("../../utils/logger");
const {
  hashPassword,
  comparePassword,
} = require("../../utils/hash");
const {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  hashRefreshToken,
} = require("../../utils/token");
const { ERROR_CODES } = require("../../utils/constants");
const { AUTH_ERRORS, AUTH_LIMITS } = require("./auth.constants");



if (!db?.User || !db?.RefreshToken) {
  throw new Error("AuthService: Models not initialized");
}



const domainError = (code, message, status = 401) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

const storeRefreshToken = async ({
  userId,
  rawToken,
  userAgent,
  ipAddress,
  transaction,
}) => {
  const hashed = hashRefreshToken(rawToken);

  const activeCount = await db.RefreshToken.count({
    where: { userId, isRevoked: false },
    transaction,
  });

  if (activeCount >= AUTH_LIMITS.MAX_ACTIVE_SESSIONS_PER_USER) {
    const oldest = await db.RefreshToken.findOne({
      where: { userId, isRevoked: false },
      order: [["createdAt", "ASC"]],
      transaction,
    });

    if (oldest) {
      oldest.isRevoked = true;
      await oldest.save({ transaction });
    }
  }

  return db.RefreshToken.create(
    {
      userId,
      token: hashed,
      expiresAt: getRefreshTokenExpiry(),
      userAgent,
      ipAddress,
    },
    { transaction }
  );
};



const register = async ({ name, email, password }) => {
  const tx = await db.sequelize.transaction();

  try {
    const exists = await db.User.findOne({
      where: { email },
      transaction: tx,
    });

    if (exists) {
      throw domainError(
        ERROR_CODES.DUPLICATE_RESOURCE,
        "Email already registered",
        409
      );
    }

    const hashed = await hashPassword(password);

    const user = await db.User.create(
      { name, email, password: hashed },
      { transaction: tx }
    );

    await tx.commit();

    logger.info("User registered", {
      userId: user.id,
      email: user.email,
    });

    return { id: user.id, email: user.email };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
};



const login = async ({
  email,
  password,
  userAgent,
  ipAddress,
  correlationId,
}) => {
  const user = await db.User.scope("withPassword").findOne({
    where: { email },
  });

  if (!user) {
    throw domainError(
      AUTH_ERRORS.INVALID_CREDENTIALS,
      "Invalid email or password"
    );
  }

  if (!user.isActive) {
    throw domainError(
      AUTH_ERRORS.ACCOUNT_DISABLED,
      "Account disabled",
      403
    );
  }

  const valid = await comparePassword(password, user.password);

  if (!valid) {
    throw domainError(
      AUTH_ERRORS.INVALID_CREDENTIALS,
      "Invalid email or password"
    );
  }

  const tx = await db.sequelize.transaction();

  try {
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    await storeRefreshToken({
      userId: user.id,
      rawToken: refreshToken,
      userAgent,
      ipAddress,
      transaction: tx,
    });

    await tx.commit();

    logger.info("User logged in", {
      userId: user.id,
      correlationId,
    });

    return {
      token: accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
};



const refresh = async ({
  refreshToken,
  userAgent,
  ipAddress,
  correlationId,
}) => {
  const tokenHash = hashRefreshToken(refreshToken);
  const matched = await db.RefreshToken.findOne({
    where: { isRevoked: false, token: tokenHash },
  });

  if (!matched) {
    throw domainError(
      AUTH_ERRORS.TOKEN_REVOKED,
      "Refresh token invalid"
    );
  }

  if (matched.expiresAt < new Date()) {
    matched.isRevoked = true;
    await matched.save();
    throw domainError(
      AUTH_ERRORS.TOKEN_EXPIRED,
      "Refresh token expired"
    );
  }

  const user = await db.User.findByPk(matched.userId);

  if (!user || !user.isActive) {
    throw domainError(
      AUTH_ERRORS.ACCOUNT_DISABLED,
      "Account disabled",
      403
    );
  }

  const tx = await db.sequelize.transaction();

  try {
    matched.isRevoked = true;
    await matched.save({ transaction: tx });

    const newAccess = generateAccessToken(user);
    const newRefresh = generateRefreshToken();

    await storeRefreshToken({
      userId: user.id,
      rawToken: newRefresh,
      userAgent,
      ipAddress,
      transaction: tx,
    });

    await tx.commit();

    logger.info("Token refreshed", {
      userId: user.id,
      correlationId,
    });

    return {
      token: newAccess,
      refreshToken: newRefresh,
    };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
};



const logout = async ({ refreshToken }) => {
  const tokenHash = hashRefreshToken(refreshToken);
  const rec = await db.RefreshToken.findOne({
    where: { isRevoked: false, token: tokenHash },
  });

  if (rec) {
    rec.isRevoked = true;
    await rec.save();
  }

  return true;
};



module.exports = Object.freeze({
  register,
  login,
  refresh,
  logout,
});
