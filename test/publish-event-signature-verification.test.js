/**
 * Story 1 (epic: event-authenticity) — verify client-published event signatures.
 *
 * Story: engineering-team/stories/event-authenticity/1-verify-client-published-event-signatures.md
 * ADR:   engineering-team/decisions/event-authenticity/0001-verify-client-published-event-signatures.md
 *
 * `POST /api/strfry/publish` (handlePublishEvent) on the signAs:'client' path must verify the
 * event signature BEFORE it publishes (strfry import) or learns it (maybeBrainWriteTapestry →
 * importEventDirect → Neo4j/LMDB). Today it checks only that id/sig/pubkey are present, so a
 * forged event (bad sig) is imported and — because strfry import exits 0 even when it rejects a
 * bad sig — its nodes are written into the graph from the event object.
 *
 * Stack-free: the handler shells out and calls the brain-write, so both are intercepted —
 *   • child_process.exec is a CORE module (not require-cache-stubbable), so we mutate
 *     child_process.exec, then fresh-require the handler so its `const { exec } = require(...)`
 *     binds the spy; restored after every test.
 *   • ../tapestryBrainWrite is stubbed via the require cache (the pattern in
 *     test/close-unauth-write-surface.test.js).
 * The spies record whether the publish / brain-write were REACHED — a forged event must reach
 * neither; a valid event must reach both.
 *
 * The forged-event tests need no signing and FAIL against current code (exec + brainWrite are
 * reached and success:true is returned). The valid-event test mints a real signature with
 * nostr-tools and SKIPs if it can't be loaded (it runs in CI / in-container).
 */

const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PUBLISH = require.resolve(path.join(ROOT, 'src/api/strfry/commands/publishEvent.js'));
const BRAINWRITE = require.resolve(path.join(ROOT, 'src/api/strfry/tapestryBrainWrite.js'));

function assert(cond, msg) { if (!cond) throw new Error(msg); }
const nowS = () => Math.floor(Date.now() / 1000);

// Resilient nostr-tools load (mirrors src/api/event/eventReadPath.js:38-40); null → SKIP signing tests.
let NT = undefined;
function nostr() {
  if (NT === undefined) {
    try { NT = require('nostr-tools'); }
    catch { try { NT = require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools'); } catch { NT = null; } }
  }
  return NT;
}

const cp = require('child_process');
const realExec = cp.exec;

function mkRes() {
  return {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(o) { this.body = o; return this; },
  };
}

// Install the exec spy + brain-write stub, then fresh-require the handler so it binds them.
function loadHandler() {
  const calls = { exec: 0, brainWrite: 0, brainWriteArgs: [] };
  cp.exec = (cmd, opts, cb) => {
    calls.exec++;
    // emulate a successful `strfry import` (exit 0)
    if (typeof cb === 'function') cb(null, '', '');
    return { stdin: { write() {}, end() {} } };
  };
  require.cache[BRAINWRITE] = {
    id: BRAINWRITE, filename: BRAINWRITE, loaded: true,
    exports: {
      maybeBrainWriteTapestry: async (ev) => { calls.brainWrite++; calls.brainWriteArgs.push(ev); return null; },
      isOwnedTapestryEvent: () => false,
    },
  };
  delete require.cache[PUBLISH];
  const { handlePublishEvent } = require(PUBLISH);
  return { handlePublishEvent, calls };
}

function cleanup() {
  cp.exec = realExec;
  delete require.cache[PUBLISH];
  delete require.cache[BRAINWRITE];
}

async function callPublish(body) {
  const { handlePublishEvent, calls } = loadHandler();
  const req = { body, session: {}, headers: {} };
  const res = mkRes();
  await handlePublishEvent(req, res);
  return { res, calls };
}

// A well-formed but FORGED event: has id/sig/pubkey (passes the presence check) but the
// signature is not valid for the pubkey.
const forged = (over = {}) => ({
  kind: 1, pubkey: 'a'.repeat(64), created_at: nowS(), tags: [], content: 'forged',
  id: '0'.repeat(64), sig: '0'.repeat(128), ...over,
});

/* ─────────────── Tests ─────────────── */

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

t('AC1: a forged-signature client event is REJECTED and never reaches strfry import or the brain-write', async () => {
  const { res, calls } = await callPublish({ event: forged(), signAs: 'client' });
  assert(res.body && res.body.success !== true, `a forged-sig publish must not succeed; got ${JSON.stringify(res.body)}.`);
  assert(calls.exec === 0, 'strfry import was invoked for a forged event — it must be rejected before publishing.');
  assert(calls.brainWrite === 0, 'maybeBrainWriteTapestry was invoked for a forged event — it must be rejected before any Neo4j/LMDB write.');
});

t('AC1: the client path with no signAs (default) also verifies', async () => {
  const { res, calls } = await callPublish({ event: forged() }); // signAs omitted → client path
  assert(res.body && res.body.success !== true, 'a forged-sig publish on the default (client) path must not succeed.');
  assert(calls.exec === 0 && calls.brainWrite === 0, 'a forged default-path event reached publish/brain-write.');
});

t('AC3 (destructive): a forged kind-39999 TA-shaped event is rejected BEFORE the brain-write (no element overwrite)', async () => {
  const taish = 'b'.repeat(64);
  const evt = forged({
    kind: 39999, pubkey: taish,
    tags: [['d', 'victim-slug'], ['z', `39998:${taish}:tapestry`]],
    content: '',
  });
  const { res, calls } = await callPublish({ event: evt, signAs: 'client' });
  assert(res.body && res.body.success !== true, 'a forged kind-39999 event must not succeed.');
  assert(calls.brainWrite === 0, 'maybeBrainWriteTapestry (which runs importEventDirect, the MERGE-by-uuid that overwrites a genuine element) was reached for a forged event.');
});

t('AC2: a validly-signed event from any pubkey still publishes (permissionless preserved) [needs nostr-tools]', async () => {
  const nt = nostr(); if (!nt) return 'SKIP';
  const sk = nt.generateSecretKey();
  const evt = nt.finalizeEvent({ kind: 1, created_at: nowS(), tags: [['t', 'ea-probe']], content: 'valid' }, sk);
  const { res, calls } = await callPublish({ event: evt, signAs: 'client' });
  assert(res.body && res.body.success === true, `a validly-signed event must publish; got ${JSON.stringify(res.body)}.`);
  assert(calls.exec === 1, 'a valid event did not reach strfry import.');
  assert(calls.brainWrite === 1, 'a valid event did not reach the brain-write hook.');
});

t('AC4 (regression): signAs:assistant still requires owner/localTrusted (unauthenticated → 403, no publish)', async () => {
  const { res, calls } = await callPublish({ event: { kind: 1, content: 'x', tags: [] }, signAs: 'assistant' });
  assert(res.statusCode === 403, `assistant signing must require owner/localTrusted; got status ${res.statusCode}.`);
  assert(calls.exec === 0, 'an unauthenticated assistant publish reached strfry import.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- publish-event signature verification tests (epic event-authenticity, Story 1) ---');
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
    } finally {
      cleanup();
    }
  }
  console.log(`\npublish-event-signature-verification: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
