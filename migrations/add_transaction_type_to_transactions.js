/**
 * Migration: Add transaction_type column to Transactions table
 *
 * Adds a nullable VARCHAR(20) column 'transaction_type' that records the
 * kind of outgoing transaction: 'SendMoney', 'Payment', 'Withdraw', 'Deposit',
 * 'StripeCashIn', etc.  Used by limitChecker to count/sum customer spending.
 *
 * Run once (idempotent):
 *   node migrations/add_transaction_type_to_transactions.js
 */

require('custom-env').env('dev');
const { sequelize } = require('../sequelizeModel/db');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected.');

    // Check whether the column already exists
    const [cols] = await sequelize.query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'Transactions'
        AND COLUMN_NAME  = 'transaction_type'
    `);

    if (cols.length > 0) {
      console.log("ℹ️  Column 'transaction_type' already exists on Transactions. Nothing to do.");
    } else {
      await sequelize.query(`
        ALTER TABLE Transactions
        ADD COLUMN transaction_type VARCHAR(20) NULL DEFAULT NULL
        AFTER credit
      `);
      console.log("✅ Column 'transaction_type' added to Transactions.");
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
