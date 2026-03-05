"use strict";

const http = require("http");
const process = require("process");

const env = require("./config/env");
const logger = require("./utils/logger");
const app = require("./app");



const {
  connectDB,
  disconnectDB,
} = require("./config/db");



const {
  startPredictionHistoryRetentionJob,
} = require("./jobs/predictionHistoryRetention.job");

const {
  startCommunityPostRetentionJob,
} = require("./jobs/communityPostRetention.job");

const {
  startOfflineMonitorJob,
} = require("./jobs/offlineMonitor.job");



const {
  connectMQTT,
  disconnectMQTT,
} = require("./infrastructure/mqtt/mqttClient");



const {
  initSocket,
  closeSocket,
} = require("./realtime/socket");



let server;
let shuttingDown = false;
let stopPredictionHistoryRetention = null;
let stopCommunityPostRetention = null;
let stopOfflineMonitor = null;
let forceShutdownTimer = null;



const waitForServerListening = () =>
  new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
    server.listen(env.PORT, "0.0.0.0");
  });

const startServer = async () => {
  try {
    logger.info("Starting FarmCast Backend", {
      env: env.NODE_ENV,
      pid: process.pid,
    });

    // 1) Connect DB
    await connectDB();

    // 2) Create HTTP server
    server = http.createServer(app);
    server.on("error", (err) => {
      logger.error("HTTP Server Error", {
        message: err.message,
        code: err.code,
      });
      process.exit(1);
    });

    // 3) Initialize Socket.IO
    initSocket(server);

    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;
    await waitForServerListening();

    logger.info("Server started successfully", {
      port: env.PORT,
      env: env.NODE_ENV,
      apiBase: `/api/${env.API_VERSION}`,
      uptime: process.uptime(),
    });

    // 4) Connect MQTT (after HTTP is reachable for broker callbacks)
    await connectMQTT();
    logger.info("MQTT connected successfully");

    // 5) Start jobs
    stopPredictionHistoryRetention =
      startPredictionHistoryRetentionJob();
    stopCommunityPostRetention =
      startCommunityPostRetentionJob();
    stopOfflineMonitor = startOfflineMonitorJob();
  } catch (error) {
    logger.error("Server startup failed", {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};

startServer();



const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.warn("Shutdown initiated", { signal });

  try {
    forceShutdownTimer = setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 15000);

    // Stop background jobs first to avoid new work during shutdown.
    if (
      typeof stopPredictionHistoryRetention ===
      "function"
    ) {
      stopPredictionHistoryRetention();
    }

    if (
      typeof stopCommunityPostRetention === "function"
    ) {
      stopCommunityPostRetention();
    }

    if (typeof stopOfflineMonitor === "function") {
      stopOfflineMonitor();
    }

    if (typeof closeSocket === "function") {
      await closeSocket();
    }

    if (server) {
      await new Promise((resolve) => {
        server.close(() => {
          logger.info("HTTP server closed");
          resolve();
        });
      });
    }

    // Disconnect MQTT
    if (typeof disconnectMQTT === "function") {
      await disconnectMQTT();
      logger.info("MQTT disconnected");
    }

    // Disconnect DB
    if (typeof disconnectDB === "function") {
      await disconnectDB();
      logger.info("Database disconnected");
    }

    if (forceShutdownTimer) {
      clearTimeout(forceShutdownTimer);
      forceShutdownTimer = null;
    }

    logger.info("Graceful shutdown complete");
    process.exit(0);
  } catch (error) {
    if (forceShutdownTimer) {
      clearTimeout(forceShutdownTimer);
      forceShutdownTimer = null;
    }

    logger.error("Shutdown error", {
      message: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
};



process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);



process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled Promise Rejection", {
    reason:
      reason instanceof Error ? reason.message : reason,
  });
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception", {
    message: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

module.exports = Object.freeze({
  startServer,
});
