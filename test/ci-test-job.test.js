/**
 * Story test-hermeticity-ci #4: the first CI test gate.
 * ADR test-hermeticity-ci/0001. Test plan:
 *   engineering-team/stories/test-hermeticity-ci/4-ci-test-job.test-plan.md
 *
 * The deliverable is CI WIRING — a .github/workflows/test.yml workflow plus an
 * OPERATIONS.md section — not runtime code. So these are SOURCE-CONTRACT
 * assertions over the raw YAML/markdown, the same shape the repo's existing
 * sentinel suites use (e.g. test/admin-tools-dashboard-panel.test.js). No YAML
 * dependency is added (JS-without-build); the checks are tolerant regex/
 * structural reads of the raw text, pinning the ADR 0001 Decision table.
 *
 * AC-5 (a live green run on THIS book's own PR) is inherently procedural — it
 * is pinned in the test plan's Verification section as an at-close manual gate,
 * not automated here (a suite cannot assert a GitHub Actions run result).
 *
 * The workflow does not exist pre-implementation, so W* FAIL now with legible
 * "workflow absent" messages (safeRead tolerates the missing file) and pass
 * once the Implementer writes it; D* likewise for the OPERATIONS.md section.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const WORKFLOW_REL = '.github/workflows/test.yml';
const WORKFLOW = path.join(REPO, WORKFLOW_REL);
const OPERATIONS = path.join(REPO, 'OPERATIONS.md');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

/** The workflow text, or a legible failure if it is absent. */
function workflow() {
  const src = safeRead(WORKFLOW);
  assert(src.length > 0,
    `${WORKFLOW_REL} does not exist yet — the Implementer must create the CI test workflow (ADR 0001: one pull_request-triggered stack-free job).`);
  return src;
}

/** Collapse YAML to a whitespace-normalized haystack for tolerant contains-checks. */
function flat(src) { return src.replace(/\s+/g, ' '); }

/**
 * Whether `npm ci` precedes `npm test` WITHIN the steps: region. Scoping to
 * steps: is what keeps a comment above it (e.g. "# runs npm test after npm ci")
 * from fooling the ordering — the old whole-file indexOf did (#22).
 */
function ciBeforeTest(src) {
  const f = flat(src);
  const stepsAt = f.indexOf('steps:');
  const region = stepsAt === -1 ? f : f.slice(stepsAt);
  const ciAt = region.indexOf('npm ci');
  const testAt = region.indexOf('npm test');
  return { ciAt, testAt, ok: ciAt !== -1 && testAt !== -1 && ciAt < testAt };
}

// ===========================================================================
// W* — the workflow YAML contract (ADR 0001 Decision table + Implementation notes)
// ===========================================================================

test('W1 (AC-1): .github/workflows/test.yml exists and defines a workflow with a job', () => {
  const src = workflow();
  assert(/^\s*name:\s*\S/m.test(src), 'workflow must carry a top-level name: (stable check name, ADR 0001).');
  assert(/^\s*jobs:\s*$/m.test(src), 'workflow must define a jobs: block.');
  assert(/runs-on:\s*ubuntu-latest/.test(src),
    'the job must run on ubuntu-latest (ADR 0001 Decision table).');
});

test('W2 (AC-1): triggered by pull_request targeting staging AND main (pre-merge gate, not push)', () => {
  const src = workflow();
  const f = flat(src);
  assert(/on:\s*pull_request:/.test(f),
    'the workflow must be triggered on: pull_request (a pre-merge gate that cannot race the push-triggered deploys) — ADR 0001 Decision table / AC-1.');
  const m = f.match(/pull_request:\s*branches:\s*\[([^\]]*)\]/)
    || f.match(/branches:\s*\[([^\]]*)\]/);
  assert(m, 'pull_request must scope branches: [ ... ] (ADR 0001).');
  assert(/\bstaging\b/.test(m[1]) && /\bmain\b/.test(m[1]),
    `the trigger must target BOTH staging and main; got branches [${m[1].trim()}] (story AC-1).`);
  assert(!/^\s*push:/m.test(src),
    'the test gate must NOT be push-triggered — push events are the deploy workflows\' domain; a push trigger duplicates minutes and races deploys (ADR 0001 Option C rejected).');
});

test('W3 (AC-1): checks out with full history (fetch-depth: 0) so lint L9/L10 stay live in CI', () => {
  const src = workflow();
  const f = flat(src);
  assert(/uses:\s*actions\/checkout@v4/.test(f),
    'must use actions/checkout@v4 (ADR 0001 Implementation notes).');
  assert(/fetch-depth:\s*0/.test(f),
    'checkout must set fetch-depth: 0 — a shallow clone silently disables harness-lint L9/L10 in the CI real-repo pass (ADR 0001 Decision table).');
});

test('W4 (AC-1): sets up Node 22 (production Dockerfile parity) with npm cache', () => {
  const src = workflow();
  const f = flat(src);
  assert(/uses:\s*actions\/setup-node@v4/.test(f),
    'must use actions/setup-node@v4 (ADR 0001 Implementation notes).');
  assert(/node-version:\s*['"]?22['"]?/.test(f),
    'node-version must be 22 to match the production Dockerfile (nodesource 22.x); ADR 0001 Decision table.');
  assert(/cache:\s*['"]?npm['"]?/.test(f),
    'setup-node must enable cache: npm (lockfile-keyed) — ADR 0001 Decision table.');
});

test('W5 (AC-1): installs from the lockfile and runs the test gate — npm ci then npm test', () => {
  const src = workflow();
  const f = flat(src);
  assert(/run:\s*npm ci\b/.test(f),
    'the job must install with `npm ci` (lockfile fidelity on a clean runner) — ADR 0001 Decision table.');
  assert(/run:\s*npm test\b/.test(f),
    'the job must run the gate with `npm test` — the SAME command contributors run locally (ADR 0001 Decision: no test:ci fork).');
  const { ciAt, testAt, ok } = ciBeforeTest(src);
  assert(ciAt !== -1 && testAt !== -1 && ok,
    'npm ci must precede npm test (install before gate), scoped to the steps: region (#22).');
});

test('W5b (#22): the ci-before-test ordering is scoped to the steps: region — a comment naming a command above steps: does not false-fail, and a genuine gate-before-install still fails', () => {
  // The #22 bug: the unscoped indexOf found `npm test` inside a comment above
  // steps: and read it as "before npm ci". A pre-steps comment must NOT fool it.
  const commentedAbove =
    'name: test\n# the gate runs npm test after npm ci\njobs:\n  t:\n    steps:\n      - run: npm ci\n      - run: npm test\n';
  assert(ciBeforeTest(commentedAbove).ok,
    'a comment above steps: naming npm test must NOT false-fail the ordering check — it must be scoped to the steps: region (#22).');
  // The real guard must survive: a workflow whose STEPS run the gate before install must still fail.
  const misordered =
    'name: test\njobs:\n  t:\n    steps:\n      - run: npm test\n      - run: npm ci\n';
  assert(!ciBeforeTest(misordered).ok,
    'a workflow that runs npm test before npm ci within steps must still FAIL the ordering check — #22 must not weaken the real guard.');
});

test('W6 (AC-1): scarf phone-home suppressed and install scripts NOT globally disabled (prebuilds need them)', () => {
  const src = workflow();
  const f = flat(src);
  assert(/SCARF_ANALYTICS:\s*['"]?false['"]?/.test(f),
    'the job must set SCARF_ANALYTICS: "false" — @scarf/scarf\'s postinstall phones home (ADR 0001 Decision table).');
  assert(!/--ignore-scripts/.test(src),
    'npm ci must NOT pass --ignore-scripts — lmdb/msgpackr prebuild downloads run in postinstall; a global disable breaks the native deps (ADR 0001 Context/Decision).');
});

test('W7 (AC-3): bounded by a hard timeout and superseded-run concurrency cancel', () => {
  const src = workflow();
  const f = flat(src);
  assert(/timeout-minutes:\s*15\b/.test(f),
    'the job must set timeout-minutes: 15 (a hang guard, not a budget) — ADR 0001 Decision table / AC-3.');
  assert(/concurrency:/.test(f),
    'the workflow must declare a concurrency: group so runs don\'t pile up (AC-3).');
  assert(/cancel-in-progress:\s*true/.test(f),
    'concurrency must set cancel-in-progress: true — a newer push cancels the older in-flight run (story AC-3).');
});

test('W8 (AC-2): NO retry mechanism anywhere — no playwright, no rerun action, no --retries', () => {
  const src = workflow();
  const f = flat(src);
  assert(!/test:playwright|playwright/i.test(src),
    'the gate must NEVER invoke Playwright — playwright.config.js sets retries in CI, and e2e is a deferred phase (story AC-2 / ADR 0001).');
  assert(!/--retries?\b/.test(src) && !/\bretry\b/i.test(src) && !/rerun/i.test(src),
    'no retry/rerun mechanism may appear — the flake-surfacing posture is that the first run\'s exit code is the verdict (story AC-2 / ADR 0001).');
  assert(!/nick-fields\/retry|retry-action/i.test(src),
    'no third-party retry action may be used (story AC-2).');
});

test('W9 (supply chain): only the two official actions/* are used — no unpinned third-party actions', () => {
  const src = workflow();
  const uses = (src.match(/uses:\s*\S+/g) || []).map((u) => u.replace(/uses:\s*/, '').trim());
  assert(uses.length >= 2, `expected at least the two official actions; found uses: ${JSON.stringify(uses)}.`);
  for (const u of uses) {
    assert(/^actions\/(checkout|setup-node)@v\d/.test(u),
      `only official actions/checkout + actions/setup-node are authorized in this gate; found unexpected action "${u}" (ADR 0001 Implementation notes: no third-party actions beyond the two official ones).`);
  }
});

// ===========================================================================
// D* — the OPERATIONS.md documentation contract (ADR 0001 Implementation notes)
// ===========================================================================

test('D1 (AC-4): OPERATIONS.md documents the CI test gate — what runs, and the excluded e2e/live phase', () => {
  const ops = safeRead(OPERATIONS);
  assert(ops.length > 0, 'OPERATIONS.md must exist.');
  assert(/npm ci\b[\s\S]{0,40}npm test|npm test/.test(ops) && /test gate|CI test/i.test(ops),
    'OPERATIONS.md must document the CI test gate (npm ci && npm test) — ADR 0001 Implementation notes / AC-4.');
  assert(/e2e|playwright/i.test(ops) && /(exclud|defer|later phase|out of)/i.test(ops),
    'OPERATIONS.md must state that e2e/Playwright + live suites are deliberately EXCLUDED (deferred phase) — story AC-4.');
});

test('D2 (AC-4): OPERATIONS.md documents the no-retry policy and the first-flake waiver pattern', () => {
  const ops = safeRead(OPERATIONS);
  assert(/no[- ]retry|no retries|retry/i.test(ops) && /flake|first run|exit code/i.test(ops),
    'OPERATIONS.md must document the no-retry flake-surfacing policy and its rationale — story AC-4.');
  assert(/waiver|quarantine/i.test(ops),
    'OPERATIONS.md must describe the cited-waiver/quarantine pattern (a file created only when a real stack-free flake is first observed) — story AC-4.');
});

/**
 * Slice the CI-test-gate section out of OPERATIONS.md so its assertions can't
 * be satisfied vacuously by the pre-existing §4 branch-protection prose. From
 * the first heading that names the gate to the next `## ` heading.
 */
function ciSection(ops) {
  const start = ops.search(/^#+ .*(CI test|test gate)/im);
  if (start === -1) return '';
  const rest = ops.slice(start);
  const next = rest.slice(1).search(/^##\s/m);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

test('D3 (AC-4): the CI-gate section records that making the check REQUIRED is a separate, un-taken operator decision', () => {
  const ops = safeRead(OPERATIONS);
  const section = ciSection(ops);
  assert(section.length > 0,
    'no CI-test-gate section found in OPERATIONS.md (a heading naming the "CI test" / "test gate") — AC-4.');
  assert(/required/i.test(section) && /(operator|ruleset|branch protection|not (yet )?(taken|enabled|made))/i.test(section),
    'the CI-gate section itself (not the pre-existing §4 branch-protection prose) must record that making the check REQUIRED in the rulesets is a deliberate operator decision NOT taken by this story — story AC-4 / ADR 0001.');
});

test('D4 (harness hygiene): OPERATIONS.md Last-updated header is not behind the CI-section change', () => {
  const ops = safeRead(OPERATIONS);
  const m = ops.match(/\*\*Last updated:\*\*\s*(20\d\d-\d\d-\d\d)/);
  assert(m, 'OPERATIONS.md must carry a **Last updated:** header (harness-lint L9 checks it).');
  // The section that documents the gate must be present when the header claims a 2026-07 refresh.
  assert(/test gate|CI test/i.test(ops),
    'the Last-updated header exists but no CI-test-gate section is present — the doc contract (AC-4) is unmet; L9 also expects the header to move with the content.');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message.split('\n')[0]}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
