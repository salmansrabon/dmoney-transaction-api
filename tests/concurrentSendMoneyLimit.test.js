/**
 * Regression test for GitHub issue #35: the daily/monthly outgoing limit must hold
 * under concurrent requests (the limit check has to run inside the locked transaction).
 *
 * Standalone script (no test runner), run directly:
 *   node tests/concurrentSendMoneyLimit.test.js [fromPhone] [toPhone]
 *
 * Fires 6 parallel send-money requests of 1,000 Tk (fee 5 Tk) from a Customer with no
 * outgoing usage today. With the 5,000 Tk daily limit at most 4 may succeed.
 * Writes real ledger rows to the DB configured in .env.dev and deletes the ones it
 * created (by trnxId) when done.
 */

const { sequelize } = require('../sequelizeModel/db');
const { Transactions } = require('../sequelizeModel/Transactions');
const { handleSendMoney } = require('../controllers/transactions/sendMoney.controller');

const FROM = process.argv[2] || '01686606902';
const TO = process.argv[3] || '01686606903';
const PARALLEL = 6;
const AMOUNT = 1000;

function callSendMoney() {
    return new Promise((resolve, reject) => {
        const req = { body: { from_account: FROM, to_account: TO, amount: AMOUNT }, user: { identifier: FROM } };
        const res = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(body) { resolve({ status: this.statusCode, body }); return this; }
        };
        handleSendMoney(req, res, reject).catch(reject);
    });
}

async function usedToday() {
    const [row] = await sequelize.query(
        `SELECT COALESCE(SUM(debit), 0) AS used FROM Transactions
         WHERE account = :phone AND debit > 0
           AND transaction_type IN ('SendMoney','Payment','Withdraw')
           AND createdAt >= UTC_DATE()`,
        { replacements: { phone: FROM }, type: sequelize.QueryTypes.SELECT }
    );
    return parseFloat(row.used);
}

(async () => {
    const createdTrnxIds = [];
    let failed = false;
    try {
        const before = await usedToday();
        if (before !== 0) {
            console.error(`Precondition failed: ${FROM} already has ${before} Tk outgoing usage today`);
            process.exitCode = 2;
            return;
        }

        const results = await Promise.all(Array.from({ length: PARALLEL }, callSendMoney));
        results.forEach(r => { if (r.status === 201) createdTrnxIds.push(r.body.trnxId); });

        const succeeded = results.filter(r => r.status === 201).length;
        const rejected = results.filter(r => r.status === 400).length;
        const total = await usedToday();
        console.log(`statuses: ${results.map(r => r.status).join(', ')}`);
        console.log(`succeeded=${succeeded} rejected(400)=${rejected} debitedToday=${total} Tk`);

        if (total > 5000 || succeeded > 4) {
            console.error('FAIL: daily limit of 5000 Tk exceeded by concurrent requests');
            failed = true;
        } else if (succeeded !== 4 || rejected !== PARALLEL - 4) {
            console.error('FAIL: expected exactly 4 successes and 2 rejections with HTTP 400');
            failed = true;
        } else {
            console.log('PASS: limit enforced under concurrency');
        }
    } finally {
        if (createdTrnxIds.length) {
            await Transactions.destroy({ where: { trnxId: createdTrnxIds } });
            console.log(`cleaned up ${createdTrnxIds.length} test transfer(s)`);
        }
        await sequelize.close();
        if (failed) process.exitCode = 1;
    }
})().catch(err => { console.error(err); process.exitCode = 1; });
