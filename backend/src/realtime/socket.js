"use strict";

const { Server } = require("socket.io");

const env = require("../config/env");
const logger = require("../utils/logger");

let io;

const EXPECTED_DISCONNECT_REASONS = new Set([
  "client namespace disconnect",
  "server namespace disconnect",
]);

const getCorsOrigins = () =>
  String(env.CORS?.ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

function initSocket(server) {
  const origins = getCorsOrigins();

  io = new Server(server, {
    path: "/socket.io",
    cors: {
      origin:
        origins.length > 0
          ? origins
          : "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  logger.info("Socket.IO initialized", {
    path: "/socket.io",
    origins,
  });

  io.on("connection", (socket) => {
    logger.info("Socket client connected", {
      socketId: socket.id,
    });

    socket.on("join:user", (userId) => {
      if (!userId) return;

      socket.join(userId);
      logger.info("Socket room joined", {
        socketId: socket.id,
        room: userId,
      });
    });

    socket.on("disconnect", (reason) => {
      const log = EXPECTED_DISCONNECT_REASONS.has(
        reason
      )
        ? logger.debug
        : logger.info;

      log("Socket client disconnected", {
        socketId: socket.id,
        reason,
      });
    });
  });

  io.engine.on("connection_error", (error) => {
    logger.warn("Socket connection error", {
      code: error.code,
      message: error.message,
    });
  });
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
}

async function closeSocket() {
  if (!io) {
    return;
  }

  await new Promise((resolve) => {
    try {
      io.disconnectSockets(true);
      io.close(() => {
        logger.info("Socket.IO server closed");
        resolve();
      });
    } catch (error) {
      logger.warn("Socket.IO close failed (ignored)", {
        message: error.message,
      });
      resolve();
    }
  });

  io = null;
}

module.exports = { initSocket, getIO, closeSocket };

