/**
 * Story #28 / ADR 0025 — Kill timeout-orphans by default so they stop suppressing
 * subsequent scheduled fires.
 *
 * The fix is a two-layer change (per ADR 0025 §Decision Option A):
 *   1. taskRegistry.json — flip global default
 *      `options_default.completion.failure.timeout.forceKill: false → true`.
 *   2. processor.js — remove the hardcoded `forceKill: false` from the per-invocation
 *      JSON. The merged optionsJson now ships only `{ completion: { failure: { timeout:
 *      { duration: timeoutMs } } } }` when timeoutMs > 0; the wrapper's hierarchical
 *      merge resolves forceKill from per-task override (if any) or global default
 *      (now true).
 *
 * Architect's Option A also explicitly preserves the 11 per-task `forceKill: false`
 * overrides — R4 guards against accidental scope creep into Option D (delete the
 * overrides). The follow-up intake (I1) captures the proper triage.
 *
 * Source/structural sentinels (S1, S2) pin the two-layer fix surface. Regression
 * guards (R1-R4) protect the wrapper kill machinery, the timeout-emit shape, the
 * ADR 0013 semaphore wrap, and the explicit non-change to per-task overrides.
 * Probe-file sentinels (P0, P1) protect the empirical probe's existence + shape.
 * The intake sentinel (I1) verifies the Implementer appended the ADR-mandated
 * follow-up intake at commit time.
 *
 * Expected pre-implementation state:
 *   - S1, S2, I1 FAIL — registry default still false, processor.js still hardcodes
 *     false, _intake.md doesn't yet contain the Architect-mandated section.
 *   - R1, R2, R3, R4, P0, P1 PASS — regression guards on existing-correct behavior
 *     that the fix must preserve, plus the probe file the Tester ships alongside.
 *
 * Post-implementation: all 9 PASS.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const TASK_REGISTRY_PATH   = path.join(ROOT, 'src/manage/taskQueue/taskRegistry.json');
const PROCESSOR_MODULE     = path.join(ROOT, 'src/manage/taskQueue/queue/processor.js');
const WRAPPER_SCRIPT       = path.join(ROOT, 'src/manage/taskQueue/launchChildTask.sh');
const QUEUE_INDEX_MODULE   = path.join(ROOT, 'src/manage/taskQueue/queue/index.js');
const INTAKE_FILE          = path.join(ROOT, 'engineering-team/stories/_intake.md');
const PROBE_SCRIPT         = path.join(ROOT, 'test/probe-kill-timeout-orphans.js');

// Part A of the ADR 0025 follow-up intake (shipped 2026-05-26 via fast-track)
// deleted 9 of the 11 redundant per-task `forceKill: false` overrides so they
// inherit the new global default `true` from story #28. Only syncWoT +
// syncProfiles retain the explicit override — Part B's deferred investigation
// must settle the correct timeout duration on those two before their overrides
// can also be removed (their current 60s duration is mis-sized for tasks with
// estimatedDuration "30-60 minutes" and averageDuration 44500ms).
const PER_TASK_OVERRIDES_PRESERVED_POST_PART_A = ['syncProfiles', 'syncWoT'];

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (_e) { return null; }
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ---------------------------------------------------------------------------
// Source sentinels — FAIL pre-implementation, PASS post-implementation.
// ---------------------------------------------------------------------------

test('S1: taskRegistry.json\'s options_default.completion.failure.timeout.forceKill === true (AC #1, AC #4; ADR 0025 §Implementation 1)', () => {
  const raw = readSafe(TASK_REGISTRY_PATH);
  assert(raw !== null, 'taskRegistry.json missing at ' + TASK_REGISTRY_PATH);
  let registry;
  try {
    registry = JSON.parse(raw);
  } catch (e) {
    throw new Error('taskRegistry.json failed to parse as JSON: ' + e.message);
  }
  const forceKill = registry &&
    registry.options_default &&
    registry.options_default.completion &&
    registry.options_default.completion.failure &&
    registry.options_default.completion.failure.timeout &&
    registry.options_default.completion.failure.timeout.forceKill;

  assert(
    forceKill === true,
    "taskRegistry.json's `options_default.completion.failure.timeout.forceKill` must be `true` " +
    `(got ${JSON.stringify(forceKill)}). This is the central architectural change of story #28 — when ` +
    "a tagged task hits its configured timeout, the wrapper script should kill the backgrounded child " +
    "process rather than leave it as an orphan that suppresses subsequent scheduled fires via " +
    "`check_task_already_running`. Layer 1 of the two-layer fix. (AC #1, AC #4; ADR 0025 §Implementation 1)"
  );
});

test('S2: processor.js\'s optionsJson literal omits the forceKill field entirely (AC #1, AC #4; ADR 0025 §Implementation 2)', () => {
  const src = readSafe(PROCESSOR_MODULE);
  assert(src !== null, 'Processor module missing at ' + PROCESSOR_MODULE);
  // The fix's intent: processor.js stops asserting opinions about forceKill at
  // per-invocation precedence. The wrapper's hierarchical merge resolves it from
  // per-task override (if present) or the (now true) registry global default.
  //
  // Pre-fix: line 122 reads `timeout: { duration: timeoutMs, forceKill: false }`.
  // Post-fix: that literal becomes `timeout: { duration: timeoutMs }`.
  //
  // We assert the substring `forceKill` does NOT appear ANYWHERE in processor.js.
  // Today it appears exactly once (line 122); removing it should drop the count to
  // zero. If a future legitimate use re-adds it, this test will need to be revisited
  // — but such a re-addition would itself be a meaningful semantic change worth
  // re-thinking via the harness.
  assert(
    !/forceKill/.test(src),
    "processor.js must NOT contain the literal `forceKill` anywhere. Pre-fix line 122 ships " +
    "`forceKill: false` at per-invocation precedence, which would override per-task overrides AND " +
    "the new (true) global default. The fix removes the field entirely so the wrapper's hierarchical " +
    "merge resolves forceKill correctly. NOTE: if your intent was to change `false` → `true`, that's " +
    "also wrong — it would pin per-invocation to true and rob per-task overrides of their precedence. " +
    "Omit the field. Layer 2 of the two-layer fix. (AC #1, AC #4; ADR 0025 §Implementation 2)"
  );
});

test('I1: _intake.md contains the Architect-mandated follow-up section header for the per-task override cleanup (ADR 0025 §"Intake to file at commit time")', () => {
  const src = readSafe(INTAKE_FILE);
  assert(src !== null, '_intake.md missing at ' + INTAKE_FILE);
  // ADR 0025's "Intake to file at commit time" block specifies the exact section
  // header the Implementer must copy verbatim. We pin the header (not the full
  // body — that would be too brittle if minor wording changes happen) and the
  // distinguishing phrase "after story #28's default-flip" which prevents this
  // sentinel from being accidentally satisfied by a similarly-titled prior intake.
  const expectedHeader = "## 2026-05-25 — Cleanup + Bug: per-task `forceKill: false` overrides after story #28's default-flip";
  assert(
    src.includes(expectedHeader),
    "_intake.md must contain the section header `" + expectedHeader + "` exactly (per ADR 0025 " +
    "§\"Intake to file at commit time\"). The Implementer copies the full intake block verbatim " +
    "from ADR 0025 at commit time. Same pattern as ADR 0023's amendment-block intake filing in " +
    "story #26. The intake captures the proper triage for the 9 redundant per-task overrides + the " +
    "2 mis-sized timeout durations on syncWoT / syncProfiles — both deliberately deferred from " +
    "story #28's scope per ADR 0025 §Decision."
  );
});

// ---------------------------------------------------------------------------
// Regression guards — PASS pre AND post.
// These protect the kill machinery, the timeout-emit shape, the ADR 0013
// semaphore wrap, and the explicit non-change to per-task overrides.
// ---------------------------------------------------------------------------

test('R1: launchChildTask.sh\'s force_kill block at :402-412 still reads from resolved_options and conditionally executes kill -9 (AC #1, AC #4 — wrapper kill machinery preserved)', () => {
  const src = readSafe(WRAPPER_SCRIPT);
  assert(src !== null, 'Wrapper script missing at ' + WRAPPER_SCRIPT);
  // The kill block has three structural requirements:
  //   (a) reads force_kill from resolved_options via jq lookup at .failure.timeout.forceKill
  //   (b) conditionally enters the kill branch when force_kill == "true"
  //   (c) executes `kill -9 "$child_pid"`
  // The fix does NOT touch this file; it only flips the *resolved value* that
  // the merge will produce. The kill machinery itself must remain intact.
  assert(
    /force_kill=\$\(\s*echo\s+["']?\$resolved_options["']?\s*\|\s*jq\s+-r\s+['"]\.failure\.timeout\.forceKill\s*\/\/\s*true['"]/.test(src),
    "launchChildTask.sh must read `force_kill` from `resolved_options` via jq lookup at " +
    "`.failure.timeout.forceKill // true`. The `// true` jq fallback aligns with the global " +
    "registry default `forceKill: true` (story #28); the fallback only engages on deep registry " +
    "corruption when resolved_options has no forceKill at all, but the value should match the " +
    "rest of the system's default. The hygiene alignment shipped 2026-05-26 closes the " +
    "documentation lie left behind by story #28's flip. (AC #1, AC #4; post-story-#28 hygiene)"
  );
  assert(
    /if\s*\[\[\s*["']?\$force_kill["']?\s*==\s*["']true["']\s*\]\]/.test(src),
    "launchChildTask.sh must still conditionally enter the kill branch when `$force_kill == \"true\"`. " +
    "(AC #1, AC #4)"
  );
  assert(
    /kill\s+-9\s+["']?\$child_pid["']?/.test(src),
    "launchChildTask.sh must still execute `kill -9 \"$child_pid\"` inside the force-kill branch. " +
    "This is the actual kill that satisfies AC #1's no-surviving-orphan claim. (AC #1, AC #4)"
  );
});

test('R2: launchChildTask.sh still emits CHILD_TASK_ERROR event with error_type="timeout" on timeout (AC #3 — observability surface preserved)', () => {
  const src = readSafe(WRAPPER_SCRIPT);
  assert(src !== null, 'Wrapper script missing — R1 must pass first.');
  // AC #3 says: "no new event type is required (operator can distinguish 'killed
  // via timeout' from other failure modes through existing fields)." This holds
  // iff the existing CHILD_TASK_ERROR emit with `error_type: "timeout"` still
  // fires. The fix does NOT change this; we guard against accidental removal.
  assert(
    /error_type="timeout"/.test(src),
    "launchChildTask.sh must still set `error_type=\"timeout\"` inside the timeout branch. The fix " +
    "flips the kill behavior but does NOT change the error-event shape. Operators continue to use the " +
    "existing CHILD_TASK_ERROR + error_type=timeout signal to detect timed-out tasks. (AC #3)"
  );
  assert(
    /emit_task_event\s+["']CHILD_TASK_ERROR["']/.test(src),
    "launchChildTask.sh must still emit `CHILD_TASK_ERROR` via `emit_task_event`. (AC #3)"
  );
});

test('R3: queue/index.js still wraps tagged-task Worker callback with semaphore.acquire / release in try-finally (AC #4 — ADR 0013 wrap preserved)', () => {
  const src = readSafe(QUEUE_INDEX_MODULE);
  assert(src !== null, 'queue/index.js missing at ' + QUEUE_INDEX_MODULE);
  // Story #28's fix flips a value in the timeout path. It must not regress the
  // ADR 0013 cross-task serialization mechanism that story #15 introduced and
  // story #27 / Track A restored. Same regression guard as story #27's R1.
  assert(
    /resourceClass/.test(src),
    "queue/index.js must still reference `resourceClass` — ADR 0013's wrap pattern conditionally " +
    "wraps the Worker callback based on `taskDef.resourceClass`. (AC #4)"
  );
  assert(
    /semaphore\.acquire\s*\(/.test(src),
    "queue/index.js must still call `semaphore.acquire(...)` in the tagged-task Worker callback " +
    "branch. (AC #4; ADR 0013)"
  );
  assert(
    /\bfinally\b\s*\{[\s\S]*?\brelease\s*\(\s*\)/.test(src),
    "queue/index.js must still release the semaphore in a `finally` block — ADR 0013's crash-safety " +
    "property. (AC #4; ADR 0013)"
  );
});

test('R4 (post-Part-A): only syncWoT + syncProfiles retain explicit forceKill: false (Part B deferred — _intake.md 2026-05-25)', () => {
  const raw = readSafe(TASK_REGISTRY_PATH);
  assert(raw !== null, 'taskRegistry.json missing — S1 must pass first.');
  let registry;
  try { registry = JSON.parse(raw); }
  catch (e) { throw new Error('taskRegistry.json failed to parse: ' + e.message); }

  // Iterate ALL tasks, collect those with explicit `forceKill: false`. After
  // Part A (2026-05-26 fast-track), the set should equal exactly
  // {syncProfiles, syncWoT} — Part B's deferred 60s-duration investigation
  // is what blocks removing those last two. Any other task carrying explicit
  // `forceKill: false` would be a regression or scope creep worth flagging
  // during review.
  const tasksWithExplicitForceKillFalse = Object.entries(registry.tasks || {})
    .filter(([_, task]) => {
      const fk = task && task.options && task.options.completion &&
                 task.options.completion.failure && task.options.completion.failure.timeout &&
                 task.options.completion.failure.timeout.forceKill;
      return fk === false;
    })
    .map(([name, _]) => name)
    .sort();

  const expected = PER_TASK_OVERRIDES_PRESERVED_POST_PART_A;
  assert(
    JSON.stringify(tasksWithExplicitForceKillFalse) === JSON.stringify(expected),
    `Exactly two tasks should retain explicit \`forceKill: false\` after Part A: ${JSON.stringify(expected)}. ` +
    `Got: ${JSON.stringify(tasksWithExplicitForceKillFalse)}. ` +
    "Part A (2026-05-26 fast-track, per _intake.md follow-up filed by ADR 0025) deleted the 9 redundant " +
    "per-task overrides on processAllTasks, callBatchTransfer, reconcileRecent, reconcileAll, " +
    "reconcileAuthor, reconcileNetwork, applicationHealthMonitor, neo4jPerformanceMonitor, " +
    "externalNetworkConnectivityMonitor — those tasks now inherit `forceKill: true` from the global " +
    "default (story #28). syncWoT + syncProfiles retain the override pending Part B's investigation " +
    "of their clearly-wrong 60s timeout duration. If a new task gains explicit `forceKill: false` in " +
    "the registry, surface it during review — the global default should be the path of least resistance."
  );
});

// ---------------------------------------------------------------------------
// Probe-file sentinels — PASS pre AND post (Tester ships the probe alongside).
// ---------------------------------------------------------------------------

test('P0: empirical probe exists at test/probe-kill-timeout-orphans.js (ADR 0025 §"Implementer self-check")', () => {
  const src = readSafe(PROBE_SCRIPT);
  assert(
    src !== null,
    `Probe script must exist at ${PROBE_SCRIPT}. The Tester ships this alongside the sentinels (same ` +
    "pattern as story #27's probe — de-risks the Implementer's self-check step). The Implementer runs " +
    "it inside the container via `docker exec tapestry node /usr/local/lib/node_modules/brainstorm/" +
    "test/probe-kill-timeout-orphans.js` to confirm the wrapper-script kill behavior works end-to-end " +
    "against the actual installed bash + jq + structured-logging machinery. If the probe ASSERTs FAIL, " +
    "re-open ADR 0025 with the probe output attached."
  );
});

test('P1: probe script exercises both Path 1 (kill verification) and Path 2 (next-fire-runs verification) and asserts against events.jsonl + ps (ADR 0025 §"Implementer self-check")', () => {
  const src = readSafe(PROBE_SCRIPT);
  assert(src !== null, 'Probe script missing — P0 must pass first.');
  // (a) The probe must spawn the wrapper script.
  assert(
    /launchChildTask\.sh/.test(src),
    "Probe script must invoke launchChildTask.sh (the wrapper script under test). " +
    "Loose check: the literal `launchChildTask.sh` must appear in the probe."
  );
  // (b) The probe must require child_process to spawn the wrapper.
  assert(
    /require\s*\(\s*['"]child_process['"]\s*\)/.test(src),
    "Probe script must `require('child_process')` to spawn the wrapper script."
  );
  // (c) The probe must observe events.jsonl.
  assert(
    /events\.jsonl/.test(src),
    "Probe script must read or grep events.jsonl to confirm CHILD_TASK_ERROR / CHILD_TASK_START / " +
    "TASK_LAUNCH_PREVENTED event presence/absence."
  );
  // (d) Path 1: verify the child PID is dead after wrapper exit.
  // Loose check: a `ps -p` invocation or equivalent (`ps -o`, `kill -0`).
  assert(
    /ps\s+-[op]\b|kill\s+-0\b/.test(src),
    "Probe script's Path 1 must verify the bash subprocess PID (captured from CHILD_TASK_ERROR's " +
    "child_pid metadata) is dead after the wrapper exits. Use `ps -p <pid>` (expecting non-zero exit) " +
    "or `kill -0 <pid>` (expecting non-zero exit). This is the empirical proof that AC #1's " +
    "no-surviving-orphan claim holds end-to-end."
  );
  // (e) Path 1: assert CHILD_TASK_ERROR with error_type=timeout.
  assert(
    /CHILD_TASK_ERROR/.test(src) && /error_type/.test(src),
    "Probe script's Path 1 must verify that the wrapper emitted a CHILD_TASK_ERROR event with " +
    "error_type=\"timeout\" (AC #3's existing observability surface)."
  );
  // (f) Path 2: assert TASK_LAUNCH_PREVENTED is NOT present.
  assert(
    /TASK_LAUNCH_PREVENTED/.test(src),
    "Probe script's Path 2 must verify that the immediately-next invocation of the same task does NOT " +
    "produce a TASK_LAUNCH_PREVENTED event (AC #2's no-silent-suppression claim)."
  );
  // (g) Path 2: assert CHILD_TASK_START is present for the second run.
  assert(
    /CHILD_TASK_START/.test(src),
    "Probe script's Path 2 must verify that the immediately-next invocation emits CHILD_TASK_START " +
    "(the launch proceeded). (AC #2)"
  );
});

async function run() {
  let pass = 0;
  let fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
