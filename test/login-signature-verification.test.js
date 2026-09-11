/**
 * Story 3 (epic: security-auth-exposure) — Login endpoints must verify the signed challenge.
 *
 * Story: engineering-team/stories/security-auth-exposure/3-login-signature-verification.md
 * ADR:   engineering-team/decisions/security-auth-exposure/0003-verify-signed-login-challenge.md
 *
 * Stack-free (needs neither Neo4j nor Redis): the auth handlers are exercised with a mock
 * req/res and a mock session that emulates express-session's regenerate()/save().
 *
 *   U-class (behavioral) — drives the real handlers:
 *     • a challenge request (verify-user) establishes NO identity (the reframe);
 *     • login rejects a bogus/all-zeros signature, a wrong kind, a stale created_at,
 *       a valid signature by the wrong key, and a replayed (single-use) challenge;
 *     • a validly-signed challenge is accepted and the session id is regenerated with no nsec;
 *     • /api/auth/login (owner) enforces the same and never stores a client nsec.
 *   S-class (source sentinels) — guards the ADR decisions behavior can't cheaply catch:
 *     verifyEvent is used, session.nsec is never assigned, regenerate() is called, and the
 *     paste-your-nsec page is retired.
 *
 * The REJECT/reframe/regenerate/sentinel tests FAIL against current code (today login trusts
 * pubkey + challenge with no signature check, verify sets session.pubkey pre-auth, there is no
 * regenerate, and nsec is stored). That is the point. Cases that must MINT a valid signature use
 * nostr-tools; if it can't be loaded (e.g. a bare host with no node_modules) those SKIP — CI
 * installs it, so they run there.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const AUTH = path.join(ROOT, 'src/middleware/auth.js');
const NSEC_PAGE = path.join(ROOT, 'public/pages/sign-in-with-nsec.html');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
const nowS = () => Math.floor(Date.now() / 1000);

// Lazy, resilient nostr-tools load — mirrors the code's own fallback
// (src/api/event/eventReadPath.js:38-40). Null when unavailable → signing tests SKIP.
let NT = undefined;
function nostr() {
  if (NT === undefined) {
    try { NT = require('nostr-tools'); }
    catch {
      try { NT = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools'); }
      catch { NT = null; }
    }
  }
  return NT;
}

/* ─────────────── Mocks ─────────────── */

function mkRes() {
  return {
    statusCode: null,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
  };
}

// Emulates enough of express-session for the handlers: regenerate() gives a NEW id and
// clears data (fixation defense), save() is a no-op callback.
function mkSession(init = {}) {
  const s = {
    id: 'sid-' + Math.random().toString(16).slice(2),
    regenerate(cb) {
      for (const k of Object.keys(this)) {
        if (k === 'id' || typeof this[k] === 'function') continue;
        delete this[k];
      }
      this.id = 'sid-' + Math.random().toString(16).slice(2);
      if (cb) cb(null);
    },
    save(cb) { if (cb) cb(null); },
    destroy(cb) { if (cb) cb(null); },
    ...init,
  };
  return s;
}

const bogus = (over = {}) => ({
  kind: 22242, pubkey: 'a'.repeat(64), created_at: nowS(),
  tags: [['challenge', 'X']], content: '',
  id: '0'.repeat(64), sig: '0'.repeat(128), ...over,
});

function mintSigned(sk, { challenge, kind = 22242, created_at } = {}) {
  const { finalizeEvent } = nostr();
  const tmpl = { kind, created_at: created_at ?? nowS(), tags: [['challenge', challenge]], content: '' };
  // round-trip, as the codebase does (event-page-read-path.test.js:51)
  return JSON.parse(JSON.stringify(finalizeEvent(tmpl, sk)));
}

/* ─────────────── Handler drivers ─────────────── */

function issueChallengeUser(pubkey, session) {
  const { handleAuthVerifyUser } = require(AUTH);
  const res = mkRes();
  handleAuthVerifyUser({ body: { pubkey }, session, headers: {} }, res);
  return res.body && res.body.challenge;
}

async function loginUser(event, session) {
  const { handleAuthLoginUser } = require(AUTH);
  const res = mkRes();
  await handleAuthLoginUser({ body: { event }, session, headers: {} }, res);
  return res;
}

function authStatus(session) {
  const { handleAuthStatus } = require(AUTH);
  const res = mkRes();
  handleAuthStatus({ session }, res);
  return res.body || {};
}

/* ─────────────── Tests ─────────────── */

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

// ── U-class: reject paths (fail against current code) ──

t('AC: an all-zeros-sig event with the right challenge is REJECTED (login-user); status stays authenticated:false', async () => {
  const session = mkSession();
  const pk = 'a'.repeat(64);
  const challenge = issueChallengeUser(pk, session);
  assert(challenge, 'verify-user did not issue a challenge.');
  const res = await loginUser(bogus({ pubkey: pk, tags: [['challenge', challenge]] }), session);
  assert(res.body && res.body.success !== true, `a bogus-signature login must not succeed; got ${JSON.stringify(res.body)}.`);
  assert(session.authenticated !== true, 'session became authenticated on an unsigned event — the bypass is still open.');
  assert(authStatus(session).authenticated === false, 'GET /api/auth/status reports authenticated:true after a bogus-sig login.');
});

t('AC: a wrong-kind event (kind 1) is REJECTED even with the right pubkey + challenge', async () => {
  const session = mkSession();
  const pk = 'a'.repeat(64);
  const challenge = issueChallengeUser(pk, session);
  const res = await loginUser(bogus({ pubkey: pk, kind: 1, tags: [['challenge', challenge]] }), session);
  assert(res.body && res.body.success !== true && session.authenticated !== true, `a non-auth kind must be rejected; got ${JSON.stringify(res.body)}.`);
});

t('AC (reframe): a bare challenge request (verify-user) establishes NO session identity', async () => {
  const session = mkSession();
  const pk = 'b'.repeat(64);
  const challenge = issueChallengeUser(pk, session);
  assert(challenge, 'verify-user did not issue a challenge.');
  assert(session.authenticated !== true, 'verify-user must not authenticate the session.');
  assert(session.pubkey === undefined, 'verify-user set session.pubkey as identity before any signature — a challenge request must establish nothing.');
  const st = authStatus(session);
  assert(st.authenticated === false && !st.pubkey, `status must report no identity after a bare challenge request; got ${JSON.stringify(st)}.`);
});

t('AC (single-use): after one failed attempt, the same challenge cannot be reused', async () => {
  const session = mkSession();
  const pk = 'c'.repeat(64);
  const challenge = issueChallengeUser(pk, session);
  const evt = bogus({ pubkey: pk, tags: [['challenge', challenge]] });
  const first = await loginUser(evt, session);
  assert(first.body && first.body.success !== true && session.authenticated !== true, 'the first (bogus-sig) attempt must be rejected, not authenticated.');
  const second = await loginUser(evt, session);
  assert(second.body && second.body.success !== true && session.authenticated !== true, 'the same challenge was accepted on a second attempt — challenges must be single-use.');
});

t('AC (both handlers): /api/auth/login (owner) rejects a bogus sig and never stores the client nsec', async () => {
  const { handleAuthLogin } = require(AUTH);
  const ownerPk = 'd'.repeat(64);
  const challenge = 'c0ffee'.repeat(8).slice(0, 64);
  const session = mkSession();
  // Seed the post-verify state in BOTH the current (pubkey+challenge) and the ADR-0003
  // (pendingAuth) shapes, so this test is agnostic to which the implementation reads.
  session.pubkey = ownerPk; session.challenge = challenge;
  session.pendingAuth = { pubkey: ownerPk, challenge };
  const res = mkRes();
  await handleAuthLogin({ body: { event: bogus({ pubkey: ownerPk, tags: [['challenge', challenge]] }), nsec: 'nsec1donotstoreme' }, session, headers: {} }, res);
  assert(res.body && res.body.success !== true, `owner login must reject a bogus sig; got ${JSON.stringify(res.body)}.`);
  assert(session.authenticated !== true, 'owner session authenticated on an unsigned event.');
  assert(session.nsec === undefined, 'the client-supplied nsec was stored in the session — it must never be.');
});

// ── U-class: accept / precise-reason paths (mint a real signature → need nostr-tools) ──

t('AC: a validly-signed challenge is ACCEPTED (login-user) [needs nostr-tools]', async () => {
  const nt = nostr(); if (!nt) return 'SKIP';
  const sk = nt.generateSecretKey(); const pk = nt.getPublicKey(sk);
  const session = mkSession();
  const challenge = issueChallengeUser(pk, session);
  const res = await loginUser(mintSigned(sk, { challenge }), session);
  assert(res.body && res.body.success === true, `a valid signed challenge must be accepted; got ${JSON.stringify(res.body)}.`);
  assert(session.authenticated === true && session.pubkey === pk, 'a valid login must establish the authenticated identity.');
  assert(authStatus(session).authenticated === true, 'status must report authenticated after a valid login.');
});

t('AC: a successful login regenerates the session id and leaves no nsec [needs nostr-tools]', async () => {
  const nt = nostr(); if (!nt) return 'SKIP';
  const sk = nt.generateSecretKey(); const pk = nt.getPublicKey(sk);
  const session = mkSession();
  const beforeId = session.id;
  const challenge = issueChallengeUser(pk, session);
  const res = await loginUser(mintSigned(sk, { challenge }), session);
  assert(res.body && res.body.success === true, 'precondition: a valid login should succeed.');
  assert(session.id && session.id !== beforeId, 'the session id was not regenerated on login — session-fixation is not mitigated.');
  assert(session.nsec === undefined, 'a nsec was present in the session after login.');
});

t('AC: a valid signature with a stale created_at (2h old) is REJECTED [needs nostr-tools]', async () => {
  const nt = nostr(); if (!nt) return 'SKIP';
  const sk = nt.generateSecretKey(); const pk = nt.getPublicKey(sk);
  const session = mkSession();
  const challenge = issueChallengeUser(pk, session);
  const res = await loginUser(mintSigned(sk, { challenge, created_at: nowS() - 7200 }), session);
  assert(res.body && res.body.success !== true && session.authenticated !== true, `a stale-created_at login must be rejected; got ${JSON.stringify(res.body)}.`);
});

t('AC: a valid signature by a DIFFERENT key than the challenged pubkey is REJECTED [needs nostr-tools]', async () => {
  const nt = nostr(); if (!nt) return 'SKIP';
  const skA = nt.generateSecretKey(); const pkA = nt.getPublicKey(skA);
  const skB = nt.generateSecretKey(); // the attacker's own key
  const session = mkSession();
  const challenge = issueChallengeUser(pkA, session); // challenge issued for pkA
  const res = await loginUser(mintSigned(skB, { challenge }), session); // validly signed, but by pkB
  assert(res.body && res.body.success !== true && session.authenticated !== true, 'a valid signature by the wrong key was accepted — event.pubkey must match the challenged pubkey.');
});

// ── S-class: source sentinels (each fails against current code, guards an ADR decision) ──

t('S: auth.js verifies the signed event with nostr-tools verifyEvent', async () => {
  assert(/verifyEvent/.test(readSafe(AUTH) || ''), 'auth.js does not reference verifyEvent — the signed challenge is not cryptographically verified.');
});

t('S: auth.js no longer assigns a client-supplied nsec to the session', async () => {
  assert(!/session\.nsec\s*=/.test(readSafe(AUTH) || ''), 'auth.js still assigns session.nsec — the client nsec must not be stored.');
});

t('S: a successful login regenerates the session (fixation defense)', async () => {
  assert(/\.regenerate\s*\(/.test(readSafe(AUTH) || ''), 'auth.js does not call session.regenerate() — session fixation is not addressed.');
});

t('S: the paste-your-nsec sign-in page is retired', async () => {
  assert(!fs.existsSync(NSEC_PAGE), 'public/pages/sign-in-with-nsec.html still exists — the nsec paste flow must be retired.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- login signature verification tests (epic security-auth-exposure, Story 3) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nlogin-signature-verification: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
