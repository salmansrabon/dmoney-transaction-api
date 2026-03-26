/**
 * Migration: Add `status` column to Users table
 * Status values: 'pending' | 'active' | 'suspended'
 * Default: 'pending'
 *
 * Run this script once:
 *   node migrations/add_status_to_users.js
 */

require('custom-env').env('dev');
const { sequelize } = require('../sequelizeModel/db');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected.');

    // Check if column already exists
    const [results] = await sequelize.query(
      `SELECT COLUMN_NAME 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() 
         AND TABLE_NAME = 'Users' 
         AND COLUMN_NAME = 'status'`
    );

    if (results.length > 0) {
      console.log("ℹ️  Column 'status' already exists in Users table. Skipping.");
    } else {
      await sequelize.query(
        `ALTER TABLE Users 
         ADD COLUMN status ENUM('pending', 'active', 'suspended') 
         NOT NULL DEFAULT 'pending' 
         AFTER role`
      );
      console.log("✅ Column 'status' added to Users table with default 'pending'.");
    }

    // Set Admin and pre-seeded system accounts to 'active' automatically
    await sequelize.query(
      `UPDATE Users 
       SET status = 'active' 
       WHERE role = 'Admin' OR phone_number = 'SYSTEM'`
    );
    console.log("✅ Admin and SYSTEM accounts set to 'active'.");

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
    console.log('🔒 DB connection closed.');
  }
}

migrate();
