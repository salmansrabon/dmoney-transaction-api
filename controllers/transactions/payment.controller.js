const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');
const { getBalance } = require('../../services/getBalance');
const jsonConfig=require('./config.json');

exports.handlePayment = async (req, res, next) => {
    const { from_account, to_account, amount, discount_code, discount_amount } = req.body;
    var trnxId = "TXN" + Math.floor(Math.random() * 1000000);

    const from_account_exists = await Users.findOne({ where: { phone_number: from_account } });
    const to_account_exists = await Users.findOne({ where: { phone_number: to_account } });

    if (from_account_exists && to_account_exists) {
        if (from_account === to_account) {
            return res.status(208).json({ message: "From account and to account cannot be the same" });
        }

        const from_account_role = await Users.findOne({ where: { phone_number: from_account } });
        const to_account_role = await Users.findOne({ where: { phone_number: to_account } });

        var feeRate = jsonConfig.payment.serviceFee;
        var commissionRate = jsonConfig.payment.agentComission;
        var minAmount = jsonConfig.payment.minAmount;
        var paymentFee = feeRate * amount;
        var commission = commissionRate * amount;

        // Apply minimum payment fee
        if (paymentFee <= 5) {
            paymentFee = 5;
        }

        // Apply discount if provided
        let finalAmount = amount;
        let discountApplied = false;
        if (discount_code && discount_amount) {
            const envDiscountCode = process.env.DISCOUNT_CODE; // assuming discount_code is stored in the env file
            if (discount_code === envDiscountCode) {
                finalAmount = amount - (amount * (discount_amount / 100));
                discountApplied = true;
            }
        }

        if ((from_account_role.getDataValue('role') === "Customer" || from_account_role.getDataValue('role') === "Agent") && to_account_role.getDataValue('role') === "Merchant") {
            var currentBalance = await getBalance(from_account);

            if (currentBalance > 0 && finalAmount + paymentFee <= currentBalance) {
                if (finalAmount >= minAmount) {
                    const debitTrnx = {
                        account: from_account,
                        from_account: from_account,
                        to_account: to_account,
                        description: "Payment",
                        trnxId: trnxId,
                        debit: finalAmount + paymentFee,
                        credit: 0
                    };
                    const creditTrnx = {
                        account: to_account,
                        from_account: from_account,
                        to_account: to_account,
                        description: "Payment",
                        trnxId: trnxId,
                        debit: 0,
                        credit: finalAmount + commission
                    };
                    const creditTrnxToSystem = {
                        account: "SYSTEM",
                        from_account: from_account,
                        to_account: "SYSTEM",
                        description: "Payment Service Charge",
                        trnxId: trnxId,
                        debit: 0,
                        credit: paymentFee
                    };
                    await Transactions.create(debitTrnx);
                    await Transactions.create(creditTrnx);
                    await Transactions.create(creditTrnxToSystem);

                    // Build the response object conditionally
                    let response = {
                        message: "Payment successful",
                        trnxId: trnxId,
                        fee: paymentFee,
                        currentBalance: await getBalance(from_account),
                    };

                    if (discountApplied) {
                        response.discountedTotal = finalAmount;
                        response.discountedAmount = amount - finalAmount;
                    }

                    return res.status(201).json(response);
                } else {
                    return res.status(208).json({ message: `Minimum Payment amount is ${minAmount} tk` });
                }
            } else {
                return res.status(208).json({ message: "Insufficient balance", currentBalance: await getBalance(from_account) });
            }
        } else {
            return res.status(208).json({ message: "From A/C should be customer or agent and To A/C should be merchant type" });
        }
    } else {
        if(!from_account_exists){
            return res.status(404).json({ message: "From Account does not exist" });
        }
        else if(!to_account_exists){
            return res.status(404).json({ message: "To Account does not exist" });
        }
    }
};

