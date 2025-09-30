const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { getBalance } = require('../../services/getBalance');

// Server status check
exports.serverStatus = (req, res, next) => {
    res.status(200).json({
        message: "Server is up"
    });
};

// List all transactions
exports.listTransactions = async (req, res, next) => {
    try {
        // Parse pagination parameters
        const page = req.query.page ? parseInt(req.query.page, 10) : 1;
        const count = req.query.count ? parseInt(req.query.count, 10) : 10;
        const limit = count > 0 ? count : 10;
        const offset = page > 1 ? (page - 1) * limit : 0;

        // Get total transaction count
        const total = await Transactions.count();

        // Get paginated transactions
        const transactions = await Transactions.findAll({
            limit: limit,
            offset: offset,
            order: [['createdAt', 'DESC']]
        });

        res.status(200).json({
            message: "Transaction list",
            total: total,
            count: transactions.length,
            transactions: transactions
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Error fetching transactions" });
    }
};



// Search transactions by ID
exports.searchTransactionById = async (req, res, next) => {
    try {
        const transactions = await Transactions.findAll({ where: { trnxId: req.params.trnxId } });
        if (transactions.length > 0) {
            res.status(200).json({
                message: "Transaction list",
                count: transactions.length,
                transactions: transactions
            });
        } else {
            res.status(404).json({ message: "Transaction not found" });
        }
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: "Error searching transactions" });
    }
};

// Get statement by account number
exports.getStatementByAccount = async (req, res, next) => {
    try {
        const user = await Users.findOne({ where: { phone_number: req.params.account } });
        if (user) {
            // Parse pagination parameters
            const page = req.query.page ? parseInt(req.query.page, 10) : 1;
            const count = req.query.count ? parseInt(req.query.count, 10) : 10;
            const limit = count > 0 ? count : 10;
            const offset = page > 1 ? (page - 1) * limit : 0;

            // Get total transaction count for this account
            const total = await Transactions.count({ where: { account: req.params.account } });

            // Get paginated transactions
            const transactions = await Transactions.findAll({
                where: { account: req.params.account },
                limit: limit,
                offset: offset,
                order: [['createdAt', 'DESC']]
            });

            res.status(200).json({
                message: "Transaction list",
                total: total,
                count: transactions.length,
                transactions: transactions
            });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: "Error fetching statement" });
    }
};

// Get transaction limit by account number
exports.getTransactionLimitByAccount = async (req, res, next) => {
    try {
        const user = await Users.findOne({ where: { phone_number: req.params.account } });
        if (user) {
            const total_credit = await Transactions.sum('credit', { where: { account: req.params.account, description: "Deposit" } });
            const total_debit = await Transactions.sum('debit', { where: { account: req.params.account, description: "Withdraw" } });
            const limit_diff = total_credit - total_debit;

            res.status(200).json({
                message: "User limit",
                limit: 10000 - limit_diff
            });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: "Error fetching transaction limit" });
    }
};

// Get balance by account number
exports.getBalanceByAccount = async (req, res, next) => {
    try {
        const user = await Users.findOne({ where: { phone_number: req.params.account } });
        if (user) {
            const userBalance = await getBalance(req.params.account);
            res.status(200).json({
                message: "User balance",
                balance: userBalance
            });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (e) {
        console.log(e);
        res.status(500).json({ message: "Error fetching balance" });
    }
};
