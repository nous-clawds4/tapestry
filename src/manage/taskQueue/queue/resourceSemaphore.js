/**
 * Resource Semaphore — cross-task concurrency control for the BullMQ task queue.
 * Story #15 / ADR 0013.
 *
 * Per-class state lives in a Redis hash keyed by leaseId → expiresAtMs at
 *   `taskQueue:resource-class:<className>:holders`
 *
 * Acquire is atomic via a Lua script that (1) sweeps expired leases, (2)
 * checks HLEN < cap, (3) HSETs a fresh lease on success. Single Redis
 * round-trip per attempt.
 *
 * Wait loop: poll at pollIntervalMs (default 500 ms) until acquire returns 1
 * OR the hard timeout (default 4 hours) elapses → reject with an Error whose
 * `.code === 'RESOURCE_CLASS_WAIT_TIMEOUT'`.
 *
 * Crash safety: TTL leases. If a Worker dies without releasing, its lease
 * ages out at `leaseTtlMs` (default 4 hours) and the next acquirer sweeps it
 * automatically.
 *
 * Observability: emits structured events to events.jsonl via the Node-side
 * emit_task_event helper at src/utils/structuredEvents.js, with phase tokens:
 *   - resource_class_wait_begin    (waiter starts polling)
 *   - resource_class_wait_end      (wait resolved — outcome: "acquired" | "timeout")
 *   - resource_class_released      (lease released — held_seconds)
 */

const crypto = require('crypto');
const { emitTaskEvent } = require('../../../utils/structuredEvents');

const DEFAULT_LEASE_TTL_MS = 4 * 60 * 60 * 1000;        // 4 hours
const DEFAULT_POLL_INTERVAL_MS = 500;                    // 0.5 s
const DEFAULT_ACQUIRE_TIMEOUT_MS = 4 * 60 * 60 * 1000;   // 4 hours

// Atomic Lua script: sweep expired leases, then check HLEN < cap, then HSET.
// Returns 1 if a slot was acquired, 0 if denied.
const ACQUIRE_LUA = `
local fields = redis.call('HGETALL', KEYS[1])
for i = 1, #fields, 2 do
  if tonumber(fields[i+1]) < tonumber(ARGV[4]) then
    redis.call('HDEL', KEYS[1], fields[i])
  end
end
local current = redis.call('HLEN', KEYS[1])
if current < tonumber(ARGV[2]) then
  redis.call('HSET', KEYS[1], ARGV[1], tonumber(ARGV[4]) + tonumber(ARGV[3]))
  return 1
end
return 0
`;

function holdersKey(resourceClass) {
  return `taskQueue:resource-class:${resourceClass}:holders`;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Factory. Returns a semaphore instance bound to the given ioredis client and
 * per-class caps map.
 *
 * @param {import('ioredis').Redis} redis    shared ioredis connection
 * @param {Object<string, number>} caps      per-class concurrency caps; e.g., { "neo4j-heavy": 1 }
 * @param {Object} [options]                 { leaseTtlMs, pollIntervalMs, acquireTimeoutMs }
 */
function createSemaphore(redis, caps, options) {
  const opts = options || {};
  const leaseTtlMs       = opts.leaseTtlMs       || DEFAULT_LEASE_TTL_MS;
  const pollIntervalMs   = opts.pollIntervalMs   || DEFAULT_POLL_INTERVAL_MS;
  const acquireTimeoutMs = opts.acquireTimeoutMs || DEFAULT_ACQUIRE_TIMEOUT_MS;

  // Register the Lua script as a custom ioredis command. Single registration
  // up front; each call invokes via the EVALSHA fast path.
  redis.defineCommand('semaphoreAcquire', {
    numberOfKeys: 1,
    lua: ACQUIRE_LUA
  });

  function effectiveCap(resourceClass) {
    if (caps && typeof caps[resourceClass] === 'number') {
      return caps[resourceClass];
    }
    // Tagged-but-unconfigured: warn and treat as cap=1 (operator-friendly).
    console.warn(
      `[task-queue][resource-class] No cap configured for class "${resourceClass}" ` +
      `in resourceClassCaps — treating as cap=1.`
    );
    return 1;
  }

  /**
   * Attempt to acquire a slot in the named resource class. Returns a
   * `release` function (async; idempotent) on success. Rejects with an Error
   * whose `.code === 'RESOURCE_CLASS_WAIT_TIMEOUT'` if acquireTimeoutMs
   * elapses without acquiring.
   *
   * @param {string} resourceClass
   * @param {Object} [context]  { taskName, target, jobId } — included in
   *                            structured events for operator visibility.
   */
  async function acquire(resourceClass, context) {
    const ctx = context || {};
    const cap = effectiveCap(resourceClass);
    const key = holdersKey(resourceClass);
    const leaseId = crypto.randomUUID();
    const start = Date.now();
    let waitEmitted = false;

    while (true) {
      const now = Date.now();
      const result = await redis.semaphoreAcquire(key, leaseId, cap, leaseTtlMs, now);

      if (result === 1) {
        const waitSeconds = Math.round((Date.now() - start) / 1000);
        emitTaskEvent('PROGRESS', ctx.taskName || resourceClass, ctx.target || '', {
          phase: 'resource_class_wait_end',
          resourceClass,
          wait_seconds: waitSeconds,
          outcome: 'acquired',
          jobId: ctx.jobId || null
        });

        const acquiredAt = Date.now();
        let released = false;
        return async function release() {
          if (released) return;
          released = true;
          try {
            await redis.hdel(key, leaseId);
            const heldSeconds = Math.round((Date.now() - acquiredAt) / 1000);
            emitTaskEvent('PROGRESS', ctx.taskName || resourceClass, ctx.target || '', {
              phase: 'resource_class_released',
              resourceClass,
              held_seconds: heldSeconds,
              jobId: ctx.jobId || null
            });
          } catch (_e) {
            // Best-effort; ignore release errors so a Redis blip mid-task
            // doesn't propagate as a job failure.
          }
        };
      }

      // Denied — emit wait_begin (only on first denial), then sleep.
      if (!waitEmitted) {
        emitTaskEvent('PROGRESS', ctx.taskName || resourceClass, ctx.target || '', {
          phase: 'resource_class_wait_begin',
          resourceClass,
          cap,
          jobId: ctx.jobId || null
        });
        waitEmitted = true;
      }

      if (Date.now() - start >= acquireTimeoutMs) {
        const waitSeconds = Math.round((Date.now() - start) / 1000);
        emitTaskEvent('TASK_ERROR', ctx.taskName || resourceClass, ctx.target || '', {
          phase: 'resource_class_wait_end',
          resourceClass,
          wait_seconds: waitSeconds,
          outcome: 'timeout',
          jobId: ctx.jobId || null
        });
        const err = new Error(
          `Could not acquire resource class "${resourceClass}" within ${acquireTimeoutMs}ms ` +
          `(cap=${cap}). RESOURCE_CLASS_WAIT_TIMEOUT.`
        );
        err.code = 'RESOURCE_CLASS_WAIT_TIMEOUT';
        throw err;
      }

      await sleep(pollIntervalMs);
    }
  }

  return { acquire };
}

module.exports = { createSemaphore };
