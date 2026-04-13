/**
 * Forgot Password Controller
 *
 * POST /user/forgot-password  — accepts email or phone_number, sends reset link to Gmail
 * POST /user/reset-password   — accepts token + new password, updates user password
 */

const { Users } = require('../../sequelizeModel/Users.js');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { hashPassword } = require('../../utils/hash');
const { sendEmail } = require('../../services/emailHelper');

// ── Request password reset ────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email, phone_number } = req.body;
    const identifier = email || phone_number;

    if (!identifier) {
      return res.status(400).json({ message: 'Please provide an email or phone number.' });
    }

    // Find user by email OR phone number
    const user = await Users.findOne({
      where: {
        [Op.or]: [
          { email: identifier },
          { phone_number: identifier }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Please input registered phone number or email.' });
    }

    const userEmail = user.getDataValue('email');
    const userName  = user.getDataValue('name');

    // Block non-Gmail accounts — they cannot receive the reset email
    if (!userEmail.toLowerCase().endsWith('@gmail.com')) {
      return res.status(400).json({
        message: 'Please contact with admin or create new account with gmail.'
      });
    }

    // Generate a cryptographically secure 64-char hex token
    const resetToken        = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // valid 1 hour

    await Users.update(
      { reset_token: resetToken, reset_token_expires: resetTokenExpires },
      { where: { id: user.id } }
    );

    // Build the reset URL pointing to the frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetLink   = `${frontendUrl}/reset-password?token=${resetToken}`;

    const emailBody = [
      `Hello ${userName},`,
      '',
      'You requested a password reset for your dMoney account.',
      '',
      'Click the link below to set a new password:',
      '',
      `  ${resetLink}`,
      '',
      'This link expires in 1 hour. If you did not request this, please ignore this email.',
      '',
      'Thank you,',
      'dMoney Team',
    ].join('\n');

    // Always log the link to console (useful when SEND_MAIL=false)
    console.log(`🔑 Password reset link for ${userEmail}: ${resetLink}`);

    sendEmail(userEmail, 'dMoney — Password Reset Request', emailBody)
      .catch(err => console.error('Password reset email error:', err));

    return res.status(200).json({
      message: 'Password reset link has been sent to your registered email address.'
    });

  } catch (err) {
    console.error('Error in forgotPassword:', err);
    return res.status(500).json({ message: 'Error processing forgot password request.', error: err.message });
  }
};

// ── Reset password using token ────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({ message: 'token, password, and confirmPassword are required.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match.' });
    }

    if (password.length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters long.' });
    }

    // Find user whose token is valid and has not expired
    const user = await Users.findOne({
      where: {
        reset_token: token,
        reset_token_expires: { [Op.gt]: new Date() }
      }
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid or expired password reset link. Please request a new one.'
      });
    }

    // Update password and clear the reset token
    await Users.update(
      { password: hashPassword(password), reset_token: null, reset_token_expires: null },
      { where: { id: user.id } }
    );

    return res.status(200).json({
      message: 'Password has been reset successfully. Please login with your new password.'
    });

  } catch (err) {
    console.error('Error in resetPassword:', err);
    return res.status(500).json({ message: 'Error resetting password.', error: err.message });
  }
};
