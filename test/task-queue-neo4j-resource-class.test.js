/**
 * Story #15 / ADR 0013 — Cross-task Neo4j-heavy serialization via Redis-backed
 * counted semaphore.
 *
 * Source/structural sentinels pin the ADR-required code shape. The behavioral
 * round-trip — actually triggering two `neo4j-heavy`-tagged tasks back-to-back
 * with the queue flag on, observing the second wait via `events.jsonl`
 * `resource_class_wait_*` phase tokens, and confirming the timeout-failure
 * mode — is reproducible only against the live Docker stack with deps
 * installed and is the **authoritative cycle-local smoke** (Reviewer-required,
 * per project precedent #5/#6/#8/#10/#11/#12/#13).
 *
 * T1..T10 : FAIL pre-implementation, PASS post.
 * R1..R4  : PASS pre AND post — regression guards on story #13's per-task
 *           queue topology, the processor.processJob entry point, the
 *           feature-flag branch + 503 path, and the BullBoard mount.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const STRUCTURED_EVENTS  = path.join(ROOT, 'src/utils/structuredEvents.js');
const RESOURCE_SEMAPHORE = path.join(ROOT, 'src/manage/taskQueue/queue/resourceSemaphore.js');
const QUEUE_INDEX        = path.join(ROOT, 'src/manage/taskQueue/queue/index.js');
const QUEUE_PROCESSOR    = path.join(ROOT, 'src/manage/taskQueue/queue/processor.js');
const BULLBOARD_MOUNT    = path.join(ROOT, 'src/manage/taskQueue/queue/bullBoardMount.js');
const RUN_TASK_JS        = path.join(ROOT, 'src/api/manage/commands/runTask.js');
const TASK_REGISTRY      = path.join(ROOT, 'src/manage/taskQueue/taskRegistry.json');
const OPERATIONS_MD      = path.join(ROOT, 'OPERATIONS.md');

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

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once Story #15 is implemented per ADR 0013.
// ---------------------------------------------------------------------------

test('T1: src/utils/structuredEvents.js exists and exports emitTaskEvent (ADR 0013 §New files; PO refinement)', () => {
  const src = readSafe(STRUCTURED_EVENTS);
  assert(
    src !== null,
    'Node-side structured-events helper does not exist at src/utils/structuredEvents.js (ADR 0013 §New ' +
      'files). Create the Node equivalent of bash emit_task_event (from src/utils/structuredLogging.sh) so ' +
      'queue-side events land in events.jsonl alongside bash-emitted events — PO-resolved to invest now ' +
      'rather than defer to console.log + a future cleanup.'
  );
  assert(
    /\bemitTaskEvent\b/.test(src),
    'src/utils/structuredEvents.js does not export emitTaskEvent (ADR 0013 §New files). The function ' +
      'signature must match bash emit_task_event: (eventType, taskName, target, metadata).'
  );
  assert(
    /module\.exports/.test(src),
    'src/utils/structuredEvents.js is missing module.exports (ADR 0013 §New files). The module is a ' +
      'CommonJS-style helper — must export emitTaskEvent for require() callers.'
  );
});

test('T2: structuredEvents.js writes JSONL to taskQueue/events.jsonl using sync atomic append (ADR 0013 §New files)', () => {
  const src = readSafe(STRUCTURED_EVENTS);
  assert(src !== null, 'structuredEvents.js missing — T1 must pass first.');
  // ADR pins: write to `${BRAINSTORM_LOG_DIR}/taskQueue/events.jsonl` matching
  // the bash version's path; use appendFileSync for line-atomic writes (under
  // PIPE_BUF on Linux).
  assert(
    /events\.jsonl/.test(src),
    'structuredEvents.js does not target events.jsonl (ADR 0013 §New files). Writes must land in the ' +
      'same path bash emit_task_event uses: ${BRAINSTORM_LOG_DIR}/taskQueue/events.jsonl. Anything else ' +
      'forks the structured-event stream — which is the exact thing this helper exists to avoid.'
  );
  assert(
    /appendFileSync/.test(src),
    'structuredEvents.js does not use fs.appendFileSync (ADR 0013 §New files). Sync append is required for ' +
      'line-atomic concurrent writes under PIPE_BUF (4 KB on Linux). Async appendFile interleaves under ' +
      'concurrent writes and corrupts JSONL lines.'
  );
  assert(
    /BRAINSTORM_LOG_DIR/.test(src),
    'structuredEvents.js does not consult BRAINSTORM_LOG_DIR (ADR 0013 §New files). The base path must ' +
      'come from brainstormConfig.get(\'BRAINSTORM_LOG_DIR\'), matching the bash version\'s configurable ' +
      'log root.'
  );
});

test('T3: resourceSemaphore.js exists at the ADR-specified path and exports createSemaphore (AC-1, AC-2; ADR 0013 §New files)', () => {
  const src = readSafe(RESOURCE_SEMAPHORE);
  assert(
    src !== null,
    'Resource-semaphore module does not exist at src/manage/taskQueue/queue/resourceSemaphore.js (AC-1, ' +
      'AC-2; ADR 0013 §New files). Create the module that owns cross-task serialization via a Redis-backed ' +
      'counted semaphore with TTL leases.'
  );
  assert(
    /\bcreateSemaphore\b/.test(src),
    'resourceSemaphore.js does not export createSemaphore factory (AC-1, AC-2; ADR 0013 §New files). The ' +
      'ADR pins the public surface: createSemaphore(redis, caps, options?) returns an instance with ' +
      '.acquire(resourceClass) → Promise<release>.'
  );
});

test('T4: resourceSemaphore.js uses Redis-side Lua atomicity for check+set+sweep (AC-2; ADR 0013 §Option A)', () => {
  const src = readSafe(RESOURCE_SEMAPHORE);
  assert(src !== null, 'resourceSemaphore.js missing — T3 must pass first.');
  // ADR pins: atomic check+set via Lua script (one Redis round-trip). Either
  // ioredis defineCommand OR raw eval/evalsha is acceptable; both put Lua on
  // the wire. Without Lua atomicity, the check-then-set race re-introduces
  // the very contention the story aims to eliminate.
  assert(
    /defineCommand|\beval\b|evalsha/.test(src),
    'resourceSemaphore.js does not use Redis Lua scripting (AC-2; ADR 0013 §Option A). Atomic check+set ' +
      '(sweep-expired-leases, check HLEN < cap, HSET on success) must happen in a single Redis round-trip ' +
      'via Lua — otherwise two concurrent acquires can both observe HLEN < cap and both HSET, exceeding the ' +
      'cap. Use ioredis defineCommand or raw eval to register/invoke the Lua script.'
  );
  // ADR pins the data model: Redis hash mapping leaseId → expiresAtMs.
  assert(
    /HSET|HDEL|HLEN/i.test(src),
    'resourceSemaphore.js does not use Redis HASH operations (HSET / HDEL / HLEN) (AC-2; ADR 0013 §Option ' +
      'A). The per-class state model is a hash mapping leaseId → expiresAtMs — HSET on acquire, HDEL on ' +
      'release, HLEN for the cap check.'
  );
});

test('T5: resourceSemaphore.js carries the RESOURCE_CLASS_WAIT_TIMEOUT error code literal (AC-2; ADR 0013 §Decision)', () => {
  const src = readSafe(RESOURCE_SEMAPHORE);
  assert(src !== null, 'resourceSemaphore.js missing — T3 must pass first.');
  // ADR pins the exact error-code string so operators and automated probes
  // can identify the timeout-failure mode without string-parsing arbitrary
  // error messages.
  assert(
    /RESOURCE_CLASS_WAIT_TIMEOUT/.test(src),
    'resourceSemaphore.js does not carry the literal RESOURCE_CLASS_WAIT_TIMEOUT error code (AC-2; ADR ' +
      '0013 §Decision). When acquire() exceeds acquireTimeoutMs, reject with an Error whose .code === ' +
      '\'RESOURCE_CLASS_WAIT_TIMEOUT\'. Operators rely on this literal for monitoring and BullBoard ' +
      'failure-tab triage.'
  );
});

test('T6: resourceSemaphore.js emits structured events via emitTaskEvent (not console.log) (AC-7; ADR 0013 §Observability)', () => {
  const src = readSafe(RESOURCE_SEMAPHORE);
  assert(src !== null, 'resourceSemaphore.js missing — T3 must pass first.');
  // PO refined the ADR at draft review: invest now in the Node-side
  // emit_task_event equivalent rather than console.log. resourceSemaphore.js
  // is the first consumer.
  assert(
    /emitTaskEvent|structuredEvents/.test(src),
    'resourceSemaphore.js does not call emitTaskEvent (AC-7; ADR 0013 §Observability). The wait-begin / ' +
      'wait-end / released phase events must land in events.jsonl alongside bash-emitted events, not in ' +
      'plain console.log. Import { emitTaskEvent } from \'../../../utils/structuredEvents\' and emit ' +
      'PROGRESS / TASK_ERROR events as the ADR specifies.'
  );
  // ADR pins the three phase tokens.
  for (const phase of ['resource_class_wait_begin', 'resource_class_wait_end', 'resource_class_released']) {
    assert(
      src.includes(phase),
      'resourceSemaphore.js does not emit the `' + phase + '` phase token (AC-7; ADR 0013 §Observability). ' +
        'Operators answer "why hasn\'t my task started?" by greping events.jsonl for these literals; ' +
        'they must appear in the source.'
    );
  }
});

test('T7: queue/index.js constructs the semaphore and wraps the Worker callback conditionally on taskDef.resourceClass (AC-1, AC-4; ADR 0013 §Edited files)', () => {
  const src = readSafe(QUEUE_INDEX);
  assert(src !== null, 'queue/index.js missing — story #13 should have shipped it; re-baseline this sentinel.');
  // ADR pins: createSemaphore is called inside initTaskQueue, and the Worker
  // callback wraps processor.processJob in an acquire/release pair when
  // taskDef.resourceClass is truthy. Both tokens must appear.
  assert(
    /resourceSemaphore|createSemaphore/.test(src),
    'queue/index.js does not reference the semaphore module (AC-1, AC-4; ADR 0013 §Edited files). The ' +
      'Worker construction loop must import and call createSemaphore so per-class caps are enforced ' +
      'before processor.processJob runs.'
  );
  assert(
    /resourceClass/.test(src),
    'queue/index.js does not branch on taskDef.resourceClass (AC-1, AC-4; ADR 0013 §Edited files). Tagged ' +
      'tasks must be wrapped with semaphore.acquire / release; untagged tasks must call processor.processJob ' +
      'directly (no wrapping overhead, no behavior change vs story #13).'
  );
  assert(
    /\bacquire\b/.test(src) && /\brelease\b/.test(src),
    'queue/index.js does not invoke semaphore acquire/release in the Worker callback (AC-1, AC-4; ADR ' +
      '0013 §Edited files). The ADR pins the wrap shape: `const release = await semaphore.acquire(rc); ' +
      'try { return await processor.processJob(job, taskDef); } finally { await release(); }`.'
  );
});

test('T8: queue/index.js consumes queueConfig.resourceClassCaps from the existing brainstorm-task-queue.json (AC-3; ADR 0013 §Config)', () => {
  const src = readSafe(QUEUE_INDEX);
  assert(src !== null, 'queue/index.js missing — re-baseline this sentinel.');
  // ADR pins: extend story #13's /etc/brainstorm-task-queue.json with a
  // sibling `resourceClassCaps` key. queue/index.js (which already loads
  // queueConfig in story #13) must pass this map to createSemaphore.
  assert(
    /resourceClassCaps/.test(src),
    'queue/index.js does not consume queueConfig.resourceClassCaps (AC-3; ADR 0013 §Config). The per-class ' +
      'cap configuration extends story #13\'s /etc/brainstorm-task-queue.json — same file, sibling key. ' +
      'Pass queueConfig.resourceClassCaps to createSemaphore so operators tune caps in one config surface.'
  );
});

test('T9: taskRegistry.json owner trio is tagged "resourceClass": "neo4j-heavy" (AC-6; ADR 0013 §Implementation notes)', () => {
  const r = readJsonSafe(TASK_REGISTRY);
  assert(r !== null && r.tasks, 'taskRegistry.json missing or malformed — re-baseline this sentinel.');
  for (const taskName of ['calculateOwnerHops', 'calculateOwnerPageRank', 'calculateOwnerGrapeRank']) {
    const entry = r.tasks[taskName];
    assert(
      entry,
      'taskRegistry.json has no entry for `' + taskName + '` — re-baseline this sentinel (the registry may ' +
        'have changed since ADR 0013 was drafted).'
    );
    assert(
      entry.resourceClass === 'neo4j-heavy',
      'taskRegistry.json entry for `' + taskName + '` is not tagged with "resourceClass": "neo4j-heavy" (AC-6; ' +
        'ADR 0013 §Implementation notes). This is the initial tag set the operator demonstrated the pain ' +
        'with on brainstorm.world (calculateOwnerGrapeRank + calculateOwnerPageRank running concurrently ' +
        'post-story-#13). Add the tag at the top level of the entry, alongside `name`, `script`, etc.'
    );
  }
});

test('T10: OPERATIONS.md §10.6 documents the resource-class config + phase tokens (AC-7; ADR 0013 §Documentation)', () => {
  const src = readSafe(OPERATIONS_MD);
  assert(src !== null, 'OPERATIONS.md missing — re-baseline this sentinel.');
  const missing = [];
  if (!/resourceClass/.test(src)) missing.push('the `resourceClass` registry field');
  if (!/resourceClassCaps/.test(src)) missing.push('the `resourceClassCaps` config key');
  if (!/neo4j-heavy/.test(src)) missing.push('the `neo4j-heavy` class name');
  if (!/resource_class_wait_begin|resource_class_wait_end|resource_class_released/.test(src)) {
    missing.push('the resource_class_wait_begin/wait_end/released phase tokens');
  }
  assert(
    missing.length === 0,
    'OPERATIONS.md does not document: ' + missing.join(', ') + ' (AC-7; ADR 0013 §Documentation). ' +
      'Add §10.6 covering: (1) the `resourceClass` registry field + how to tag a new task; (2) the ' +
      '`resourceClassCaps` config key in /etc/brainstorm-task-queue.json; (3) the initial neo4j-heavy:1 cap ' +
      'and the owner-trio tag set; (4) the three structured-event phase tokens operators grep ' +
      'events.jsonl for; (5) the RESOURCE_CLASS_WAIT_TIMEOUT failure mode.'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinels — PASS now AND post-implementation.
// ---------------------------------------------------------------------------

test('R1: queue/index.js still constructs per-task Queue + Worker per registry task (story #13 topology preserved, AC-5)', () => {
  const src = readSafe(QUEUE_INDEX);
  assert(src !== null, 'queue/index.js missing — re-baseline this sentinel.');
  // Story #13's per-task queue topology must survive. R1 trips if the
  // Implementer refactors the per-task loop into something else while
  // wiring in the semaphore.
  assert(
    /new Queue\(/.test(src) && /new Worker\(/.test(src),
    'R1: queue/index.js no longer instantiates per-task BullMQ Queue + Worker (AC-5; story #13 / ADR 0012 ' +
      'topology regression). The semaphore wrapper is ADDITIVE — it composes with the existing per-task ' +
      'concurrency, it does not replace it.'
  );
  assert(
    /for\s*\(/.test(src) || /Object\.keys/.test(src),
    'R1: queue/index.js no longer iterates the task registry to create per-task queues (story #13 ' +
      'topology regression). The 51-task enumeration must remain — the semaphore is an additional wrap, ' +
      'not a topology change.'
  );
});

test('R2: processor.js still exports processJob (NOT process, story #13 blocker-fix preserved)', () => {
  const src = readSafe(QUEUE_PROCESSOR);
  assert(src !== null, 'processor.js missing — re-baseline this sentinel.');
  // Story #13 review found that `function process(...)` shadows the Node
  // global; fix renamed it to `processJob`. R2 trips if the Implementer ever
  // reverts that rename. The shadow bug would silently break the spawn\'s
  // env inheritance — same risk reappears.
  assert(
    /\bprocessJob\b/.test(src),
    'R2: processor.js no longer references processJob (story #13 blocker-fix regression). The function ' +
      'rename from `process` → `processJob` resolved the Node global-shadow bug that broke every queued ' +
      'job\'s spawn env. Do NOT revert this rename — see the explanatory comment above the function.'
  );
  // Also pin that the dangerous original name is NOT a function declaration.
  assert(
    !/^function\s+process\s*\(/m.test(src) && !/\bfunction\s+process\s*\(/.test(src),
    'R2: processor.js declares `function process(...)` again (story #13 blocker-fix regression). This ' +
      'shadows Node\'s global `process`, breaking the spawn\'s env inheritance. Rename to processJob (or ' +
      'similar non-shadowing name) per ADR 0012.'
  );
});

test('R3: runTask.js feature-flag branch + 503 QUEUE_UNAVAILABLE preserved (story #13 / ADR 0012 contract)', () => {
  const src = readSafe(RUN_TASK_JS);
  assert(src !== null, 'runTask.js missing — re-baseline this sentinel.');
  assert(
    /TASK_QUEUE_ENABLED/.test(src) && /QUEUE_UNAVAILABLE/.test(src),
    'R3: runTask.js no longer carries the TASK_QUEUE_ENABLED branch or QUEUE_UNAVAILABLE 503 code (story ' +
      '#13 / ADR 0012 regression). Story #15 is purely additive over story #13; the feature-flag rollback ' +
      'path and the Redis-down failure mode must remain intact.'
  );
});

test('R4: BullBoard mount module still exists and references /admin/queues + requireOwnerOnly (story #13 / ADR 0012 contract)', () => {
  const mount = readSafe(BULLBOARD_MOUNT);
  assert(mount !== null, 'bullBoardMount.js missing — re-baseline this sentinel.');
  assert(
    /['"`]\/admin\/queues['"`]/.test(mount),
    'R4: bullBoardMount.js no longer references the canonical /admin/queues path (story #13 / ADR 0012 ' +
      'regression). The mount path is part of the operator-facing contract; do not change it as a side ' +
      'effect of story #15.'
  );
  assert(
    /requireOwnerOnly|requireOwner/.test(mount),
    'R4: bullBoardMount.js no longer references the owner-only auth gate (story #13 / ADR 0012 ' +
      'regression). retry / remove / pause controls remain capable of affecting in-flight calculations; the ' +
      'gate stays.'
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
