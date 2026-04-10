/**
 * Sequelize model for the TransactionLimits table.
 *
 * Each row defines the maximum outgoing transaction amount and count
 * for a given user role within a given time period.
 *
 * Seeded by: migrations/create_transaction_limits.js
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('./db');

const TransactionLimit = sequelize.define('TransactionLimit', {
    role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        comment: 'User role this limit applies to, e.g. Customer'
    },
    period: {
        type: DataTypes.ENUM('daily', 'monthly'),
        allowNull: false,
        comment: 'Rolling window: daily resets at midnight, monthly at 1st of month'
    },
    max_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        comment: 'Maximum cumulative outgoing amount (Tk) in the period'
    },
    max_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        comment: 'Maximum number of outgoing transactions in the period'
    },
    is_active: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1
    }
}, {
    tableName: 'TransactionLimits',
    timestamps: true
});

module.exports = { TransactionLimit };
