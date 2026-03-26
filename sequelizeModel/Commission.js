const { DataTypes } = require('sequelize');
const { sequelize } = require('./db');

const Commission = sequelize.define('Commissions', {
    transaction_type: {
        type: DataTypes.ENUM('Deposit', 'Withdraw', 'SendMoney', 'Payment'),
        allowNull: false
    },
    fee_name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    fee_type: {
        type: DataTypes.ENUM('percentage', 'flat'),
        allowNull: false
    },
    rate: {
        type: DataTypes.DECIMAL(10, 6),
        allowNull: false
    },
    min_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
    },
    max_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
    },
    recipient: {
        type: DataTypes.ENUM('SYSTEM', 'Agent', 'Merchant'),
        allowNull: false
    },
    charged_to: {
        type: DataTypes.ENUM('from_account', 'to_account', 'platform'),
        allowNull: false
    },
    min_txn_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 10.00
    },
    max_txn_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
    }
}, {
    // Use the exact table name we created in the migration
    tableName: 'Commissions',
    timestamps: true
});

/**
 * Helper: load all active rules for a given transaction type
 * Returns a plain object with the most-used values pre-computed.
 *
 * Usage:
 *   const config = await Commission.getConfig('Deposit');
 *   config.agentCommissionRate  // 0.025
 *   config.minTxnAmount         // 10
 *   config.maxTxnAmount         // 10000
 */
Commission.getConfig = async (transactionType) => {
    const rules = await Commission.findAll({
        where: { transaction_type: transactionType, is_active: true }
    });

    const result = {
        rules,               // raw rule objects for full flexibility
        minTxnAmount: 10,    // sensible defaults
        maxTxnAmount: null,
    };

    for (const rule of rules) {
        const rate = parseFloat(rule.rate);
        const minFee = rule.min_fee !== null ? parseFloat(rule.min_fee) : null;

        // Populate convenience properties based on recipient + fee_type
        if (rule.recipient === 'SYSTEM') {
            result.serviceFeeRate = rate;
            result.serviceFeeType = rule.fee_type;
            result.minServiceFee  = minFee;
        } else if (rule.recipient === 'Agent') {
            result.agentCommissionRate = rate;
        } else if (rule.recipient === 'Merchant') {
            result.merchantCommissionRate = rate;
        }

        // Transaction limits (take from the first rule that has them)
        if (rule.min_txn_amount !== null) {
            result.minTxnAmount = parseFloat(rule.min_txn_amount);
        }
        if (rule.max_txn_amount !== null) {
            result.maxTxnAmount = parseFloat(rule.max_txn_amount);
        }
    }

    return result;
};

/**
 * Helper: compute a fee amount from a rule
 *   fee_type=percentage  →  rate * amount  (floored to min_fee if set)
 *   fee_type=flat        →  rate  (fixed amount)
 */
Commission.calcFee = (rule, amount) => {
    const rate = parseFloat(rule.rate);
    const minFee = rule.min_fee !== null ? parseFloat(rule.min_fee) : null;

    let fee = rule.fee_type === 'flat' ? rate : rate * amount;
    if (minFee !== null && fee < minFee) fee = minFee;
    return fee;
};

module.exports = { Commission };
