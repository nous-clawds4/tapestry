/**
 * Scheduled Tasks entry validation (story #24 / ADR 0021).
 *
 * validateEntry(entry, registry) → { ok: boolean, errors: Array<{field,code,message}> }
 *
 * Validation rules:
 *   - `entry.taskId` must be present in registry.tasks.
 *   - `registry.tasks[taskId].frequency` must NOT be "continuous" (queue
 *     daemons like taskQueueManager / taskScheduler / taskExecutor cannot be
 *     scheduled from this panel).
 *   - If `entry.enabled === true`, the schedule must be "runnable":
 *     a non-empty `cron` string OR any positive interval. No 1h floor
 *     (ADR 0019 dropped it). Adopted from ADR 0019's scheduler.isValidSchedule.
 *   - For each declared argument shape in registry.tasks[taskId].arguments:
 *       - `customer: true`  → args.customer must be a 64-char *lowercase*
 *         hex pubkey. Required.
 *       - `customer: false` → args.customer, if provided, must still match
 *         the pubkey shape; absent allowed.
 *       - `{ type: "boolean", ... }` → args[k] must be boolean or undefined
 *         (default applied at fire time when undefined).
 *       - `"optional"` → args[k] must be undefined / "" / null, OR a
 *         non-negative integer.
 *       - Any other shape → passed through (text-input fallback rendering).
 *
 * Used by:
 *   - HTTP create/update handlers (rejects 400 on first save attempt).
 *   - The fire-time path in entryResolver.js (re-validates against the
 *     current registry at every fire so a registry change that made the
 *     args invalid auto-disables the entry).
 *
 * Used by:
 *   - test/scheduled-tasks-with-arguments.test.js → T6-T13
 */

// 64-char lowercase hex. ADR 0021 pins lowercase; CustomerManager keys by the
// canonical lowercase form. Permitting uppercase here would let a mixed-case
// pubkey from the legacy explorer's display pass through and then fail
// downstream in CustomerManager — fail-fast at the boundary instead.
const PUBKEY_RE = /^[a-f0-9]{64}$/;

/**
 * A schedule is "runnable" when enabled if it has either a cron pattern or
 * any positive interval (days/hours/minutes summed > 0). Mirrors
 * scheduler.isValidSchedule from ADR 0019 so the two stay aligned.
 */
function hasRunnableSchedule(entry) {
  if (entry && typeof entry.cron === 'string' && entry.cron.trim()) return true;
  const minutes =
    (Number(entry && entry.intervalDays) || 0) * 24 * 60 +
    (Number(entry && entry.intervalHours) || 0) * 60 +
    (Number(entry && entry.intervalMinutes) || 0);
  return minutes > 0;
}

function validateEntry(entry, registry) {
  const errors = [];

  if (!entry || typeof entry !== 'object') {
    return {
      ok: false,
      errors: [{ field: 'entry', code: 'INVALID_ENTRY', message: 'entry must be a non-null object' }],
    };
  }

  const taskId = entry.taskId;
  const task = registry && registry.tasks && registry.tasks[taskId];

  if (!task) {
    return {
      ok: false,
      errors: [{
        field: 'taskId',
        code: 'UNKNOWN_TASK',
        message: `Task '${taskId}' is not present in taskRegistry.json`,
      }],
    };
  }

  if (task.frequency === 'continuous') {
    return {
      ok: false,
      errors: [{
        field: 'taskId',
        code: 'NOT_SCHEDULABLE',
        message: `Task '${taskId}' has frequency "continuous" and is a queue daemon; it cannot be scheduled from this panel`,
      }],
    };
  }

  // Schedule shape: an enabled entry must specify SOMETHING (cron OR positive interval).
  // No 1h floor (ADR 0019). A disabled entry with no schedule is fine — operator
  // may be drafting.
  if (entry.enabled === true && !hasRunnableSchedule(entry)) {
    errors.push({
      field: 'schedule',
      code: 'INVALID_SCHEDULE',
      message: `Enabled entry must specify a cron expression OR a positive interval (days/hours/minutes); ADR 0019 dropped the 1-hour floor but the schedule must still be runnable`,
    });
  }

  const args = (entry.args && typeof entry.args === 'object') ? entry.args : {};
  const argsSchema = task.arguments;

  if (argsSchema && typeof argsSchema === 'object' && !Array.isArray(argsSchema)) {
    for (const [argName, argShape] of Object.entries(argsSchema)) {
      const value = args[argName];

      // ── customer arg ──────────────────────────────────────
      if (argName === 'customer') {
        const required = argShape === true;
        const missing = (value === undefined || value === null || value === '');
        if (required && missing) {
          errors.push({
            field: 'customer',
            code: 'CUSTOMER_REQUIRED',
            message: `Customer is required for ${taskId}`,
          });
          continue;
        }
        if (!missing) {
          if (typeof value !== 'string' || !PUBKEY_RE.test(value)) {
            errors.push({
              field: 'customer',
              code: 'INVALID_CUSTOMER_PUBKEY',
              message: `Customer pubkey for ${taskId} must be 64 lowercase hex characters; got: ${JSON.stringify(value).slice(0, 80)}`,
            });
          }
        }
        continue;
      }

      // ── boolean arg (e.g., warmStart) ─────────────────────
      if (argShape && typeof argShape === 'object' && argShape.type === 'boolean') {
        if (value !== undefined && typeof value !== 'boolean') {
          errors.push({
            field: argName,
            code: 'INVALID_BOOLEAN',
            message: `${argName} must be a boolean for ${taskId}; got: ${typeof value}`,
          });
        }
        continue;
      }

      // ── "optional" arg (e.g., limit) ──────────────────────
      if (argShape === 'optional') {
        if (value !== undefined && value !== null && value !== '') {
          if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            errors.push({
              field: argName,
              code: 'INVALID_INT',
              message: `${argName} must be a non-negative integer for ${taskId}; got: ${JSON.stringify(value)}`,
            });
          }
        }
        continue;
      }

      // Unknown shape — intentional pass-through (text-input fallback).
    }
  }

  return { ok: errors.length === 0, errors };
}

module.exports = { validateEntry, hasRunnableSchedule };
