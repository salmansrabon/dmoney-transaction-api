const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { Commission } = require('../../sequelizeModel/Commission');
const { getBalance } = require('../../services/getBalance');
const { checkCustomerLimits } = require('../../services/limitChecker');

exports.handleWithdraw = async (req, res, next) => {
    const { from_account, to_account, amount } = req.body;
    var trnxId = "TXN" + Math.floor(Math.random() * 1000000);

    // Load commission rules from DB
    const config         = await Commission.getConfig('Withdraw');
    const feeRule        = config.rules.find(r => r.recipient === 'SYSTEM');
    const commissionRate = config.agentCommissionRate || 0.025;
    const minAmount      = config.minTxnAmount        || 10;

    // Calculate withdraw fee using the DB rule (respects min_fee floor)
    var withdrawFee = feeRule ? Commission.calcFee(feeRule, amount) : Math.max(amount * 0.01, 5);
    var commission  = commissionRate * amount;

    const from_account_exists = await Users.findOne({ where: { phone_number: from_account } });
    const to_account_exists   = await Users.findOne({ where: { phone_number: to_account } });

    if (from_account_exists && to_account_exists) {
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
            if (fromRole === "Customer") {
                const limitCheck = await checkCustomerLimits(from_account, amount);
                if (!limitCheck.allowed) {
                    return res.status(400).json({
                        message: limitCheck.message,
                        details: limitCheck.details
                    });
                }
            }

            var currentBalance = await getBalance(from_account);

            if (currentBalance > 0 && amount + withdrawFee <= currentBalance) {
                if (amount >= minAmount) {
                    const debitTrnx = {
                        account:          from_account,
                        from_account:     from_account,
                        to_account:       to_account,
                        description:      "Withdraw",
                        trnxId:           trnxId,
                        debit:            amount + withdrawFee,
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
                        credit:           amount + commission,
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
                    await Transactions.create(debitTrnx);
                    await Transactions.create(creditTrnx);
                    await Transactions.create(creditTrnxToSystem);

                    return res.status(201).json({
                        message:        "Withdraw successful",
                        trnxId:         trnxId,
                        fee:            withdrawFee,
                        currentBalance: await getBalance(from_account),
                    });
                } else {
                    return res.status(400).json({
                        message:        `Minimum withdraw amount is ${minAmount} tk`,
                        currentBalance: await getBalance(from_account)
                    });
                }
            } else {
                return res.status(208).json({ message: "Insufficient balance", currentBalance: await getBalance(from_account) });
            }
        } else {
            return res.status(400).json({ message: "fromAc/toAc is invalid" });
        }
    } else {
        if (!from_account_exists) {
            return res.status(400).json({ message: "From Account does not exist" });
        } else {
            return res.status(400).json({ message: "To Account does not exist" });
        }
    }
};
