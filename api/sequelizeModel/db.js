const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('emoneydb', 'root', '', {
    host: 'localhost',
    dialect: 'mysql'
});

module.exports = { sequelize }
