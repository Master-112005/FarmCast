/**
 * seeders/admin.seeder.js
 * ------------------------------------------------------
 * Initial Admin User Seeder (Enterprise Hardened)
 *
 * CRITICAL FILE (SYSTEM BOOTSTRAP AUTHORITY)
 *
 * Guarantees:
 * - Idempotent
 * - Environment driven
 * - Transactional
 * - No plaintext secrets
 */

"use strict";

const bcrypt = require("bcrypt");
const { QueryTypes } = require("sequelize");
const crypto = require("crypto");


/**
 * Environment-driven configuration
 */
const ADMIN_CONFIG = Object.freeze({
  EMAIL: process.env.ADMIN_EMAIL,
  PASSWORD: process.env.ADMIN_PASSWORD,
  NAME: process.env.ADMIN_NAME || "System Administrator",
  ROLE: "admin",
});

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    /* ======================================================
       VALIDATION
    ====================================================== */

    if (!ADMIN_CONFIG.EMAIL || !ADMIN_CONFIG.PASSWORD) {
      throw new Error(
        "ADMIN_EMAIL and ADMIN_PASSWORD must be defined in environment variables"
      );
    }

    const transaction =
      await queryInterface.sequelize.transaction();

    try {
      /* ======================================================
         CHECK EXISTING USER
      ====================================================== */

      const existing = await queryInterface.sequelize.query(
        `
          SELECT id 
          FROM users
          WHERE email = :email
          LIMIT 1
        `,
        {
          replacements: {
            email: ADMIN_CONFIG.EMAIL,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );

      if (existing.length > 0) {
        console.info(
          "[ADMIN SEEDER] Admin already exists. Skipping."
        );
        await transaction.commit();
        return;
      }

      /* ======================================================
         CREATE ADMIN
      ====================================================== */

      const hashedPassword = await bcrypt.hash(
        ADMIN_CONFIG.PASSWORD,
        12
      );
      

      await queryInterface.bulkInsert(
        "users",
        [
          {
            id: crypto.randomUUID(),  
            name: ADMIN_CONFIG.NAME,
            email: ADMIN_CONFIG.EMAIL,
            password: hashedPassword,
            role: ADMIN_CONFIG.ROLE,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        { transaction }
      );

      await transaction.commit();

      console.info(
        "[ADMIN SEEDER] Admin user created successfully."
      );
    } catch (error) {
      await transaction.rollback();
      console.error(
        "[ADMIN SEEDER] Failed:",
        error.message
      );
      throw error;
    }
  },

  async down() {
    /**
     * Intentionally NOOP.
     * Admin users must never be auto-removed.
     */
    console.info(
      "[ADMIN SEEDER] Down skipped (admin preserved)."
    );
  },
};
