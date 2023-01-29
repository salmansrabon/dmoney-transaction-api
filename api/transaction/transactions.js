const express = require('express');
const router = express.Router();
const { Transactions } = require('../sequelizeModel/Transactions');
const { Users } = require('../sequelizeModel/Users');
const { authenticateJWT } = require('../../jwtMiddleware');
const { getBalance } = require('./getBalance')

const { sequelize } = require('../sequelizeModel/db');

router.get('/', (req, res, next) => {
    res.status(200).json({
        message: "Server is up"
    });
});

router.get('/list', authenticateJWT, async (req, res, next) => {
    // check if transaction exists and then get all transaction list
    await Transactions.findAll()
        .then(transactions => {
            if (transactions.length > 0) {
                res.status(200).json({
                    message: "Transaction list",
                    count: transactions.length,
                    transactions: transactions
                });
            } else {
                res.status(404).json({
                    message: "Transaction not found"
                });
            }
        }).catch(e => {
            console.log(e)
        })
});
router.get('/search/:trnxId', authenticateJWT, async (req, res, next) => {
    // check if transaction exists and then get transaction by trnx id
    await Transactions.findAll({
        where: {
            trnxId: req.params.trnxId
        }
    }).then(transactions => {
        if (transactions.length > 0) {
            res.status(200).json({
                message: "Transaction list",
                count: transactions.length,
                transactions: transactions
            });
        } else {
            res.status(404).json({
                message: "Transaction not found"
            });
        }
    }).catch(e => {
        console.log(e)
    })

});
router.get('/statement/:account', authenticateJWT, async (req, res, next) => {
    //check if user exists and then get statement
    await Users.findOne({
        where: {
            phone_number: req.params.account
        }
    }).then(async user => {
        if (user) {
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
            }).catch(e => {
                console.log(e)
            })
        } else {
            res.status(404).json({
                message: "User not found"
            });
        }
    }).catch(e => {
        console.log(e)
    })

});
router.get('/limit/:account', authenticateJWT, async (req, res, next) => {
    // Check if user exists and then check balance
    await Users.findOne({
        where: {
            phone_number: req.params.account
        }
    }).then(async user => {
        if (user) {
            const account = req.params.account;
            const total_credit = await Transactions.sum('credit', {
                where: {
                    account: account,
                    description: "Deposit"
                }
            });
            
            const total_debit = await Transactions.sum('debit', {
                where: {
                    account: account,
                    description: "Withdraw"
                }
            });
            
            var limit_diff = total_credit - total_debit;
            res.status(200).json({
                message: "User limit",
                limit: 10000- limit_diff
            });
        } else {
            res.status(404).json({
                message: "User not found"
            });
        }
    }).catch(e => {
        console.log(e)
    })


});


router.get('/balance/:account', authenticateJWT, async (req, res, next) => {
    // Check if user exists and then check balance
    await Users.findOne({
        where: {
            phone_number: req.params.account
        }
    }).then(async user => {
        if (user) {
            const userBalance = await getBalance(req.params.account);
            res.status(200).json({
                message: "User balance",
                balance: userBalance
            });
        } else {
            res.status(404).json({
                message: "User not found"
            });
        }
    }).catch(e => {
        console.log(e)
    })


});

module.exports = router;