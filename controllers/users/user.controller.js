const { Users } = require('../../sequelizeModel/Users.js');
const { Roles } = require('../../sequelizeModel/Role.js');
const { Transactions } = require('../../sequelizeModel/Transactions.js');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../../sequelizeModel/db.js');
const { sendEmail } = require('../../services/emailHelper');
const { sendPersonalEmail } = require('../../services/gmailPersonalHelper');

// Path to the service account key — checked at call time
const SERVICE_ACCOUNT_FILE = path.join(__dirname, '../../config/gmail-service-account.json');

/**
 * Unified mailer: uses the Google Service Account when the key file is present,
 * otherwise falls back to personal Gmail SMTP (Nodemailer).
 */
function mailer(to, subject, text, contentType) {
    return fs.existsSync(SERVICE_ACCOUNT_FILE)
        ? sendEmail(to, subject, text, contentType)
        : sendPersonalEmail(to, subject, text, contentType);
}

exports.listUsers = async (req, res) => {
    try {
        // Parse pagination parameters
        const page = req.query.page ? parseInt(req.query.page, 10) : 1;
        const count = req.query.count ? parseInt(req.query.count, 10) : 10;
        const limit = count > 0 ? count : 10;
        const offset = page > 1 ? (page - 1) * limit : 0;
        
        // Parse order parameter
        const order = req.query.order && req.query.order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

        // Get total user count
        const total = await Users.count();

        // Get paginated users with ordering
        const users = await Users.findAll({
            limit: limit,
            offset: offset,
            order: [['id', order]]
        });

        // Calculate balance for each user
        const userList = await Promise.all(users.map(async (user) => {
            const userTransactions = await Transactions.findAll({
                where: { account: user.phone_number }
            });
            const balance = userTransactions.reduce((acc, transaction) => acc + transaction.credit - transaction.debit, 0);
            return { ...user.dataValues, balance: balance };
        }));

        res.status(200).json({
            message: "User list",
            total: total,
            count: userList.length,
            users: userList
        });
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
        const user = await Users.findOne({ where: { email: req.params.email } });
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
// Optimized: Search users by role with aggregated balances
// Optimized: Search users by role (no balance calculation)
exports.searchUsersByRole = async (req, res) => {
  try {
    const { role } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const offset = (page - 1) * limit;

    // Fetch users by role, paginated
    const { count, rows: users } = await Users.findAndCountAll({
      where: { role },
      limit: Number(limit),
      offset,
      order: [['id', 'DESC']],
      attributes: ['id', 'name', 'email', 'phone_number', 'nid', 'role', 'createdAt'],
    });

    res.status(200).json({
      count,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
      users,
    });
  } catch (error) {
    console.error('Error searching users by role:', error);
    res.status(500).json({ message: 'Error searching users' });
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
            console.error("Validation error:", error.details[0].message);
            return res.status(400).json({ message: error.details[0].message });
        }

        // Create the user in the database
        const user = await Users.create(newUser);
        res.status(201).json({ message: "User created", user });

    } catch (err) {
        console.error("Error creating user:", err);
        console.error("Error details:", err.message);
        res.status(500).json({ message: "Error creating user", error: err.message });
    }
};

// Update an existing user
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await Users.findOne({ where: { id } });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isAdmin = req.user.role.toLowerCase() === 'admin';
        const isSelf  = user.email === req.user.identifier || user.phone_number === req.user.identifier;

        if (!isAdmin && !isSelf) {
            return res.status(403).json({ message: 'You can only update your own account' });
        }

        // Check if user is protected (system users)
        if (user.phone_number === "SYSTEM" || 
            user.email === "admin@roadtocareer.net" || 
            user.email === "admin@dmoney.com" || 
            user.email === "system@dmoney.com") {
            return res.status(403).json({ message: "Stupid! Do not try to update this!" });
        }

        const updatedUser = { ...req.body };

        // Non-admin users cannot change role or status
        if (!isAdmin) {
            delete updatedUser.role;
            delete updatedUser.status;
        }

        const { error } = await exports.validateUser(updatedUser);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        await Users.update(updatedUser, { where: { id } });
        res.status(200).json({ message: "User updated", user: updatedUser });

    } catch (err) {
        console.error("Error updating user:", err);
        res.status(500).json({ message: "Error updating user" });
    }
};

// Partially update an existing user
exports.partialUpdateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await Users.findOne({ where: { id } });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isAdmin = req.user.role.toLowerCase() === 'admin';
        const isSelf  = user.email === req.user.identifier || user.phone_number === req.user.identifier;

        if (!isAdmin && !isSelf) {
            return res.status(403).json({ message: 'You can only update your own account' });
        }

        // Check if user is protected (system users)
        if (user.phone_number === "SYSTEM" ||
            user.email === "admin@roadtocareer.net" ||
            user.email === "admin@dmoney.com" ||
            user.email === "system@dmoney.com") {
            return res.status(403).json({ message: "Stupid! Do not try to update this!" });
        }

        const updatedUser = { ...req.body };

        // Non-admin users cannot change role or status
        if (!isAdmin) {
            delete updatedUser.role;
            delete updatedUser.status;
        }

        // If email is being updated, enforce Gmail-only restriction
        if (updatedUser.email !== undefined) {
            const emailSchema = Joi.string().email().pattern(/@gmail\.com$/i).messages({
                'string.pattern.base': 'Only Gmail addresses (@gmail.com) are allowed.',
                'string.email': 'Please provide a valid email address.'
            });
            const { error: emailError } = emailSchema.validate(updatedUser.email);
            if (emailError) {
                return res.status(400).json({ message: emailError.message });
            }
        }

        await Users.update(updatedUser, { where: { id } });

        // Send status-change notification email if status was updated to active or suspended (admin only)
        if (isAdmin && (req.body.status === 'active' || req.body.status === 'suspended')) {
            const userName = user.getDataValue('name');
            const userEmail = user.getDataValue('email');
            const newStatus = req.body.status;

            if (newStatus === 'active') {
                mailer(
                    userEmail,
                    'DMoney — Your Account Has Been Activated',
                    `Hello ${userName},\n\nGreat news! Your DMoney account has been activated.\n\nYou can now log in and start using all features available to your account.\n\nIf you have any questions, feel free to reach out to our support team.\n\nThank you,\nDMoney Team`
                ).catch(err => console.error('Account activation email error:', err));
            } else {
                mailer(
                    userEmail,
                    'DMoney — Your Account Has Been Suspended',
                    `Hello ${userName},\n\nWe are writing to inform you that your DMoney account has been suspended.\n\nDuring this time, you will not be able to perform any transactions.\n\nIf you believe this is a mistake or have questions, please contact our admin team for assistance.\n\nThank you,\nDMoney Team`
                ).catch(err => console.error('Account suspension email error:', err));
            }
        }

        res.status(200).json({ message: "User updated successfully", user: updatedUser });

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
            // Check if user is protected (system users)
            if (user.phone_number === "SYSTEM" || 
                user.email === "admin@roadtocareer.net" || 
                user.email === "admin@dmoney.com" || 
                user.email === "system@dmoney.com") {
                return res.status(403).json({ message: "Stupid! Do not try to delete this!" });
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

// Self-registration — public endpoint (no auth)
// Allowed roles: Customer, Agent, Merchant (Admin cannot self-register)
// Only Gmail addresses (@gmail.com) are accepted — enforced via Joi schema
exports.registerUser = async (req, res) => {
    try {
        const { name, email, password, phone_number, nid, role } = req.body;

        // Validate all fields including Gmail-only and allowed-role rules via dedicated Joi schema
        const newUser = { name, email, password, phone_number, nid, role };
        const { error } = exports.validateRegistration(newUser);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        // Check duplicates — separate checks for distinct error messages
        const emailExists = await Users.findOne({ where: { email } });
        if (emailExists) {
            return res.status(208).json({ message: 'An account with this email already exists' });
        }

        const phoneExists = await Users.findOne({ where: { phone_number } });
        if (phoneExists) {
            return res.status(208).json({ message: 'An account with this phone number already exists' });
        }

        // Verify role exists in Roles table
        const roleExists = await Roles.findOne({ where: { role } });
        if (!roleExists) {
            return res.status(400).json({ message: `Invalid role: ${role}` });
        }

        // Create user with default status 'pending'
        const user = await Users.create({ name, email, password, phone_number, nid, role, status: 'pending' });

        // Send registration confirmation email (non-blocking — does not fail the request)
        mailer(
            email,
            'DMoney — Registration Confirmation',
            `Hello ${name},\n\nThank you for registering with DMoney!\n\nYour registration details:\n- Name: ${name}\n- Email: ${email}\n- Phone: ${phone_number}\n- Role: ${role}\n\nYour account is currently pending review. Once an admin verifies your information, your account will be activated and you will be able to perform transactions.\n\nYou will receive another email once your account status is updated.\n\nThank you,\nDMoney Team`
        ).catch(err => console.error('Registration confirmation email error:', err));

        return res.status(201).json({
            message: 'Registration successful. Your account is pending approval by an admin.',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone_number: user.phone_number,
                role: user.role,
                status: user.status,
            },
        });
    } catch (err) {
        console.error('Error registering user:', err);
        return res.status(500).json({ message: 'Error registering user', error: err.message });
    }
};

exports.loginUser = async (req, res) => {
    try {
        const { identifier, password } = req.validatedData;

        // Try to find user by email or phone_number
        const user = await Users.findOne({
            where: {
                [require('sequelize').Op.or]: [
                    { email: identifier },
                    { phone_number: identifier }
                ]
            }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.password !== password) {
            return res.status(401).json({ message: "Password incorrect" });
        }

        const userRole       = user.getDataValue('role');
        const userPhone      = user.getDataValue('phone_number') || '';
        const isSystemAccount = userPhone.toUpperCase() === 'SYSTEM';

        // Admin & SYSTEM account: skip OTP — return JWT directly
        if (userRole === 'Admin' || isSystemAccount) {
            const token = jwt.sign(
                { identifier: identifier, role: userRole },
                process.env.ACCESS_TOKEN_SECRET,
                { expiresIn: process.env.expires_in }
            );
            return res.status(200).json({
                message: "Login successful",
                token: token,
                role: userRole,
                expiresIn: process.env.expires_in
            });
        }

        // Customer / Agent / Merchant: generate 4-digit OTP
        const otp        = String(Math.floor(1000 + Math.random() * 9000));
        const otpExpire  = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes

        await Users.update(
            { otp: otp, otp_expire: otpExpire },
            { where: { id: user.id } }
        );

        const userEmail = user.getDataValue('email');
        const userName  = user.getDataValue('name');
        const isGmail   = userEmail.toLowerCase().endsWith('@gmail.com');

        // ✅ Always console.log the OTP (works for any email address)
        console.log(`🔐 OTP for ${userEmail} [${userRole}]: ${otp}  — expires ${otpExpire.toISOString()}`);

        // Send OTP email only if the user has a Gmail address
        if (isGmail) {
            mailer(
                userEmail,
                'DMoney — Your Login OTP',
                `Hello ${userName},\n\nYour One-Time Password (OTP) for DMoney login is:\n\n  ${otp}\n\nThis OTP is valid for 2 minutes. Do not share it with anyone.\n\nIf you did not attempt to log in, please contact support immediately.\n\nThank you,\nDMoney Team`
            ).catch(err => console.error('OTP email error:', err));
        } else {
            console.log(`📧 OTP email skipped — ${userEmail} is not a Gmail address. OTP is shown in console only.`);
        }

        return res.status(200).json({
            message: 'OTP sent to your registered email address',
            otpRequired: true
        });

    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: "An error occurred while processing the request: " + error.message });
    }
};

// ── Separate OTP verification function ───────────────────────────────────────
exports.verifyOtp = async (req, res) => {
    try {
        const { identifier, otp } = req.body;

        if (!identifier || !otp) {
            return res.status(400).json({ message: 'Identifier and OTP are required' });
        }

        const user = await Users.findOne({
            where: {
                [require('sequelize').Op.or]: [
                    { email: identifier },
                    { phone_number: identifier }
                ]
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const storedOtp    = user.getDataValue('otp');
        const otpExpire    = user.getDataValue('otp_expire');

        if (!storedOtp || !otpExpire) {
            return res.status(400).json({ message: 'No OTP found. Please login again to request a new OTP.' });
        }

        // Check expiry first
        if (new Date() > new Date(otpExpire)) {
            await Users.update({ otp: null, otp_expire: null }, { where: { id: user.id } });
            return res.status(401).json({ message: 'OTP has expired. Please login again to receive a new OTP.' });
        }

        // Check OTP match
        if (storedOtp !== String(otp).trim()) {
            return res.status(401).json({ message: 'Invalid OTP. Please try again.' });
        }

        // ✅ OTP valid — clear it and issue JWT
        await Users.update({ otp: null, otp_expire: null }, { where: { id: user.id } });

        const token = jwt.sign(
            { identifier: identifier, role: user.role },
            process.env.ACCESS_TOKEN_SECRET,
            { expiresIn: process.env.expires_in }
        );

        return res.status(200).json({
            message: 'Login successful',
            token: token,
            role: user.role,
            expiresIn: process.env.expires_in
        });

    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.status(500).json({ message: 'Error verifying OTP: ' + error.message });
    }
};

exports.validateLoginData = (req, res, next) => {
    const { email, phone_number, password } = req.body;

    // Accept either email or phone_number along with password
    if ((!email && !phone_number) || !password) {
        return res.status(400).json({ message: "Please provide either email or phone_number along with password" });
    }

    // Use whichever identifier was provided
    const identifier = email || phone_number;
    req.validatedData = { identifier, password };
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

// Validation function for user creation and updates (admin)
// Gmail-only is enforced globally — both admin-created and self-registered users must have @gmail.com
exports.validateUser = async (user) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(50).required(),
        email: Joi.string()
            .min(5)
            .max(255)
            .required()
            .email()
            .pattern(/@gmail\.com$/i)
            .messages({
                'string.pattern.base': 'Only Gmail addresses (@gmail.com) are allowed.'
            }),
        password: Joi.string().min(4).max(1024).required(),
        phone_number: Joi.string().min(11).max(11).required(),
        nid: Joi.string().min(7).max(13).required(),
        role: Joi.string().min(3).max(50).required()
    });
    return schema.validate(user);
};

// Validation function specifically for self-registration — enforces Gmail-only at schema level
exports.validateRegistration = (user) => {
    const schema = Joi.object({
        name: Joi.string().min(3).max(50).required(),
        email: Joi.string()
            .min(5)
            .max(255)
            .required()
            .email()
            .pattern(/@gmail\.com$/i)
            .messages({
                'string.pattern.base': 'Only Gmail addresses (@gmail.com) are accepted for registration.'
            }),
        password: Joi.string().min(4).max(1024).required(),
        phone_number: Joi.string().length(11).required(),
        nid: Joi.string().min(7).max(13).required(),
        role: Joi.string()
            .valid('Customer', 'Agent', 'Merchant')
            .required()
            .messages({
                'any.only': 'Role must be one of: Customer, Agent, Merchant'
            })
    });
    return schema.validate(user, { abortEarly: true });
};
