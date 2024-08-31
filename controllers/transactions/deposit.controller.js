const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { getBalance } = require('../../services/getBalance');

exports.handleDeposit = async (req, res, next) => {
    const { from_account, to_account, amount } = req.body;
    var trnxId = "TXN" + Math.floor(Math.random() * 1000000);

    const from_account_exists = await Users.findOne({ where: { phone_number: from_account } });
    const to_account_exists = await Users.findOne({ where: { phone_number: to_account } });

    if (from_account_exists && to_account_exists) {
        if (from_account === to_account) {
            return res.status(208).json({ message: "From account and to account cannot be the same" });
        }

        const user_role = await Users.findOne({ where: { phone_number: from_account } });

        if (user_role.getDataValue('role') === "Agent") {
            var currentBalance = await getBalance(from_account);
            var commissionRate = 0.025;
            var commission = commissionRate * amount;

            if (currentBalance > 0 && amount <= currentBalance) {
                const total_credit = await Transactions.sum('credit', { where: { to_account: to_account, description: "Deposit" } });
                const total_debit = await Transactions.sum('debit', { where: { from_account: to_account, description: "Withdraw" } });
                var limit_diff = total_credit - total_debit;

                if (amount >= 10 && amount <= 10000) {
                    if (limit_diff + amount <= 10000) {
                        const debitTrnx = {
                            account: from_account,
                            from_account: from_account,
                            to_account: to_account,
                            description: "Deposit Commission",
                            trnxId: trnxId,
                            debit: amount,
                            credit: commission
                        };
                        const creditTrnx = {
                            account: to_account,
                            from_account: from_account,
                            to_account: to_account,
                            description: "Deposit",
                            trnxId: trnxId,
                            debit: 0,
                            credit: amount
                        };
                        await Transactions.create(debitTrnx);
                        await Transactions.create(creditTrnx);

                        return res.status(201).json({
                            message: "Deposit successful",
                            trnxId: trnxId,
                            commission: commission,
                            currentBalance: await getBalance(from_account)
                        });
                    } else {
                        return res.status(208).json({ message: "Maximum limit exceeded. You can't deposit more than 10000 tk" });
                    }
                } else {
                    return res.status(208).json({ message: "Minimum deposit amount is 10 tk and maximum deposit amount is 10000 tk" });
                }
            } else {
                return res.status(208).json({ message: "Insufficient balance", currentBalance: await getBalance(from_account) });
            }
        } else {
            return res.status(208).json({ message: "Only Agent can deposit money" });
        }
    } else {
        return res.status(404).json({ message: "Account does not exist" });
    }
};
