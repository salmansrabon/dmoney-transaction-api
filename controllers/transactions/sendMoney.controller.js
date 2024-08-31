const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { getBalance } = require('../../services/getBalance');

exports.handleSendMoney = async (req, res, next) => {
    const { from_account, to_account, amount } = req.body;
    var trnxId = "TXN" + Math.floor(Math.random() * 1000000);

    const from_account_exists = await Users.findOne({ where: { phone_number: from_account } });
    const to_account_exists = await Users.findOne({ where: { phone_number: to_account } });

    if (from_account_exists && to_account_exists) {
        if (from_account === to_account) {
            return res.status(208).json({ message: "From account and to account cannot be the same" });
        }

        const from_account_role = await Users.findOne({ where: { phone_number: from_account } });
        const to_account_role = await Users.findOne({ where: { phone_number: to_account } });
        var p2pFee = 5;

        if (from_account_role.getDataValue('role') === "Customer" && to_account_role.getDataValue('role') === "Customer") {
            var currentBalance = await getBalance(from_account);

            if (currentBalance > 0 && amount <= currentBalance) {
                if (amount >= 10) {
                    const debitTrnx = {
                        account: from_account,
                        from_account: from_account,
                        to_account: to_account,
                        description: "Send Money",
                        trnxId: trnxId,
                        debit: amount + p2pFee,
                        credit: 0
                    };
                    const creditTrnx = {
                        account: to_account,
                        from_account: from_account,
                        to_account: to_account,
                        description: "Send Money",
                        trnxId: trnxId,
                        debit: 0,
                        credit: amount
                    };
                    await Transactions.create(debitTrnx);
                    await Transactions.create(creditTrnx);

                    return res.status(201).json({
                        message: "Send money successful",
                        trnxId: trnxId,
                        fee: p2pFee,
                        currentBalance: await getBalance(from_account)
                    });
                } else {
                    return res.status(208).json({ message: "Minimum amount is 10 tk" });
                }
            } else {
                return res.status(208).json({ message: "Insufficient balance", currentBalance: await getBalance(from_account) });
            }
        } else {
            return res.status(208).json({ message: "From/To account should not be an agent account" });
        }
    } else {
        return res.status(404).json({ message: "From/To Account does not exist" });
    }
};
