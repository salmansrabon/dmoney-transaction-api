const express = require('express');
const router = express.Router();
const { Transactions } = require('../sequelizeModel/Transactions');
const { Users } = require('../sequelizeModel/Users');
const { sequelize } = require('../sequelizeModel/db');

async function getBalance(account) {
    var userBalance = await sequelize.query("SELECT COALESCE(SUM(t.`credit`)-SUM(t.`debit`), 0) AS Balance FROM Transactions t WHERE t.`account`='" + account + "'", { model: Transactions })
    return parseFloat(parseFloat(userBalance[0].dataValues.Balance).toFixed(2));
}

module.exports = { getBalance }