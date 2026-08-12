const { test } = require('node:test');
const assert = require('node:assert');
const { hashPassword, isHashed, verifyPassword } = require('./auth');

test('hashPassword produces a scrypt-prefixed, non-plaintext value', () => {
  const hash = hashPassword('secreto123');
  assert.ok(hash.startsWith('scrypt:'), 'should be tagged as scrypt');
  assert.ok(!hash.includes('secreto123'), 'must not contain the plaintext');
  assert.ok(isHashed(hash));
});

test('hashPassword salts: same input yields different hashes', () => {
  assert.notStrictEqual(hashPassword('misma'), hashPassword('misma'));
});

test('verifyPassword accepts the correct password and rejects wrong ones', () => {
  const hash = hashPassword('0000');
  assert.strictEqual(verifyPassword('0000', hash), true);
  assert.strictEqual(verifyPassword('0001', hash), false);
  assert.strictEqual(verifyPassword('', hash), false);
});

test('verifyPassword falls back to plaintext compare for legacy (unhashed) records', () => {
  assert.strictEqual(isHashed('0000'), false);
  assert.strictEqual(verifyPassword('0000', '0000'), true);
  assert.strictEqual(verifyPassword('9999', '0000'), false);
});

test('verifyPassword tolerates malformed stored hashes without throwing', () => {
  assert.strictEqual(verifyPassword('x', 'scrypt:onlyonepart'), false);
});
