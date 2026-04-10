const crypto = require('crypto');

// Character set: uppercase letters + digits (A-Z, 0-9) — 36 chars
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generates a collision-resistant transaction ID.
 * Format : TXN + 10 uppercase alphanumeric characters
 * Example: TXNMNA69IHWA1
 * Total length: 13 characters
 */
function generateTrnxId() {
    const bytes = crypto.randomBytes(10);
    let suffix = '';
    for (let i = 0; i < 10; i++) {
        suffix += CHARS[bytes[i] % CHARS.length];
    }
    return `TXN${suffix}`;
}

module.exports = { generateTrnxId };
