/**
 * honest-publish-reporting #1 — the publish result tells the truth about what each relay did.
 * Story: engineering-team/stories/honest-publish-reporting/1-publish-result-tells-the-truth.md
 * ADR:   engineering-team/decisions/honest-publish-reporting/0001-per-relay-publish-classification.md
 *
 * The defect: publishToRelays races `pool.publish([relay], event)` — which returns an ARRAY of
 * promises, not a promise — against a timeout. Promise.race resolves the non-thenable immediately,
 * so every relay is pushed onto `successes` whatever it did, and the timeout can never fire.
 *
 * TESTABILITY FINDING — why this suite executes ui/src where its predecessor could not.
 * test/honest-broadcast-reporting.test.js records that "no ui/src module is executed anywhere in
 * this runner — every ui/src reference in every suite is read as TEXT for structural pins," and
 * therefore tested a pure CJS core (src/lib/broadcastOutcome.js) instead. That finding is now
 * stale in one specific way, and the distinction is the whole reason this defect survived:
 *
 *   - Node 24 can `require()` an ES module, and `ui/src/utils/nostrPublish.js` happens to be
 *     loadable because it has ZERO extensionless relative imports (its only import is the bare
 *     specifier `nostr-tools/pool`). Its consumers — publishProfileTag.js, dispositionActions.js —
 *     import `'./nostrPublish'` without the extension, which Vite resolves and Node does not, so
 *     they remain text-only. That is the boundary this suite works within.
 *   - Testing a pure core is what let this bug hide. broadcastOutcome.js is CORRECT; the wiring
 *     beneath it was a lie, so a green core sat on top of a broken primitive for five months.
 *     These tests therefore drive the REAL publishToRelays and assert on what it returns.
 *
 * The seam is nostr-tools' own `useWebSocketImplementation()` — the supported injection point for
 * non-browser environments. No production code changes for testability.
 *
 * IMPORTANT: the ESM build must be the one injected into. `require.resolve('nostr-tools/pool')`
 * returns the CJS twin, a DIFFERENT module instance; injecting there silently does nothing to the
 * ESM copy that nostrPublish.js imports. Resolve from ui/ (repo root carries an older nostr-tools)
 * and step across to the esm sibling.
 *
 *   B1..B5 — behavioral: per-relay classification driven by real relay behavior.
 *   D1     — the per-relay `details` map (ADR 0001 Option B).
 *   I1     — integration: the real primitive feeding the real broadcastOutcome core. This is the
 *            test whose absence let the defect survive.
 *   R1     — a refused publish leaves no unhandled promise rejection.
 *   G1     — the local-only gate is undisturbed (own process: the policy answer is cached at
 *            module scope, so gate-on cannot share a process with the gate-off tests).
 *   S1     — structural: publishOrThrow still derives externalOk from successes.length, the
 *            contract AC4 leans on. (Not Node-loadable; text is the only available lens.)
 *
 * EXPECTED NOW (pre-implementation): B2, B3, B4, B5, D1, I1, R1 FAIL; B1, G1, S1 PASS.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'ui');
const NOSTR_PUBLISH_JS = path.join(UI, 'src/utils/nostrPublish.js');
const PROFILE_TAG_JS = path.join(UI, 'src/utils/publishProfileTag.js');
const BROADCAST_CORE = path.join(ROOT, 'src/lib/broadcastOutcome.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

/** The ESM pool module — the same instance nostrPublish.js imports. See header. */
function esmPoolPath() {
  const cjs = require.resolve('nostr-tools/pool', { paths: [UI] });
  return path.resolve(path.dirname(cjs), '../esm/pool.js');
}

// ── the fake relay ────────────────────────────────────────────────────────────
// Behavior is keyed by URL so tests never collide; nostr-tools normalizes URLs
// (adding a trailing slash), so the key is compared without it.
const BEHAVIOR = Object.create(null);
let socketsOpened = 0;

class FakeRelaySocket {
  static OPEN = 1;
  constructor(url) {
    socketsOpened++;
    this.readyState = 0;
    this.mode = BEHAVIOR[String(url).replace(/\/$/, '')] || 'accept';
    setTimeout(() => {
      if (this.mode === 'unreachable') { this.onerror?.(new Error('connection refused')); return; }
      this.readyState = FakeRelaySocket.OPEN;
      this.onopen?.();
    }, 2);
  }
  send(message) {
    let frame;
    try { frame = JSON.parse(message); } catch { return; }
    if (frame[0] !== 'EVENT') return;
    if (this.mode === 'silent') return;                 // never answers: library's publish timeout
    const ok = this.mode === 'accept';
    setTimeout(() => this.onmessage?.({
      data: JSON.stringify(['OK', frame[1].id, ok, ok ? 'ok' : this.mode]),
    }), 2);
  }
  close() { this.readyState = 3; }
}

let publishToRelays;
function harness() {
  if (!publishToRelays) {
    require(esmPoolPath()).useWebSocketImplementation(FakeRelaySocket);
    ({ publishToRelays } = require(NOSTR_PUBLISH_JS));
  }
  return publishToRelays;
}

let seq = 0;
/** Register a relay with a behavior and return its URL. */
function relay(mode) {
  const url = `wss://${mode}-${++seq}.honest-publish.test`;
  BEHAVIOR[url] = mode;
  return url;
}

const EVENT = {
  id: 'a'.repeat(64), pubkey: 'b'.repeat(64), created_at: 1,
  kind: 1, tags: [], content: '', sig: 'c'.repeat(128),
};

// ═══ B — per-relay classification, driven by real relay behavior ═════════════

test('B1 a relay that accepts the event is reported as a success', async () => {
  const url = relay('accept');
  const r = await harness()(EVENT, [url]);
  assert(r.successes.includes(url), `an accepting relay must be a success; got ${JSON.stringify(r)}`);
  assert(!r.failures.includes(url), `an accepting relay must not also be a failure; got ${JSON.stringify(r)}`);
});

test('B2 a relay that refuses the event (OK:false) is reported as a failure, not a success', async () => {
  const url = relay('refused');
  const r = await harness()(EVENT, [url]);
  assert(!r.successes.includes(url),
    `the relay answered OK:false — reporting it as a success is the defect. Got ${JSON.stringify(r)}`);
  assert(r.failures.includes(url), `a refusing relay must appear in failures; got ${JSON.stringify(r)}`);
});

test('B3 a relay that cannot be connected to is reported as a failure', async () => {
  const url = relay('unreachable');
  const r = await harness()(EVENT, [url]);
  assert(!r.successes.includes(url),
    'an unreachable relay must not be a success. nostr-tools RESOLVES (does not reject) with a ' +
    `"connection failure: …" string here, so classifying on settled status alone still gets this ` +
    `wrong — the fulfilled VALUE has to be read. Got ${JSON.stringify(r)}`);
  assert(r.failures.includes(url), `an unreachable relay must appear in failures; got ${JSON.stringify(r)}`);
});

test('B4 a relay that connects but never answers is reported as a failure, within a bounded wait', async () => {
  const url = relay('silent');
  const started = Date.now();
  const r = await harness()(EVENT, [url]);
  const elapsed = Date.now() - started;
  assert(!r.successes.includes(url),
    `a relay that never acknowledged must not be a success; got ${JSON.stringify(r)}`);
  assert(r.failures.includes(url), `a silent relay must appear in failures; got ${JSON.stringify(r)}`);
  assert(elapsed >= 500,
    `a silent relay must actually be waited for — returning in ${elapsed}ms means nothing was awaited`);
  assert(elapsed < 15000, `the wait must be bounded; took ${elapsed}ms`);
});

test('B5 a mixed relay set is partitioned correctly in one call', async () => {
  const good = relay('accept');
  const bad = relay('refused');
  const gone = relay('unreachable');
  const r = await harness()(EVENT, [good, bad, gone]);
  assert(r.successes.length === 1 && r.successes[0] === good,
    `only the accepting relay belongs in successes; got ${JSON.stringify(r.successes)}`);
  assert(r.failures.includes(bad) && r.failures.includes(gone) && r.failures.length === 2,
    `both the refusing and the unreachable relay belong in failures; got ${JSON.stringify(r.failures)}`);
});

// ═══ D — the per-relay detail map (ADR 0001 Option B) ════════════════════════

test('D1 each relay carries a status and a reason distinguishing refused from unreachable', async () => {
  const good = relay('accept');
  const bad = relay('refused');
  const gone = relay('unreachable');
  const r = await harness()(EVENT, [good, bad, gone]);
  assert(r.details && typeof r.details === 'object',
    `the result must carry a per-relay details map (ADR 0001); got ${JSON.stringify(Object.keys(r))}`);
  assert(r.details[good]?.status === 'accepted',
    `${good} should be 'accepted'; got ${JSON.stringify(r.details[good])}`);
  assert(r.details[bad]?.status === 'refused',
    `${bad} should be 'refused'; got ${JSON.stringify(r.details[bad])}`);
  assert(r.details[gone]?.status === 'unreachable',
    `${gone} should be 'unreachable' — distinguishing "the relay said no" from "we could not reach ` +
    `it" is the point of the map; got ${JSON.stringify(r.details[gone])}`);
  assert(typeof r.details[bad]?.reason === 'string' && r.details[bad].reason.length > 0,
    `a failure must carry the relay's own reason so a deploy can be diagnosed; got ${JSON.stringify(r.details[bad])}`);
});

// ═══ I — the primitive feeding the real classifier ══════════════════════════

test("I1 when no relay accepted, the real broadcast core classifies the real result as not-delivered", async () => {
  const bad = relay('refused');
  const gone = relay('unreachable');
  const result = await harness()(EVENT, [bad, gone]);
  const { classifyBroadcast, outcomeMessage } = require(BROADCAST_CORE);
  const outcome = classifyBroadcast(result);
  assert(outcome === 'not-delivered',
    'This is the seam the defect hid behind: broadcastOutcome.js is correct, but it classifies from ' +
    '`successes`, which the primitive filled unconditionally — so its entire not-delivered vocabulary ' +
    `was unreachable. Expected 'not-delivered', got '${outcome}' from ${JSON.stringify(result)}`);
  const message = outcomeMessage({ outcome, verb: 'submit', already: false });
  assert(/didn't reach the community relay/.test(message),
    `the user must be told it did not land; got ${JSON.stringify(message)}`);
});

// ═══ R — no unhandled rejection ═════════════════════════════════════════════

test('R1 a refused publish leaves no unhandled promise rejection', async () => {
  // A mode of its own, so this test counts only the rejection it caused: every
  // mode but 'accept' / 'silent' / 'unreachable' is a refusal whose reason IS the mode name.
  const url = relay('refused-r1-only');
  const seen = [];
  const onUnhandled = (reason) => seen.push(String((reason && reason.message) || reason));
  process.on('unhandledRejection', onUnhandled);
  try {
    await harness()(EVENT, [url]);
    await new Promise((r) => setTimeout(r, 400));   // give an unhandled rejection time to be reported
  } finally {
    process.removeListener('unhandledRejection', onUnhandled);
  }
  const ours = seen.filter((m) => m === 'refused-r1-only');
  assert(ours.length === 0,
    'Promise.race calls Promise.resolve(array) and never iterates into it, so nothing ever attaches ' +
    `a handler to the relay's promise — its rejection escapes to the user's console. Saw ${ours.length}: ` +
    JSON.stringify(ours));
});

// ═══ G — the local-only gate is undisturbed ═════════════════════════════════

test('G1 with the local-only guard on, the publish is kept local and no socket is opened', () => {
  // Own process: isExternalPublishAllowed() caches the policy at module scope, so a gate-on
  // assertion cannot share a process with the gate-off tests above.
  const child = `
    global.fetch = async () => ({ ok: true, json: async () => ({ allowExternalPublish: false }) });
    let opened = 0;
    class WS { static OPEN = 1; constructor() { opened++; } send() {} close() {} }
    require(${JSON.stringify(esmPoolPath())}).useWebSocketImplementation(WS);
    require(${JSON.stringify(NOSTR_PUBLISH_JS)})
      .publishToRelays(${JSON.stringify(EVENT)}, ['wss://gated.honest-publish.test'])
      .then((r) => console.log('RESULT ' + JSON.stringify({
        skippedByGate: r.skippedByGate, successes: r.successes, failures: r.failures, opened,
      })))
      .catch((e) => console.log('RESULT ' + JSON.stringify({ error: String(e && e.message || e) })));
  `;
  const out = spawnSync(process.execPath, ['-e', child], { encoding: 'utf8', timeout: 30000 });
  const line = String(out.stdout || '').split('\n').find((l) => l.startsWith('RESULT '));
  assert(line, `the gate-on child produced no result. stdout=${out.stdout} stderr=${out.stderr}`);
  const r = JSON.parse(line.slice('RESULT '.length));
  assert(r.skippedByGate === true, `the gate must still mark the publish kept-local; got ${JSON.stringify(r)}`);
  assert(Array.isArray(r.successes) && r.successes.length === 0,
    `kept-local must claim no successes; got ${JSON.stringify(r)}`);
  assert(Array.isArray(r.failures) && r.failures.length === 0,
    `kept-local is a setting, not a failure; got ${JSON.stringify(r)}`);
  assert(r.opened === 0, `no socket may be opened when the guard is on; ${r.opened} were`);
});

// ═══ S — structural pin on the one consumer contract AC4 leans on ═══════════

test('S1 publishOrThrow still derives external success from successes.length', () => {
  // publishProfileTag.js imports './nostrPublish' extensionless — Vite resolves it, Node does not,
  // so text is the only lens available. The pin matters because AC4's second half ("a local failure
  // raises again") holds only while this guard reads the primitive's successes.
  const src = safeRead(PROFILE_TAG_JS);
  assert(src, `${PROFILE_TAG_JS} is unreadable`);
  assert(/externalOk\s*=\s*\(?\s*result\?\.external\?\.successes\?\.length/.test(src),
    'publishOrThrow must keep deriving externalOk from the external successes list — that is what ' +
    'makes a truthful primitive reach the throw decision');
  assert(/if\s*\(\s*!localOk\s*&&\s*!externalOk\s*\)/.test(src),
    'the deliberate partial-failure tolerance (local success tolerates external failure) is out of ' +
    'scope for this story and must be preserved');
});

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  ✓ ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      failures.push({ name: t.name, message: err.message });
      fail++;
    }
  }
  console.log(`\nhonest-publish-reporting: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
