// Proves the login handlers reject an unsigned/forged challenge event. Before
// the fix, /api/auth/login(-user) only echoed the caller-controlled pubkey +
// challenge, so any pubkey (incl. owner/admin) could be impersonated with no
// private key. The fix verifies the schnorr signature.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
process.env.BOUNTIES_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bs-auth-')), 'b.db');

const { generateSecretKey, getPublicKey, finalizeEvent } = require('nostr-tools');
const { handleAuthLoginUser, handleAuthLogin } = require('../src/middleware/auth');

function fakeRes() {
  const r = { statusCode: 200, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (o) => { r.body = o; return r; };
  return r;
}

const victimSk = generateSecretKey();
const victimPk = getPublicKey(victimSk);
const attackerSk = generateSecretKey();
const CHALLENGE = 'deadbeef'.repeat(8);

function signedChallenge(sk, pkOverride) {
  const ev = finalizeEvent({ kind: 22242, created_at: Math.floor(Date.now() / 1000), tags: [['challenge', CHALLENGE]], content: '' }, sk);
  if (pkOverride) ev.pubkey = pkOverride; // forge: claim victim's pubkey, signed by someone else
  // Round-trip through JSON to mirror how Express delivers req.body.event — this
  // also drops nostr-tools' in-process "verified" memo symbol, so verifyEvent
  // does the real check (exactly what happens to a real over-the-wire request).
  return JSON.parse(JSON.stringify(ev));
}

let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`  ok  ${name}`); }

for (const [label, handler] of [['login-user', handleAuthLoginUser], ['login (owner)', handleAuthLogin]]) {
  test(`${label} rejects a forged event (victim pubkey, attacker signature)`, () => {
    const req = { body: { event: signedChallenge(attackerSk, victimPk) }, session: { pubkey: victimPk, challenge: CHALLENGE } };
    const res = fakeRes();
    handler(req, res);
    assert.strictEqual(res.body.success, false, 'forged login must be rejected');
    assert.notStrictEqual(req.session.authenticated, true, 'session must NOT be authenticated');
  });

  test(`${label} accepts a properly signed event`, () => {
    const req = { body: { event: signedChallenge(victimSk) }, session: { pubkey: victimPk, challenge: CHALLENGE } };
    const res = fakeRes();
    handler(req, res);
    assert.strictEqual(res.body.success, true, 'valid login must succeed');
    assert.strictEqual(req.session.authenticated, true);
  });
}

console.log(`\n${passed} auth-signature tests passed`);
