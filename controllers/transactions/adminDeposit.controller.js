const { Transactions } = require('../../sequelizeModel/Transactions');
const { Users } = require('../../sequelizeModel/Users');

/**
 * Admin → SYSTEM deposit
 * - from_account must belong to an Admin role user
 * - to_account must be the SYSTEM account (phone_number === 'SYSTEM')
 * - No balance checks, no amount limits
 */
exports.handleAdminDeposit = async (req, res) => {
    const { from_account, to_account, amount } = req.body;
    const trnxId = "TXN" + Math.floor(Math.random() * 1000000);

    try {
        const fromUser = await Users.findOne({ where: { phone_number: from_account } });
        const toUser   = await Users.findOne({ where: { phone_number: to_account   } });

        if (!fromUser) {
            return res.status(404).json({ message: "From account does not exist" });
        }
        if (!toUser) {
            return res.status(404).json({ message: "To account does not exist" });
        }

        // Caller must be Admin
        if (fromUser.getDataValue('role') !== 'Admin') {
            return res.status(403).json({ message: "Only Admin can use this deposit endpoint" });
        }

        // Destination must be the SYSTEM account
        if (toUser.getDataValue('phone_number') !== 'SYSTEM') {
            return res.status(400).json({
                message: "Admin can only deposit to the SYSTEM account. Please enter 'SYSTEM' as the account phone number."
            });
        }

        const amt = Number(amount);
        if (!amt || amt <= 0) {
            return res.status(400).json({ message: "Amount must be greater than 0" });
        }

        // Debit Admin account
        await Transactions.create({
            account:      from_account,
            from_account: from_account,
            to_account:   to_account,
            description:  "Admin Deposit to SYSTEM",
            trnxId:       trnxId,
            debit:        amt,
            credit:       0
        });

        // Credit SYSTEM account
        await Transactions.create({
            account:      to_account,
            from_account: from_account,
            to_account:   to_account,
            description:  "Admin Deposit",
            trnxId:       trnxId,
            debit:        0,
            credit:       amt
        });

        return res.status(201).json({
            message: "Deposit to SYSTEM account successful",
            trnxId:  trnxId,
            amount:  amt
        });

    } catch (error) {
        console.error('Admin deposit error:', error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};
