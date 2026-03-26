const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { Commission } = require('../../sequelizeModel/Commission');
const { getBalance } = require('../../services/getBalance');

/**
 * Find a user by the JWT identifier (could be email or phone_number)
 */
async function findUserByIdentifier(identifier) {
    const Op = require('sequelize').Op;
    return Users.findOne({
        where: {
            [Op.or]: [
                { email: identifier },
                { phone_number: identifier }
            ]
        }
    });
}

/**
 * POST /transaction/stripe/create-intent
 *
 * Validates the amount against the current Deposit commission limits,
 * then creates a Stripe PaymentIntent. Returns the client_secret to
 * the frontend so it can render the Stripe card form.
 */
exports.createPaymentIntent = async (req, res) => {
    try {
        const { amount } = req.body;
        const identifier = req.user.identifier;

        // ── 1. Find customer ──────────────────────────────────────────────────
        const customer = await findUserByIdentifier(identifier);
        if (!customer) {
            return res.status(404).json({ message: 'Customer account not found' });
        }

        const role   = customer.getDataValue('role');
        const status = customer.getDataValue('status');

        if (role !== 'Customer') {
            return res.status(403).json({ message: 'Only customers can use bank cash-in' });
        }
        if (status !== 'active') {
            return res.status(403).json({ message: 'Your account is not active. Please contact admin.' });
        }

        // ── 2. Validate amount ────────────────────────────────────────────────
        const amt = Number(amount);
        if (!amt || isNaN(amt) || amt <= 0) {
            return res.status(400).json({ message: 'Amount must be a positive number' });
        }

        // ── 3. Load Deposit commission limits ─────────────────────────────────
        const config     = await Commission.getConfig('Deposit');
        const minAmount  = config.minTxnAmount || 10;
        const maxAmount  = config.maxTxnAmount || 10000;

        if (amt < minAmount) {
            return res.status(400).json({ message: `Minimum cash-in amount is ${minAmount} tk` });
        }
        if (maxAmount && amt > maxAmount) {
            return res.status(400).json({ message: `Maximum cash-in amount is ${maxAmount} tk` });
        }

        // ── 4. Check customer wallet cap ──────────────────────────────────────
        const customerPhone   = customer.getDataValue('phone_number');
        const currentBalance  = await getBalance(customerPhone);

        if (maxAmount && currentBalance >= maxAmount) {
            return res.status(208).json({
                message: 'Limit exceeded. Your wallet is already at maximum capacity.'
            });
        }
        if (maxAmount) {
            const remaining = maxAmount - currentBalance;
            if (amt > remaining) {
                return res.status(208).json({
                    message: `Limit exceeded. You can cash in a maximum of ${remaining.toFixed(2)} tk.`
                });
            }
        }

        // ── 5. Create Stripe PaymentIntent ────────────────────────────────────
        // BDT uses 2 decimal places → multiply by 100 to get paisa
        const paymentIntent = await stripe.paymentIntents.create({
            amount:   Math.round(amt * 100),
            currency: 'bdt',
            metadata: {
                customer_phone: customerPhone,
                customer_email: customer.getDataValue('email'),
                dmoney_amount:  String(amt)
            }
        });

        return res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            amount:       amt,
            minAmount,
            maxAmount
        });

    } catch (error) {
        console.error('Stripe create-intent error:', error);
        return res.status(500).json({
            message: 'Failed to create payment intent',
            error:   error.message
        });
    }
};

/**
 * POST /transaction/stripe/confirm
 *
 * After the frontend successfully confirms the card payment via Stripe.js,
 * it sends the paymentIntentId here. We:
 *   1. Retrieve the PaymentIntent from Stripe and verify it succeeded.
 *   2. Verify the metadata matches the authenticated customer (anti-spoofing).
 *   3. Idempotency guard — refuse if this PaymentIntent was already processed.
 *   4. Write debit (SYSTEM) + credit (customer) records in Transactions table.
 */
exports.confirmCashIn = async (req, res) => {
    try {
        const { paymentIntentId } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({ message: 'paymentIntentId is required' });
        }

        const identifier = req.user.identifier;

        // ── 1. Find customer ──────────────────────────────────────────────────
        const customer = await findUserByIdentifier(identifier);
        if (!customer) {
            return res.status(404).json({ message: 'Customer account not found' });
        }

        const customerPhone = customer.getDataValue('phone_number');

        // ── 2. Retrieve & verify PaymentIntent from Stripe ────────────────────
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({
                message: `Payment not completed. Stripe status: ${paymentIntent.status}`
            });
        }

        // ── 3. Anti-spoofing: verify this PI belongs to the authenticated user ─
        if (paymentIntent.metadata.customer_phone !== customerPhone) {
            return res.status(403).json({
                message: 'Payment intent does not belong to this account'
            });
        }

        // ── 4. Idempotency: ensure we have not already processed this PI ───────
        const alreadyProcessed = await Transactions.findOne({
            where: { trnxId: paymentIntentId }
        });
        if (alreadyProcessed) {
            return res.status(208).json({ message: 'This payment has already been processed' });
        }

        // ── 5. Amount: Stripe stores in paisa → convert back to taka ─────────
        const amt    = paymentIntent.amount / 100;
        const trnxId = paymentIntentId; // reuse PI id for full traceability

        // ── 6. Write transaction records ──────────────────────────────────────
        // Debit SYSTEM — platform's pool decreases
        await Transactions.create({
            account:      'SYSTEM',
            from_account: 'STRIPE',
            to_account:   customerPhone,
            description:  'Bank Cash In (Stripe)',
            trnxId:       trnxId,
            debit:        amt,
            credit:       0
        });

        // Credit customer wallet — customer balance increases
        await Transactions.create({
            account:      customerPhone,
            from_account: 'STRIPE',
            to_account:   customerPhone,
            description:  'Bank Cash In (Stripe)',
            trnxId:       trnxId,
            debit:        0,
            credit:       amt
        });

        const currentBalance = await getBalance(customerPhone);

        return res.status(201).json({
            message:        'Cash in successful',
            trnxId:         trnxId,
            amount:         amt,
            currentBalance: currentBalance
        });

    } catch (error) {
        console.error('Stripe confirm error:', error);
        return res.status(500).json({
            message: 'Failed to process cash in',
            error:   error.message
        });
    }
};
