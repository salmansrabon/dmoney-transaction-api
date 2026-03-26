/**
 * Migration: Add `otp` and `otp_expire` columns to Users table
 *
 * otp        — 4-digit string, nullable (cleared after use)
 * otp_expire — DATETIME, nullable (set to now + 2 minutes on generation)
 *
 * Run once:
 *   node migrations/add_otp_to_users.js
 */

// Use dotenv with an absolute path so the migration works regardless of CWD
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sequelize } = require('../sequelizeModel/db');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected.');

    // ── Add otp column ────────────────────────────────────────────────────────
    const [otpCol] = await sequelize.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'Users'
         AND COLUMN_NAME  = 'otp'`
    );

    if (otpCol.length > 0) {
      console.log("ℹ️  Column 'otp' already exists. Skipping.");
    } else {
      await sequelize.query(
        `ALTER TABLE Users ADD COLUMN otp VARCHAR(4) NULL AFTER status`
      );
      console.log("✅ Column 'otp' added to Users table.");
    }

    // ── Add otp_expire column ─────────────────────────────────────────────────
    const [otpExpireCol] = await sequelize.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'Users'
         AND COLUMN_NAME  = 'otp_expire'`
    );

    if (otpExpireCol.length > 0) {
      console.log("ℹ️  Column 'otp_expire' already exists. Skipping.");
    } else {
      await sequelize.query(
        `ALTER TABLE Users ADD COLUMN otp_expire DATETIME NULL AFTER otp`
      );
      console.log("✅ Column 'otp_expire' added to Users table.");
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔒 DB connection closed.');
  }
}

migrate();
