const express = require('express');
const router = express.Router();
const { Users } = require('./sequelizeModel/Users.js');
const { Roles } = require('./sequelizeModel/Role.js');
const { Transactions } = require('./sequelizeModel/Transactions');
const { authenticateJWT, publicAuthenticateJWT } = require('../jwtMiddleware');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const multer = require('multer');
require('custom-env').env('dev')

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
//search by user id
router.get('/search/id/:id', publicAuthenticateJWT, async (req, res, next) => {
    //search user by id
    const id = req.params.id;
    await Users.findOne({
        where: {
            id: id
        }
    })
        .then(async user => {
            if (user) {
                const userBalance = await Transactions.findAll({
                    where: {
                        account: user.phone_number
                    }
                });
                res.status(200).json({
                    message: "User found",
                    user: {
                        ...user.dataValues,
                        balance: userBalance.reduce((acc, cur) => acc + cur.credit - cur.debit, 0)
                    }
                });
            } else {
                res.status(404).json({
                    message: "User not found"
                });
            }
        })
});

router.get('/search/phonenumber/:phone_number', authenticateJWT, async (req, res, next) => {
    // search user by phonenumber
    const phone_number = req.params.phone_number;
    await Users.findOne({
        where: {
            phone_number: phone_number
        }
    })
        .then(async user => {
            if (user) {
                const userBalance = await Transactions.findAll({
                    where: {
                        account: user.phone_number
                    }
                });
                res.status(200).json({
                    message: "User found",
                    user: {
                        ...user.dataValues,
                        balance: userBalance.reduce((acc, cur) => acc + cur.credit - cur.debit, 0)
                    }
                });
            } else {
                res.status(404).json({
                    message: "User not found"
                });
            }
        })
});

router.get('/search/email/:email', authenticateJWT, async (req, res, next) => {
    //search user by email
    const email = req.params.email;
    await Users.findOne({
        where: {
            email: email
        }
    })
        .then(async user => {
            if (user) {
                const userBalance = await Transactions.findAll({
                    where: {
                        account: user.phone_number
                    }
                });
                res.status(200).json({
                    message: "User found",
                    user: {
                        ...user.dataValues,
                        balance: userBalance.reduce((acc, cur) => acc + cur.credit - cur.debit, 0)
                    }
                });
            } else {
                res.status(404).json({
                    message: "User not found"
                });
            }
        })
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
    // Check if the logged-in user is an admin
    if (req.user.role.toLowerCase() !== 'admin') {
        return res.status(403).json({ message: 'Only admin can create new users' });
    }

    console.log("Logged-in User Role: ", req.user.role);

    try {
        const { email, phone_number, role } = req.body;
        console.log(role)

        // Check if the provided role exists in the Role table
        const roleExists = await Roles.findOne({
            where: { role: role }
        });
        console.log(roleExists)

        if (!roleExists) {
            return res.status(400).json({
                message: `Invalid role: ${role}. This role does not exist in the Role table.`
            });
        }

        // Check if the email or phone number already exists
        const emailExists = await Users.findOne({ where: { email: email } });
        const phoneNumberExists = await Users.findOne({ where: { phone_number: phone_number } });

        if (emailExists || phoneNumberExists) {
            return res.status(208).json({
                message: "User already exists",
            });
        }

        // Create the new user if the role is valid and the user doesn't exist
        const newUser = {
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            phone_number: req.body.phone_number,
            nid: req.body.nid,
            role: role
        };

        // Validate the new user data
        const { error } = await validateUser(newUser);
        if (error) {
            return res.status(400).json({
                message: error.details[0].message
            });
        }

        // Create the user in the database
        const user = await Users.create(newUser);
        res.status(201).json({
            message: "User created",
            user: user
        });

    } catch (err) {
        console.error("Error creating user:", err);
        res.status(500).json({
            message: "Error creating user",
            error: err.message
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
    if (req.user.role.toLowerCase() !== 'admin') {
        return res.status(403).json({ message: 'Only admin can update users' });
    }
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
            // update user for all mandatory fields
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
            await Users.update(newUser, {
                where: {
                    id: id
                }
            });
            res.status(200).json({
                message: "User updated",
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
    if (req.user.role.toLowerCase() !== 'admin') {
        return res.status(403).json({ message: 'Only admin can update users' });
    }
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
    if (req.user.role.toLowerCase() !== 'admin') {
        return res.status(403).json({ message: 'Only admin can delete users' });
    }
    // delete specific data by id
    const { id } = req.params;
    const user = await Users.findOne({
        where: {
            id: id
        }
    });
    if (user) {
        //if user phone_number is SYSTEM do not delete
        if (user.phone_number === "SYSTEM" || user.email == "salman@roadtocareer.net") {
            res.status(403).json({
                message: "Cannot delete SYSTEM user or admin"
            })
        }
        else {
            await Users.destroy({
                where: {
                    id: id
                }
            });
            res.status(200).json({
                message: "User deleted successfully"
            });
        }
    }
    else {
        res.status(404).json({
            message: "User not found"
        });
    }
})
const accessTokenSecret = process.env.accessTokenSecret;
router.post('/login', validateLoginData, async (req, res, next) => {
    try {
        const { email, password } = req.validatedData;
        
        // Find the user by email
        const user = await Users.findOne({
            where: { email: email }
        });

        // Check if the user exists
        if (user) {
            // Directly compare plain-text passwords for testing purposes
            if (user.password === password) {
                // Generate JWT token including role
                const token = jwt.sign(
                    { identifier: email, role: user.role }, // Added role here
                    accessTokenSecret,
                    { expiresIn: process.env.expires_in } // Expiration time from env variables
                );

                // Send response with token and role
                res.status(200).json({
                    message: "Login successfully",
                    token: `${token}`,
                    role: user.role, // Return role in response
                    expiresIn: process.env.expires_in
                });
            } else {
                res.status(401).json({
                    message: "Password incorrect"
                });
            }
        } else {
            res.status(404).json({
                message: "User not found"
            });
        }
    } catch (error) {
        console.error("Error occurred:", error);
        res.status(500).json({
            message: "An error occurred while processing the request: " + error.message
        });
    }
});

function validateLoginData(req, res, next) {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            message: "Please check the request body and try again"
        });
    }

    // Optionally, add further validation rules here

    req.validatedData = { email, password };
    next();
}

//create an API to upload photo
//photo size not more than 1MB

// Multer configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads'); // Your image storage destination
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Use the original file name for the uploaded file
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 // Maximum file size of 1MB (in bytes)
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true); // Accept only image files
        } else {
            cb(new Error('Please upload an image file'));
        }
    }
});

router.post('/upload/:id', authenticateJWT, upload.single('image'), async (req, res, next) => {
    // Your existing code to update the user with the uploaded photo
    const { id } = req.params;
    const user = await Users.findOne({
        where: {
            id: id
        }
    });

    if (user) {
        try {
            const image = req.file; // Access the uploaded file via req.file
            if (!image) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            await Users.update({
                photo: image.filename // Use image.filename instead of image.name
            }, {
                where: {
                    id: id
                }
            });

            res.status(200).json({
                message: 'Photo uploaded successfully',
                photo: image.filename
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({
                message: 'Error uploading photo',
                error: err.message
            });
        }
    } else {
        res.status(404).json({
            message: 'User not found'
        });
    }
});
module.exports = router;