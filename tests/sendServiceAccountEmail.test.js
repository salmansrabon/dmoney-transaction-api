/**
 * Test: sendEmail via Google Service Account (emailHelper)
 *
 * Uses the existing `sendEmail` function from services/emailHelper.js which
 * authenticates with the Google Gmail API using the service account key at:
 *   config/gmail-service-account.json
 *
 * Prerequisites:
 *  1. config/gmail-service-account.json must be present and valid.
 *  2. The service account must have domain-wide delegation enabled in
 *     Google Workspace admin and be authorised for the Gmail send scope.
 *  3. SEND_MAIL=true must be set in .env to actually dispatch the email.
 *
 * Run:
 *   node dmoney-transaction-api/tests/sendServiceAccountEmail.test.js [recipientEmail]
 *
 * Example:
 *   node dmoney-transaction-api/tests/sendServiceAccountEmail.test.js newuser@gmail.com
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { sendEmail } = require("../services/emailHelper");

// Accept recipient from CLI arg; fallback to the impersonated sender for quick self-testing
const recipientEmail = process.argv[2] || "salman@roadtocareer.net";

async function testServiceAccountEmail(to) {
    console.log(`\n--- Test: Service Account plain-text email → ${to} ---`);
    await sendEmail(
        to,
        "✅ DMoney — Test Service Account Email",
        "Hello!\n\nThis is a plain-text test email sent from the DMoney backend using the Google Service Account.\n\nRegards,\nDMoney Team"
    );
    console.log("Test finished.\n");
}

(async () => {
    try {
        await testServiceAccountEmail(recipientEmail);
        console.log("🎉 Service account email test completed successfully.");
    } catch (err) {
        console.error("💥 Test failed:", err.message);
        process.exit(1);
    }
})();
