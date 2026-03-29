/**
 * Test: sendPersonalEmail via gmailPersonalHelper
 *
 * Behaviour:
 *  - If config/gmail-service-account.json EXISTS  → sends via Google Service Account
 *  - If config/gmail-service-account.json MISSING → falls back to Gmail SMTP (Nodemailer)
 *
 * Prerequisites (when running in SMTP fallback mode):
 *   EMAIL_HOST=smtp.gmail.com
 *   EMAIL_PORT=587
 *   EMAIL_USER=student@gmail.com    ← your Gmail (sender)
 *   EMAIL_PASS=abcd efgh ijkl mnop  ← Gmail App Password
 *
 * The recipient (TO) is passed as a parameter — it is the actual user's email,
 * NOT the sender (EMAIL_USER).
 *
 * Run:
 *   node dmoney-transaction-api/tests/sendPersonalEmail.test.js [recipientEmail]
 *
 * Example:
 *   node dmoney-transaction-api/tests/sendPersonalEmail.test.js newuser@gmail.com
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { sendPersonalEmail } = require("../services/gmailPersonalHelper");

// Accept recipient from CLI arg; fallback to EMAIL_USER for quick self-testing
const recipientEmail = process.argv[2] || process.env.EMAIL_USER;

async function testPlainTextEmail(to) {
    console.log(`\n--- Test: Plain text email → ${to} ---`);
    await sendPersonalEmail(
        to,
        "✅ DMoney — Test Plain-Text Email",
        "Hello!\n\nThis is a plain-text test email sent from the DMoney backend.\n\nRegards,\nDMoney Team"
    );
    console.log("Test finished.\n");
}

(async () => {
    try {
        await testPlainTextEmail(recipientEmail);
        console.log("🎉 Personal email test completed successfully.");
    } catch (err) {
        console.error("💥 Test failed:", err.message);
        process.exit(1);
    }
})();
