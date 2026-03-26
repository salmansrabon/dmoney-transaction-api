/**
 * Migration: Create TransactionLimits table and seed Customer daily/monthly limits
 *
 * Limits enforced on OUTGOING Customer transactions (SendMoney, Payment, Withdraw):
 *   Daily   — max 5 000 Tk total,  max 10 transactions
 *   Monthly — max 50 000 Tk total, max 50 transactions
 *
 * Run once (idempotent):
 *   node migrations/create_transaction_limits.js
 */

require('custom-env').env('dev');
const { sequelize } = require('../sequelizeModel/db');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected.');

    // ── 1. Create table if it does not exist ─────────────────────────────────
    const [tableCheck] = await sequelize.query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'TransactionLimits'
    `);

    if (tableCheck.length === 0) {
      await sequelize.query(`
        CREATE TABLE TransactionLimits (
          id               INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
          role             VARCHAR(20)   NOT NULL COMMENT 'User role this limit applies to (e.g. Customer)',
          period           ENUM('daily','monthly') NOT NULL COMMENT 'Rolling window for the limit',
          max_amount       DECIMAL(15,2) NOT NULL COMMENT 'Maximum cumulative outgoing amount in the period (Tk)',
          max_count        INT           NOT NULL COMMENT 'Maximum number of outgoing transactions in the period',
          is_active        TINYINT(1)    NOT NULL DEFAULT 1,
          createdAt        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_role_period (role, period)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
          COMMENT='Per-role, per-period spending limits for outgoing transactions';
      `);
      console.log("✅ Table 'TransactionLimits' created.");
    } else {
      console.log("ℹ️  Table 'TransactionLimits' already exists.");
    }

    // ── 2. Seed if the table is empty ─────────────────────────────────────────
    const [[{ rowCount }]] = await sequelize.query(
      `SELECT COUNT(*) AS rowCount FROM TransactionLimits`
    );

    if (parseInt(rowCount, 10) > 0) {
      console.log(`ℹ️  TransactionLimits already has ${rowCount} row(s). Skipping seed.`);
    } else {
      await sequelize.query(`
        INSERT INTO TransactionLimits (role, period, max_amount, max_count, is_active, createdAt, updatedAt)
        VALUES
          ('Customer', 'daily',   5000.00,  10, 1, NOW(), NOW()),
          ('Customer', 'monthly', 50000.00, 50, 1, NOW(), NOW())
      `);
      console.log("✅ Default Customer limits seeded (daily: 5000/10 txns, monthly: 50000/50 txns).");
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
