/**
 * Task Queue — BullMQ-backed dispatcher behind /api/run-task.
 * Story #13 / ADR 0010.
 *
 * Module owns:
 *   - One BullMQ Queue + one Worker per task in the registry (per-task topology).
 *   - A single shared ioredis connection (BullMQ best-practice for many queues).
 *   - BullMQ-native jobId-based dedup: (taskName, pubkey) for customer tasks,
 *     taskName alone for non-customer tasks.
 *   - Per-task concurrency from /etc/brainstorm-task-queue.json (with sane
 *     defaultConcurrency fallback). When the file is absent, every task runs
 *     concurrency = 1 (phase-1 safe default).
 *   - The sync/async wrappers (`runViaQueueSync` / `runViaQueueAsync`) that
 *     preserve the response shapes today's runTask.js returns.
 *
 * This module is feature-gated by TASK_QUEUE_ENABLED in /etc/brainstorm.conf.
 * When the flag is off, this module is never `require`d at runtime — the
 * legacy direct-spawn path in runTask.js runs unchanged. That is the rollback
 * path per the ADR.
 */

const fs = require('fs');
const path = require('path');
const { Queue, Worker, QueueEvents } = require('bullmq');
const Redis = require('ioredis');
const brainstormConfig = require('../../../utils/brainstormConfig');
const processor = require('./processor');
const resourceSemaphore = require('./resourceSemaphore');

const QUEUE_CONFIG_PATH = '/etc/brainstorm-task-queue.json';
const DEFAULT_QUEUE_CONFIG = { defaultConcurrency: 1, concurrencyByTask: {} };

// Module-level state. Initialized exactly once by initTaskQueue.
let _state = null;

function loadQueueConfig() {
  try {
    if (fs.existsSync(QUEUE_CONFIG_PATH)) {
      const raw = JSON.parse(fs.readFileSync(QUEUE_CONFIG_PATH, 'utf8'));
      return { ...DEFAULT_QUEUE_CONFIG, ...raw, concurrencyByTask: { ...DEFAULT_QUEUE_CONFIG.concurrencyByTask, ...(raw.concurrencyByTask || {}) } };
    }
  } catch (e) {
    console.warn(`[task-queue] Failed to load ${QUEUE_CONFIG_PATH}, using defaults: ${e.message}`);
  }
  return { ...DEFAULT_QUEUE_CONFIG };
}

function createRedisConnection() {
  const host = process.env.REDIS_HOST || brainstormConfig.get('REDIS_HOST') || 'redis';
  const port = parseInt(process.env.REDIS_PORT || brainstormConfig.get('REDIS_PORT') || '6379', 10);
  // BullMQ requires maxRetriesPerRequest: null (per BullMQ docs).
  return new Redis({ host, port, maxRetriesPerRequest: null });
}

/**
 * Compute the BullMQ jobId for dedup.
 *   - Customer task: `${taskName}:${pubkey}` — concurrent submissions for the
 *     same customer dedup to one execution.
 *   - Non-customer task: `${taskName}` — at most one of this task in
 *     wait/active at a time.
 *
 * Exported for testability.
 */
function computeJobId(taskName, customerArgs) {
  if (customerArgs && customerArgs.pubkey) {
    return `${taskName}:${customerArgs.pubkey}`;
  }
  return taskName;
}

/**
 * Initialize the task queue.
 * Idempotent — calling twice is a no-op (returns the existing state).
 * Gated by the caller; runTask.js and control-panel.js both check
 * TASK_QUEUE_ENABLED before calling this.
 */
async function initTaskQueue({ registry } = {}) {
  if (_state) return _state;

  if (!registry) {
    const registryPath = path.join(
      brainstormConfig.get('BRAINSTORM_MODULE_MANAGE_DIR'),
      'taskQueue/taskRegistry.json'
    );
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  }

  const queueConfig = loadQueueConfig();
  const redis = createRedisConnection();

  // Construct the cross-task resource-class semaphore (story #15 / ADR 0013).
  // When resourceClassCaps is empty/missing, only tagged tasks (those with
  // taskDef.resourceClass set) hit the wrap below — untagged tasks call the
  // processor directly with no overhead, no behavior change vs story #13.
  const semaphore = resourceSemaphore.createSemaphore(
    redis,
    queueConfig.resourceClassCaps || {}
  );

  const queues = new Map();
  const workers = new Map();
  const queueEvents = new Map();

  for (const taskName of Object.keys(registry.tasks || {})) {
    const queue = new Queue(taskName, { connection: redis });
    queues.set(taskName, queue);

    const concurrency =
      (queueConfig.concurrencyByTask && queueConfig.concurrencyByTask[taskName]) ||
      queueConfig.defaultConcurrency;

    const taskDef = registry.tasks[taskName];
    const resourceClass = taskDef && taskDef.resourceClass;

    // Conditional Worker-callback wrap. Tagged tasks acquire the resource-
    // class semaphore before processor.processJob runs; untagged tasks call
    // the processor directly (story #13 behavior unchanged).
    const workerFn = resourceClass
      ? async (job) => {
          const release = await semaphore.acquire(resourceClass, {
            taskName,
            target: (job && job.data && job.data.customerArgs && job.data.customerArgs.pubkey) || '',
            jobId: job && job.id
          });
          try {
            return await processor.processJob(job, taskDef);
          } finally {
            await release();
          }
        }
      : async (job) => processor.processJob(job, taskDef);

    const worker = new Worker(taskName, workerFn, { connection: redis, concurrency });
    worker.on('failed', (job, err) => {
      console.error(`[task-queue] Worker for ${taskName} failed job ${job && job.id}: ${err && err.message}`);
    });
    workers.set(taskName, worker);

    queueEvents.set(taskName, new QueueEvents(taskName, { connection: redis }));
  }

  _state = { redis, queues, workers, queueEvents, registry, queueConfig, semaphore };
  console.log(
    `[task-queue] Initialized ${queues.size} queues + workers ` +
    `(defaultConcurrency=${queueConfig.defaultConcurrency}, ` +
    `resourceClasses=${Object.keys(queueConfig.resourceClassCaps || {}).join(',') || 'none'})`
  );
  return _state;
}

/**
 * Cheap Redis ping. runTask.js calls this before enqueueing so it can return
 * a 503 with code QUEUE_UNAVAILABLE if Redis is unreachable (AC-17).
 */
async function isQueueAvailable() {
  if (!_state) return false;
  try {
    const pong = await _state.redis.ping();
    return pong === 'PONG';
  } catch (e) {
    console.warn(`[task-queue] Redis ping failed: ${e.message}`);
    return false;
  }
}

function getQueue(taskName) {
  if (!_state) throw new Error('Task queue not initialized');
  return _state.queues.get(taskName);
}

function getAllQueues() {
  if (!_state) return [];
  return Array.from(_state.queues.values());
}

/**
 * Enqueue a task. Returns the BullMQ Job. Idempotent on jobId while the
 * previous attempt is in `wait` or `active` — concurrent submissions for
 * the same (taskName, pubkey) join one execution. Once the previous attempt
 * finalizes (completed or failed), the next submission with the same jobId
 * creates a fresh execution.
 *
 * The wait/active-only dedup window is enforced by passing
 * `removeOnComplete: true` and `removeOnFail: true` on every add: these
 * map to BullMQ's `{count: 0}` keepJobs semantics, which deletes the per-
 * job Redis hash as part of finalization. With the hash gone, `queue.add`
 * with the same jobId finds nothing in any state and creates a fresh job.
 * See ADR 0022 (story #25) for the full rationale and the empirical probe.
 */
async function enqueueTask({ taskName, customerArgs, queryParams, timeoutMs }) {
  const queue = getQueue(taskName);
  if (!queue) throw new Error(`Unknown task: ${taskName}`);
  const jobId = computeJobId(taskName, customerArgs);
  const data = { taskName, customerArgs, queryParams, timeoutMs };
  return queue.add(taskName, data, {
    jobId,
    removeOnComplete: true,
    removeOnFail: true,
  });
}

/**
 * Sync wrapper — enqueues, then awaits the job's completion up to timeoutMs.
 * Preserves the response shape today's runTask.js sync path returns.
 */
async function runViaQueueSync({ taskName, customerArgs, queryParams, timeoutMs }) {
  const job = await enqueueTask({ taskName, customerArgs, queryParams, timeoutMs });
  const queueEvents = _state.queueEvents.get(taskName);
  const startTime = new Date().toISOString();
  try {
    const result = await job.waitUntilFinished(queueEvents, timeoutMs);
    return {
      success: !!result && result.success !== false,
      taskName,
      executionMode: 'sync',
      jobId: job.id,
      pid: result && result.pid ? result.pid : null,
      startTime,
      timestamp: new Date().toISOString(),
      execution: result
    };
  } catch (e) {
    return {
      success: false,
      taskName,
      executionMode: 'sync',
      jobId: job.id,
      pid: null,
      startTime,
      timestamp: new Date().toISOString(),
      error: e && e.message ? e.message : String(e)
    };
  }
}

/**
 * Async wrapper — enqueues and returns immediately with a "queued" response.
 * Preserves the response shape today's runTask.js async path returns
 * (with `jobId` added; legacy `pid: null` so existing parsers don't break).
 */
async function runViaQueueAsync({ taskName, customerArgs, queryParams, timeoutMs }) {
  const job = await enqueueTask({ taskName, customerArgs, queryParams, timeoutMs });
  const minutes = timeoutMs ? Math.round(timeoutMs / 60000) : null;
  return {
    success: true,
    taskName,
    executionMode: 'async',
    queued: true,
    jobId: job.id,
    pid: null,
    status: 'queued',
    timestamp: new Date().toISOString(),
    statusMessage: 'Task enqueued via BullMQ. Check /admin/queues or Task Explorer for progress.',
    estimatedDuration: minutes ? `${minutes} minutes` : 'unknown'
  };
}

/**
 * Graceful shutdown. Closes all Workers + Queues + the shared Redis
 * connection. Called from control-panel.js's SIGTERM/SIGINT handlers.
 */
async function closeTaskQueue() {
  if (!_state) return;
  const { workers, queues, queueEvents, redis } = _state;
  await Promise.all(Array.from(workers.values()).map(w => w.close().catch(() => {})));
  await Promise.all(Array.from(queues.values()).map(q => q.close().catch(() => {})));
  await Promise.all(Array.from(queueEvents.values()).map(qe => qe.close().catch(() => {})));
  await redis.quit().catch(() => {});
  _state = null;
}

module.exports = {
  initTaskQueue,
  closeTaskQueue,
  isQueueAvailable,
  enqueueTask,
  runViaQueueSync,
  runViaQueueAsync,
  getQueue,
  getAllQueues,
  computeJobId
};
