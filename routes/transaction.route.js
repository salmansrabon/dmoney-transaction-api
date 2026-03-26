const express = require('express');
const { authenticateJWT } = require('../jwtMiddleware');
const depositController = require('../controllers/transactions/deposit.controller.js');
const withdrawController = require('../controllers/transactions/withdraw.controller.js');
const transactionDetailsController = require('../controllers/transactions/transactionDetails.controller.js');
const sendMoneyController = require('../controllers/transactions/sendMoney.controller.js');
const paymentController = require('../controllers/transactions/payment.controller.js');
const adminDepositController = require('../controllers/transactions/adminDeposit.controller.js');
const stripeCashInController = require('../controllers/transactions/stripeCashIn.controller.js');

const router = express.Router();

router.get('/transaction/list', authenticateJWT, transactionDetailsController.listTransactions);
router.get('/transaction/search/:trnxId', authenticateJWT, transactionDetailsController.searchTransactionById);
router.get('/transaction/statement/:account', authenticateJWT, transactionDetailsController.getStatementByAccount);
router.get('/transaction/limit/:account', authenticateJWT, transactionDetailsController.getTransactionLimitByAccount);
router.get('/transaction/balance/:account', authenticateJWT, transactionDetailsController.getBalanceByAccount);

router.post('/transaction/deposit', authenticateJWT, depositController.handleDeposit);
router.post('/transaction/withdraw', authenticateJWT, withdrawController.handleWithdraw);
router.post('/transaction/sendmoney', authenticateJWT, sendMoneyController.handleSendMoney);
router.post('/transaction/payment', authenticateJWT, paymentController.handlePayment);
router.post('/transaction/adminDeposit',          authenticateJWT, adminDepositController.handleAdminDeposit);
router.post('/transaction/stripe/create-intent',  authenticateJWT, stripeCashInController.createPaymentIntent);
router.post('/transaction/stripe/confirm',        authenticateJWT, stripeCashInController.confirmCashIn);

module.exports = router;
