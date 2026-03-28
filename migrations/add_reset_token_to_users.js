/**
 * Migration: Add `reset_token` and `reset_token_expires` columns to Users table
 *
 * reset_token         — 64-char hex string, nullable (cleared after use)
 * reset_token_expires — DATETIME, nullable (set to now + 1 hour on generation)
 *
 * Run once:
 *   node migrations/add_reset_token_to_users.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sequelize } = require('../sequelizeModel/db');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected.');

    // ── Add reset_token column ────────────────────────────────────────────────
    const [resetTokenCol] = await sequelize.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'Users'
         AND COLUMN_NAME  = 'reset_token'`
    );

    if (resetTokenCol.length > 0) {
      console.log("ℹ️  Column 'reset_token' already exists. Skipping.");
    } else {
      await sequelize.query(
        `ALTER TABLE Users ADD COLUMN reset_token VARCHAR(64) NULL AFTER otp_expire`
      );
      console.log("✅ Column 'reset_token' added to Users table.");
    }

    // ── Add reset_token_expires column ────────────────────────────────────────
    const [resetExpireCol] = await sequelize.query(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'Users'
         AND COLUMN_NAME  = 'reset_token_expires'`
    );

    if (resetExpireCol.length > 0) {
      console.log("ℹ️  Column 'reset_token_expires' already exists. Skipping.");
    } else {
      await sequelize.query(
        `ALTER TABLE Users ADD COLUMN reset_token_expires DATETIME NULL AFTER reset_token`
      );
      console.log("✅ Column 'reset_token_expires' added to Users table.");
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
