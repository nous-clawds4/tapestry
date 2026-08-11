/**
 * Story 1 (epic: test-suite-hermeticity) — the "writes nothing to strfry"
 * brackets must measure only what this instance could have written.
 *
 * Story: engineering-team/stories/test-suite-hermeticity/1-narrow-strfry-write-assertion-brackets.md
 * ADR:   engineering-team/decisions/test-suite-hermeticity/0001-author-scoped-write-assertion-brackets.md
 *
 * Two H-class tests elsewhere prove an operation writes no event to strfry by
 * bracketing it with GET /api/strfry/scan/count and requiring equality:
 * relationship-primitives H8 and relationship-primitives-probe H4. Both counted
 * the WHOLE corpus, so live strfry-router ingest inside the bracket window
 * failed them — measured 5 red / 1 green across six consecutive runs on
 * 2026-08-10 (OPEN.md row 150, six sightings). This suite is the regression
 * guard for the fix.
 *
 * Two test classes:
 *
 *   S-class (source assertions, stack-free, always gates) — asserts the two
 *     bracket helpers are author-scoped rather than whole-corpus, resolve the
 *     per-deployment TA pubkey at runtime, and no longer carry the row-150
 *     "quiesce the router and re-run" guidance. These FAIL until the two
 *     suites are edited; they are the story's failing-tests-first contract.
 *
 *   H-class (live local stack, per-test SKIP when unreachable) — proves the
 *     chosen fingerprint has TEETH: that an author-scoped count still detects
 *     an event this instance actually wrote (H1), and that it is not narrowed
 *     to nothing (H2). Both are PRE-SATISFIED by design and pass before the
 *     fix lands — they characterize the fingerprint the S-class then pins the
 *     suites to. (Same shape as relationship-primitives-probe H3, which is
 *     likewise already satisfied pre-implementation and documented as such.)
 *     Without them, an Implementer could satisfy every S-class assertion with
 *     a filter that matches nothing — a permanently-green dead test, which is
 *     the specific failure this story exists to avoid.
 *
 * H1 writes one TA-signed event and deletes it in a finally block, leaving the
 * corpus exactly as found (verified 8591 -> 8592 -> 8591 during test design).
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REL_SUITE = path.join(ROOT, 'test/relationship-primitives.test.js');
const PROBE_SUITE = path.join(ROOT, 'test/relationship-primitives-probe.test.js');

const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

// A regular (non-replaceable, non-ephemeral) kind the application never uses,
// so H1's probe event cannot collide with real data or be silently replaced.
const TEETH_KIND = 7357;

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function short(v, n = 200) {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s === undefined ? String(v) : (s.length > n ? `${s.slice(0, n)}…` : s);
}
function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

// Every line that issues a scan/count request — the bracket's filter is on one
// of these, whatever else the helper is named.
function scanCountLines(src) {
  return src.split('\n').filter((l) => l.includes('scan/count?filter='));
}

// Source of a top-level `function name(...)` through its column-0 close brace.
function topLevelFnSource(src, name) {
  const re = new RegExp(`(async\\s+)?function\\s+${name}\\s*\\(`);
  const m = re.exec(src);
  if (!m) return null;
  const rest = src.slice(m.index);
  const end = rest.indexOf('\n}\n');
  return end === -1 ? rest : rest.slice(0, end + 2);
}

const SUITES = [
  { label: 'relationship-primitives (H8)', file: REL_SUITE, rel: 'test/relationship-primitives.test.js' },
  { label: 'relationship-primitives-probe (H4)', file: PROBE_SUITE, rel: 'test/relationship-primitives-probe.test.js' },
];

/* ── H-class plumbing ──────────────────────────────────────────────────── */

async function hostGetJson(pathname, timeout = 15000) {
  const r = await fetch(`${HOST_BASE}${pathname}`, { signal: AbortSignal.timeout(timeout) });
  return r.json().catch(() => null);
}

function dockerCurl(args) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], { encoding: 'utf8', timeout: 60000 });
}

async function taScopedCount(ta) {
  const filter = JSON.stringify({ authors: [ta] });
  const j = await hostGetJson(`/api/strfry/scan/count?filter=${encodeURIComponent(filter)}`);
  assert(j && j.success === true && typeof j.count === 'number',
    `GET /api/strfry/scan/count did not answer a count for the author-scoped filter (got ${short(j)}).`);
  return j.count;
}

// The stack is "available" for H-class only when BOTH the host HTTP path and
// the container loopback answer — H1 publishes over the loopback, which is the
// req.localTrusted class permitted to mint TA-signed events.
let reachable = null;
let taPubkey = null;
async function stackAvailable() {
  if (reachable !== null) return reachable;
  let host = false;
  try {
    const r = await fetch(`${HOST_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(2000) });
    host = r.ok;
  } catch { host = false; }
  let loopback = false;
  try {
    const out = dockerCurl(['-s', '-m', '3', `${CONTAINER_BASE}/api/auth/user-classification`]);
    loopback = /"success"\s*:\s*true/.test(out);
  } catch { loopback = false; }
  reachable = host && loopback;
  if (reachable) {
    const j = await hostGetJson('/api/assistant/pubkey', 5000).catch(() => null);
    taPubkey = j && j.success === true && /^[0-9a-f]{64}$/.test(j.pubkey || '') ? j.pubkey : null;
  }
  return reachable;
}

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

/* ══════════ S-class — the two brackets are author-scoped, not whole-corpus ══════════ */

t('S1 (AC-1): neither bracket helper asks strfry for a whole-corpus count — the empty filter is what live router ingest races', () => {
  for (const s of SUITES) {
    const src = readSafe(s.file);
    assert(src !== null, `${s.rel} is unreadable — cannot audit its bracket filter.`);
    const lines = scanCountLines(src);
    assert(lines.length > 0,
      `${s.rel} issues no scan/count request at all — the ${s.label} write assertion has gone missing, ` +
      'which is not a fix (story out-of-scope: deleting the bracket).');
    for (const line of lines) {
      assert(!/\{\}/.test(line),
        `${s.rel} still counts the WHOLE corpus — the empty filter {} is the whole defect (ADR 0001): ` +
        `every event the live strfry-router ingests inside the bracket window fails the assertion. Got: ${short(line.trim(), 160)}`);
    }
  }
});

t('S2 (AC-2): both bracket helpers scope the count by author — the only axis this instance can write on', () => {
  for (const s of SUITES) {
    const src = readSafe(s.file);
    assert(src !== null, `${s.rel} is unreadable — cannot audit its bracket filter.`);
    const fn = topLevelFnSource(src, 'strfryEventCount');
    assert(fn !== null,
      `${s.rel} no longer defines a top-level strfryEventCount(...) — this guard reads that helper to ` +
      'verify the filter is author-scoped. If it was deliberately renamed, re-aim this assertion.');
    assert(/authors/.test(fn),
      `${s.rel}'s strfryEventCount must scope its filter by "authors" (ADR 0001 decision): server-side signing ` +
      'resolves only through getOwnerAssistantKeys (publishEvent.js:38-53), so the TA identity is the only ' +
      `author this instance can produce. Got: ${short(fn, 240)}`);
  }
});

t('S3 (AC-3): neither suite bakes in a pubkey literal — the TA is per-deployment and must be resolved at runtime', () => {
  for (const s of SUITES) {
    const src = readSafe(s.file);
    assert(src !== null, `${s.rel} is unreadable — cannot audit its TA resolution.`);
    const hex = src.match(/\b[0-9a-f]{64}\b/);
    assert(hex === null,
      `${s.rel} contains a 64-hex literal (${short(hex && hex[0], 20)}). The TA pubkey is created at first ` +
      'container startup and differs on every deployment (CLAUDE.md) — a hardcode makes the bracket count ' +
      "another instance's author and silently stop testing anything.");
    assert(src.includes('/api/assistant/pubkey'),
      `${s.rel} must resolve the TA pubkey at runtime via GET /api/assistant/pubkey — the pattern nine other ` +
      'suites already use (e.g. capture-a-goal-and-see-it.test.js:150).');
  }
});

t('S4 (AC-4): the row-150 "quiesce the router and re-run" guidance is gone from both assertion messages', () => {
  for (const s of SUITES) {
    const src = readSafe(s.file);
    assert(src !== null, `${s.rel} is unreadable — cannot audit its failure message.`);
    assert(!/quiesce/i.test(src),
      `${s.rel} still tells the reader to quiesce a concurrent publisher and re-run. That was the OPEN.md ` +
      'row-150 workaround, and the story retires it (AC-4): an author-scoped count cannot be moved by router ' +
      'traffic, so the message must now say the change means THIS instance authored an event.');
  }
});

/* ══════════ H-class — the fingerprint has teeth (pre-satisfied; see header) ══════════ */

t('H1 (AC-2): an author-scoped count still detects an event this instance actually wrote — the narrowing keeps its teeth', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  assert(taPubkey !== null,
    'could not resolve the runtime TA pubkey via GET /api/assistant/pubkey — without it the author-scoped ' +
    'fingerprint cannot be exercised at all.');

  const before = await taScopedCount(taPubkey);
  let publishedId = null;
  try {
    // The container loopback is the req.localTrusted class permitted to mint
    // TA-signed events (publishEvent.js:33-38) — the same signing path any
    // accidental write from the bracketed operations would have to take.
    const out = dockerCurl([
      '-s', '-m', '30', '-X', 'POST', `${CONTAINER_BASE}/api/strfry/publish`,
      '-H', 'Content-Type: application/json',
      '-d', JSON.stringify({
        signAs: 'assistant',
        event: { kind: TEETH_KIND, content: 'test-suite-hermeticity #1 bracket teeth probe', tags: [['d', 'test-bracket-teeth']] },
      }),
    ]);
    let published = null;
    try { published = JSON.parse(out); } catch {}
    assert(published && published.success === true && published.event && published.event.id,
      `could not publish a TA-signed probe event over the container loopback (got ${short(out, 200)}).`);
    assert(published.event.pubkey === taPubkey,
      `the probe event must be signed by this instance's TA (${short(taPubkey, 16)}) — got ${short(published.event.pubkey, 16)}.`);
    publishedId = published.event.id;

    const after = await taScopedCount(taPubkey);
    assert(after === before + 1,
      `an author-scoped count MUST move when this instance writes an event: went ${before} -> ${after} after ` +
      'publishing one TA-signed event. If it did not move, the fingerprint chosen in ADR 0001 matches nothing ' +
      'and both brackets are permanently-green dead tests.');
  } finally {
    if (publishedId) {
      // Leave the corpus exactly as found — scoped to this one event id.
      try {
        cp.execFileSync('docker', ['exec', CONTAINER, 'strfry', 'delete', `--filter={"ids":["${publishedId}"]}`],
          { encoding: 'utf8', timeout: 60000, stdio: 'pipe' });
      } catch (e) {
        throw new Error(
          `H1 published probe event ${publishedId} but could not delete it — the local corpus now holds one ` +
          `stray kind-${TEETH_KIND} event. Remove it with: docker exec ${CONTAINER} strfry delete ` +
          `'--filter={"ids":["${publishedId}"]}'. Cause: ${e.message}`);
      }
    }
  }
});

t('H2 (AC-2): the author-scoped fingerprint is not narrowed to nothing — it matches this instance\'s existing events', async () => {
  if (!(await stackAvailable())) return 'SKIP';
  assert(taPubkey !== null,
    'could not resolve the runtime TA pubkey via GET /api/assistant/pubkey.');
  const count = await taScopedCount(taPubkey);
  assert(count > 0,
    `the author-scoped count for this instance's TA (${short(taPubkey, 16)}) is ${count}. A fingerprint that ` +
    'matches zero events would make both brackets trivially equal and permanently green — the exact ' +
    'failure mode the narrowing must not introduce.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- strfry write-assertion bracket tests (epic test-suite-hermeticity, Story 1) ---');
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
  console.log(`\nstrfry-write-assertion-bracket: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
