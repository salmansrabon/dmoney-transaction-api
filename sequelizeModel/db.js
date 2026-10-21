const { Sequelize } = require('sequelize');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
//require('custom-env').env()
require('custom-env').env('dev')

// jwtMiddleware.js runs dotenv.config() (.env) before this file loads, and neither loader
// overwrites a variable that is already set. That let the DB_* values in .env (e.g. localhost)
// silently beat the ones in .env.dev. When .env.dev exists, its DB_* values always win.
// No .env.dev (e.g. inside Docker) -> process.env is left untouched.
const devEnvFile = path.join(__dirname, '..', '.env.dev');
if (fs.existsSync(devEnvFile)) {
    const devEnv = dotenv.parse(fs.readFileSync(devEnvFile));
    for (const key of Object.keys(devEnv)) {
        if (key.startsWith('DB_')) process.env[key] = devEnv[key];
    }
}

const db_name = process.env.DB_NAME;
const db_user = process.env.DB_USER;
const host = process.env.DB_HOST;
const port=process.env.DB_PORT || 3306;
const password = process.env.DB_PASSWORD;

// Sequelize loads the driver with a dynamic require(), which Vercel's bundler cannot trace,
// so mysql2 is left out of the deployed function ("Please install mysql2 package manually").
// Passing the module explicitly makes it a static require that gets bundled.
const sequelize = new Sequelize(db_name, db_user, password, {
    host: host,
    port: port,
    dialect: 'mysql',
    dialectModule: require('mysql2'),
    logging: false
});

module.exports = { sequelize }
