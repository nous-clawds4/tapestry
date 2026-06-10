/**
 * Story #27 / ADR 0024 — Scheduled tasks bypass configured timeouts
 * (restoring `neo4j-heavy` semaphore contract).
 *
 * The fix is defense-in-depth across three layers (per ADR 0024 §Decision):
 *   1. scheduler.js adopts the existing `resolveTaskTimeout` utility — DRY
 *      with runTask.js.
 *   2. processor.js conditionally builds optionsJson — sends a per-invocation
 *      timeout block only when timeoutMs > 0 (so the wrapper's hierarchical
 *      merge falls through to options_default for tasks with `"options": {}`).
 *   3. launchChildTask.sh monitor loop guards `elapsed >= timeout_seconds`
 *      with `timeout_seconds -gt 0` — matches Unix convention that `0` means
 *      "no timeout, monitor indefinitely."
 *
 * Source/structural sentinels pin each layer's fix. Unit tests verify the
 * `resolveTaskTimeout` contract (PASS pre AND post — regression guards on the
 * existing utility, since the fix's correctness depends on it). The probe
 * (separate file, not registered in test/test.js) exercises end-to-end against
 * the actual installed wrapper script + jq + structured logging.
 *
 * Expected pre-implementation state:
 *   - S1, S2, S3, S4, P0, P1 FAIL — the imports/calls/guards/probe-file don't
 *     exist yet.
 *   - U1, U2, U3, R1, R2 PASS — regression guards on existing-correct behavior
 *     that the fix must preserve.
 *
 * Post-implementation: all PASS.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SCHEDULER_MODULE     = path.join(ROOT, 'src/manage/taskQueue/queue/scheduler.js');
const PROCESSOR_MODULE     = path.join(ROOT, 'src/manage/taskQueue/queue/processor.js');
const WRAPPER_SCRIPT       = path.join(ROOT, 'src/manage/taskQueue/launchChildTask.sh');
const QUEUE_INDEX_MODULE   = path.join(ROOT, 'src/manage/taskQueue/queue/index.js');
const SEMAPHORE_MODULE     = path.join(ROOT, 'src/manage/taskQueue/queue/resourceSemaphore.js');
const TASK_TIMEOUT_UTIL    = path.join(ROOT, 'src/utils/taskTimeout.js');
const PROBE_SCRIPT         = path.join(ROOT, 'test/probe-scheduled-task-timeout-propagation.js');

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

test('S1: scheduler.js requires resolveTaskTimeout from ../../../utils/taskTimeout (AC #1; ADR 0024 §Implementation 1)', () => {
  const src = readSafe(SCHEDULER_MODULE);
  assert(src !== null, 'Scheduler module missing at ' + SCHEDULER_MODULE);
  // Accept either `const { resolveTaskTimeout } = require(...)` or
  // `const taskTimeoutUtil = require(...)`. The Implementer may format
  // slightly differently; what we pin is the require path.
  const requirePattern = /require\s*\(\s*['"]\.\.\/\.\.\/\.\.\/utils\/taskTimeout['"]\s*\)/;
  assert(
    requirePattern.test(src),
    "scheduler.js must require '../../../utils/taskTimeout' (the shared hierarchical-timeout-resolution utility) so " +
    "tasks with `\"options\": {}` in the registry get the global default timeout instead of falling through to 0. " +
    "The same utility is already used by runTask.js; the bug was that scheduler.js rolled its own one-liner that " +
    "didn't fall through to options_default. (AC #1; ADR 0024 §Implementation 1)"
  );
});

test('S2: scheduler.js calls resolveTaskTimeout(taskDef, registry) inside upsertSchedule and destructures timeoutMs (AC #1; ADR 0024 §Implementation 1)', () => {
  const src = readSafe(SCHEDULER_MODULE);
  assert(src !== null, 'Scheduler module missing — S1 must pass first.');
  // Pin the call site. We're flexible on the variable binding (the Implementer
  // can use either inline destructure or a temp var) but require the function
  // is actually called with (taskDef, registry) inside upsertSchedule.
  const upsertScheduleMatch = src.match(/async\s+function\s+upsertSchedule[\s\S]*?(?=\nasync\s+function|\nfunction\s+|\nmodule\.exports)/);
  assert(
    upsertScheduleMatch,
    'Could not locate the `async function upsertSchedule` definition in scheduler.js — has the function shape changed?'
  );
  const upsertScheduleBody = upsertScheduleMatch[0];
  assert(
    /resolveTaskTimeout\s*\(\s*taskDef\s*,\s*registry\s*\)/.test(upsertScheduleBody),
    "scheduler.js's upsertSchedule must call `resolveTaskTimeout(taskDef, registry)` so the per-fire job-data payload carries the correctly-resolved timeoutMs. " +
    "The pre-fix one-liner read only `taskDef.options.completion.failure.timeout.duration` and fell through to `0` — never honoring the registry's options_default. (AC #1; ADR 0024 §Implementation 1)"
  );
  // The result must be destructured to bind `timeoutMs` (since that's what the
  // existing data payload at the upsertJobScheduler call uses).
  assert(
    /(?:const|let)\s+\{[^}]*\btimeoutMs\b[^}]*\}\s*=\s*resolveTaskTimeout\s*\(/.test(upsertScheduleBody),
    "scheduler.js's upsertSchedule must destructure `timeoutMs` from `resolveTaskTimeout(...)`'s return value " +
    "(the utility returns `{ timeoutMs, timeoutSeconds, timeoutMinutes, ..., forceKill, source }`; only `timeoutMs` " +
    "is needed for the Job Scheduler's data payload). (AC #1; ADR 0024 §Implementation 1)"
  );
});

test('S3: processor.js builds optionsJson conditionally on timeoutMs > 0 (AC #2; ADR 0024 §Implementation 2)', () => {
  const src = readSafe(PROCESSOR_MODULE);
  assert(src !== null, 'Processor module missing at ' + PROCESSOR_MODULE);
  // The fix's intent: when timeoutMs is falsy/zero, ship `'{}'` so the wrapper
  // script's hierarchical merge falls through to options_default; when > 0,
  // ship the full block. Two pinned signals:
  //   (a) The literal `'{}'` (or `"{}"`) appears as one branch of the optionsJson
  //       construction.
  //   (b) `duration: timeoutMs` (without the buggy `|| 0` clamp) appears in the
  //       other branch.
  assert(
    /optionsJson\s*=/.test(src),
    "Could not locate the `optionsJson` assignment in processor.js — has the assignment shape changed?"
  );
  // (a) The empty-options branch must exist.
  assert(
    /['"]\{\}['"]/.test(src),
    "processor.js must include an empty-options branch (`'{}'` or `\"{}\"`) for the case where `timeoutMs` is falsy/zero. " +
    "Without this, the wrapper script's hierarchical-options merge always sees a per-invocation timeout = 0 and " +
    "clobbers the global default. The fix omits the per-invocation timeout block entirely when there's no real " +
    "value to ship. (AC #2; ADR 0024 §Implementation 2)"
  );
  // (b) The positive-timeout branch must ship `duration: timeoutMs` WITHOUT
  // the buggy `|| 0` fallback (since the conditional already guards).
  assert(
    /duration\s*:\s*timeoutMs\b(?!\s*\|\|)/.test(src),
    "processor.js must ship `duration: timeoutMs` (no `|| 0` fallback) inside the conditional positive-timeout " +
    "branch. The whole point of the fix is that 0 must NOT be sent as a real override; that case is now caught by " +
    "the outer conditional that builds an empty-options JSON instead. (AC #2; ADR 0024 §Implementation 2)"
  );
  // (c) Confirm the conditional pattern is actually present — accept either
  // `(timeoutMs && timeoutMs > 0)` or `timeoutMs > 0` or equivalent guard.
  assert(
    /timeoutMs\s*(?:&&\s*timeoutMs\s*)?>\s*0/.test(src),
    "processor.js's optionsJson construction must guard the timeout-block branch with a `timeoutMs > 0` (or " +
    "`timeoutMs && timeoutMs > 0`) check. This is the fix's central conditional. (AC #2; ADR 0024 §Implementation 2)"
  );
});

test('S4: launchChildTask.sh monitor loop guards the timeout check with `timeout_seconds -gt 0` (AC #2, AC #3; ADR 0024 §Implementation 3)', () => {
  const src = readSafe(WRAPPER_SCRIPT);
  assert(src !== null, 'Wrapper script missing at ' + WRAPPER_SCRIPT);
  // The fix: change `if [[ $elapsed -ge $timeout_seconds ]]; then` to
  // `if [[ $timeout_seconds -gt 0 && $elapsed -ge $timeout_seconds ]]; then`.
  // We accept either argument ordering inside the [[ ]] but require both the
  // `-gt 0` guard and the `-ge $timeout_seconds` comparison on the same line.
  const monitorLoopGuard =
    /\[\[\s*\$timeout_seconds\s+-gt\s+0\s+&&\s+\$elapsed\s+-ge\s+\$timeout_seconds\s*\]\]/.test(src) ||
    /\[\[\s*\$elapsed\s+-ge\s+\$timeout_seconds\s+&&\s+\$timeout_seconds\s+-gt\s+0\s*\]\]/.test(src);
  assert(
    monitorLoopGuard,
    "launchChildTask.sh's monitor-loop timeout check must include the `$timeout_seconds -gt 0` guard alongside the " +
    "existing `$elapsed -ge $timeout_seconds` comparison. Without this guard, a per-invocation `timeout: { duration: 0 }` " +
    "trivially trips at first iteration (5 >= 0 is TRUE), declaring 'timed out' and exiting while the backgrounded " +
    "task continues — the precise bug story #27 fixes. The guard makes `timeout_seconds=0` mean 'no timeout, monitor " +
    "indefinitely' (matching Unix convention: `timeout 0 cmd` doesn't timeout). (AC #2, AC #3; ADR 0024 §Implementation 3)"
  );
  // Also verify the buggy original form is NOT left in place (in case the
  // Implementer adds the guard somewhere else but forgets to remove the
  // original check).
  const unguardedCount = (src.match(/if\s*\[\[\s*\$elapsed\s+-ge\s+\$timeout_seconds\s*\]\]/g) || []).length;
  assert(
    unguardedCount === 0,
    `launchChildTask.sh still contains an unguarded \`[[ $elapsed -ge $timeout_seconds ]]\` check (${unguardedCount} occurrence(s)). ` +
    "The buggy original form must be replaced, not augmented. Find and update the existing check to include the " +
    "`$timeout_seconds -gt 0` guard. (AC #2, AC #3; ADR 0024 §Implementation 3)"
  );
});

// ---------------------------------------------------------------------------
// Unit tests on the resolveTaskTimeout contract.
// These PASS both pre and post — they're regression guards on the existing
// utility that the fix's correctness depends on.
// ---------------------------------------------------------------------------

test('U1: resolveTaskTimeout(taskWithEmptyOptions, registryWithGlobalDefault) returns the registry default duration (AC #1)', () => {
  const taskTimeoutUtil = readSafe(TASK_TIMEOUT_UTIL);
  assert(taskTimeoutUtil !== null, 'taskTimeout utility missing at ' + TASK_TIMEOUT_UTIL);
  // Lazy-require so the assertion-error message above is clean if the file is missing.
  const { resolveTaskTimeout } = require(TASK_TIMEOUT_UTIL);

  const taskWithEmptyOptions = {
    name: 'fixtureTask',
    options: {} // exactly the shape of processCustomer, updateAllScoresForOwner, etc.
  };
  const registry = {
    options_default: {
      completion: {
        failure: {
          timeout: { duration: 1800000 /* 30 min */ }
        }
      }
    }
  };

  const result = resolveTaskTimeout(taskWithEmptyOptions, registry);
  assert(
    result.timeoutMs === 1800000,
    "resolveTaskTimeout must fall through to the registry's `options_default.completion.failure.timeout.duration` " +
    `when the task's own \`options\` is empty (got timeoutMs=${result.timeoutMs}, expected 1800000). This is the ` +
    "contract the fix's correctness depends on — if this regresses, scheduler.js's adoption of the utility (S1, S2) " +
    "no longer produces the right value. (AC #1; resolveTaskTimeout Priority 2)"
  );
});

test('U2: resolveTaskTimeout(taskWithExplicitOverride, registry) returns the per-task override, not the global default (AC #7)', () => {
  const { resolveTaskTimeout } = require(TASK_TIMEOUT_UTIL);

  const taskWithOverride = {
    name: 'fixtureTask',
    options: {
      completion: {
        failure: {
          timeout: { duration: 600000 /* 10 min — within MIN/MAX bounds (5 min / 24 hr) */ }
        }
      }
    }
  };
  const registry = {
    options_default: {
      completion: {
        failure: {
          timeout: { duration: 1800000 /* 30 min — would be the fallback */ }
        }
      }
    }
  };

  const result = resolveTaskTimeout(taskWithOverride, registry);
  assert(
    result.timeoutMs === 600000,
    "resolveTaskTimeout must honor per-task explicit overrides (Priority 1) before falling through to the global " +
    `default (got timeoutMs=${result.timeoutMs}, expected 600000). AC #7 requires that the fix does NOT break tasks ` +
    "that currently set their own timeout — those tasks should continue to get their own value, not the registry " +
    "default. (AC #7; resolveTaskTimeout Priority 1)"
  );
});

test('U3: resolveTaskTimeout(taskWithEmptyOptions, registryWithGlobalDefault).timeoutMs is greater than 0 (AC #1 — direct anti-regression on the specific bug)', () => {
  const { resolveTaskTimeout } = require(TASK_TIMEOUT_UTIL);

  const taskWithEmptyOptions = { name: 'fixtureTask', options: {} };
  const registry = {
    options_default: {
      completion: {
        failure: {
          timeout: { duration: 1800000 }
        }
      }
    }
  };

  const result = resolveTaskTimeout(taskWithEmptyOptions, registry);
  assert(
    result.timeoutMs > 0,
    `resolveTaskTimeout must NEVER return timeoutMs=0 for a task with empty options when the registry has a ` +
    `global-default timeout (got timeoutMs=${result.timeoutMs}). This is the specific failure mode story #27 fixes — ` +
    `pre-fix scheduler.js silently fell through to \`|| 0\`, propagated 0 through the chain, and broke the wrapper's ` +
    `monitor loop. The utility's design prevents this; this assertion guards against any regression that would ` +
    `re-enable it. (AC #1; ADR 0024 §Context — the DRY violation)`
  );
});

// ---------------------------------------------------------------------------
// Probe-file sentinels — FAIL pre, PASS post.
// ---------------------------------------------------------------------------

test('P0: empirical probe exists at test/probe-scheduled-task-timeout-propagation.js (ADR 0024 §Implementer self-check)', () => {
  const src = readSafe(PROBE_SCRIPT);
  assert(
    src !== null,
    `Probe script must exist at ${PROBE_SCRIPT}. ADR 0024's "Implementer self-check before commit" mandates ` +
    "this script as an empirical post-fix verification — the Implementer runs it inside the container via " +
    "`docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-scheduled-task-timeout-propagation.js` " +
    "to confirm the wrapper-script fix works against the actual installed bash + jq + structured-logging machinery. " +
    "If the probe ASSERTs FAIL, re-open ADR 0024 with the probe output attached."
  );
});

test('P1: probe script exercises both Path 1 (timeoutMs=0 → no spurious timeout) and Path 2 (genuine timeout) and asserts against events.jsonl (ADR 0024 §Implementer self-check)', () => {
  const src = readSafe(PROBE_SCRIPT);
  assert(src !== null, 'Probe script missing — P0 must pass first.');
  // (a) The probe must spawn the wrapper script (or invoke it via Node's
  // child_process). Loose check: presence of `launchChildTask.sh` literal.
  assert(
    /launchChildTask\.sh/.test(src),
    "Probe script must invoke launchChildTask.sh (the wrapper script under test). " +
    "Loose check: the literal `launchChildTask.sh` must appear in the probe. (ADR 0024 §Implementer self-check)"
  );
  // (b) The probe must spawn a child process — verify it requires child_process.
  assert(
    /require\s*\(\s*['"]child_process['"]\s*\)/.test(src),
    "Probe script must `require('child_process')` to spawn the wrapper script. (ADR 0024 §Implementer self-check)"
  );
  // (c) The probe must observe events.jsonl. The path is fixed by the
  // installed config (verified via `docker exec tapestry sh -c 'find /var/log -name events.jsonl'`
  // during /discuss: `/var/log/brainstorm/taskQueue/events.jsonl`).
  assert(
    /events\.jsonl/.test(src),
    "Probe script must read or grep events.jsonl to confirm the expected `CHILD_TASK_END` / `CHILD_TASK_ERROR` events. " +
    "(ADR 0024 §Implementer self-check)"
  );
  // (d) The probe must exercise Path 1 (timeoutMs=0 case) — the bug case.
  // Loose check: a literal "duration":0 or "duration: 0" or equivalent token.
  assert(
    /"duration"\s*:\s*0\b|duration\s*:\s*0\b/.test(src),
    "Probe script's Path 1 must explicitly invoke the wrapper with a per-invocation `duration: 0` payload (the bug " +
    "shape that the fix turns into 'no timeout' instead of 'timeout at first tick'). The probe must verify the " +
    "wrapper does NOT declare a spurious timeout in this case. (AC #2; ADR 0024 §Implementer self-check)"
  );
  // (e) The probe must exercise Path 2 (genuine timeout case).
  // Loose check: a non-zero literal duration appears that is plausibly a probe
  // timeout (we accept 5000, 2000, 3000, etc. — anything > 0 but small).
  // Verify by presence of "error_type":"timeout" or error_type=timeout AND
  // an elapsed_time / non-zero duration reference.
  assert(
    /error_type\s*[:=]\s*['"]?timeout['"]?/.test(src),
    "Probe script's Path 2 must verify that a genuine timeout (a non-zero `timeoutMs` against a script that exceeds " +
    "it) produces a `CHILD_TASK_ERROR` event with `error_type: \"timeout\"`. (AC #3; ADR 0024 §Implementer self-check)"
  );
});

// ---------------------------------------------------------------------------
// Regression guards on ADR 0013's semaphore contract.
// These PASS both pre and post — the fix MUST NOT remove the wrap or the
// observability surface AC #6 relies on.
// ---------------------------------------------------------------------------

test('R1: queue/index.js still wraps tagged-task Worker callback with semaphore.acquire / release in try-finally (AC #4, #5 — ADR 0013 wrap preserved)', () => {
  const src = readSafe(QUEUE_INDEX_MODULE);
  assert(src !== null, 'queue/index.js missing at ' + QUEUE_INDEX_MODULE);
  // Pin the ADR 0013 wrap pattern: a conditional on `resourceClass` that takes
  // the acquire/release branch for tagged tasks.
  assert(
    /resourceClass/.test(src),
    "queue/index.js must still reference `resourceClass` — ADR 0013's wrap pattern conditionally wraps the Worker " +
    "callback based on `taskDef.resourceClass`. Removing this would mean tagged tasks no longer acquire the " +
    "semaphore at all. (AC #4, #5)"
  );
  assert(
    /semaphore\.acquire\s*\(/.test(src),
    "queue/index.js must still call `semaphore.acquire(...)` in the tagged-task Worker callback branch. " +
    "ADR 0013's contract requires the wrap; story #27's fix only restores the wrap's effective duration — it must " +
    "NOT remove the wrap itself. (AC #4, #5; ADR 0013)"
  );
  // The release must be in a finally block (try/finally pattern from ADR 0013).
  assert(
    /\bfinally\b\s*\{[\s\S]*?\brelease\s*\(\s*\)/.test(src),
    "queue/index.js must still release the semaphore in a `finally` block — ADR 0013's crash-safety property " +
    "(lease always released after acquire, regardless of processor.processJob outcome). (AC #4, #5; ADR 0013)"
  );
});

test('R2: resourceSemaphore.js still emits resource_class_wait_begin / wait_end / released phase tokens (AC #6 — observability surface preserved)', () => {
  const src = readSafe(SEMAPHORE_MODULE);
  assert(src !== null, 'resourceSemaphore.js missing at ' + SEMAPHORE_MODULE);
  // The three phase tokens AC #6's cycle-local smoke depends on for serialization
  // visibility:
  const tokens = [
    'resource_class_wait_begin',
    'resource_class_wait_end',
    'resource_class_released'
  ];
  for (const token of tokens) {
    assert(
      src.indexOf(token) !== -1,
      `resourceSemaphore.js must still emit the \`${token}\` phase token. AC #6's cycle-local smoke uses ` +
      "these events to verify cap=1 serialization (the second task's `wait_end outcome=acquired` timestamp must " +
      "occur after the first task's `released` timestamp). Removing or renaming this token would silently break " +
      "the observability surface the AC depends on. (AC #6)"
    );
  }
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
