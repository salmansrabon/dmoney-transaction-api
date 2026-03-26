const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { Commission } = require('../../sequelizeModel/Commission');
const { getBalance } = require('../../services/getBalance');

exports.handleDeposit = async (req, res, next) => {
    const { from_account, to_account, amount } = req.body;
    var trnxId = "TXN" + Math.floor(Math.random() * 1000000);

    // Load commission rules from DB
    const config = await Commission.getConfig('Deposit');
    const commissionRate = config.agentCommissionRate || 0.025;
    const minAmount      = config.minTxnAmount        || 10;
    const maxLimit       = config.maxTxnAmount        || 10000;

    const from_account_exists = await Users.findOne({ where: { phone_number: from_account } });
    const to_account_exists   = await Users.findOne({ where: { phone_number: to_account } });

    if (from_account_exists && to_account_exists) {
        if (from_account === to_account) {
            return res.status(400).json({ message: "From account and to account cannot be the same" });
        }

        // Status checks — both accounts must be active
        if (from_account_exists.getDataValue('status') !== 'active') {
            return res.status(403).json({ message: "Agent account is not active. Please contact admin." });
        }
        if (to_account_exists.getDataValue('status') !== 'active') {
            return res.status(403).json({ message: "Customer account is not active. Please contact admin." });
        }

        if (from_account_exists.getDataValue('role') === "Agent") {
            var currentBalance  = await getBalance(from_account);
            var commission      = commissionRate * amount;

            if (currentBalance > 0 && amount <= currentBalance) {
                var current_balance_to_account = await getBalance(to_account);

                // Check customer deposit cap
                if (current_balance_to_account >= maxLimit) {
                    return res.status(208).json({ message: "Limit exceeded. You cannot deposit any more to this account." });
                }

                var remaining_limit = maxLimit - current_balance_to_account;
                if (amount > remaining_limit) {
                    return res.status(208).json({ message: `Limit exceeded. You can deposit a maximum of ${remaining_limit.toFixed(2)} tk to this customer.` });
                }

                if (amount >= minAmount && amount <= maxLimit) {
                    const debitTrnx = {
                        account:      from_account,
                        from_account: from_account,
                        to_account:   to_account,
                        description:  "Deposit Commission",
                        trnxId:       trnxId,
                        debit:        amount,
                        credit:       commission
                    };
                    const creditTrnx = {
                        account:      to_account,
                        from_account: from_account,
                        to_account:   to_account,
                        description:  "Deposit",
                        trnxId:       trnxId,
                        debit:        0,
                        credit:       amount
                    };
                    await Transactions.create(debitTrnx);
                    await Transactions.create(creditTrnx);

                    return res.status(201).json({
                        message:        "Deposit successful",
                        trnxId:         trnxId,
                        commission:     commission,
                        currentBalance: await getBalance(from_account)
                    });
                } else {
                    return res.status(400).json({ message: `Minimum deposit amount is ${minAmount} tk and maximum deposit amount is ${maxLimit} tk` });
                }
            } else {
                return res.status(208).json({ message: "Insufficient balance", currentBalance: await getBalance(from_account) });
            }
        } else {
            return res.status(208).json({ message: "Only Agent can deposit money" });
        }
    } else {
        if (!from_account_exists) {
            return res.status(404).json({ message: "From Account does not exist" });
        } else {
            return res.status(404).json({ message: "To Account does not exist" });
        }
    }
};
