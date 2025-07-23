const { Sequelize } = require('sequelize');
//require('custom-env').env()
require('custom-env').env('dev')

const db_name = process.env.DB_NAME;
const db_user = process.env.DB_USER;
const host = process.env.DB_HOST;
const password = process.env.DB_PASSWORD;

const sequelize = new Sequelize(db_name, db_user, password, {
    host: host,
    dialect: 'mysql',
    logging: true
});

module.exports = { sequelize }
