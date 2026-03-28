const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { Commission } = require('../../sequelizeModel/Commission');
const { getBalance } = require('../../services/getBalance');
const { generateTrnxId } = require('../../services/generateTrnxId');
const { sequelize } = require('../../sequelizeModel/db');
const { Transaction } = require('sequelize');

/**
 * Deposit endpoint — two supported flows, both require an Agent token:
 *
 *  1. SYSTEM → Regular Agent  (phone_number === 'SYSTEM', role = Agent)
 *     • Used to fund regular agent accounts from the SYSTEM pool.
 *     • to_account MUST be a regular Agent — Customer/Merchant/Admin rejected.
 *     • No commission, no per-transaction min/max limits.
 *
 *  2. Regular Agent → Customer
 *     • Agent earns a commission; customer receives the full amount.
 *     • min / max amount limits and customer balance cap enforced.
 *
 *  Both accounts must have role = Agent, but SYSTEM is identified by
 *  phone_number === 'SYSTEM'.  Every other Agent is a "regular" agent.
 */
exports.handleDeposit = async (req, res, next) => {
    const { from_account, to_account, amount } = req.body;
    const trnxId = generateTrnxId();

    // Load commission rules from DB
    const config         = await Commission.getConfig('Deposit');
    const commissionRate = config.agentCommissionRate || 0.025;
    const minAmount      = config.minTxnAmount        || 10;
    const maxLimit       = config.maxTxnAmount        || 10000;

    const from_account_exists = await Users.findOne({ where: { phone_number: from_account } });
    const to_account_exists   = await Users.findOne({ where: { phone_number: to_account } });

    if (from_account_exists && to_account_exists) {

        // ── Authorization: the token owner must be the from_account holder ────
        // Case-insensitive comparison handles the SYSTEM account being logged in
        // with either "SYSTEM" or "system" — both must match the DB value 'SYSTEM'.
        const authIdentifier = req.user.identifier;
        const dbPhone = (from_account_exists.getDataValue('phone_number') || '').toLowerCase();
        const dbEmail = (from_account_exists.getDataValue('email') || '').toLowerCase();
        const authId  = authIdentifier.toLowerCase();

        if (dbPhone !== authId && dbEmail !== authId) {
            return res.status(403).json({
                message: "Unauthorized: you can only initiate transactions from your own account"
            });
        }

        if (from_account === to_account) {
            return res.status(400).json({ message: "From account and to account cannot be the same" });
        }

        // Status checks — both accounts must be active
        if (from_account_exists.getDataValue('status') !== 'active') {
            return res.status(403).json({ message: "From account is not active. Please contact admin." });
        }
        if (to_account_exists.getDataValue('status') !== 'active') {
            return res.status(403).json({ message: "To account is not active. Please contact admin." });
        }

        // Only Agent-role accounts can initiate deposits
        if (from_account_exists.getDataValue('role') !== 'Agent') {
            return res.status(400).json({
                message: "Invalid from account. Only an Agent or the SYSTEM account can initiate a deposit."
            });
        }

        // ── Distinguish SYSTEM account from a regular Agent ──────────────────
        const isSystemAccount = from_account_exists.getDataValue('phone_number') === 'SYSTEM';
        const toRole          = to_account_exists.getDataValue('role');

        // ════════════════════════════════════════════════════════════════════
        //  FLOW 1 — SYSTEM → Regular Agent
        //  SYSTEM funds an agent account.  to_account must be a regular Agent.
        // ════════════════════════════════════════════════════════════════════
        if (isSystemAccount) {

            // to_account must be a regular Agent (not SYSTEM itself, not Customer/Merchant/Admin)
            if (toRole !== 'Agent' || to_account_exists.getDataValue('phone_number') === 'SYSTEM') {
                return res.status(400).json({
                    message: "SYSTEM account can only deposit to a regular Agent account. Customer and Merchant accounts are not allowed."
                });
            }

            const amt = Number(amount);
            if (!amt || amt <= 0) {
                return res.status(400).json({ message: "Amount must be greater than 0" });
            }

            try {
                // Atomic: lock SYSTEM balance, validate, then write both ledger rows
                await sequelize.transaction(
                    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
                    async (t) => {
                        // Lock SYSTEM balance — prevents concurrent over-draw
                        const systemRows = await sequelize.query(
                            'SELECT COALESCE(SUM(`credit`) - SUM(`debit`), 0) AS Balance FROM Transactions WHERE `account` = ? FOR UPDATE',
                            { replacements: [from_account], transaction: t, type: sequelize.QueryTypes.SELECT }
                        );
                        const systemBalance = parseFloat(systemRows[0].Balance) || 0;

                        if (systemBalance <= 0 || amt > systemBalance) {
                            const err = new Error('INSUFFICIENT_BALANCE');
                            err.balance = systemBalance;
                            throw err;
                        }

                        // SYSTEM debit
                        await Transactions.create({
                            account:          from_account,
                            from_account:     from_account,
                            to_account:       to_account,
                            description:      "System Deposit to Agent",
                            trnxId:           trnxId,
                            debit:            amt,
                            credit:           0,
                            transaction_type: 'Deposit'
                        }, { transaction: t });

                        // Agent credit
                        await Transactions.create({
                            account:          to_account,
                            from_account:     from_account,
                            to_account:       to_account,
                            description:      "Top-up from SYSTEM",
                            trnxId:           trnxId,
                            debit:            0,
                            credit:           amt,
                            transaction_type: 'Deposit'
                        }, { transaction: t });
                    }
                );

                return res.status(201).json({
                    message:      "SYSTEM deposit to Agent successful",
                    trnxId:       trnxId,
                    amount:       amt,
                    agentBalance: await getBalance(to_account)
                });

            } catch (err) {
                if (err.message === 'INSUFFICIENT_BALANCE') {
                    return res.status(208).json({
                        message:        "SYSTEM account has insufficient balance",
                        currentBalance: err.balance
                    });
                }
                console.error('SYSTEM → Agent deposit error:', err);
                return res.status(500).json({ message: "Internal server error", error: err.message });
            }

        // ════════════════════════════════════════════════════════════════════
        //  FLOW 2 — Regular Agent → Customer
        // ════════════════════════════════════════════════════════════════════
        } else {

            // to_account MUST be Customer (BRD §7.1: Regular Agent → Customer only)
            if (toRole !== 'Customer') {
                return res.status(400).json({
                    message: "To account must be a Customer account. A regular Agent can only deposit to a Customer."
                });
            }

            var commission = commissionRate * amount;

            // Amount range check
            if (amount < minAmount || amount > maxLimit) {
                return res.status(400).json({
                    message: `Minimum deposit amount is ${minAmount} tk and maximum deposit amount is ${maxLimit} tk`
                });
            }

            try {
                // Atomic balance check + ledger writes
                // READ_COMMITTED + FOR UPDATE on both accounts ensures:
                //   1. Agent can't double-spend concurrently (locked debit read)
                //   2. Two agents can't concurrently exceed the customer's cap
                //   3. All writes succeed or all roll back together
                await sequelize.transaction(
                    { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
                    async (t) => {
                        // Lock agent balance — prevents concurrent over-spend
                        const agentRows = await sequelize.query(
                            'SELECT COALESCE(SUM(`credit`) - SUM(`debit`), 0) AS Balance FROM Transactions WHERE `account` = ? FOR UPDATE',
                            { replacements: [from_account], transaction: t, type: sequelize.QueryTypes.SELECT }
                        );
                        const agentBalance = parseFloat(agentRows[0].Balance) || 0;

                        if (agentBalance <= 0 || amount > agentBalance) {
                            const err = new Error('INSUFFICIENT_BALANCE');
                            err.balance = agentBalance;
                            throw err;
                        }

                        // Lock customer balance — prevents concurrent cap breach
                        const customerRows = await sequelize.query(
                            'SELECT COALESCE(SUM(`credit`) - SUM(`debit`), 0) AS Balance FROM Transactions WHERE `account` = ? FOR UPDATE',
                            { replacements: [to_account], transaction: t, type: sequelize.QueryTypes.SELECT }
                        );
                        const customerBalance = parseFloat(customerRows[0].Balance) || 0;

                        if (customerBalance >= maxLimit) {
                            throw new Error('CUSTOMER_CAP_EXCEEDED');
                        }

                        const remaining_limit = maxLimit - customerBalance;
                        if (amount > remaining_limit) {
                            const err = new Error('AMOUNT_EXCEEDS_REMAINING_LIMIT');
                            err.remaining = remaining_limit;
                            throw err;
                        }

                        const debitTrnx = {
                            account:          from_account,
                            from_account:     from_account,
                            to_account:       to_account,
                            description:      "Deposit Commission",
                            trnxId:           trnxId,
                            debit:            amount,
                            credit:           commission,
                            transaction_type: 'Deposit'
                        };
                        const creditTrnx = {
                            account:          to_account,
                            from_account:     from_account,
                            to_account:       to_account,
                            description:      "Deposit",
                            trnxId:           trnxId,
                            debit:            0,
                            credit:           amount,
                            transaction_type: 'Deposit'
                        };

                        await Transactions.create(debitTrnx,  { transaction: t });
                        await Transactions.create(creditTrnx, { transaction: t });
                    }
                );

                return res.status(201).json({
                    message:        "Deposit successful",
                    trnxId:         trnxId,
                    commission:     commission,
                    currentBalance: await getBalance(from_account)
                });

            } catch (err) {
                if (err.message === 'INSUFFICIENT_BALANCE') {
                    return res.status(208).json({
                        message:        "Insufficient balance",
                        currentBalance: err.balance
                    });
                }
                if (err.message === 'CUSTOMER_CAP_EXCEEDED') {
                    return res.status(208).json({
                        message: "Limit exceeded. You cannot deposit any more to this account."
                    });
                }
                if (err.message === 'AMOUNT_EXCEEDS_REMAINING_LIMIT') {
                    return res.status(208).json({
                        message: `Limit exceeded. You can deposit a maximum of ${err.remaining.toFixed(2)} tk to this customer.`
                    });
                }
                console.error('Deposit transaction error:', err);
                return res.status(500).json({ message: "Internal server error", error: err.message });
            }
        }

    } else {
        if (!from_account_exists) {
            return res.status(404).json({ message: "From Account does not exist" });
        } else {
            return res.status(404).json({ message: "To Account does not exist" });
        }
    }
};
