const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('./db');

sequelize.sync();

exports.Transactions = sequelize.define('Transactions', {

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
        allowNull: false
    },
    debit: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    credit: {
        type: DataTypes.INTEGER,
        allowNull: false
    }

});