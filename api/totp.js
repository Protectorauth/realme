const { authenticator } = require("otplib");

authenticator.options = {
    step: 60,
    digits: 6,
    window: 0
};

function generateSecret() {
    return authenticator.generateSecret();
}

function getCurrentCode(secret) {
    return authenticator.generate(secret);
}

function getTotpCounter() {
    return Math.floor(Date.now() / 1000 / 60);
}

function isValidCodeFormat(token) {
    return /^\d{6}$/.test(String(token || "").trim());
}

function verifyCode(secret, token) {
    if (!isValidCodeFormat(token)) {
        return false;
    }
    return authenticator.verify({ token: String(token).trim(), secret });
}

function secondsUntilNextCode() {
    const now = Math.floor(Date.now() / 1000);
    return 60 - (now % 60);
}

module.exports = {
    generateSecret,
    getCurrentCode,
    getTotpCounter,
    isValidCodeFormat,
    verifyCode,
    secondsUntilNextCode
};
