/**
 * Story #13 / ADR 0010 — Route /api/run-task through BullMQ (task queue, phase 1).
 *
 * Source/structural sentinels pin the ADR-required code shape. The behavioral
 * proofs — actual dedup under concurrent POSTs, actual sync `waitUntilFinished`
 * vs immediate "queued" async response, actual BullBoard auth gate, actual
 * feature-flag rollback flip, actual 503 when Redis is down, actual job
 * survival across control-panel restart, actual AOF persistence across Redis
 * restart — are reproducible only against the live Docker stack and are the
 * **authoritative cycle-local smoke** (Reviewer-required, per project
 * precedent #5/#6/#8/#10/#11/#12).
 *
 * T1..T13 : FAIL pre-implementation, PASS post.
 * R1..R5  : PASS pre AND post — regression guards on /api/run-task signature,
 *           the existing scheduled-tasks → /api/run-task contract, the
 *           determineExecutionMode sync-vs-async branching, the launchChildTask
 *           pgrep guard, and the strfry-stream-consumer Redis pattern.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const PKG_JSON           = path.join(ROOT, 'package.json');
const RUN_TASK_JS        = path.join(ROOT, 'src/api/manage/commands/runTask.js');
const QUEUE_MODULE       = path.join(ROOT, 'src/manage/taskQueue/queue/index.js');
const PROCESSOR_MODULE   = path.join(ROOT, 'src/manage/taskQueue/queue/processor.js');
const BULLBOARD_MOUNT    = path.join(ROOT, 'src/manage/taskQueue/queue/bullBoardMount.js');
const API_INDEX_JS       = path.join(ROOT, 'src/api/index.js');
const CONTROL_PANEL_JS   = path.join(ROOT, 'bin/control-panel.js');
const SUPERVISORD_CONF   = path.join(ROOT, 'docker/supervisord.conf');
const DOCKER_COMPOSE_YML = path.join(ROOT, 'docker-compose.yml');
const BRAINSTORM_CONF_T  = path.join(ROOT, 'config/brainstorm.conf.template');
const OPERATIONS_MD      = path.join(ROOT, 'OPERATIONS.md');
const LAUNCH_CHILD_TASK  = path.join(ROOT, 'src/manage/taskQueue/launchChildTask.sh');
const SCHEDULED_TASKS    = path.join(ROOT, 'src/api/scheduled-tasks/index.js');
const REDIS_CONSUMER     = path.join(ROOT, 'src/pipeline/stream/redis-consumer.js');

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (_e) { return null; }
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once Story #13 is implemented per ADR 0010.
// ---------------------------------------------------------------------------

test('T1: package.json declares bullmq, @bull-board/api, @bull-board/express as direct dependencies (AC-2, AC-11, ADR 0010 §Dependencies)', () => {
  const pkg = JSON.parse(readSafe(PKG_JSON) || '{}');
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const missing = [];
  if (!deps['bullmq']) missing.push('bullmq');
  if (!deps['@bull-board/api']) missing.push('@bull-board/api');
  if (!deps['@bull-board/express']) missing.push('@bull-board/express');
  assert(
    missing.length === 0,
    'package.json is missing required dependencies (AC-2/AC-11; ADR 0010 §Dependencies): ' +
      missing.join(', ') + '. Add them under "dependencies" — ioredis is already present so no Redis-client ' +
      'duplication.'
  );
});

test('T2: queue module exists at src/manage/taskQueue/queue/index.js and exports the dispatch surface (AC-2, AC-12, ADR 0010 §New files)', () => {
  const src = readSafe(QUEUE_MODULE);
  assert(
    src !== null,
    'Queue module does not exist at src/manage/taskQueue/queue/index.js (AC-2/AC-12; ADR 0010 §New files). ' +
      'Create the sourceable module that owns per-task BullMQ Queue + Worker pairs, the enqueue surface, ' +
      'and the sync/async wrappers (initTaskQueue, enqueueTask, runViaQueueSync, runViaQueueAsync, ' +
      'isQueueAvailable).'
  );
  // ADR pins the public surface explicitly — pin at least the two wrappers + the availability probe.
  for (const sym of ['runViaQueueSync', 'runViaQueueAsync', 'isQueueAvailable']) {
    assert(
      src.includes(sym),
      'Queue module does not appear to export `' + sym + '` (AC-2/AC-12; ADR 0010 §New files). The ADR ' +
        'pins the queue module\'s public surface — runTask.js will call into these three by name.'
    );
  }
});

test('T3: queue module computes jobId from (taskName, pubkey) for customer tasks and from taskName alone for non-customer tasks (AC-3, AC-5, ADR 0010 §Option A: Dedup)', () => {
  const src = readSafe(QUEUE_MODULE);
  assert(src !== null, 'Queue module missing — T2 must pass first.');
  // BullMQ-native jobId dedup is the dedup mechanism the ADR chose. The jobId
  // computation must reference BOTH taskName and pubkey (so customer-task
  // dedup is per-customer-pubkey, satisfying AC-3) — pinned by requiring
  // both tokens to appear in proximity to a `jobId` mention.
  assert(
    /jobId/.test(src),
    'Queue module does not reference `jobId` (AC-3/AC-5; ADR 0010 §Option A: Dedup). BullMQ-native ' +
      'idempotent dedup via Queue.add(name, data, { jobId }) is the chosen mechanism — without it, ' +
      'concurrent same-(taskName, pubkey) POSTs run twice.'
  );
  assert(
    /pubkey/i.test(src) && /taskName/.test(src),
    'Queue module does not reference both `taskName` and `pubkey` (AC-3/AC-5; ADR 0010 §Option A: Dedup). ' +
      'jobId must be ${taskName}:${pubkey} for customer tasks and ${taskName} alone for non-customer ' +
      'tasks; both branches need both tokens visible in the module.'
  );
});

test('T4: queue module consumes per-task concurrency configuration (AC-4, ADR 0010 §Option A: Per-task concurrency config)', () => {
  const src = readSafe(QUEUE_MODULE);
  assert(src !== null, 'Queue module missing — T2 must pass first.');
  // ADR specifies `defaultConcurrency` + `concurrencyByTask` map shape (config
  // file or brainstorm.conf section — Implementer's call). At minimum the
  // queue module must reference per-Worker concurrency derived from a config
  // source. Pin the `concurrency` token + at least one of the two config-shape
  // keys.
  assert(
    /\bconcurrency\b/.test(src),
    'Queue module does not reference `concurrency` (AC-4; ADR 0010 §Option A: Per-task concurrency ' +
      'config). Each Worker\'s concurrency must be resolved from a server-side config source; default 1 ' +
      'in phase 1, tunable per task.'
  );
  assert(
    /defaultConcurrency|concurrencyByTask/.test(src),
    'Queue module does not reference the ADR-specified config shape (`defaultConcurrency` or ' +
      '`concurrencyByTask`) (AC-4; ADR 0010 §Option A: Per-task concurrency config). The config file lives ' +
      'at /etc/brainstorm-task-queue.json (or a new section of brainstorm.conf — Implementer\'s choice); ' +
      'either way, the queue module is the consumer.'
  );
});

test('T5: processor module exists and invokes launchChildTask.sh (AC-6, ADR 0010 §New files)', () => {
  const src = readSafe(PROCESSOR_MODULE);
  assert(
    src !== null,
    'Processor module does not exist at src/manage/taskQueue/queue/processor.js (AC-6; ADR 0010 §New ' +
      'files). Create the per-task processor that the Worker invokes; it must spawn launchChildTask.sh ' +
      'the same way executeTask does today, preserving the pgrep guard and the LAUNCHCHILDTASK_RESULT ' +
      'stdout parse.'
  );
  assert(
    /launchChildTask\.sh/.test(src),
    'Processor module does not invoke launchChildTask.sh (AC-6; ADR 0010 §New files). The story is ' +
      'explicit: BullMQ jobs invoke the same launcher as today; the pgrep guard remains in place as ' +
      'belt-and-suspenders for phase 1.'
  );
});

test('T6: Redis container is configured with AOF persistence (appendonly yes, appendfsync everysec) (AC-10, ADR 0010 §Redis configuration)', () => {
  // ADR allows two acceptable patches: command: in docker-compose.yml OR a
  // mounted redis.conf. Either is fine; just need AOF flags reachable from
  // the redis service definition. Most direct: grep the compose file.
  const compose = readSafe(DOCKER_COMPOSE_YML);
  assert(compose !== null, 'docker-compose.yml not at expected path — re-baseline this sentinel.');
  // Look for either the CLI flag form (--appendonly yes) or the conf line
  // (appendonly yes), in the compose file OR a redis.conf alongside it.
  const composeHasAof = /(--)?appendonly\s+yes/.test(compose) && /(--)?appendfsync\s+everysec/.test(compose);
  let redisConfHasAof = false;
  for (const conf of ['docker/redis.conf', 'config/redis.conf']) {
    const s = readSafe(path.join(ROOT, conf));
    if (s && /appendonly\s+yes/.test(s) && /appendfsync\s+everysec/.test(s)) { redisConfHasAof = true; break; }
  }
  assert(
    composeHasAof || redisConfHasAof,
    'Redis is not configured with AOF persistence (AC-10; ADR 0010 §Redis configuration). Patch the ' +
      'tapestry-redis service\'s startup: either add `--appendonly yes --appendfsync everysec` to the ' +
      'service\'s `command:` in docker-compose.yml, or mount a redis.conf at docker/redis.conf containing ' +
      '`appendonly yes` + `appendfsync everysec`. Without AOF, queued jobs are lost on Redis restart.'
  );
});

test('T7: BullBoard is mounted at /admin/queues behind owner-only auth (AC-11, ADR 0010 §BullBoard mount)', () => {
  // ADR allows the mount to live in a dedicated bullBoardMount.js module OR
  // inline in api/index.js. Either is fine; both need to satisfy: path is
  // /admin/queues AND the route is guarded by requireOwnerOnly (or requireOwner).
  const mountModule = readSafe(BULLBOARD_MOUNT);
  const apiIndex = readSafe(API_INDEX_JS);
  assert(apiIndex !== null, 'src/api/index.js not at expected path — re-baseline this sentinel.');
  const candidates = [mountModule, apiIndex].filter(Boolean).join('\n');
  assert(
    /['"`]\/admin\/queues['"`]/.test(candidates),
    'BullBoard is not mounted at the path `/admin/queues` (AC-11; ADR 0010 §BullBoard mount). The ADR ' +
      'pins this canonical admin-operations path; either the dedicated bullBoardMount.js module or ' +
      'src/api/index.js must reference it.'
  );
  assert(
    /requireOwnerOnly|requireOwner/.test(candidates),
    'BullBoard route is not guarded by requireOwnerOnly or requireOwner (AC-11; ADR 0010 §BullBoard ' +
      'mount). retry / remove / pause on a live queue can damage running calculations; the mount must ' +
      'reuse the existing admin auth pattern (adminApi.requireOwnerOnly, per src/api/index.js:454).'
  );
});

test('T8: control-panel.js initializes the task queue at startup, gated on TASK_QUEUE_ENABLED (AC-12, AC-15, ADR 0010 §Edited files)', () => {
  const src = readSafe(CONTROL_PANEL_JS);
  assert(src !== null, 'bin/control-panel.js not at expected path — re-baseline this sentinel.');
  // ADR pins: at startup, after Redis session-store init, call initTaskQueue
  // (also gated on TASK_QUEUE_ENABLED). Both tokens must be visible.
  assert(
    /initTaskQueue|taskQueue/i.test(src),
    'bin/control-panel.js does not initialize the task queue module at startup (AC-12; ADR 0010 §Edited ' +
      'files). The in-process worker model requires the queue and Workers to be constructed during ' +
      'control-panel boot so they are ready when /api/run-task fires.'
  );
  assert(
    /TASK_QUEUE_ENABLED/.test(src),
    'bin/control-panel.js does not gate queue init on TASK_QUEUE_ENABLED (AC-15; ADR 0010 §Edited files). ' +
      'When the flag is false, the queue must not be constructed at all — that is the rollback path.'
  );
});

test('T9: docker/supervisord.conf does NOT gain a new entry for a separate task-queue worker process (AC-12, ADR 0010 §Decision)', () => {
  const src = readSafe(SUPERVISORD_CONF);
  assert(src !== null, 'docker/supervisord.conf not at expected path — re-baseline this sentinel.');
  // ADR §Decision: "no new supervisord entry in phase 1." Worker is
  // in-process within the existing control-panel. Pin the absence of any new
  // [program:...] section that mentions queue / worker / task / bull.
  const forbidden = /\[program:[^\]]*(queue|worker|bull|taskqueue)/i;
  assert(
    !forbidden.test(src),
    'docker/supervisord.conf appears to gain a new [program:...] entry for a queue/worker process (AC-12; ' +
      'ADR 0010 §Decision). The in-process worker model explicitly forbids a separate supervisord entry ' +
      'in phase 1. If you genuinely need to split it out later, that\'s a separate ADR.'
  );
});

test('T10: brainstorm.conf.template defines TASK_QUEUE_ENABLED=false as the default rollback-safe value (AC-15, ADR 0010 §Config)', () => {
  const src = readSafe(BRAINSTORM_CONF_T);
  assert(src !== null, 'config/brainstorm.conf.template not at expected path — re-baseline this sentinel.');
  // ADR §Config pins exactly this line. The default `false` is the deploy-
  // safe rollback — flipped on by the operator only after smoke confirms.
  assert(
    /export\s+TASK_QUEUE_ENABLED\s*=\s*false\b/.test(src),
    'config/brainstorm.conf.template does not define `export TASK_QUEUE_ENABLED=false` (AC-15; ADR 0010 ' +
      '§Config). The knob must be present in the template (deployment installs it at /etc/brainstorm.conf) ' +
      'with the deploy-safe `false` default. Operator flips on after smoke confirms.'
  );
});

test('T11: OPERATIONS.md documents the new env var, BullBoard URL, and the queue drain/pause workflow (AC-16, ADR 0010 §Documentation)', () => {
  const src = readSafe(OPERATIONS_MD);
  assert(src !== null, 'OPERATIONS.md not at expected path — re-baseline this sentinel.');
  const missing = [];
  if (!/TASK_QUEUE_ENABLED/.test(src)) missing.push('TASK_QUEUE_ENABLED');
  if (!/\/admin\/queues/.test(src)) missing.push('/admin/queues');
  if (!/(drain|pause)/i.test(src)) missing.push('drain / pause workflow');
  assert(
    missing.length === 0,
    'OPERATIONS.md is missing documentation for: ' + missing.join(', ') + ' (AC-16; ADR 0010 §Documentation). ' +
      'Operators need to know how to flip the flag, where to reach BullBoard, and how to drain or pause the ' +
      'queue for maintenance.'
  );
});

test('T12: runTask.js returns 503 with code QUEUE_UNAVAILABLE when the queue is enabled but Redis is unreachable (AC-17, ADR 0010 §Implementation notes)', () => {
  const src = readSafe(RUN_TASK_JS);
  assert(src !== null, 'src/api/manage/commands/runTask.js not at expected path — re-baseline this sentinel.');
  // ADR §Implementation notes specifies the literal error code so operators
  // and automated probes can identify this specific failure mode without
  // string-parsing.
  assert(
    /QUEUE_UNAVAILABLE/.test(src),
    'runTask.js does not return the QUEUE_UNAVAILABLE 503 path (AC-17; ADR 0010 §Implementation notes). ' +
      'When TASK_QUEUE_ENABLED=true and Redis is unreachable, the handler must return 503 with body ' +
      '`{success:false, error:"task queue (Redis) unreachable", code:"QUEUE_UNAVAILABLE"}` so the failure ' +
      'mode is machine-identifiable.'
  );
  assert(
    /\b503\b/.test(src),
    'runTask.js does not reference status code 503 (AC-17; ADR 0010 §Implementation notes). The Redis-' +
      'unreachable response must be 503 Service Unavailable so monitoring distinguishes it from 4xx ' +
      'client errors and 5xx unhandled exceptions.'
  );
});

test('T13: runTask.js branches on TASK_QUEUE_ENABLED at the top of the handler (AC-2, AC-15, ADR 0010 §Implementation notes)', () => {
  const src = readSafe(RUN_TASK_JS);
  assert(src !== null, 'runTask.js not at expected path — re-baseline this sentinel.');
  // Top-level branch is the rollback gate. When the flag is OFF the legacy
  // direct-spawn path runs unchanged; when ON the queue path runs. Pin the
  // existence of the conditional.
  assert(
    /TASK_QUEUE_ENABLED/.test(src),
    'runTask.js does not consult TASK_QUEUE_ENABLED (AC-2/AC-15; ADR 0010 §Implementation notes). The ' +
      'handler must branch on the feature flag — when true, delegate to the queue module; when false, ' +
      'run the existing direct-spawn path unchanged. That branch IS the rollback path.'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinels — PASS now AND post-implementation.
// ---------------------------------------------------------------------------

test('R1: runTask.js still accepts the existing query parameters (taskName, pubkey, customerId, customerName) (AC-1, regression guard)', () => {
  const src = readSafe(RUN_TASK_JS);
  assert(src !== null, 'runTask.js missing — re-baseline this sentinel.');
  // AC-1: signature unchanged. The handler still extracts these names from
  // req.query. Implementer must preserve this contract regardless of branch.
  for (const param of ['taskName', 'pubkey', 'customerId', 'customerName']) {
    assert(
      src.includes(param),
      'R1: runTask.js no longer references query parameter `' + param + '` — the /api/run-task signature ' +
        'contract from AC-1 has been broken. Existing UIs (Scheduled Tasks tab, Legacy Task Explorer, ' +
        'systemd timers) all depend on these names.'
    );
  }
});

test('R2: scheduled-tasks/index.js still POSTs to /api/run-task (AC-7, AC-8, regression guard)', () => {
  const src = readSafe(SCHEDULED_TASKS);
  assert(src !== null, 'scheduled-tasks/index.js missing — re-baseline this sentinel.');
  // AC-7: existing UIs work unchanged. The scheduler must continue to hit
  // /api/run-task as today; the queue layer is invisible to it.
  assert(
    /\/api\/run-task/.test(src),
    'R2: scheduled-tasks/index.js no longer references /api/run-task (AC-7/AC-8; regression). The phase-1 ' +
      'design preserves the contract — scheduler hits /api/run-task; that endpoint enqueues; everything ' +
      'downstream is invisible to the caller. Migrating the scheduler off /api/run-task is a phase-2 story.'
  );
});

test('R3: runTask.js still uses determineExecutionMode for the sync-vs-async branch (AC-13, regression guard)', () => {
  const src = readSafe(RUN_TASK_JS);
  assert(src !== null, 'runTask.js missing — re-baseline this sentinel.');
  // AC-13: sync vs async preservation. determineExecutionMode is the existing
  // arbiter; the queue wrappers (runViaQueueSync / runViaQueueAsync) branch
  // on its output. Removing this import would break the existing sync-task UX.
  assert(
    /determineExecutionMode/.test(src),
    'R3: runTask.js no longer uses determineExecutionMode (AC-13; regression). The sync-vs-async ' +
      'branching arbiter must remain in place; both the legacy direct-spawn path AND the new queue path ' +
      'branch on its output. Removing it would break sync-task response shapes that UIs depend on.'
  );
  assert(
    /resolveTaskTimeout/.test(src),
    'R3: runTask.js no longer uses resolveTaskTimeout (AC-13; regression). Timeout resolution is shared ' +
      'between the legacy path and the queue path — both consume the same per-task timeout config.'
  );
});

test('R4: launchChildTask.sh still implements its pgrep-based same-task serialization guard (AC-6, regression guard)', () => {
  const src = readSafe(LAUNCH_CHILD_TASK);
  assert(src !== null, 'launchChildTask.sh missing — re-baseline this sentinel.');
  // AC-6: pgrep guard remains as belt-and-suspenders this phase. ADR §Out of
  // scope is explicit: "Removing the pgrep guard from launchChildTask.sh —
  // keep until BullMQ behavior is proven in production over multiple recalc
  // cycles." R4 trips if the Implementer prematurely retires it.
  assert(
    /pgrep\s+-f/.test(src),
    'R4: launchChildTask.sh no longer invokes `pgrep -f` (AC-6; regression). The pgrep guard is the ' +
      'phase-1 safety net behind the BullMQ jobId dedup. ADR §Out of scope explicitly defers its removal ' +
      'until BullMQ behavior is proven over multiple recalc cycles. Do not remove it now.'
  );
});

test('R5: strfry-stream-consumer still uses ioredis blpop on `strfry:events` (AC-10, regression guard)', () => {
  const src = readSafe(REDIS_CONSUMER);
  assert(src !== null, 'src/pipeline/stream/redis-consumer.js missing — re-baseline this sentinel.');
  // AC-10: Architect verifies AOF persistence has no adverse interaction
  // with the strfry-stream-consumer. The consumer's contract is the existing
  // blpop-on-`strfry:events` pattern; AOF persistence doesn\'t change blpop
  // semantics — but R5 trips if the Implementer accidentally refactors this
  // consumer (out of scope) while patching Redis.
  assert(
    /blpop/i.test(src) && /strfry:events/.test(src),
    'R5: redis-consumer.js no longer uses blpop on `strfry:events` (AC-10; regression). AOF persistence ' +
      'must not change the strfry-stream-consumer\'s contract — that consumer is out of scope for this ' +
      'story; do not touch it.'
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
