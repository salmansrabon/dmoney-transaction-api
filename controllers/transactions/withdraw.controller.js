const { json } = require('body-parser');
const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { getBalance } = require('../../services/getBalance');
const jsonConfig=require('./config.json');

exports.handleWithdraw = async (req, res, next) => {
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

        var feeRate = jsonConfig.withdraw.serviceFee;
        var commissionRate = jsonConfig.withdraw.agentComission;
        var withdrawFee = feeRate * amount;
        var commission = commissionRate * amount;
        var minAmount = jsonConfig.withdraw.minAmount;

        if (withdrawFee <= 5) {
            withdrawFee = 5;
        } else {
            withdrawFee = feeRate * amount;
        }

        if (from_account_role.getDataValue('role') === "Customer" && to_account_role.getDataValue('role') === "Agent") {
            var currentBalance = await getBalance(from_account);

            if (currentBalance > 0 && amount + withdrawFee <= currentBalance) {
                if (amount >= minAmount) {
                    const debitTrnx = {
                        account: from_account,
                        from_account: from_account,
                        to_account: to_account,
                        description: "Withdraw",
                        trnxId: trnxId,
                        debit: amount + withdrawFee,
                        credit: 0
                    };
                    const creditTrnx = {
                        account: to_account,
                        from_account: from_account,
                        to_account: to_account,
                        description: "Withdraw",
                        trnxId: trnxId,
                        debit: 0,
                        credit: amount + commission
                    };
                    const creditTrnxToSystem = {
                        account: "SYSTEM",
                        from_account: from_account,
                        to_account: "SYSTEM",
                        description: "Withdraw Service Charge",
                        trnxId: trnxId,
                        debit: 0,
                        credit: withdrawFee
                    };
                    await Transactions.create(debitTrnx);
                    await Transactions.create(creditTrnx);
                    await Transactions.create(creditTrnxToSystem);

                    return res.status(201).json({
                        message: "Withdraw successful",
                        trnxId: trnxId,
                        fee: withdrawFee,
                        currentBalance: await getBalance(from_account),
                    });
                } else {
                    return res.status(208).json({ 
                        message: `Minimum withdraw amount is ${minAmount} tk` ,
                        currentBalance: await getBalance(from_account)
                    });
                }
            } else {
                return res.status(208).json({ message: "Insufficient balance", currentBalance: await getBalance(from_account) });
            }
        } else {
            return res.status(208).json({ message: "Customer cannot withdraw money from another customer" });
        }
    } else {
        if(!from_account_exists){
            return res.status(404).json({ message: "From Account does not exist" });
        }
        else if(!to_account_exists){
            return res.status(404).json({ message: "To Account does not exist" });
        }
        
    }
};
