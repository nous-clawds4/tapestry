/**
 * shared-concepts-seeding #1 — tell the truth about whether a broadcast landed.
 * Story: engineering-team/stories/shared-concepts-seeding/1-honest-broadcast-reporting.md
 * (Bug under Standard — Architecture skipped by design.)
 *
 * The defect: `declareAndBroadcast` and `wireAndBroadcast` await publishToRelays
 * and DISCARD its result, then assert the concept reached the community.
 * publishToRelays never throws — it resolves {successes, failures} or
 * {skippedByGate:true} — so the catch those functions rely on is dead for the
 * ordinary failure modes.
 *
 * TESTABILITY FINDING (see the test plan): no ui/src module is executed
 * anywhere in this runner — every ui/src reference in every suite is read as
 * TEXT for structural pins. So the three outcomes cannot be exercised where
 * they currently live, and a structural pin on `skippedByGate` would be
 * satisfied by the token's mere presence, not by correct branching. These
 * tests are therefore written against a small pure core in src/lib/ — the same
 * move bValueForms / adoptionQueue / trustedDictionary / sharingState already
 * make in this repo, and the only shape under which the bug's actual failure
 * modes are reachable at the unit level.
 *
 *   U1..U9 — the pure core: the three-way classification (including the safe
 *            direction on malformed input) and the wording contract.
 *   S1..S5 — structural: both siblings consume the core, defer still makes no
 *            community claim, both calling surfaces surface the message, and
 *            the working model in ConceptDetail is not disturbed.
 *   H1     — live: the publish-policy endpoint the gate reads still answers.
 *
 * EXPECTED NOW (pre-implementation): U1–U9 FAIL (the core does not exist),
 * S1, S2 FAIL (the siblings still discard the result); S3, S4, S5 PASS
 * (regression guards); H1 PASS.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIB_JS = path.join(ROOT, 'src/lib/broadcastOutcome.js');
const ACTIONS_JS = path.join(ROOT, 'ui/src/utils/dispositionActions.js');
const PANEL_JSX = path.join(ROOT, 'ui/src/components/DispositionPanel.jsx');
const QUEUE_JSX = path.join(ROOT, 'ui/src/pages/shared-concepts/AdoptionQueue.jsx');
const DETAIL_JSX = path.join(ROOT, 'ui/src/pages/concepts/ConceptDetail.jsx');

const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function libMod() {
  try { return require(LIB_JS); } catch (err) { throw new Error(`src/lib/broadcastOutcome.js does not load: ${err.message}`); }
}
/** Structure-bounded function body (the OPEN.md #109-ratified shape). */
function fnBody(src, name) {
  const re = new RegExp(`(export )?(async )?function ${name}\\b`);
  const m = src.match(re);
  if (!m) return null;
  const start = m.index;
  const rest = src.slice(start + m[0].length);
  const next = rest.search(/\n(export )?(async )?function |\nmodule\.exports/);
  return next === -1 ? src.slice(start) : src.slice(start, start + m[0].length + next);
}

// The shapes publishToRelays actually resolves with (ui/src/utils/nostrPublish.js).
const REACHED = { successes: ['wss://dcosl.brainstorm.world'], failures: [] };
const NOT_DELIVERED = { successes: [], failures: ['wss://dcosl.brainstorm.world'] };
const KEPT_LOCAL = { successes: [], failures: [], skippedByGate: true };

// ═══ U — the pure core ═════════════════════════════════════════════════

test('U1 (AC-2): the deployment guard resolves to kept-local, not to success and not to failure', () => {
  const { classifyBroadcast } = libMod();
  assert(classifyBroadcast(KEPT_LOCAL) === 'kept-local',
    `the local-only guard is a deliberate setting — it must classify as 'kept-local', got ${JSON.stringify(classifyBroadcast(KEPT_LOCAL))}`);
});

test('U2 (AC-1): at least one relay accepted → published', () => {
  const { classifyBroadcast } = libMod();
  assert(classifyBroadcast(REACHED) === 'published', 'one accepting relay is enough to have reached the community');
  assert(classifyBroadcast({ successes: ['a', 'b'], failures: ['c'] }) === 'published',
    'a partial success still reached the community — the concept is retrievable');
});

test('U3 (AC-3): every relay refused → not-delivered', () => {
  const { classifyBroadcast } = libMod();
  assert(classifyBroadcast(NOT_DELIVERED) === 'not-delivered',
    'no accepting relay means the concept did not reach the community, even though publishToRelays resolved rather than threw — this is the exact case the shipped code reports as success');
});

test('U4 (load-bearing): malformed or missing results fail SAFE — never "published"', () => {
  const { classifyBroadcast } = libMod();
  for (const bad of [null, undefined, {}, { successes: null }, 'nonsense', 0]) {
    const got = classifyBroadcast(bad);
    assert(got !== 'published',
      `a result we cannot read must never be reported as having reached the community; ${JSON.stringify(bad)} gave ${JSON.stringify(got)}`);
    assert(got === 'not-delivered',
      `unreadable results should resolve to 'not-delivered' (the honest, safe direction); ${JSON.stringify(bad)} gave ${JSON.stringify(got)}`);
  }
});

test('U5 (AC-1/2/3): submitting produces three DISTINCT messages, one per outcome', () => {
  const { outcomeMessage } = libMod();
  const msgs = ['published', 'kept-local', 'not-delivered'].map((o) => outcomeMessage({ outcome: o, verb: 'submit' }));
  msgs.forEach((m, i) => assert(typeof m === 'string' && m.trim() !== '', `outcome ${i} produced no message`));
  assert(new Set(msgs).size === 3, `the three outcomes must read differently — got ${JSON.stringify(msgs)}`);
});

test('U6 (AC-4): wiring produces the same three distinctions — the sibling path makes no claim submit would not', () => {
  const { outcomeMessage } = libMod();
  const msgs = ['published', 'kept-local', 'not-delivered'].map((o) => outcomeMessage({ outcome: o, verb: 'wire' }));
  assert(new Set(msgs).size === 3, `wiring must distinguish all three outcomes — got ${JSON.stringify(msgs)}`);
  const submitted = outcomeMessage({ outcome: 'published', verb: 'submit' });
  assert(msgs[0] !== submitted, 'wiring and submitting are different acts and should not share one message');
});

test('U7 (AC-5): repeating an action keeps the three-way distinction', () => {
  const { outcomeMessage } = libMod();
  for (const verb of ['submit', 'wire']) {
    const msgs = ['published', 'kept-local', 'not-delivered'].map((o) => outcomeMessage({ outcome: o, verb, already: true }));
    assert(new Set(msgs).size === 3,
      `a repeat ${verb} must still say which of the three outcomes the re-broadcast had — got ${JSON.stringify(msgs)}`);
    const fresh = outcomeMessage({ outcome: 'published', verb });
    assert(msgs[0] !== fresh, `a repeat ${verb} should read differently from a first-time one`);
  }
});

test('U8 (AC-2): kept-local reads as information, not as an error, and never claims community reach', () => {
  const { outcomeMessage } = libMod();
  const kept = outcomeMessage({ outcome: 'kept-local', verb: 'submit' });
  assert(!/fail|error|problem|could not|couldn't/i.test(kept),
    `the deployment guard is a deliberate setting, so this must not read as a failure — got ${JSON.stringify(kept)}`);
  assert(!/reached the community|broadcast to the community/i.test(kept),
    `kept-local must not claim community reach — got ${JSON.stringify(kept)}`);
  const failed = outcomeMessage({ outcome: 'not-delivered', verb: 'submit' });
  assert(/again|retry/i.test(failed),
    `a failed broadcast should say it can be tried again (story AC-3) — got ${JSON.stringify(failed)}`);
});

test('U9 (purity): the core is zero-require and exports both functions', () => {
  const src = safeRead(LIB_JS);
  assert(src, 'src/lib/broadcastOutcome.js is missing');
  assert(!/\brequire\s*\(/.test(src),
    'the pure core must have zero requires — the house lib pattern (bValueForms, adoptionQueue, trustedDictionary, sharingState are all strictly zero-require)');
  const mod = libMod();
  assert(typeof mod.classifyBroadcast === 'function' && typeof mod.outcomeMessage === 'function',
    'the core must export classifyBroadcast and outcomeMessage');
});

// ═══ S — structural pins ═══════════════════════════════════════════════

test('S1 (AC-1/2/3): declareAndBroadcast consumes the publish result instead of discarding it', () => {
  const src = safeRead(ACTIONS_JS);
  assert(src, 'dispositionActions.js unreadable');
  const body = fnBody(src, 'declareAndBroadcast');
  assert(body, 'declareAndBroadcast not found');
  assert(/classifyBroadcast|outcomeMessage/.test(body),
    'declareAndBroadcast must resolve its outcome through the shared core rather than assuming success');
  assert(!/^\s*await publishToRelays\([^)]*\);\s*$/m.test(body),
    'the publish result must be captured, not discarded — a bare `await publishToRelays(...)` is the defect itself');
});

test('S2 (AC-4): wireAndBroadcast gets the identical treatment — the sibling is not left behind', () => {
  const src = safeRead(ACTIONS_JS);
  assert(src, 'dispositionActions.js unreadable');
  const body = fnBody(src, 'wireAndBroadcast');
  assert(body, 'wireAndBroadcast not found');
  assert(/classifyBroadcast|outcomeMessage/.test(body),
    'wireAndBroadcast carries the identical defect and must be fixed in the same pass — fixing one and leaving the other is a half-sweep');
  assert(!/^\s*await publishToRelays\([^)]*\);\s*$/m.test(body),
    'wireAndBroadcast must capture the publish result too');
});

test('S3 (AC-6, regression, passes pre AND post): keeping private makes no community claim', () => {
  const src = safeRead(ACTIONS_JS);
  assert(src, 'dispositionActions.js unreadable');
  const body = fnBody(src, 'defer');
  assert(body, 'defer not found');
  assert(!/publishToRelays/.test(body),
    'keeping a concept private must never broadcast — deferral is a stance, not an announcement');
  assert(!/community relay|reached the community/i.test(body),
    "defer's message must make no claim about the community at all");
});

test('S4 (AC-7, regression, passes pre AND post): both calling surfaces display the returned outcome', () => {
  for (const [label, file] of [['DispositionPanel', PANEL_JSX], ['AdoptionQueue', QUEUE_JSX]]) {
    const src = safeRead(file);
    assert(src, `${label} unreadable`);
    assert(/declareAndBroadcast/.test(src) && /wireAndBroadcast/.test(src),
      `${label} must call both actions through the shared module (it is one of the four affected call sites)`);
    assert(/setMessage|message/.test(src),
      `${label} must surface the returned outcome to the user rather than swallowing it`);
  }
});

test('S5 (regression, passes pre AND post): the concept page keeps the working model intact', () => {
  const src = safeRead(DETAIL_JSX);
  assert(src, 'ConceptDetail.jsx unreadable');
  assert(/skippedByGate/.test(src) && /successes/.test(src),
    "ConceptDetail's own submit handler is the model this story copies — it must keep inspecting skippedByGate and successes");
});

// ═══ H — live ══════════════════════════════════════════════════════════

let _stack = null;
async function stack() {
  if (_stack) return _stack;
  try {
    const r = await fetch(`${HOST_BASE}/api/assistant/pubkey`, { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    _stack = (j && j.success && /^[0-9a-f]{64}$/.test(j.pubkey)) ? { up: true } : { up: false };
  } catch { _stack = { up: false }; }
  return _stack;
}

test('H1: the publish-policy endpoint the gate reads still answers', async () => {
  const s = await stack();
  if (!s.up) return 'SKIP';
  const r = await fetch(`${HOST_BASE}/api/publish-policy`, { signal: AbortSignal.timeout(15000) });
  assert(r.status === 200, `the kept-local branch depends on GET /api/publish-policy — got ${r.status}`);
  const j = await r.json().catch(() => null);
  assert(j && typeof j === 'object' && 'allowExternalPublish' in j,
    `the policy response must carry allowExternalPublish (isExternalPublishAllowed reads it) — got ${JSON.stringify(j)}`);
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
  console.log(`\nhonest-broadcast-reporting: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
