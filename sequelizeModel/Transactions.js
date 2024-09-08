const { Sequelize, DataTypes, Op } = require('sequelize');
const { sequelize } = require('./db');

// Define the Transactions model
const Transactions = sequelize.define('Transactions', {
    account: {
        type: DataTypes.STRING,
        allowNull: false
    },
    from_account: {
        type: DataTypes.STRING,
        allowNull: false
    },
    to_account: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    trnxId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: false
    },
    debit: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    credit: {
        type: DataTypes.DOUBLE,
        allowNull: false
    }
});

// Seed data to be inserted if not found
const seedTransaction = {
    account: "SYSTEM",
    from_account: "SUPER_USER",
    to_account: "SYSTEM",
    description: "SYSTEM DEPOSIT",
    trnxId: "TRNX1001",
    debit: 0,
    credit: 10000000
};

// Sync database and conditionally insert seed data
sequelize.sync().then(async () => {
    // Check if the transaction with the specific trnxId exists
    const existingTransaction = await Transactions.findOne({
        where: {
            trnxId: seedTransaction.trnxId
        }
    });

    // If not found, insert the seed transaction
    if (!existingTransaction) {
        await Transactions.create(seedTransaction);
        console.log('Seed SYSTEM account has been inserted.');
    } else {
        console.log('Seed SYSTEM account already exists and was not inserted.');
    }
});

module.exports = { Transactions };
