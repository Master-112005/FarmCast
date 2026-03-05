"use strict";

const { Sequelize } = require("sequelize");
const env = require("./env");
const logger = require("../utils/logger");



if (!env?.DB?.HOST || !env?.DB?.NAME) {
  throw new Error("Database configuration incomplete");
}



const sequelize = new Sequelize(
  env.DB.NAME,
  env.DB.USER,
  env.DB.PASSWORD,
  {
    host: env.DB.HOST,
    port: env.DB.PORT,
    dialect: env.DB.DIALECT,

    logging:
      env.NODE_ENV === "development"
        ? (msg) => logger.debug(msg)
        : false,

    pool: {
      max: env.DB.POOL.MAX,
      min: env.DB.POOL.MIN,
      acquire: env.DB.POOL.ACQUIRE,
      idle: env.DB.POOL.IDLE,
      evict: 1000,
    },

    define: {
      freezeTableName: true,
      underscored: true,
    },

    timezone: "+00:00",

    dialectOptions: {
      multipleStatements: false,
    },

    retry: {
      max: 5,
    },
  }
);



let isConnected = false;



const connectDB = async () => {
  if (isConnected) return;

  const MAX_RETRIES = 5;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    try {
      attempt += 1;

      await sequelize.authenticate();

      isConnected = true;

      logger.info("Database connected", {
        host: env.DB.HOST,
        database: env.DB.NAME,
      });

      return;
    } catch (error) {
      logger.error("Database connection attempt failed", {
        attempt,
        message: error.message,
      });

      if (attempt >= MAX_RETRIES) {
        throw error;
      }

      await new Promise((r) =>
        setTimeout(r, attempt * 2000)
      );
    }
  }
};

const disconnectDB = async () => {
  if (!isConnected) return;

  try {
    await sequelize.close();
    isConnected = false;
    logger.info("Database connection closed");
  } catch (error) {
    logger.warn("Database close error (ignored)", {
      message: error.message,
    });
  }
};

module.exports = Object.freeze({
  sequelize,
  Sequelize,
  connectDB,
  disconnectDB,
});