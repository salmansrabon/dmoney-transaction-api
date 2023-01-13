const { Sequelize } = require('sequelize');
require('dotenv').config()

const db_name = process.env.DB_NAME;
const db_user = process.env.DB_USER;
const host = process.env.DB_HOST;

const sequelize = new Sequelize(db_name, db_user, '', {
    host: host,
    dialect: 'mysql',
    logging: false
});

module.exports = { sequelize }
