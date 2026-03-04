/**
 * src/config/sequelize-cli.js
 * ------------------------------------------------------
 * Sequelize CLI Configuration
 *
 * PURPOSE:
 * - Used ONLY by sequelize-cli
 * - Exports plain config object (NOT Sequelize instance)
 *
 * IMPORTANT:
 * - Do NOT import this in runtime code
 */

require("dotenv").config();

module.exports = {
  development: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: process.env.DB_DIALECT || "mysql",
    logging: false,
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: process.env.DB_DIALECT || "mysql",
    logging: false,
  },
};
