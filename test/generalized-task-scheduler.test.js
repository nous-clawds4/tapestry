/**
 * Story #22 / ADR 0019 — Generalized task scheduler via BullMQ Job Schedulers.
 *
 * Source/structural sentinels pin the ADR-required code shape: the in-process
 * `setInterval` scheduler is replaced by BullMQ Job Schedulers
 * (`upsertJobScheduler` / `removeJobScheduler`) on the existing per-task queues,
 * the 1-hour floor and hardcoded DEFAULTS restriction are gone, and the config
 * schema gains cron + sub-hour (`intervalMinutes`).
 *
 * The behavioral heart — does a sub-hour schedule actually fire via the queue;
 * does a cron schedule fire on pattern; does a schedule SURVIVE a control-panel
 * restart (durability); does the migrated `refreshSearchIndex` keep firing;
 * does the kill-switch halt scheduling — is reproducible only against a live
 * Redis + BullMQ + control-panel, and is the **authoritative cycle-local /
 * staging smoke** (Reviewer-required, per project precedent). See the test
 * plan's "Not covered (deferred to smoke)" section.
 *
 * T1..T8 : FAIL pre-implementation, PASS post.
 * R1..R4 : PASS pre AND post — regression guards on the BullMQ queue topology
 *          the scheduler attaches to, the bullmq dependency, the operator API
 *          surface, and the boot wiring.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const SCHEDULED_TASKS  = path.join(ROOT, 'src/api/scheduled-tasks/index.js');
const SCHEDULER_MODULE = path.join(ROOT, 'src/manage/taskQueue/queue/scheduler.js'); // ADR-optional: reconcile may live here or inline in scheduled-tasks
const QUEUE_INDEX      = path.join(ROOT, 'src/manage/taskQueue/queue/index.js');
const API_INDEX        = path.join(ROOT, 'src/api/index.js');
const CONTROL_PANEL    = path.join(ROOT, 'bin/control-panel.js');
const PACKAGE_JSON     = path.join(ROOT, 'package.json');
const OPERATIONS_MD    = path.join(ROOT, 'OPERATIONS.md');

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (_e) { return null; }
}
function readJsonSafe(p) {
  const s = readSafe(p);
  if (s === null) return null;
  try { return JSON.parse(s); }
  catch (_e) { return null; }
}
// The reconcile logic may live inline in scheduled-tasks/index.js OR in a
// sibling scheduler module — search both so the sentinel doesn't over-constrain
// file layout (ADR 0019 §Implementation notes leaves this open).
function schedulerSource() {
  return [readSafe(SCHEDULED_TASKS) || '', readSafe(SCHEDULER_MODULE) || ''].join('\n');
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ---------------------------------------------------------------------------
// Failing sentinels — FAIL now, PASS once Story #22 is implemented per ADR 0019.
// ---------------------------------------------------------------------------

test('T1: scheduling uses BullMQ Job Schedulers (upsertJobScheduler), not setInterval (AC durability/queue-routed; ADR 0019 §Decision)', () => {
  const src = schedulerSource();
  assert(
    /upsertJobScheduler/.test(src),
    'The scheduler does not call BullMQ `upsertJobScheduler` (ADR 0019 §Decision). Recurring scheduling must ' +
      'be served by durable BullMQ Job Schedulers attached to each task\'s existing queue — that is what makes ' +
      'schedules survive a control-panel restart and routes every fire through the queue (semaphore + ' +
      'concurrency + BullBoard). Replace the in-process setInterval with `queue.upsertJobScheduler(...)`.'
  );
});

test('T2: the scheduler reconciles disabled/orphan schedules (removeJobScheduler / getJobSchedulers) (AC enable-disable + file-authoritative; ADR 0019 §Decision Q2)', () => {
  const src = schedulerSource();
  assert(
    /removeJobScheduler|getJobSchedulers/.test(src),
    'The scheduler does not remove/reconcile Job Schedulers (ADR 0019 §Decision Q2). Disabling a task must ' +
      '`removeJobScheduler`, and the boot reconcile must drop orphaned schedulers not present in the config so ' +
      'the config file stays authoritative over Redis. Use `removeJobScheduler` (and `getJobSchedulers` to ' +
      'enumerate for orphan cleanup).'
  );
});

test('T3: the in-process setInterval scheduler is retired from scheduled-tasks/index.js (AC: in-process scheduler retired; ADR 0019 §Impl)', () => {
  const src = readSafe(SCHEDULED_TASKS);
  assert(src !== null, 'src/api/scheduled-tasks/index.js missing — re-baseline this sentinel.');
  assert(
    !/setInterval\(/.test(src),
    'src/api/scheduled-tasks/index.js still uses setInterval (AC: in-process scheduler retired; ADR 0019 §Impl). ' +
      'The setInterval scheduling loop AND the PID-polling setInterval must both go — BullMQ Job Schedulers ' +
      'handle recurrence, and the Worker handles completion. A timer that dies with the control-panel process ' +
      'is exactly the fragility this story removes.'
  );
});

test('T4: the 1-hour minimum-interval floor is removed (AC: sub-hour allowed; ADR 0019 §Impl)', () => {
  const src = readSafe(SCHEDULED_TASKS);
  assert(src !== null, 'src/api/scheduled-tasks/index.js missing — re-baseline this sentinel.');
  assert(
    !/Minimum interval is 1 hour/.test(src),
    'src/api/scheduled-tasks/index.js still rejects sub-hour intervals with "Minimum interval is 1 hour" ' +
      '(AC: sub-hour allowed; ADR 0019 §Impl). reconcileRecent wants ~10-minute cadence — the floor must go.'
  );
  assert(
    !/<\s*3600000/.test(src),
    'src/api/scheduled-tasks/index.js still guards on `< 3600000` (the 1-hour floor in startScheduler) ' +
      '(AC: sub-hour allowed; ADR 0019 §Impl). Remove the floor; BullMQ accepts any `every` interval.'
  );
});

test('T5: schedulable tasks are validated against the task registry, not a hardcoded DEFAULTS set (AC: any registered task; ADR 0019 §Impl)', () => {
  const src = schedulerSource();
  assert(
    /taskRegistry|getAllQueues/.test(src),
    'The scheduler does not consult the task registry (AC: any registered task; ADR 0019 §Impl). Today only ' +
      'the hardcoded DEFAULTS (updateAllScoresForOwner, refreshSearchIndex) are schedulable. The schedulable ' +
      'set must come from the registry (taskRegistry.json) — any registered task can be scheduled and the UI ' +
      'list endpoint enumerates them. Validate `taskId` against the registry (unknown → 400), not DEFAULTS.'
  );
});

test('T6: schedules support cron expressions (AC: interval + cron; ADR 0019 §Decision)', () => {
  const src = schedulerSource();
  assert(
    /cron/.test(src),
    'The scheduler config/handlers have no notion of `cron` (AC: interval + cron; ADR 0019 §Decision). A ' +
      'schedule must be expressible as a cron expression (→ `upsertJobScheduler(id, { pattern: cron }, ...)`), ' +
      'so a heavy run like reconcileAll can be pinned to a low-traffic window.'
  );
});

test('T7: schedules support sub-hour intervals via intervalMinutes (AC: sub-hour; ADR 0019 §Impl config schema)', () => {
  const src = schedulerSource();
  assert(
    /intervalMinutes/.test(src),
    'The scheduler config schema has no `intervalMinutes` (AC: sub-hour; ADR 0019 §Impl). The schema extends ' +
      'backward-compatibly with `intervalMinutes` (and `cron`) so reconcileRecent can run every ~10 minutes; ' +
      'existing intervalHours/intervalDays keep working.'
  );
});

test('T8: OPERATIONS.md documents the generalized scheduler (sub-hour + the Job Scheduler mechanism) (AC-10; ADR 0019 §Impl docs)', () => {
  const src = readSafe(OPERATIONS_MD);
  assert(src !== null, 'OPERATIONS.md missing — re-baseline this sentinel.');
  const missing = [];
  if (!/intervalMinutes/.test(src)) missing.push('the sub-hour `intervalMinutes` config field');
  if (!/job scheduler/i.test(src)) missing.push('the BullMQ Job Scheduler mechanism');
  assert(
    missing.length === 0,
    'OPERATIONS.md does not document: ' + missing.join(', ') + ' (AC-10; ADR 0019 §Impl). Add a scheduler ' +
      'section covering: scheduling any registered task by interval or cron; sub-hour (`intervalMinutes`); ' +
      'durability + the skip-and-resume (no-backfill) missed-fire policy; the kill-switch; the retirement of ' +
      'the in-process scheduler; and the reconciliation seed-via-reconcileAll-first runbook note.'
  );
});

// ---------------------------------------------------------------------------
// Regression guards — PASS now AND post-implementation.
// ---------------------------------------------------------------------------

test('R1: the BullMQ per-task Queue+Worker topology the scheduler attaches to is intact, and getQueue is exported (ADR 0012/0019)', () => {
  const src = readSafe(QUEUE_INDEX);
  assert(src !== null, 'queue/index.js missing — re-baseline this sentinel.');
  assert(
    /new Queue\(/.test(src) && /new Worker\(/.test(src),
    'R1: queue/index.js no longer instantiates per-task BullMQ Queue + Worker (ADR 0012/0019 regression). The ' +
      'scheduler attaches Job Schedulers to these existing queues so scheduled fires reuse the existing ' +
      'Worker + neo4j-heavy semaphore. The per-task topology must survive.'
  );
  assert(
    /getQueue\b/.test(src) && /module\.exports/.test(src),
    'R1: queue/index.js no longer exports getQueue (ADR 0019 regression). The scheduler reconcile needs ' +
      'getQueue(taskName) to upsert/remove a Job Scheduler on each task\'s queue.'
  );
});

test('R2: bullmq is a declared runtime dependency (the scheduler is built on its Job Schedulers) (ADR 0019)', () => {
  const pkg = readJsonSafe(PACKAGE_JSON);
  assert(pkg && pkg.dependencies, 'package.json missing or has no dependencies block.');
  assert(
    typeof pkg.dependencies.bullmq === 'string',
    'R2: package.json does not declare `bullmq` (ADR 0019 regression). Job Schedulers (upsertJobScheduler) are ' +
      'a BullMQ 5.x feature; the dependency must remain declared/installed or the scheduler cannot run.'
  );
});

test('R3: the scheduled-tasks operator API surface remains registered (AC: operator manages schedules; ADR 0019)', () => {
  const src = readSafe(API_INDEX);
  assert(src !== null, 'src/api/index.js missing — re-baseline this sentinel.');
  assert(
    /scheduled-tasks\/status/.test(src) && /scheduled-tasks\/update/.test(src),
    'R3: src/api/index.js no longer registers the /api/scheduled-tasks status + update routes (ADR 0019 ' +
      'regression). These are the operator surface the UI panel drives (generalized here to any task + ' +
      'cron/sub-hour); they must remain registered.'
  );
});

test('R4: the scheduler is still wired at control-panel boot (AC: durability/restore on boot; ADR 0019 §Impl)', () => {
  const src = readSafe(CONTROL_PANEL);
  assert(src !== null, 'bin/control-panel.js missing — re-baseline this sentinel.');
  assert(
    /scheduled-tasks/.test(src),
    'R4: bin/control-panel.js no longer references the scheduled-tasks module at boot (ADR 0019 §Impl ' +
      'regression). The boot path must reconcile the persisted schedule config into BullMQ Job Schedulers on ' +
      'startup (replacing the old initScheduler), so enabled schedules are restored after a restart.'
  );
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail };
}

module.exports = { run };
