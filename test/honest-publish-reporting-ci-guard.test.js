/**
 * GUARD SUITE for test/honest-publish-reporting.test.js.
 * Story: engineering-team/stories/honest-publish-reporting/1-publish-result-tells-the-truth.md
 * ADR:   engineering-team/decisions/honest-publish-reporting/0001-per-relay-publish-classification.md
 *
 * Written under the ADR-template carve-out for a change whose deliverable IS a test change
 * (OPEN.md row 167): Phase 4 repairs `honest-publish-reporting.test.js` and is barred from
 * editing THIS file.
 *
 * WHAT WENT WRONG. The suite resolves nostr-tools with
 * `require.resolve('nostr-tools/pool', { paths: [UI] })`, intending ui/'s pinned copy — the one
 * Vite bundles into production. But `paths:` falls back to ANCESTOR node_modules, and CI runs
 * `npm ci` at the repo root only (.github/workflows/test.yml:36), so `ui/node_modules` never
 * exists there and resolution silently lands on the repo root's nostr-tools 2.10.4 instead of
 * ui/'s 2.23.3. The two report a failed connection differently:
 *
 *   2.23.3  onerror -> reject("connection failed")      -> pool.publish catches
 *                                                       -> FULFILLED "connection failure: …"
 *   2.10.4  onerror -> reject(ev.message || "websocket error")
 *                                                       -> REJECTED "connection refused"
 *
 * So `D1` classified an unreachable relay as `refused`, and the required `stack-free` check on
 * main failed. Production was never affected — Vite builds from ui/ against the pin — but the
 * suite's central claim ("these assertions run against the real primitive") was false in CI while
 * still appearing to pass 9/10.
 *
 * WHAT THIS GUARD REQUIRES. A version gate on the suite: when the nostr-tools it actually
 * resolved is not the version ui/ pins, the relay-behavior tests SKIP (the repo's idiom for a
 * missing precondition — cf. adoption-candidates-queue.test.js) instead of asserting things that
 * cannot be true of the shipped code.
 *
 * Q5 is the one that matters most. A gate that always skips would turn CI green while destroying
 * every assertion the story depends on. Q5 fails if the suite skips HERE, where ui/'s pinned copy
 * is installed and the tests must really run.
 *
 * EXPECTED NOW (pre-implementation): Q1–Q5 FAIL (no gate exists).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SUITE_PATH = path.join(ROOT, 'test/honest-publish-reporting.test.js');
const UI_LOCKFILE = path.join(ROOT, 'ui/package-lock.json');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

function suite() {
  try { return require(SUITE_PATH); }
  catch (err) { throw new Error(`${SUITE_PATH} does not load: ${err.message}`); }
}

/** The version ui/ pins — the one Vite bundles into production. */
function pinnedVersion() {
  const lock = JSON.parse(fs.readFileSync(UI_LOCKFILE, 'utf8'));
  const entry = Object.entries(lock.packages || {})
    .find(([k]) => k.endsWith('node_modules/nostr-tools'));
  return entry && entry[1].version;
}

test('Q1 the suite exposes a nostr-tools version gate', () => {
  const m = suite();
  assert(typeof m.nostrToolsVersionGate === 'function',
    'the suite must export nostrToolsVersionGate({resolved, pinned}) so the decision to skip is ' +
    'testable rather than buried — got ' + typeof m.nostrToolsVersionGate);
  assert('SKIP_REASON' in m,
    'the suite must export SKIP_REASON — null when it is running against the pinned version, a ' +
    'string explaining why not otherwise');
});

test('Q2 the gate skips when the resolved nostr-tools is not the version ui/ pins', () => {
  const { nostrToolsVersionGate } = suite();
  const reason = nostrToolsVersionGate({ resolved: '2.10.4', pinned: '2.23.3' });
  assert(typeof reason === 'string' && reason.length > 0,
    'a version mismatch must produce a skip reason, not silence — this exact mismatch (root 2.10.4 ' +
    `vs ui/ 2.23.3) is what failed CI. Got ${JSON.stringify(reason)}`);
  assert(reason.includes('2.10.4') && reason.includes('2.23.3'),
    `the reason must name BOTH versions so the next reader is not left guessing; got ${JSON.stringify(reason)}`);
});

test('Q3 the gate runs when the resolved nostr-tools IS the version ui/ pins', () => {
  const { nostrToolsVersionGate } = suite();
  const reason = nostrToolsVersionGate({ resolved: '2.23.3', pinned: '2.23.3' });
  assert(reason === null,
    `matching versions must not skip — the suite's whole value is running against the shipped ` +
    `version. Got ${JSON.stringify(reason)}`);
});

test('Q4 the pinned version is read from ui/package-lock.json, never hardcoded', () => {
  const src = fs.readFileSync(SUITE_PATH, 'utf8');
  assert(/ui\/package-lock\.json|package-lock\.json/.test(src),
    'the expected version must be derived from ui/package-lock.json — a hardcoded literal silently ' +
    'rots at the next dependency bump, which is the same class of failure as the bug being fixed');
  const pinned = pinnedVersion();
  assert(pinned, 'could not read the nostr-tools pin from ui/package-lock.json');
  const hardcoded = new RegExp(`['"\`]${pinned.replace(/\./g, '\\.')}['"\`]`);
  assert(!hardcoded.test(src),
    `the suite must not hardcode the version string ${pinned}; derive it from the lockfile instead`);
});

test('Q5 the suite does NOT skip here, where ui/ pinned deps are installed', () => {
  const uiCopy = path.join(ROOT, 'ui/node_modules/nostr-tools/package.json');
  if (!fs.existsSync(uiCopy)) {
    // Guarding the guard: this assertion is only meaningful where ui/ deps exist.
    return 'SKIP';
  }
  const { SKIP_REASON } = suite();
  assert(SKIP_REASON === null,
    'ui/ pinned deps ARE installed here, so the relay-behavior tests must really run. A gate that ' +
    'skips unconditionally would turn CI green while silently deleting every assertion this story ' +
    `depends on — that is a worse outcome than the failure it replaces. Got ${JSON.stringify(SKIP_REASON)}`);
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
  console.log(`\nhonest-publish-reporting-ci-guard: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
