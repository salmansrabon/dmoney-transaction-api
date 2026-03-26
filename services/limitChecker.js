/**
 * limitChecker.js
 *
 * Checks whether a customer's OUTGOING transaction (SendMoney, Payment, Withdraw)
 * would breach the per-period limits defined in the TransactionLimits table.
 *
 * Limits are enforced on the customer's DEBIT rows only
 * (account = customerPhone, debit > 0, transaction_type IN ('SendMoney','Payment','Withdraw')).
 *
 * Usage:
 *   const { checkCustomerLimits } = require('../../services/limitChecker');
 *   const check = await checkCustomerLimits(customerPhone, amount);
 *   if (!check.allowed) return res.status(400).json({ message: check.message, details: check.details });
 */

const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../sequelizeModel/db');
const { TransactionLimit } = require('../sequelizeModel/TransactionLimit');

// Transaction types that count against a customer's outgoing limit
const OUTGOING_TYPES = ['SendMoney', 'Payment', 'Withdraw'];

/**
 * Returns a Date object for the start of the current UTC day (midnight).
 */
function startOfDay() {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

/**
 * Returns a Date object for the first millisecond of the current UTC month.
 */
function startOfMonth() {
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

/**
 * Fetches the running totals (amount spent + transaction count) for a customer
 * within the given period start date.
 *
 * @param {string} customerPhone  - The customer's phone number (= account field)
 * @param {Date}   periodStart    - Start of the window to query
 * @returns {{ usedAmount: number, usedCount: number }}
 */
async function getUsage(customerPhone, periodStart) {
    const [rows] = await sequelize.query(
        `SELECT
             COALESCE(SUM(debit), 0)               AS usedAmount,
             COUNT(DISTINCT trnxId)                AS usedCount
         FROM Transactions
         WHERE account          = :phone
           AND debit            > 0
           AND transaction_type IN (:types)
           AND createdAt        >= :since`,
        {
            replacements: {
                phone: customerPhone,
                types: OUTGOING_TYPES,
                since: periodStart
            },
            type: sequelize.QueryTypes.SELECT
        }
    );

    return {
        usedAmount: parseFloat(rows.usedAmount) || 0,
        usedCount:  parseInt(rows.usedCount,  10) || 0
    };
}

/**
 * Checks all active TransactionLimits for role='Customer' against the current
 * usage + the proposed new amount.
 *
 * @param {string} customerPhone  - Sender's phone number
 * @param {number} amount         - Proposed transaction amount (Tk, EXCLUDING fee)
 *
 * @returns {Promise<{
 *   allowed: boolean,
 *   message?: string,
 *   details?: {
 *     period: string,
 *     usedAmount: number,
 *     usedCount: number,
 *     maxAmount: number,
 *     maxCount: number,
 *     remainingAmount: number,
 *     remainingCount: number
 *   }
 * }>}
 */
async function checkCustomerLimits(customerPhone, amount) {
    // Load all active limits for Customer role
    const limits = await TransactionLimit.findAll({
        where: { role: 'Customer', is_active: 1 }
    });

    if (!limits || limits.length === 0) {
        // No limits configured — allow the transaction
        return { allowed: true };
    }

    for (const limitRow of limits) {
        const period     = limitRow.getDataValue('period');         // 'daily' | 'monthly'
        const maxAmount  = parseFloat(limitRow.getDataValue('max_amount'));
        const maxCount   = parseInt(limitRow.getDataValue('max_count'), 10);

        const periodStart = period === 'daily' ? startOfDay() : startOfMonth();
        const { usedAmount, usedCount } = await getUsage(customerPhone, periodStart);

        const remainingAmount = maxAmount - usedAmount;
        const remainingCount  = maxCount  - usedCount;

        const details = {
            period,
            usedAmount,
            usedCount,
            maxAmount,
            maxCount,
            remainingAmount: Math.max(0, remainingAmount),
            remainingCount:  Math.max(0, remainingCount)
        };

        // Check transaction COUNT limit first
        if (usedCount >= maxCount) {
            return {
                allowed: false,
                message: `${period.charAt(0).toUpperCase() + period.slice(1)} transaction limit reached. ` +
                         `You have used all ${maxCount} allowed transactions for this ${period} period.`,
                details
            };
        }

        // Check cumulative AMOUNT limit
        if (usedAmount + amount > maxAmount) {
            return {
                allowed: false,
                message: `${period.charAt(0).toUpperCase() + period.slice(1)} amount limit exceeded. ` +
                         `You can send at most ${remainingAmount.toFixed(2)} Tk more this ${period} period ` +
                         `(limit: ${maxAmount} Tk, used: ${usedAmount.toFixed(2)} Tk).`,
                details
            };
        }
    }

    return { allowed: true };
}

module.exports = { checkCustomerLimits };
