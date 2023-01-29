const express = require('express');
const router = express.Router();
const { Transactions } = require('../sequelizeModel/Transactions');
const { Users } = require('../sequelizeModel/Users');
const { authenticateJWT } = require('../../jwtMiddleware');
const { getBalance } = require('./getBalance');
const { sequelize } = require('../sequelizeModel/db');

router.post('/withdraw', authenticateJWT, async (req, res, next) => {

    // check if from_account and to_account exists
    const { from_account, to_account, amount } = req.body;
    var trnxId = "TXN" + Math.floor(Math.random() * 1000000);
    const from_account_exists = await Users.findOne({
        where: {
            phone_number: from_account
        }
    });
    const to_account_exists = await Users.findOne({
        where: {
            phone_number: to_account
        }
    });
    if (from_account_exists && to_account_exists) {

        // check if from_account and to_account are same
        if (from_account == to_account) {
            res.status(208).json({
                message: "From account and to account cannot be same"
            });
        }
        else {
            // find user role of from_account
            const from_account_role = await Users.findOne({
                where: {
                    phone_number: from_account
                }
            })
            const to_account_role = await Users.findOne({
                where: {
                    phone_number: to_account
                }
            })
            var feeRate = 0.01;
            var commissionRate = 0.025;
            var withdrawFee = feeRate * amount;
            var commission = commissionRate * amount;
            if (withdrawFee <= 5) {
                withdrawFee = 5;
            }
            else {
                withdrawFee = feeRate * amount;
            }
            if (from_account_role.getDataValue('role') == "Customer" && to_account_role.getDataValue('role') == "Agent") {
                var currentBalance = await getBalance(from_account);
                // check if from_account has sufficient balance
                if (currentBalance > 0 && amount + withdrawFee <= currentBalance) {
                    if (amount >= 10) {
                        const debitTrnx = {
                            account: from_account,
                            from_account: from_account,
                            to_account: to_account,
                            description: "Withdraw",
                            trnxId: trnxId,
                            debit: amount + withdrawFee,
                            credit: 0
                        }
                        const creditTrnx = {
                            account: to_account,
                            from_account: from_account,
                            to_account: to_account,
                            description: "Withdraw",
                            trnxId: trnxId,
                            debit: 0,
                            credit: amount + commission
                        }
                        await Transactions.create(debitTrnx)
                        await Transactions.create(creditTrnx)

                        res.status(201).json({
                            message: "Withdraw successful",
                            trnxId: trnxId,
                            fee: withdrawFee,
                            currentBalance: await getBalance(from_account),
                        });
                    }
                    else {
                        res.status(208).json({
                            message: "Minimum withdraw amount 10 tk"
                        });
                    }
                }
                else {
                    res.status(208).json({
                        message: "Insufficient balance",
                        currentBalance: await getBalance(from_account)
                    });
                }

            }
            else {
                res.status(208).json({
                    message: "Customer can not withdraw money from another customer"
                });
            }

        }
    }
    else {
        res.status(404).json({
            message: "Account does not exist"
        });
    }

})

module.exports = router;