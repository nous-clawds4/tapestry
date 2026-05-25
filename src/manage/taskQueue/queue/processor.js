/**
 * Task Queue Processor — invoked by BullMQ Workers per task.
 * Story #13 / ADR 0010.
 *
 * Spawns launchChildTask.sh the SAME way runTask.js's executeTask does today
 * — same arg shape, same options JSON, same stdout LAUNCHCHILDTASK_RESULT
 * parse. The launchChildTask.sh pgrep guard remains in place (phase 1
 * belt-and-suspenders, per ADR §Out of scope).
 *
 * The result this processor returns becomes the BullMQ job result — picked
 * up by `job.waitUntilFinished()` for sync callers and recorded for async
 * callers' observability via BullBoard.
 */

const { spawn } = require('child_process');
const brainstormConfig = require('../../../utils/brainstormConfig');

/**
 * Build the child args array the same way runTask.js's buildTaskCommand does.
 */
function buildChildArgs(taskDef, customerArgs, queryParams) {
  const args = [];
  // Static args declared on the registry entry (e.g. reconciliation "--mode all").
  // Word-split so each token becomes its own argv element when launchChildTask
  // runs `bash "$child_script" $child_args`.
  if (taskDef.staticArgs) {
    args.push(...String(taskDef.staticArgs).trim().split(/\s+/).filter(Boolean));
  }
  if (taskDef.arguments && taskDef.arguments.customer && customerArgs) {
    args.push(customerArgs.pubkey, customerArgs.customerId, customerArgs.customerName);
  }
  if (taskDef.arguments && taskDef.arguments.limit && queryParams && queryParams.limit) {
    args.push(String(queryParams.limit));
  }
  if (taskDef.arguments && taskDef.arguments.warmStart && queryParams && queryParams.warmStart === 'true') {
    args.push('warmStart');
  }
  return args;
}

/**
 * Parse the LAUNCHCHILDTASK_RESULT: <json> line out of launchChildTask.sh's
 * stdout. Same shape as runTask.js's executeTask parser.
 */
function parseLaunchResult(stdout) {
  const lines = stdout.split('\n');
  let collecting = false;
  let buffer = '';
  for (const line of lines) {
    if (line.startsWith('LAUNCHCHILDTASK_RESULT:')) {
      const jsonStart = line.substring('LAUNCHCHILDTASK_RESULT:'.length).trim();
      buffer = jsonStart;
      if (jsonStart.startsWith('{') && jsonStart.endsWith('}')) {
        try { return JSON.parse(jsonStart); }
        catch (_e) { collecting = true; }
      } else {
        collecting = true;
      }
    } else if (collecting) {
      buffer += '\n' + line;
      if (line.trim() === '}' && buffer.includes('{')) {
        try { return JSON.parse(buffer); }
        catch (_e) { /* keep collecting */ }
      }
    }
  }
  return null;
}

/**
 * BullMQ processor entry point. Spawns launchChildTask.sh; resolves with
 * the structured result; rejects on spawn error so BullMQ marks the job
 * failed.
 *
 * NB: named `processJob` (not `process`) — using `process` here would shadow
 * the Node.js global inside the function body and `process.env` would resolve
 * to the function's `.env` (undefined), breaking the spawn's env inheritance.
 */
function processJob(job, taskDef) {
  // ── Scheduled-fire branch (story #24 / ADR 0021) ─────────────────────
  // Per-entry scheduled fires carry `entryId` in their job-data and have
  // NO customerArgs / queryParams baked in (those resolve fresh at fire
  // time via entryResolver). Manual /api/run-task calls take the
  // unchanged path below (no entryId).
  return Promise.resolve().then(async () => {
    let { taskName, customerArgs, queryParams, timeoutMs, entryId } = job.data;

    if (entryId) {
      const { resolveScheduledEntry, disableEntryWithError } = require('./entryResolver');
      const resolved = await resolveScheduledEntry(entryId, taskDef);
      if (!resolved.ok) {
        // Auto-disable the entry, drop its Job Scheduler, fail the job.
        // The failure is visible in BullBoard with the explicit error code;
        // events.jsonl carries an ENTRY_AUTO_DISABLED record for the panel.
        await disableEntryWithError(entryId, resolved.error);
        throw new Error(`[scheduler] entry ${entryId} auto-disabled: ${resolved.error.code} — ${resolved.error.message}`);
      }
      customerArgs = resolved.customerArgs;
      queryParams  = resolved.queryParams;
    }

    return runWithResolvedArgs({ job, taskDef, taskName, customerArgs, queryParams, timeoutMs });
  });
}

// Extracted to keep the Promise/spawn machinery readable next to the new
// scheduled-fire branch above. The body is unchanged from the original
// processJob — it spawns launchChildTask.sh with the same args, parses
// LAUNCHCHILDTASK_RESULT, and resolves with the structured result.
function runWithResolvedArgs({ job, taskDef, taskName, customerArgs, queryParams, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const launchChildTaskPath = brainstormConfig.expandScriptPath(
      '$BRAINSTORM_MODULE_MANAGE_DIR/taskQueue/launchChildTask.sh'
    );

    const args = buildChildArgs(taskDef, customerArgs, queryParams);

    const optionsJson = (timeoutMs && timeoutMs > 0)
      ? JSON.stringify({
          completion: {
            failure: {
              timeout: { duration: timeoutMs, forceKill: false }
            }
          }
        })
      : '{}';

    const childArgs = args.length > 0 ? args.join(' ') : '';

    console.log(`[task-queue] processor invoking launchChildTask for: ${taskName} (job ${job.id})`);

    const child = spawn(
      'bash',
      [launchChildTaskPath, taskName, 'task-queue', optionsJson, childArgs],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, BRAINSTORM_STRUCTURED_LOGGING: 'true' }
      }
    );

    let stdout = '';
    let stderr = '';
    const startTime = new Date().toISOString();

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    child.on('close', (code) => {
      const launchResult = parseLaunchResult(stdout);
      resolve({
        taskName,
        jobId: job.id,
        exitCode: code,
        success: code === 0,
        pid: child.pid,
        startTime,
        timestamp: new Date().toISOString(),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        launchResult
      });
    });

    child.on('error', (err) => {
      console.error(`[task-queue] processor spawn error for ${taskName} (job ${job.id}): ${err.message}`);
      reject(err);
    });
  });
}

module.exports = { processJob, buildChildArgs, parseLaunchResult };
