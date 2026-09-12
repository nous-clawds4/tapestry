/**
 * event-authenticity #1 (ported for the sandboxes) — `POST /api/strfry/publish` must verify a
 * client-signed event's signature BEFORE it publishes the event (strfry import).
 *
 * Story: engineering-team/stories/sandbox-security/1-magic-carpet-security-parity.md (AC "published
 *        events are authentic"), 2-tags-security-parity.md (same).
 * ADR:   engineering-team/decisions/sandbox-security/0001-port-production-security-fixes-to-sandboxes.md
 * Source oracle: test/publish-event-signature-verification.test.js on staging
 *        (event-authenticity/0001), ADAPTED to the sandbox publishEvent.js shape.
 *
 * Why adapted: the sandboxes are behind staging and their publishEvent.js has NO
 * tapestryBrainWrite / import-into-Neo4j path — on the client path the ONLY sink is
 * `exec('strfry import')`. So the authenticity guard reduces to: a forged client event
 * (well-formed, has id/sig/pubkey, but the signature is not valid for its pubkey) must NOT
 * reach that exec; a validly-signed one must.
 *
 * Stack-free: child_process.exec is spied. publishEvent.js pulls in three sibling modules at
 * load (assistantKeys, lib/receiving/publish, profiles/fetchProfiles) — the last hardcodes an
 * in-container `ws` path — so all three are stubbed via the require cache to let the handler
 * load on a bare host. The forged test needs no signing and FAILS against current code (today
 * the client path checks only that id/sig/pubkey are present, so exec is reached and
 * success:true is returned). The valid-signature test mints a real sig with nostr-tools and
 * SKIPs if it can't be loaded (it runs in-container / in CI).
 */

const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLISH = require.resolve(path.join(ROOT, 'src/api/strfry/commands/publishEvent.js'));

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const nowS = () => Math.floor(Date.now() / 1000);

// Resilient nostr-tools load (mirrors the code's own fallback); null → SKIP signing tests.
let NT = undefined;
function nostr() {
  if (NT === undefined) {
    try { NT = require('nostr-tools'); }
    catch { try { NT = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools'); } catch { NT = null; } }
  }
  return NT;
}

/* ---- test runner ---- */
let pass = 0, fail = 0, skipped = 0;
async function test(name, fn) {
  try { const r = fn(); if (r && typeof r.then === 'function') await r; console.log(`  PASS  ${name}`); pass++; }
  catch (e) { if (e && e.SKIP) { console.log(`  SKIP  ${name} [${e.message}]`); skipped++; } else { console.log(`  FAIL  ${name}\n        ${e.message}`); fail++; } }
}
function skip(msg) { const e = new Error(msg); e.SKIP = true; throw e; }

/* ---- stubs: let publishEvent.js load on a bare host, and spy the strfry-import sink ----
 * Intercept the three sibling modules publishEvent pulls in by require-string suffix, so this
 * is agnostic to each sandbox branch's exact file layout (their paths differ). */
const Module = require('module');
const _origLoad = Module._load;
const STUBS = [
  { match: /profiles\/fetchProfiles$/, exports: { invalidateProfileCache() {}, getProfiles: async () => ({}) } },
  { match: /receiving\/publish$/,      exports: { publishToRelays: async () => ({}), getProfileRelays: async () => [] } },
  { match: /utils\/assistantKeys$/,    exports: { getOwnerAssistantKeys: async () => ({ privkey: '', pubkey: '' }), getOwnerAssistantPubkey: () => '' } },
];
function installStubs() {
  Module._load = function (request, parent, isMain) {
    for (const s of STUBS) if (s.match.test(request)) return s.exports;
    return _origLoad.call(this, request, parent, isMain);
  };
}
function restoreStubs() { Module._load = _origLoad; }
const cp = require('child_process');
let execCmds = [];
const realExec = cp.exec;
function installExecSpy() {
  execCmds = [];
  cp.exec = function (cmd, opts, cb) {
    execCmds.push(cmd);
    const done = typeof opts === 'function' ? opts : cb;
    // emulate a successful strfry import so the handler completes its callback path
    if (done) process.nextTick(() => done(null, '0', ''));
    return { stdin: { write() {}, end() {} }, on() {}, stdout: { on() {} }, stderr: { on() {} } };
  };
}
function restore() { cp.exec = realExec; }

function loadHandler() {
  installStubs();          // stub the sibling modules by require-suffix before loading the handler
  delete require.cache[PUBLISH];
  try { return require(PUBLISH).handlePublishEvent; }
  finally { restoreStubs(); }
}
function mkRes() {
  return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(o) { this.body = o; return this; } };
}
function reachedImport() { return execCmds.some(c => /strfry\s+import/.test(c)); }

async function run() {
  // A forged client event: well-formed with id/sig/pubkey present, but the signature is bogus.
  const forged = {
    kind: 1, created_at: nowS(), tags: [], content: 'forged',
    pubkey: 'a'.repeat(64), id: 'b'.repeat(64), sig: '0'.repeat(128),
  };

  await test('AC: a forged client event (invalid signature) is NOT published (never reaches strfry import)', async () => {
    installExecSpy();
    try {
      const handler = loadHandler();
      const res = mkRes();
      await handler({ body: { event: forged, signAs: 'client' }, session: {}, headers: {} }, res);
      assert(!reachedImport(), 'a forged event reached `strfry import` — the signature was not verified before publish.');
      assert(res.statusCode >= 400 || (res.body && res.body.success === false),
        `a forged event must be rejected; got status ${res.statusCode} body ${JSON.stringify(res.body)}.`);
    } finally { restore(); }
  });

  await test('AC: a validly-signed client event from any pubkey IS published (permissionless, authenticity-only)', async () => {
    const nt = nostr();
    if (!nt) skip('needs nostr-tools');
    const sk = nt.generateSecretKey();
    const pk = nt.getPublicKey(sk);
    const signed = nt.finalizeEvent({ kind: 1, created_at: nowS(), tags: [], content: 'genuine' }, sk);
    assert(signed.pubkey === pk, 'sanity: finalizeEvent set the pubkey');
    installExecSpy();
    try {
      const handler = loadHandler();
      const res = mkRes();
      await handler({ body: { event: signed, signAs: 'client' }, session: {}, headers: {} }, res);
      assert(reachedImport(), 'a validly-signed event did NOT reach `strfry import` — permissionless publishing was broken.');
    } finally { restore(); }
  });

  // No source-order sentinel here on purpose: the two behavioral tests above drive the real
  // handler (a forged event must not reach `strfry import`; a valid one must), so a regex over
  // source would only add OPEN.md #193-class brittleness — a resilient verifier called through a
  // variable is a legitimate shape a `/verifyEvent\(/` sentinel would wrongly reject.

  console.log(`\npublish-event-signature-verification: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped };
}

module.exports = { run };
if (require.main === module) run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
