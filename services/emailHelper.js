const { google } = require("googleapis");
const path = require("path");

const SERVICE_ACCOUNT_FILE = path.join(__dirname, "../config/gmail-service-account.json");
const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

// Set up OAuth2 client
const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_FILE,
    scopes: SCOPES,
    clientOptions: {
        subject: "salman@roadtocareer.net", // ✅ The email of the user you want to impersonate
    },
});

// Function to send email
async function sendEmail(to, subject, text, contentType = "text/plain") {
    try {
        const client = await auth.getClient();
        const gmail = google.gmail({ version: "v1", auth: client });

        // ✅ Set the "From" field with custom alias
        const senderName = "Road to SDET"; // ✅ Alias name
        const senderEmail = "salman@roadtocareer.net";

        // ✅ Encode the email with correct formatting
        const encodedMessage = Buffer.from(
            `From: ${senderName} <${senderEmail}>\r\n` +  // ✅ Properly formatted alias
            `To: ${to}\r\n` +
            `Subject: ${subject}\r\n` +
            "MIME-Version: 1.0\r\n" +
            `Content-Type: ${contentType}; charset=UTF-8\r\n\r\n` +
            `${text}`
        ).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

        // ✅ Send the email
        console.log(process.env.SEND_MAIL);
        if(process.env.SEND_MAIL === "false") {
            console.log("📧 Email send configuration is set to false", text);
            return;
        }
        const response = await gmail.users.messages.send({
            userId: "me",
            requestBody: {
                raw: encodedMessage,
            },
        });

        console.log("✅ Email sent successfully:", response.data);
    } catch (error) {
        console.error("❌ Error sending email:", error);
    }
}

module.exports = { sendEmail };
