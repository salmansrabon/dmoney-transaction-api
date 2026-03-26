const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { Commission } = require('../../sequelizeModel/Commission');
const { getBalance } = require('../../services/getBalance');

exports.handleSendMoney = async (req, res, next) => {
    const { from_account, to_account, amount } = req.body;
    var trnxId = "TXN" + Math.floor(Math.random() * 1000000);

    // Load commission rules from DB
    const config    = await Commission.getConfig('SendMoney');
    const feeRule   = config.rules.find(r => r.recipient === 'SYSTEM');
    const p2pFee    = feeRule ? Commission.calcFee(feeRule, amount) : 5;
    const minAmount = config.minTxnAmount || 10;

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
            return res.status(403).json({ message: "Receiver account is not active. Please contact admin." });
        }

        const fromRole = from_account_exists.getDataValue('role');
        const toRole   = to_account_exists.getDataValue('role');

        if (fromRole === "Customer" && toRole === "Customer") {
            var currentBalance = await getBalance(from_account);

            if (currentBalance > 0 && amount + p2pFee <= currentBalance) {
                if (amount >= minAmount) {
                    const debitTrnx = {
                        account:      from_account,
                        from_account: from_account,
                        to_account:   to_account,
                        description:  "Send Money",
                        trnxId:       trnxId,
                        debit:        amount + p2pFee,
                        credit:       0
                    };
                    const creditTrnx = {
                        account:      to_account,
                        from_account: from_account,
                        to_account:   to_account,
                        description:  "Send Money",
                        trnxId:       trnxId,
                        debit:        0,
                        credit:       amount
                    };
                    const creditTrnxToSystem = {
                        account:      "SYSTEM",
                        from_account: from_account,
                        to_account:   "SYSTEM",
                        description:  "Sendmoney Service Charge",
                        trnxId:       trnxId,
                        debit:        0,
                        credit:       p2pFee
                    };
                    await Transactions.create(debitTrnx);
                    await Transactions.create(creditTrnx);
                    await Transactions.create(creditTrnxToSystem);

                    return res.status(201).json({
                        message:        "Send money successful",
                        trnxId:         trnxId,
                        fee:            p2pFee,
                        currentBalance: await getBalance(from_account)
                    });
                } else {
                    return res.status(400).json({ message: `Minimum amount is ${minAmount} tk` });
                }
            } else {
                return res.status(208).json({ message: "Insufficient balance", currentBalance: await getBalance(from_account) });
            }
        } else {
            return res.status(208).json({ message: "From/To account should not be an agent account" });
        }
    } else {
        if (!from_account_exists) {
            return res.status(404).json({ message: "From Account does not exist" });
        } else {
            return res.status(404).json({ message: "To Account does not exist" });
        }
    }
};
