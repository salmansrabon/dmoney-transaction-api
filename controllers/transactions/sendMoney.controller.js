const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { Commission } = require('../../sequelizeModel/Commission');
const { getBalance } = require('../../services/getBalance');
const { checkCustomerLimits } = require('../../services/limitChecker');
const { generateTrnxId } = require('../../services/generateTrnxId');
const { sequelize } = require('../../sequelizeModel/db');
const { Transaction } = require('sequelize');

exports.handleSendMoney = async (req, res, next) => {
    const { from_account, to_account, amount } = req.body;
    const amt = Number(amount);
    const trnxId = generateTrnxId();

    if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ message: 'Amount must be a valid number greater than 0' });
    }

    // Load commission rules from DB
    const config    = await Commission.getConfig('SendMoney');
    const feeRule   = config.rules.find(r => r.recipient === 'SYSTEM');
    const p2pFee    = feeRule ? Commission.calcFee(feeRule, amt) : 5;
    const minAmount = config.minTxnAmount || 10;

    const from_account_exists = await Users.findOne({ where: { phone_number: from_account } });
    const to_account_exists   = await Users.findOne({ where: { phone_number: to_account } });

    if (from_account_exists && to_account_exists) {
        // ── Authorization: the token owner must be the from_account holder ────
        // req.user.identifier is the email or phone_number used at login.
        // We match it against both fields of the from_account user record so that
        // a token issued for any user cannot be used to transact from another account.
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
            return res.status(403).json({ message: "Receiver account is not active. Please contact admin." });
        }

        const fromRole = from_account_exists.getDataValue('role');
        const toRole   = to_account_exists.getDataValue('role');

        if (fromRole === "Customer" && toRole === "Customer") {

            // ── Daily / Monthly limit check ──────────────────────────────────
            // Pass the full debit (amount + fee) so the check uses the same
            // basis as the historical SUM(debit) query in limitChecker.js.
            const limitCheck = await checkCustomerLimits(from_account, amt + p2pFee);
            if (!limitCheck.allowed) {
                return res.status(400).json({
                    message: limitCheck.message,
                    details: limitCheck.details
                });
            }

            // ── Minimum amount check (no DB needed — do it before the transaction) ──
            if (amt < minAmount) {
                return res.status(400).json({ message: `Minimum amount is ${minAmount} tk` });
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

                        if (currentBalance <= 0 || amt + p2pFee > currentBalance) {
                            // Throw to trigger automatic rollback
                            const err = new Error('INSUFFICIENT_BALANCE');
                            err.balance = currentBalance;
                            throw err;
                        }

                        const debitTrnx = {
                            account:          from_account,
                            from_account:     from_account,
                            to_account:       to_account,
                            description:      "Send Money",
                            trnxId:           trnxId,
                            debit:            amt + p2pFee,
                            credit:           0,
                            transaction_type: 'SendMoney'
                        };
                        const creditTrnx = {
                            account:          to_account,
                            from_account:     from_account,
                            to_account:       to_account,
                            description:      "Send Money",
                            trnxId:           trnxId,
                            debit:            0,
                            credit:           amt,
                            transaction_type: 'SendMoney'
                        };
                        const creditTrnxToSystem = {
                            account:          "SYSTEM",
                            from_account:     from_account,
                            to_account:       "SYSTEM",
                            description:      "Sendmoney Service Charge",
                            trnxId:           trnxId,
                            debit:            0,
                            credit:           p2pFee,
                            transaction_type: 'SendMoney'
                        };

                        // All 3 writes are atomic — they all commit or all roll back
                        await Transactions.create(debitTrnx,          { transaction: t });
                        await Transactions.create(creditTrnx,         { transaction: t });
                        await Transactions.create(creditTrnxToSystem, { transaction: t });
                    }
                );

                return res.status(201).json({
                    message:        "Send money successful",
                    trnxId:         trnxId,
                    fee:            p2pFee,
                    currentBalance: await getBalance(from_account)
                });

            } catch (err) {
                if (err.message === 'INSUFFICIENT_BALANCE') {
                    return res.status(208).json({
                        message:        "Insufficient balance",
                        currentBalance: err.balance
                    });
                }
                console.error('SendMoney transaction error:', err);
                return res.status(500).json({ message: "Internal server error", error: err.message });
            }

        } else {
            return res.status(400).json({ message: "Send money is only allowed between two Customer accounts" });
        }
    } else {
        if (!from_account_exists) {
            return res.status(404).json({ message: "From Account does not exist" });
        } else {
            return res.status(404).json({ message: "To Account does not exist" });
        }
    }
};


