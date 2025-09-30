const { Sequelize, DataTypes, Op } = require('sequelize');
const { sequelize } = require('./db');

const Users = sequelize.define('Users', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phone_number: {
        type: DataTypes.STRING,
        allowNull: false
    },
    nid: {
        type: DataTypes.STRING,
        allowNull: false
    },
    role: {
        type: DataTypes.STRING,
        allowNull: true
    },
    photo: {
        type: DataTypes.STRING,
        allowNull: true
    }
});

const predefinedUsers = [
    {
        name: "SYSTEM",
        email: "system@dmoney.com",
        password: "1234",
        phone_number: "SYSTEM",
        nid: "123456789",
        role: "Agent",
        photo: null
    },
    {
        name: "Admin",
        email: "admin@dmoney.com",
        password: "1234",
        phone_number: "01686606909",
        nid: "123456789",
        role: "Admin",
        photo: null
    },
    {
        name: "Test Agent",
        email: "agent@dmoney.com",
        password: "1234",
        phone_number: "01686606901",
        nid: "123456789",
        role: "Agent",
        photo: null
    },
    {
        name: "SYSTEM",
        email: "system@dmoney.com",
        password: "1234",
        phone_number: "SYSTEM",
        nid: "123456789",
        role: "Agent",
        photo: null
    },
    {
        name: "Test Customer 1",
        email: "customer1@dmoney.com",
        password: "1234",
        phone_number: "01686606902",
        nid: "123456789",
        role: "Customer",
        photo: null
    },
    {
        name: "Test Customer 2",
        email: "customer2@dmoney.com",
        password: "1234",
        phone_number: "01686606903",
        nid: "123456789",
        role: "Customer",
        photo: null
    },
    {
        name: "Test Merchant",
        email: "merchant@dmoney.com",
        password: "1234",
        phone_number: "01686606905",
        nid: "123456789",
        role: "Merchant",
        photo: null
    }
];

// Sync database and conditionally insert predefined data
sequelize.sync().then(async () => {
    for (const user of predefinedUsers) {
        const existingUser = await Users.findOne({
            where: {
                [Op.or]: [
                    { email: user.email },
                    { phone_number: user.phone_number }
                ]
            }
        });

        if (!existingUser) {
            await Users.create(user);
            console.log(`User ${user.email} has been inserted.`);
        } else {
            console.log(`User ${user.email} already exists and was not inserted.`);
        }
    }
});

module.exports = { Users };
