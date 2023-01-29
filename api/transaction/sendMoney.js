const express = require('express');
const router = express.Router();
const { Transactions } = require('../sequelizeModel/Transactions');
const { Users } = require('../sequelizeModel/Users');
const { authenticateJWT } = require('../../jwtMiddleware');
const { getBalance } = require('./getBalance');

const { sequelize } = require('../sequelizeModel/db');

router.post('/sendmoney', authenticateJWT, async (req, res, next) => {

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
            var p2pFee = 5;
            if (from_account_role.getDataValue('role') == "Customer" && to_account_role.getDataValue('role') == "Customer") {
                var currentBalance = await getBalance(from_account);
                // check if from_account has sufficient balance
                if (currentBalance > 0 && amount <= currentBalance) {
                    if (amount >= 10) {
                        //perform transaction
                        const debitTrnx = {
                            account: from_account,
                            from_account: from_account,
                            to_account: to_account,
                            description: "Send Money",
                            trnxId: trnxId,
                            debit: amount + p2pFee,
                            credit: 0
                        }
                        const creditTrnx = {
                            account: to_account,
                            from_account: from_account,
                            to_account: to_account,
                            description: "Send Money",
                            trnxId: trnxId,
                            debit: 0,
                            credit: amount
                        }
                        await Transactions.create(debitTrnx)
                        await Transactions.create(creditTrnx)

                        res.status(201).json({
                            message: "Send money successful",
                            trnxId: trnxId,
                            fee: p2pFee,
                            currentBalance: await getBalance(from_account)
                        });
                    }
                    else {
                        res.status(208).json({
                            message: "Minimum amount 10 tk"
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
                    message: "From/To account should not be an agent account"
                });
            }

        }
    }
    else {
        res.status(404).json({
            message: "From/To Account does not exist"
        });
    }


})

module.exports = router;