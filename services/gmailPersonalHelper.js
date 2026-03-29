const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const path = require("path");
const fs = require("fs");

const SERVICE_ACCOUNT_FILE = path.join(__dirname, "../config/gmail-service-account.json");
const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

/**
 * Sends an email with automatic fallback:
 *
 *  PRIMARY   → Google Service Account (googleapis)
 *             Used when config/gmail-service-account.json EXISTS.
 *
 *  FALLBACK  → Personal Gmail SMTP via Nodemailer
 *             Used when config/gmail-service-account.json is MISSING.
 *             Requires the following env variables:
 *               EMAIL_HOST  e.g. smtp.gmail.com
 *               EMAIL_PORT  e.g. 587
 *               EMAIL_USER  sender Gmail address
 *               EMAIL_PASS  Gmail App Password (16-char)
 *
 * @param {string} to            - Recipient email address (the actual user)
 * @param {string} subject       - Email subject
 * @param {string} text          - Email body (plain text or HTML)
 * @param {string} [contentType] - "text/plain" (default) or "text/html"
 */
async function sendPersonalEmail(to, subject, text, contentType = "text/plain") {
    try {
        console.log(process.env.SEND_MAIL);
        if (process.env.SEND_MAIL === "false") {
            console.log("📧 Email send configuration is set to false", text);
            return;
        }

        // ── Check whether the service account key file is present ────────────
        const serviceAccountExists = fs.existsSync(SERVICE_ACCOUNT_FILE);

        if (serviceAccountExists) {
            // ── PRIMARY: Google Service Account ──────────────────────────────
            console.log("📧 Service account found — attempting via Google Service Account...");
            try {
                const auth = new google.auth.GoogleAuth({
                    keyFile: SERVICE_ACCOUNT_FILE,
                    scopes: SCOPES,
                    clientOptions: {
                        subject: process.env.EMAIL_USER, // impersonate the configured sender
                    },
                });

                const client = await auth.getClient();
                const gmail = google.gmail({ version: "v1", auth: client });

                const encodedMessage = Buffer.from(
                    `From: ${process.env.EMAIL_USER}\r\n` +
                    `To: ${to}\r\n` +
                    `Subject: ${subject}\r\n` +
                    "MIME-Version: 1.0\r\n" +
                    `Content-Type: ${contentType}; charset=UTF-8\r\n\r\n` +
                    `${text}`
                ).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

                const response = await gmail.users.messages.send({
                    userId: "me",
                    requestBody: { raw: encodedMessage },
                });

                console.log("✅ Personal email sent via Service Account:", response.data);
                return response.data;

            } catch (saError) {
                // Service account failed (e.g. personal Gmail cannot be impersonated,
                // domain-wide delegation not configured, or revoked credentials).
                // Automatically fall through to SMTP.
                console.warn(
                    "⚠️  Service account send failed — falling back to Gmail SMTP (Nodemailer).",
                    saError.message
                );
            }
        } else {
            console.log("⚠️  Service account file not found — falling back to Gmail SMTP (Nodemailer)...");
        }

        // ── FALLBACK: Gmail SMTP via Nodemailer ───────────────────────────────
        // Reached when: (a) service account file is missing, OR
        //               (b) service account send threw an error.
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT, 10),
            secure: false, // STARTTLS on port 587
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const isHtml = contentType === "text/html";

        const mailOptions = {
            from: `"${process.env.EMAIL_USER}" <${process.env.EMAIL_USER}>`,
            to,   // recipient — the actual user's email passed as parameter
            subject,
            ...(isHtml ? { html: text } : { text }),
        };

        const info = await transporter.sendMail(mailOptions);
        console.log("✅ Personal email sent via SMTP:", info.messageId);
        return info;

    } catch (error) {
        console.error("❌ Error sending personal email:", error);
        throw error;
    }
}

module.exports = { sendPersonalEmail };
