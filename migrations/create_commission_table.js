/**
 * Migration: Create Commission table and seed default fee/commission rules
 *
 * Replaces the hardcoded config.json with a DB-driven commission configuration.
 *
 * Run this script once (safe to re-run — idempotent):
 *   node migrations/create_commission_table.js
 *
 * NOTE: Sequelize sync() may auto-create the table as empty when the server
 * first starts (because Commission.js is loaded). This script handles that
 * gracefully by checking row count separately from table existence.
 */

require('custom-env').env('dev');
const { sequelize } = require('../sequelizeModel/db');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected.');

    // ── 1. Check if table already exists ───────────────────────────────────
    const [tableCheck] = await sequelize.query(
      `SELECT TABLE_NAME
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'Commissions'`
    );

    if (tableCheck.length === 0) {
      // ── 2a. Table does not exist — create it ─────────────────────────────
      await sequelize.query(`
        CREATE TABLE Commissions (
          id                INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
          transaction_type  ENUM('Deposit','Withdraw','SendMoney','Payment') NOT NULL,
          fee_name          VARCHAR(100)  NOT NULL,
          fee_type          ENUM('percentage','flat') NOT NULL,
          rate              DECIMAL(10,6) NOT NULL,
          min_fee           DECIMAL(10,2) DEFAULT NULL,
          max_fee           DECIMAL(10,2) DEFAULT NULL,
          recipient         ENUM('SYSTEM','Agent','Merchant') NOT NULL,
          charged_to        ENUM('from_account','to_account','platform') NOT NULL,
          min_txn_amount    DECIMAL(10,2) NOT NULL DEFAULT 10.00,
          max_txn_amount    DECIMAL(10,2) DEFAULT NULL,
          is_active         TINYINT(1)    NOT NULL DEFAULT 1,
          createdAt         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log("✅ Table 'Commissions' created.");
    } else {
      console.log("ℹ️  Table 'Commissions' already exists (may have been auto-created by Sequelize sync).");
    }

    // ── 2b. Always check row count — seed only if table is empty ───────────
    const [[{ rowCount }]] = await sequelize.query(
      `SELECT COUNT(*) AS rowCount FROM Commissions`
    );

    if (parseInt(rowCount, 10) > 0) {
      console.log(`ℹ️  Commissions table already has ${rowCount} row(s). Skipping seed.`);
    } else {
      // ── 3. Seed default rules (mirrors config.json exactly) ───────────────
      await sequelize.query(`
        INSERT INTO Commissions
          (transaction_type, fee_name,              fee_type,     rate,       min_fee, max_fee, recipient,   charged_to,     min_txn_amount, max_txn_amount, is_active, createdAt,   updatedAt)
        VALUES
          -- Deposit: Agent earns 2.5% commission; no system fee on deposit
          ('Deposit',   'Agent Commission',    'percentage', 0.025000, NULL, NULL,  'Agent',    'platform',     10.00, 10000.00, 1, NOW(), NOW()),

          -- Withdraw: System takes 1% (min 5 BDT) from payer
          ('Withdraw',  'Service Fee',         'percentage', 0.010000, 5.00, NULL,  'SYSTEM',   'from_account', 10.00, NULL,     1, NOW(), NOW()),

          -- Withdraw: Agent earns 2.5% commission on top
          ('Withdraw',  'Agent Commission',    'percentage', 0.025000, NULL, NULL,  'Agent',    'platform',     10.00, NULL,     1, NOW(), NOW()),

          -- Send Money: System takes flat 5 BDT from sender
          ('SendMoney', 'Service Fee',         'flat',       5.000000, NULL, NULL,  'SYSTEM',   'from_account', 10.00, NULL,     1, NOW(), NOW()),

          -- Payment: System takes 1% (min 5 BDT) from payer
          ('Payment',   'Service Fee',         'percentage', 0.010000, 5.00, NULL,  'SYSTEM',   'from_account', 10.00, NULL,     1, NOW(), NOW()),

          -- Payment: Merchant earns 2.5% commission on top
          ('Payment',   'Merchant Commission', 'percentage', 0.025000, NULL, NULL,  'Merchant', 'platform',     10.00, NULL,     1, NOW(), NOW());
      `);
      console.log("✅ Default commission rules seeded (6 rows).");
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
