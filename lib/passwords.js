const crypto = require("crypto");

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function generateTemporaryPassword(length = 10) {
  let password = "";

  for (let i = 0; i < length; i += 1) {
    password += CHARS[crypto.randomInt(CHARS.length)];
  }

  return password;
}

function passwordFingerprint(passwordHash) {
  return crypto.createHash("sha256").update(String(passwordHash)).digest("hex").slice(0, 16);
}

module.exports = { generateTemporaryPassword, passwordFingerprint };
