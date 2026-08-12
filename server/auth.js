const crypto = require('crypto');

// Password hashing for the single login user, using Node's built-in scrypt (no
// external dependency). The stored form is `scrypt:<saltHex>:<hashHex>` so we can
// tell a hashed value apart from a legacy plaintext one and re-derive on verify.
//
// NOTE: this only covers the login password. The Gmail app password (settings.senderPass)
// is deliberately NOT hashed — nodemailer needs the real value to authenticate over SMTP,
// so a one-way hash there would make sending impossible.

const SCRYPT_KEYLEN = 64;
const HASH_PREFIX = 'scrypt:';

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(plain), salt, SCRYPT_KEYLEN).toString('hex');
  return `${HASH_PREFIX}${salt}:${hash}`;
}

function isHashed(stored) {
  return typeof stored === 'string' && stored.startsWith(HASH_PREFIX);
}

// Constant-time comparison so a match/mismatch can't be inferred from timing.
function verifyPassword(plain, stored) {
  if (!isHashed(stored)) {
    // Legacy plaintext record (pre-migration): fall back to a direct compare so
    // login keeps working until runMaintenance() upgrades it to a hash.
    return String(plain) === String(stored);
  }
  const [, salt, expectedHex] = stored.split(':');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = crypto.scryptSync(String(plain), salt, expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = {
  hashPassword,
  isHashed,
  verifyPassword
};
