const { Users } = require('../../sequelizeModel/Users.js');
const { Roles } = require('../../sequelizeModel/Role.js');
const { Transactions } = require('../../sequelizeModel/Transactions.js');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const multer = require('multer');
const fs = require('fs');
const path = require('path');



// List all users with balance
exports.listUsers = async (req, res) => {
    try {
        // Parse limit and offset from the request query. Set default values if not provided.
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;  // Default to 10 if limit is not specified
        const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;  // Default to 0 if offset is not specified

        const users = await Users.findAll({
            limit: limit,
            offset: offset
        });

        const userList = await Promise.all(users.map(async (user) => {
            // Assuming `Transactions` model has `credit` and `debit` fields
            const userTransactions = await Transactions.findAll({
                where: { account: user.phone_number }
            });
            const balance = userTransactions.reduce((acc, transaction) => acc + transaction.credit - transaction.debit, 0);
            return { ...user.dataValues, balance: balance };
        }));

        res.status(200).json({ message: "User list", count: userList.length, users: userList });
    } catch (error) {
        console.error("Error listing users:", error);
        res.status(500).json({ message: "Error listing users" });
    }
};


// Search user by ID
exports.searchUserById = async (req, res) => {
    try {
        const user = await Users.findOne({ where: { id: req.params.id } });
        if (user) {
            const userBalance = await Transactions.findAll({ where: { account: user.phone_number } });
            res.status(200).json({ message: "User found", user: { ...user.dataValues, balance: userBalance.reduce((acc, cur) => acc + cur.credit - cur.debit, 0) } });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        console.error("Error searching user by ID:", error);
        res.status(500).json({ message: "Error searching user" });
    }
};

// Search user by phone number
exports.searchUserByPhoneNumber = async (req, res) => {
    try {
        const user = await Users.findOne({ where: { phone_number: req.params.phone_number } });
        if (user) {
            const userBalance = await Transactions.findAll({ where: { account: user.phone_number } });
            res.status(200).json({ message: "User found", user: { ...user.dataValues, balance: userBalance.reduce((acc, cur) => acc + cur.credit - cur.debit, 0) } });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        console.error("Error searching user by phone number:", error);
        res.status(500).json({ message: "Error searching user" });
    }
};

// Search user by email
exports.searchUserByEmail = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await Users.findOne({ where: { email } });
        if (user) {
            const userBalance = await Transactions.findAll({ where: { account: user.phone_number } });
            res.status(200).json({ message: "User found", user: { ...user.dataValues, balance: userBalance.reduce((acc, cur) => acc + cur.credit - cur.debit, 0) } });
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (error) {
        console.error("Error searching user by email:", error);
        res.status(500).json({ message: "Error searching user" });
    }
};

// Search users by role
exports.searchUsersByRole = async (req, res) => {
    try {
        const users = await Users.findAll({ where: { role: req.params.role } });
        const userList = await Promise.all(users.map(async (user) => {
            const userBalance = await Transactions.findAll({ where: { account: user.phone_number } });
            return { ...user.dataValues, balance: userBalance.reduce((acc, cur) => acc + cur.credit - cur.debit, 0) };
        }));
        res.status(200).json({ count: users.length, users: userList });
    } catch (error) {
        console.error("Error searching users by role:", error);
        res.status(500).json({ message: "Error searching users" });
    }
};

// Create a new user
exports.createUser = async (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin') {
        return res.status(403).json({ message: 'Only admin can create new users' });
    }

    try {
        const { email, phone_number, role } = req.body;

        // Check if the provided role exists in the Role table
        const roleExists = await Roles.findOne({ where: { role } });
        if (!roleExists) {
            return res.status(400).json({ message: `Invalid role: ${role}. This role does not exist in the Role table.` });
        }

        // Check if the email or phone number already exists
        const emailExists = await Users.findOne({ where: { email } });
        const phoneNumberExists = await Users.findOne({ where: { phone_number } });

        if (emailExists || phoneNumberExists) {
            return res.status(208).json({ message: "User already exists" });
        }

        // Create the new user if the role is valid and the user doesn't exist
        const newUser = { ...req.body };

        // Validate the new user data
        const { error } = await exports.validateUser(newUser);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        // Create the user in the database
        const user = await Users.create(newUser);
        res.status(201).json({ message: "User created", user });

    } catch (err) {
        console.error("Error creating user:", err);
        res.status(500).json({ message: "Error creating user", error: err.message });
    }
};

// Update an existing user
exports.updateUser = async (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin') {
        return res.status(403).json({ message: 'Only admin can update users' });
    }

    try {
        const { id } = req.params;
        const user = await Users.findOne({ where: { id } });

        if (user) {
            const updatedUser = { ...req.body };

            const { error } = await exports.validateUser(updatedUser);
            if (error) {
                return res.status(400).json({ message: error.details[0].message });
            }

            await Users.update(updatedUser, { where: { id } });
            res.status(200).json({ message: "User updated", user: updatedUser });

        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (err) {
        console.error("Error updating user:", err);
        res.status(500).json({ message: "Error updating user" });
    }
};

// Partially update an existing user
exports.partialUpdateUser = async (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin') {
        return res.status(403).json({ message: 'Only admin can update users' });
    }

    try {
        const { id } = req.params;
        const user = await Users.findOne({ where: { id } });

        if (user) {
            const updatedUser = { ...req.body };
            await Users.update(updatedUser, { where: { id } });
            res.status(200).json({ message: "User updated successfully", user: updatedUser });

        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (err) {
        console.error("Error updating user:", err);
        res.status(500).json({ message: "Error updating user" });
    }
};

// Delete a user
exports.deleteUser = async (req, res) => {
    if (req.user.role.toLowerCase() !== 'admin') {
        return res.status(403).json({ message: 'Only admin can delete users' });
    }

    try {
        const { id } = req.params;
        const user = await Users.findOne({ where: { id } });

        if (user) {
            if (user.phone_number === "SYSTEM" || user.email == "admin@roadtocareer.net") {
                res.status(403).json({ message: "Cannot delete SYSTEM user or admin" });
            } else {
                await Users.destroy({ where: { id } });
                res.status(200).json({ message: "User deleted successfully" });
            }
        } else {
            res.status(404).json({ message: "User not found" });
        }
    } catch (err) {
        console.error("Error deleting user:", err);
        res.status(500).json({ message: "Error deleting user" });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.validatedData;

        const user = await Users.findOne({ where: { email } });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.password !== password) {
            return res.status(401).json({ message: "Password incorrect" });
        }

        const token = jwt.sign(
            { identifier: email, role: user.role },
            process.env.accessTokenSecret,
            { expiresIn: process.env.expires_in }
        );

        res.status(200).json({
            message: "Login successful",
            token: token,
            role: user.role,
            expiresIn: process.env.expires_in
        });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "An error occurred while processing the request: " + error.message });
    }
};

exports.validateLoginData = (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "Please check the request body and try again" });
    }

    req.validatedData = { email, password };
    next();
};

// Multer configuration for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads'); // Specify your image storage destination
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname); // Use the original file name
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 }, // Maximum file size of 1MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true); // Accept only image files
        } else {
            cb(new Error('Please upload an image file'));
        }
    }
});

exports.upload = upload.single('image');

exports.uploadPhoto = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await Users.findOne({ where: { id } });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const image = req.file;
        if (!image) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        await Users.update({ photo: image.filename }, { where: { id } });

        res.status(200).json({ message: 'Photo uploaded successfully', photo: image.filename });
    } catch (err) {
        console.error("Error uploading photo:", err);
        res.status(500).json({ message: 'Error uploading photo', error: err.message });
    }
};

exports.retrieveImage = (req, res) => {
    const { file } = req.params; // Extract the file name from the URL
    const uploadsDir = path.join(__dirname, '../../uploads'); // Path to the uploads folder
    const filePath = path.join(uploadsDir, file); // Construct the full file path
    console.log(filePath);
  
    // Check if the file exists
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        console.error(`File not found: ${filePath}`);
        return res.status(404).json({
          error: 'File not found',
        });
      }
  
      // Send the file
      res.sendFile(filePath, (err) => {
        if (err) {
          console.error(`Error sending file: ${err.message}`);
          return res.status(500).json({
            error: 'Failed to send file',
          });
        }
      });
    });
};

// Validation function for user creation and updates
exports.validateUser = async (user) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(50).required(),
        email: Joi.string().min(5).max(255).required().email(),
        password: Joi.string().min(4).max(1024).required(),
        phone_number: Joi.string().min(11).max(11).required(),
        nid: Joi.string().min(7).max(13).required(),
        role: Joi.string().min(3).max(50).required()
    });
    return schema.validate(user);
};

