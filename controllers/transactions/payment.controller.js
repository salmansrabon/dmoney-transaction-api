const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { Commission } = require('../../sequelizeModel/Commission');
const { getBalance } = require('../../services/getBalance');

exports.handlePayment = async (req, res, next) => {
    const { from_account, to_account, amount, discount_code, discount_amount } = req.body;
    var trnxId = "TXN" + Math.floor(Math.random() * 1000000);

    // Load commission rules from DB
    const config          = await Commission.getConfig('Payment');
    const feeRule         = config.rules.find(r => r.recipient === 'SYSTEM');
    const commissionRate  = config.merchantCommissionRate || 0.025;
    const minAmount       = config.minTxnAmount           || 10;

    const from_account_exists = await Users.findOne({ where: { phone_number: from_account } });
    const to_account_exists   = await Users.findOne({ where: { phone_number: to_account } });

    if (from_account_exists && to_account_exists) {
        if (from_account === to_account) {
            return res.status(400).json({ message: "From account and to account cannot be the same" });
        }

        // Status checks — both accounts must be active
        if (from_account_exists.getDataValue('status') !== 'active') {
            return res.status(403).json({ message: "Your account is not active. Please contact admin." });
        }
        if (to_account_exists.getDataValue('status') !== 'active') {
            return res.status(403).json({ message: "Merchant account is not active. Please contact admin." });
        }

        const fromRole = from_account_exists.getDataValue('role');
        const toRole   = to_account_exists.getDataValue('role');

        // Apply discount if provided
        let finalAmount    = amount;
        let discountApplied = false;
        if (discount_code && discount_amount) {
            const envDiscountCode = process.env.DISCOUNT_CODE;
            if (discount_code === envDiscountCode) {
                finalAmount     = amount - (amount * (discount_amount / 100));
                discountApplied = true;
            }
        }

        // Calculate payment fee using DB rule (respects min_fee floor)
        var paymentFee = feeRule ? Commission.calcFee(feeRule, finalAmount) : Math.max(finalAmount * 0.01, 5);
        var commission = commissionRate * finalAmount;

        if ((fromRole === "Customer" || fromRole === "Agent") && toRole === "Merchant") {
            var currentBalance = await getBalance(from_account);

            if (currentBalance > 0 && finalAmount + paymentFee <= currentBalance) {
                if (finalAmount >= minAmount) {
                    const debitTrnx = {
                        account:      from_account,
                        from_account: from_account,
                        to_account:   to_account,
                        description:  "Payment",
                        trnxId:       trnxId,
                        debit:        finalAmount + paymentFee,
                        credit:       0
                    };
                    const creditTrnx = {
                        account:      to_account,
                        from_account: from_account,
                        to_account:   to_account,
                        description:  "Payment",
                        trnxId:       trnxId,
                        debit:        0,
                        credit:       finalAmount + commission
                    };
                    const creditTrnxToSystem = {
                        account:      "SYSTEM",
                        from_account: from_account,
                        to_account:   "SYSTEM",
                        description:  "Payment Service Charge",
                        trnxId:       trnxId,
                        debit:        0,
                        credit:       paymentFee
                    };
                    await Transactions.create(debitTrnx);
                    await Transactions.create(creditTrnx);
                    await Transactions.create(creditTrnxToSystem);

                    let response = {
                        message:        "Payment successful",
                        trnxId:         trnxId,
                        fee:            paymentFee,
                        currentBalance: await getBalance(from_account),
                    };

                    if (discountApplied) {
                        response.discountedTotal  = finalAmount;
                        response.discountedAmount = amount - finalAmount;
                    }

                    return res.status(201).json(response);
                } else {
                    return res.status(400).json({ message: `Minimum Payment amount is ${minAmount} tk` });
                }
            } else {
                return res.status(208).json({ message: "Insufficient balance", currentBalance: await getBalance(from_account) });
            }
        } else {
            return res.status(400).json({ message: "From A/C should be customer or agent and To A/C should be merchant type" });
        }
    } else {
        if (!from_account_exists) {
            return res.status(400).json({ message: "From Account does not exist" });
        } else {
            return res.status(400).json({ message: "To Account does not exist" });
        }
    }
};
