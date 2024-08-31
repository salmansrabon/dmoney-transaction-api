const express = require('express');
const { authenticateJWT } = require('../jwtMiddleware');
const depositController = require('../controllers/transactions/deposit.controller.js');
const withdrawController = require('../controllers/transactions/withdraw.controller.js');
const transactionDetailsController = require('../controllers/transactions/transactionDetails.controller.js');
const sendMoneyController = require('../controllers/transactions/sendMoney.controller.js');
const paymentController = require('../controllers/transactions/payment.controller.js');

const router = express.Router();

router.get('/', transactionDetailsController.serverStatus);
router.get('/list', authenticateJWT, transactionDetailsController.listTransactions);
router.get('/search/:trnxId', authenticateJWT, transactionDetailsController.searchTransactionById);
router.get('/statement/:account', authenticateJWT, transactionDetailsController.getStatementByAccount);
router.get('/limit/:account', authenticateJWT, transactionDetailsController.getTransactionLimitByAccount);
router.get('/balance/:account', authenticateJWT, transactionDetailsController.getBalanceByAccount);

router.post('/deposit', authenticateJWT, depositController.handleDeposit);
router.post('/withdraw', authenticateJWT, withdrawController.handleWithdraw);
router.post('/sendmoney', authenticateJWT, sendMoneyController.handleSendMoney);
router.post('/payment', authenticateJWT, paymentController.handlePayment);

module.exports = router;
