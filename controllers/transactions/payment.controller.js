const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { getBalance } = require('../../services/getBalance');

exports.handlePayment = async (req, res, next) => {
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

        var feeRate = 0.01;
        var commissionRate = 0.025;
        var paymentFee = feeRate * amount;
        var commission = commissionRate * amount;

        if (paymentFee <= 5) {
            paymentFee = 5;
        } else {
            paymentFee = feeRate * amount;
        }

        if ((from_account_role.getDataValue('role') === "Customer" || from_account_role.getDataValue('role') === "Agent") && to_account_role.getDataValue('role') === "Merchant") {
            var currentBalance = await getBalance(from_account);

            if (currentBalance > 0 && amount + paymentFee <= currentBalance) {
                if (amount >= 10) {
                    const debitTrnx = {
                        account: from_account,
                        from_account: from_account,
                        to_account: to_account,
                        description: "Payment",
                        trnxId: trnxId,
                        debit: amount + paymentFee,
                        credit: 0
                    };
                    const creditTrnx = {
                        account: to_account,
                        from_account: from_account,
                        to_account: to_account,
                        description: "Payment",
                        trnxId: trnxId,
                        debit: 0,
                        credit: amount + commission
                    };
                    await Transactions.create(debitTrnx);
                    await Transactions.create(creditTrnx);

                    return res.status(201).json({
                        message: "Payment successful",
                        trnxId: trnxId,
                        fee: paymentFee,
                        currentBalance: await getBalance(from_account),
                    });
                } else {
                    return res.status(208).json({ message: "Minimum Payment amount is 10 tk" });
                }
            } else {
                return res.status(208).json({ message: "Insufficient balance", currentBalance: await getBalance(from_account) });
            }
        } else {
            return res.status(208).json({ message: "From A/C should be customer or agent and To A/C should be merchant type" });
        }
    } else {
        return res.status(404).json({ message: "Account does not exist" });
    }
};
