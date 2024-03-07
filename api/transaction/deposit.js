const express = require('express');
const router = express.Router();
const { Transactions } = require('../sequelizeModel/Transactions');
const { Users } = require('../sequelizeModel/Users');
const { authenticateJWT } = require('../../jwtMiddleware');
const { getBalance } = require('./getBalance')


router.post('/deposit', authenticateJWT, async (req, res, next) => {

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
            const user_role = await Users.findOne({
                where: {
                    phone_number: from_account
                }
            })
            console.log("********************************"+user_role.getDataValue('role'))
            if (user_role.getDataValue('role') == "Agent") {

                var currentBalance = await getBalance(from_account);
                var commissionRate = 0.025;
                var commission = commissionRate * amount;
                // check if from_account has sufficient balance
                if (currentBalance > 0 && amount <= currentBalance) {
                    // check if amount is between 10 and 10000
                    // check if to_account has not more than 10000 tk if transaction description is deposit for daily limit
                    //difference of sum of credit and sum of debit for to_account
                    const total_credit = await Transactions.sum('credit', {
                        where: {
                            to_account: to_account,
                            description: "Deposit"
                        }
                    });
                    
                    const total_debit = await Transactions.sum('debit', {
                        where: {
                            from_account: to_account,
                            description: "Withdraw"
                        }
                    });
                    
                    var limit_diff = total_credit - total_debit;
                   

                    if (amount >= 10 && amount <= 10000) {
                        // check if to_account has not more than 10000 tk if transaction description is deposit for daily limit
                        if (limit_diff+amount <= 10000) {
                            const debitTrnx = {
                                account: from_account,
                                from_account: from_account,
                                to_account: to_account,
                                description: "Deposit Commission",
                                trnxId: trnxId,
                                debit: amount,
                                credit: commission
                            }
                            const creditTrnx = {
                                account: to_account,
                                from_account: from_account,
                                to_account: to_account,
                                description: "Deposit",
                                trnxId: trnxId,
                                debit: 0,
                                credit: amount
                            }
                            await Transactions.create(debitTrnx)
                            await Transactions.create(creditTrnx)

                            res.status(201).json({
                                message: "Deposit successful",
                                trnxId: trnxId,
                                commission: commission,
                                currentBalance: await getBalance(from_account)
                            });
                            console.log("Total credit"+ total_credit)
                            console.log("Total debit "+ total_debit)
                            console.log(limit_diff)
                        }
                        else {
                            res.status(208).json({
                                message: "Maximum limit exceeded. You cant deposit more than 10000 tk"
                            });
                        }
                    }

                    else {
                        res.status(208).json({
                            message: "Minimum deposit amount 10 tk and maximum deposit amount 10000 tk"
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
                    message: "Only Agent can deposit money"
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