const crypto = require('crypto');

function generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
}

function validateToken(token) {
    return typeof token === 'string' && token.length === 64;
}

module.exports = {
    generateToken,
    validateToken
};
