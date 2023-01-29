const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { Users } = require('./sequelizeModel/Users.js');
const { Transactions } = require('./sequelizeModel/Transactions');
const { authenticateJWT, publicAuthenticateJWT } = require('../jwtMiddleware');
const jwt = require('jsonwebtoken');
const Joi = require('joi');

const { sequelize } = require('./sequelizeModel/db');

router.get('/', (req, res, next) => {
    res.status(200).json({
        message: "Server is up"
    });
});
router.get('/list', publicAuthenticateJWT, async (req, res, next) => {
    //get user list from db
    await Users.findAll()
        .then(async users => {
            res.status(200).json({
                message: "User list",
                count: users.length,
                //get user balance
                users: await Promise.all(users.map(async user => {
                    const userBalance = await Transactions.findAll({
                        where: {
                            account: user.phone_number
                        }
                    });
                    return {
                        ...user.dataValues,
                        balance: userBalance.reduce((acc, cur) => acc + cur.credit - cur.debit, 0)
                    }
                }))

            });
        })
});
async function getBalance(account) {
    var userBalance
    userBalance = await sequelize.query("SELECT COALESCE(SUM(t.`credit`)-SUM(t.`debit`), 0) AS Balance FROM transactions t WHERE t.`account`='" + account + "'", { model: Transactions })
    return parseInt(userBalance[0].dataValues.Balance);
}
router.get('/search', authenticateJWT, async (req, res, next) => {
    // search user by email or id
    const { phone_number, email, id } = req.query;
    if (email) {
        await Users.findOne({
            where: {
                email: email
            }
        })
            .then(async users => {
                const userInfo = { ...users.dataValues, balance: await getBalance(phone_number) }
                res.status(200).json({
                    user: userInfo
                });
            }).catch(err => { res.status(404).json({ message: "User not found" }) })
    }
    else if (id) {
        await Users.findOne({
            where: {
                id: id
            }
        })
            .then(async users => {
                const userInfo = { ...users.dataValues, balance: await getBalance(phone_number) }
                res.status(200).json({
                    user: userInfo
                });
            }).catch(err => { res.status(404).json({ message: "User not found" }) })
    }
    else if (phone_number) {
        await Users.findOne({
            where: {
                phone_number: phone_number
            }
        })
            .then(async users => {
                const userInfo = { ...users.dataValues, balance: await getBalance(phone_number) }
                res.status(200).json({
                    user: userInfo
                });
            }).catch(err => { res.status(404).json({ message: "User not found" }) })
    }
    else {
        res.status(400).json({
            message: "Please provide email, id or phone_number"
        });
    }
});
router.get('/search/:role', authenticateJWT, async (req, res, next) => {
    //search user by role
    const role = req.params.role;
    await Users.findAll({
        where: {
            role: role
        }
    })
        .then(async users => {
            res.status(200).json({
                count: users.length,
                users: await Promise.all(users.map(async user => {
                    const userBalance = await Transactions.findAll({
                        where: {
                            account: user.phone_number
                        }
                    });
                    return {
                        ...user.dataValues,
                        balance: userBalance.reduce((acc, cur) => acc + cur.credit - cur.debit, 0)
                    }
                }))
            });
        })

});
router.post('/create', authenticateJWT, async (req, res, next) => {
    try {
        const { email, phone_number } = req.body;
        const email_exists = await Users.findOne({
            where: {
                email: email
            }
        });
        const phone_number_exists = await Users.findOne({
            where: {
                phone_number: phone_number
            }
        });

        if (email_exists || phone_number_exists) {
            res.status(208).json({
                message: "User already exists",
            });

        }
        else {

            //if user does not exist then create user and all fields are mandatory

            const newUser = {
                name: req.body.name,
                email: req.body.email,
                password: req.body.password,
                phone_number: req.body.phone_number,
                nid: req.body.nid,
                role: req.body.role
            };
            //if user doesn't input any field name then it should return validation error
            const { error } = await validateUser(newUser);
            if (error) {
                return res.status(400).json({
                    message: error.details[0].message
                });
            }
            const user = await Users.create(newUser);
            res.status(201).json({
                message: "User created",
                user: user
            });
        }
    } catch (err) {
        res.status(500).json({
            message: "Error creating user",
            error: err
        });
    }

});
async function validateUser(user) {
    const schema = Joi.object({
        name: Joi.string().min(3).max(50).required(),
        email: Joi.string().min(5).max(255).required().email(),
        password: Joi.string().min(4).max(1024).required(),
        phone_number: Joi.string().min(11).max(11).required(),
        nid: Joi.string().min(7).max(13).required(),
        role: Joi.string().min(3).max(50).required()
    });
    return schema.validate(user);
}
router.put('/update/:id', authenticateJWT, async (req, res, next) => {
    // update user by id
    const { id } = req.params;
    const user = await Users.findOne({
        where: {
            id: id
        }
    });
    // check if user is found and then update user for all mandatory fields
    if (user) {
        try {
            const newUser = {
                name: req.body.name,
                email: req.body.email,
                password: req.body.password,
                phone_number: req.body.phone_number,
                nid: req.body.nid,
                role: req.body.role
            };
            await Users.update(newUser, {
                where: {
                    id: id
                }
            });
            res.status(200).json({
                message: "User updated successfully",
                user: newUser
            });
        }
        catch {
            res.status(500).json({
                message: "Field missing"
            });
        }
    }
    else {
        res.status(404).json({
            message: "User not found"
        });
    }


});
router.patch('/update/:id', authenticateJWT, async (req, res, next) => {
    //update user by id or name or email
    const { id } = req.params;
    const { name, email, password, phone_number, nid, role } = req.body;
    const user = await Users.findOne({
        where: {
            id: id
        }
    });
    if (user) {
        try {
            const newUser = {
                name: name,
                email: email,
                password: password,
                phone_number: phone_number,
                nid: nid,
                role: role
            };
            await Users.update(newUser, {
                where: {
                    id: id
                }
            });
            res.status(200).json({
                message: "User updated successfully",
                user: newUser
            });
        }
        catch {
            res.status(500).json({
                message: "Field missing"
            });
        }
    }
    else {
        res.status(404).json({
            message: "User not found"
        });
    }

});
router.delete('/delete/:id', authenticateJWT, async (req, res, next) => {
    // delete specific data by id
    const { id } = req.params;
    const user = await Users.findOne({
        where: {
            id: id
        }
    });
    if (user) {
        await Users.destroy({
            where: {
                id: id
            }
        });
        res.status(200).json({
            message: "User deleted successfully"
        });
    }
    else {
        res.status(404).json({
            message: "User not found"
        });
    }
})
const accessTokenSecret = 'myaccesstokensecret';
router.post('/login', async (req, res, next) => {
    // user login by email and password
    const { email, password } = req.body;
    const user = await Users.findOne({
        where: {
            email: email
        }
    });
    if (user) {
        if (user.password === password) {
            const token = jwt.sign({ email: user.email, password: user.password }, accessTokenSecret, { expiresIn: '30m' });
            res.status(200).json({
                message: "Login successfully",
                token: token
            });
        }
        else {
            res.status(401).json({
                message: "Password incorrect"
            });
        }
    }
    else {
        res.status(404).json({
            message: "User not found"
        });
    }
})
module.exports = router;