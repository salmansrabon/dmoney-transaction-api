/**
 * generateTrnxId
 * ──────────────────────────────────────────────────────────────────────────────
 * Produces a collision-resistant transaction ID without any external dependency.
 *
 * Format:  TXN<TIMESTAMP_BASE36><8_RANDOM_HEX_CHARS>
 * Example: TXNLK4WRXSA3F2B1C9
 *
 * Why this is safe:
 *   • Timestamp (Date.now in base-36) makes IDs chronologically sortable and
 *     ensures two IDs generated in *different* milliseconds are always unique.
 *   • 4 crypto-random bytes = 2^32 ≈ 4 billion possible suffixes *per millisecond*.
 *     Even at 10,000 TPS the probability of a collision within the same ms is
 *     effectively zero (~0.000000001%).
 *   • crypto.randomBytes() is backed by the OS CSPRNG — unlike Math.random()
 *     it is NOT predictable and NOT limited to 1,000,000 values.
 *
 * Contrast with the old approach:
 *   "TXN" + Math.floor(Math.random() * 1_000_000)
 *   → only 10^6 possible IDs, ~50% collision after ≈1,000 transactions
 *     (birthday paradox), and Math.random() is not cryptographically random.
 */

const crypto = require('crypto');

/**
 * @returns {string}  e.g. "TXNLK4WRXSA3F2B1C9"
 */
function generateTrnxId() {
    const timestamp  = Date.now().toString(36).toUpperCase();           // base-36 ms timestamp
    const randomPart = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 hex chars
    return `TXN${timestamp}${randomPart}`;
}

module.exports = { generateTrnxId };
