const jwt = require('jsonwebtoken');
require('dotenv').config();
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
const partnerKey = process.env.PARTNER_KEY;


const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (authHeader) {
        if (req.header('X-AUTH-SECRET-KEY') === partnerKey) {
            //const token = authHeader;
            const token = authHeader.split(' ')[1];

            jwt.verify(token, accessTokenSecret, (err, user) => {
                if (err) {
                    if (err.name === 'TokenExpiredError') {
                        return res.status(403).json({ message: 'Token expired!' });
                    } else {
                        return res.status(403).json({ message: 'Token invalid!' });
                    }
                }

                req.user = user;
                next();
            });
        } else {
            return res.status(401).json({ message: 'Secret auth key validation failure!' });
        }
    } else {
        return res.status(401).json({ message: 'No Token Found!' });
    }
};
const publicAuthenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        //const token = authHeader;
        const token = authHeader.split(' ')[1];
        jwt.verify(token, accessTokenSecret, (err, user) => {
            if (err) {
                const err = new Error('Token expired!');
                err.status = 403;
                throw err;
            }

            req.user = user;
            next();
        });
    }
    else {
        const err = new Error('No Token Found!');
        err.status = 401;
        throw err;
    }
};
module.exports = { authenticateJWT, publicAuthenticateJWT };