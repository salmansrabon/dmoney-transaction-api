const express = require('express');
const router = express.Router();
const { Transactions } = require('./sequelizeModel/Transactions');
const { Users } = require('./sequelizeModel/Users');
const { authenticateJWT } = require('../../jwtMiddleware');

const { sequelize } = require('./sequelizeModel/db');

router.get('/', (req, res, next) => {
    res.status(200).json({
        message: "Server is up"
    });
});
router.get('/list', authenticateJWT, async (req, res, next) => {
    // Get list from Transactions table
    await Transactions.findAll()
        .then(transactions => {
            res.status(200).json({
                message: "Transaction list",
                count: transactions.length,
                transactions: transactions
            });
        }).catch(e => {
            console.log(e)
        })

});
router.get('/search/:trnxId', authenticateJWT, async (req, res, next) => {
    // Search transaction list by trnx id
    await Transactions.findAll({
        where: {
            trnxId: req.params.trnxId
        }
    }).then(transactions => {
        res.status(200).json({
            message: "Transaction list",
            count: transactions.length,
            transactions: transactions
        });
    }
    ).catch(e => {
        console.log(e)
    })

});
router.get('/statement/:account', authenticateJWT, async (req, res, next) => {
    // Search transaction list by user account
    await Transactions.findAll({
        where: {
            account: req.params.account
        }
    }).then(transactions => {
        res.status(200).json({
            message: "Transaction list",
            count: transactions.length,
            transactions: transactions
        });
    }
    ).catch(e => {
        console.log(e)
    })


});

router.get('/balance/:account', authenticateJWT, async (req, res, next) => {
    // Get balance from Transactions table
    const account = req.params.account;
    const userBalance = await getBalance(account);
    res.status(200).json({
        message: "User balance",
        balance: userBalance
    });
});
async function getBalance(account) {
    var userBalance = await sequelize.query("SELECT COALESCE(SUM(t.`credit`)-SUM(t.`debit`), 0) AS Balance FROM transactions t WHERE t.`account`='" + account + "'", { model: Transactions })
    return parseInt(userBalance[0].dataValues.Balance);
}
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
            message: "Account does not exist"
        });
    }


})
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
            var withdrawFee = feeRate * amount;
            if (withdrawFee <= 10) {
                withdrawFee = 10;
            }
            else {
                withdrawFee = feeRate * amount;
            }
            if (from_account_role.getDataValue('role') == "Customer" && to_account_role.getDataValue('role') == "Agent") {
                var currentBalance = await getBalance(from_account);
                // check if from_account has sufficient balance
                if (currentBalance > 0 && amount <= currentBalance + withdrawFee) {
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
                            credit: amount
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
            if (user_role.getDataValue('role') == "Agent") {

                var currentBalance = await getBalance(from_account);
                // check if from_account has sufficient balance
                if (currentBalance > 0 && amount <= currentBalance) {
                    if (amount >= 10) {
                        //perform transaction
                        const debitTrnx = {
                            account: from_account,
                            from_account: from_account,
                            to_account: to_account,
                            description: "Deposit",
                            trnxId: trnxId,
                            debit: amount,
                            credit: 0
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
                            currentBalance: await getBalance(from_account)
                        });

                    }
                    else {
                        res.status(208).json({
                            message: "Minimum deposit amount 10 tk"
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
router.get('/userrole/:phone', authenticateJWT, async (req, res, next) => {
    // find user role of from_account
    const user_role = await Users.findOne({
        where: {
            phone_number: req.params.phone
        }
    }).catch(e => {
        console.log(e);
    })
    console.log(user_role.role);



});
module.exports = router;