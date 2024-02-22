const jwt = require('jsonwebtoken');
require ('dotenv').config();
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
const partnerKey = process.env.PARTNER_KEY;


const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        if (req.header('X-AUTH-SECRET-KEY') == partnerKey) {
            const token = authHeader;

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
            const err = new Error('Secret auth key validation failure!');
            err.status = 401;
            throw err;
        }

    }
    else {
        const err = new Error('No Token Found!');
        err.status = 401;
        throw err;
    }
};
const publicAuthenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader;
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