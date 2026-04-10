const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { Commission } = require('../../sequelizeModel/Commission');
const { getBalance } = require('../../services/getBalance');
const { checkCustomerLimits } = require('../../services/limitChecker');
const { generateTrnxId } = require('../../services/generateTrnxId');
const { sequelize } = require('../../sequelizeModel/db');
const { Transaction } = require('sequelize');

exports.handleWithdraw = async (req, res, next) => {
    const { from_account, to_account, amount } = req.body;
    const amt = Number(amount);
    const trnxId = generateTrnxId();

    if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ message: 'Amount must be a valid number greater than 0' });
    }

    // Load commission rules from DB
    const config         = await Commission.getConfig('Withdraw');
    const feeRule        = config.rules.find(r => r.recipient === 'SYSTEM');
    const commissionRate = config.agentCommissionRate || 0.025;
    const minAmount      = config.minTxnAmount        || 10;

    // Calculate withdraw fee using the DB rule (respects min_fee floor)
    var withdrawFee = feeRule ? Commission.calcFee(feeRule, amt) : Math.max(amt * 0.01, 5);
    var commission  = commissionRate * amt;

    const from_account_exists = await Users.findOne({ where: { phone_number: from_account } });
    const to_account_exists   = await Users.findOne({ where: { phone_number: to_account } });

    if (from_account_exists && to_account_exists) {
        // ── Authorization: the token owner must be the from_account holder ────
        const authIdentifier = req.user.identifier;
        if (from_account_exists.getDataValue('phone_number') !== authIdentifier &&
            from_account_exists.getDataValue('email') !== authIdentifier) {
            return res.status(403).json({
                message: "Unauthorized: you can only initiate transactions from your own account"
            });
        }

        if (from_account === to_account) {
            return res.status(400).json({ message: "From account and to account cannot be the same" });
        }

        // Status checks — both accounts must be active
        if (from_account_exists.getDataValue('status') !== 'active') {
            return res.status(403).json({ message: "Your account is not active. Please contact admin." });
        }
        if (to_account_exists.getDataValue('status') !== 'active') {
            return res.status(403).json({ message: "Agent account is not active. Please contact admin." });
        }

        const fromRole = from_account_exists.getDataValue('role');
        const toRole   = to_account_exists.getDataValue('role');

        if (fromRole === "Customer" || fromRole === "Merchant") {
            if (toRole !== "Agent") {
                return res.status(400).json({ message: "To Account is not agent account" });
            }

            // ── Daily / Monthly limit check (Customers only) ──────────────────
            // Pass the full debit (amount + fee) so the check uses the same
            // basis as the historical SUM(debit) query in limitChecker.js.
            if (fromRole === "Customer") {
                const limitCheck = await checkCustomerLimits(from_account, amt + withdrawFee);
                if (!limitCheck.allowed) {
                    return res.status(400).json({
                        message: limitCheck.message,
                        details: limitCheck.details
                    });
                }
            }

            // ── Minimum amount check (no DB needed — do it before the transaction) ──
            if (amt < minAmount) {
                return res.status(400).json({
                    message:        `Minimum withdraw amount is ${minAmount} tk`,
                    currentBalance: await getBalance(from_account)
                });
            }

            try {
                // ── Atomic balance check + ledger writes ─────────────────────
                // READ_COMMITTED + FOR UPDATE ensures:
                //   1. No concurrent request reads the same balance before this debit commits
                //   2. All 3 inserts succeed or all roll back together (no partial writes)
                await sequelize.transaction(
                    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
                    async (t) => {
                        // Locked balance read — blocks concurrent requests on this account
                        const balanceRows = await sequelize.query(
                            'SELECT COALESCE(SUM(`credit`) - SUM(`debit`), 0) AS Balance FROM Transactions WHERE `account` = ? FOR UPDATE',
                            { replacements: [from_account], transaction: t, type: sequelize.QueryTypes.SELECT }
                        );
                        const currentBalance = parseFloat(balanceRows[0].Balance) || 0;

                        if (currentBalance <= 0 || amt + withdrawFee > currentBalance) {
                            const err = new Error('INSUFFICIENT_BALANCE');
                            err.balance = currentBalance;
                            throw err;
                        }

                        const debitTrnx = {
                            account:          from_account,
                            from_account:     from_account,
                            to_account:       to_account,
                            description:      "Withdraw",
                            trnxId:           trnxId,
                            debit:            amt + withdrawFee,
                            credit:           0,
                            transaction_type: 'Withdraw'
                        };
                        const creditTrnx = {
                            account:          to_account,
                            from_account:     from_account,
                            to_account:       to_account,
                            description:      "Withdraw",
                            trnxId:           trnxId,
                            debit:            0,
                            credit:           amt + commission,
                            transaction_type: 'Withdraw'
                        };
                        const creditTrnxToSystem = {
                            account:          "SYSTEM",
                            from_account:     from_account,
                            to_account:       "SYSTEM",
                            description:      "Withdraw Service Charge",
                            trnxId:           trnxId,
                            debit:            0,
                            credit:           withdrawFee,
                            transaction_type: 'Withdraw'
                        };

                        // All 3 writes are atomic — they all commit or all roll back
                        await Transactions.create(debitTrnx,          { transaction: t });
                        await Transactions.create(creditTrnx,         { transaction: t });
                        await Transactions.create(creditTrnxToSystem, { transaction: t });
                    }
                );

                return res.status(201).json({
                    message:        "Withdraw successful",
                    trnxId:         trnxId,
                    fee:            withdrawFee,
                    currentBalance: await getBalance(from_account),
                });

            } catch (err) {
                if (err.message === 'INSUFFICIENT_BALANCE') {
                    return res.status(208).json({
                        message:        "Insufficient balance",
                        currentBalance: err.balance
                    });
                }
                console.error('Withdraw transaction error:', err);
                return res.status(500).json({ message: "Internal server error", error: err.message });
            }

        } else {
            return res.status(400).json({ message: "fromAc/toAc is invalid" });
        }
    } else {
        if (!from_account_exists) {
            return res.status(404).json({ message: "From Account does not exist" });
        } else {
            return res.status(404).json({ message: "To Account does not exist" });
        }
    }
};

