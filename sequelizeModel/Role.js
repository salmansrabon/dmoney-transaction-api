const { Sequelize, DataTypes } = require('sequelize');
const { sequelize } = require('./db');

sequelize.sync();

exports.Roles = sequelize.define('Roles', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    role: {
        type: DataTypes.STRING(20),
        allowNull: false
    }
    
});