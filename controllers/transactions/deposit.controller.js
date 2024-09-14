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
                // Use getBalance to get the correct balance of `to_account`
                var current_balance_to_account = await getBalance(to_account);
                console.log(current_balance_to_account);

                // Calculate remaining limit for the deposit
                var remaining_limit = 10000 - current_balance_to_account;

                // Check if `to_account` has already reached or exceeded 10,000 TK
                if (current_balance_to_account >= 10000) {
                    return res.status(208).json({ message: "Limit exceeded. You cannot deposit any more to this account." });
                }

                // Check if the deposit amount exceeds the remaining limit
                if (amount > remaining_limit) {
                    return res.status(208).json({ message: `Limit exceeded. You can deposit a maximum of ${remaining_limit.toFixed(2)} tk to this customer.` });
                }

                // Deposit process
                if (amount >= 10 && amount <= 10000) {
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
                    return res.status(208).json({ message: "Minimum deposit amount is 10 tk and maximum deposit amount is 10000 tk" });
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
        } else if (!to_account_exists) {
            return res.status(404).json({ message: "To Account does not exist" });
        }
    }
};
