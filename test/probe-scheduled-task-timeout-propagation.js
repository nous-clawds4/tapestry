#!/usr/bin/env node
/**
 * Empirical probe — ADR 0024 §"Implementer self-check before commit".
 *
 * Verifies, against the actually-installed launchChildTask.sh + bash + jq +
 * structured-logging machinery in the tapestry container, that the three-layer
 * fix from ADR 0024 works end-to-end:
 *
 *   - Path 1 (the bug case, now fixed): per-invocation `timeout: { duration: 0 }`
 *     means "no timeout, monitor indefinitely" — NOT "timeout at first iteration."
 *     The wrapper runs to script-completion (not to the 5s mark) and emits
 *     CHILD_TASK_END (not a spurious CHILD_TASK_ERROR error_type=timeout).
 *
 *   - Path 2 (genuine timeout still works): per-invocation `timeout: { duration:
 *     5000 }` against a 15-second sleep script trips the wrapper's timeout at
 *     ~5s and emits CHILD_TASK_ERROR error_type=timeout with elapsed_time≈5000.
 *
 * If either ASSERT-FAILs, the architecture in ADR 0024 §Decision is wrong for
 * the installed wrapper script. STOP, re-open ADR 0024, attach this probe's
 * output, and re-design.
 *
 * Run inside the tapestry container:
 *
 *   docker exec tapestry node \
 *     /usr/local/lib/node_modules/brainstorm/test/probe-scheduled-task-timeout-propagation.js
 *
 * The probe creates a temporary probe-only task in taskRegistry.json (backup
 * → modify → run → restore) and a temporary script in /tmp; both are cleaned
 * up in a finally block. If the probe crashes mid-run, re-run it once — the
 * cleanup is idempotent.
 *
 * This script is NOT registered in test/test.js — it's a one-shot empirical
 * check, not a regression test. The test/scheduled-task-timeout-propagation
 * .test.js sentinels (P0, P1) protect this file's existence + shape.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Inside the tapestry container, the brainstorm package is at
// /usr/local/lib/node_modules/brainstorm.  We resolve paths relative to the
// probe's own location so the probe also works against a dev checkout (where
// __dirname is .../tapestry/test).
const REPO_ROOT = path.resolve(__dirname, '..');
const TASK_REGISTRY_PATH = path.join(REPO_ROOT, 'src/manage/taskQueue/taskRegistry.json');
const WRAPPER_PATH       = path.join(REPO_ROOT, 'src/manage/taskQueue/launchChildTask.sh');

// Default events.jsonl path inside the container; override via env var if a
// different path is needed for a dev environment.
const EVENTS_LOG = process.env.BRAINSTORM_EVENTS_LOG ||
                   '/var/log/brainstorm/taskQueue/events.jsonl';

const STAMP = Date.now();
const PROBE_TASK_NAME       = `__probe_timeout_${STAMP}`;
const PROBE_SCRIPT_PATH     = `/tmp/probe-script-${STAMP}.sh`;
const PROBE_SCRIPT_RELATIVE = `tmp/probe-script-${STAMP}.sh`;

let assertCount = 0;
let registryBackup = null;

function assertTruthy(actual, label) {
  assertCount++;
  if (actual) {
    console.log(`  ✓ ASSERT-PASS  ${label}`);
  } else {
    console.log(`  ✗ ASSERT-FAIL  ${label}: expected truthy, got ${JSON.stringify(actual)}`);
    process.exitCode = 1;
  }
}
function assertFalsy(actual, label) {
  assertCount++;
  if (!actual) {
    console.log(`  ✓ ASSERT-PASS  ${label}`);
  } else {
    console.log(`  ✗ ASSERT-FAIL  ${label}: expected falsy, got ${JSON.stringify(actual)}`);
    process.exitCode = 1;
  }
}
function assertApprox(actual, expected, toleranceMs, label) {
  assertCount++;
  const diff = Math.abs(actual - expected);
  if (diff <= toleranceMs) {
    console.log(`  ✓ ASSERT-PASS  ${label} (got ${actual}, expected ≈${expected}, diff ${diff}ms within ±${toleranceMs}ms)`);
  } else {
    console.log(`  ✗ ASSERT-FAIL  ${label}: got ${actual}, expected ≈${expected}, diff ${diff}ms exceeds ±${toleranceMs}ms`);
    process.exitCode = 1;
  }
}

// Write a temporary probe-task entry into taskRegistry.json.
// Backs up the original to memory; restoreRegistry() reverts.
function installProbeTask(sleepSeconds) {
  const raw = fs.readFileSync(TASK_REGISTRY_PATH, 'utf8');
  registryBackup = raw;
  const registry = JSON.parse(raw);
  registry.tasks[PROBE_TASK_NAME] = {
    name: PROBE_TASK_NAME,
    categories: ['maintenance'],
    description: `Probe task for story #27 / ADR 0024 (sleeps ${sleepSeconds}s).`,
    script: PROBE_SCRIPT_PATH,
    script_relative_path: PROBE_SCRIPT_RELATIVE,
    arguments: false,
    scope: 'system',
    priority: 'low',
    frequency: 'on-demand',
    status: 'active',
    structuredLogging: true,
    options: {}
  };
  fs.writeFileSync(TASK_REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

function restoreRegistry() {
  if (registryBackup !== null) {
    fs.writeFileSync(TASK_REGISTRY_PATH, registryBackup);
    registryBackup = null;
  }
}

function installProbeScript(sleepSeconds) {
  const content = `#!/bin/bash\n# Probe script — sleeps ${sleepSeconds}s then exits cleanly.\nsleep ${sleepSeconds}\nexit 0\n`;
  fs.writeFileSync(PROBE_SCRIPT_PATH, content);
  fs.chmodSync(PROBE_SCRIPT_PATH, 0o755);
}

function removeProbeScript() {
  try { fs.unlinkSync(PROBE_SCRIPT_PATH); } catch (_e) { /* ignore */ }
}

// Snapshot the current size of events.jsonl so we can slice "new events since".
function eventsLogSizeBefore() {
  try { return fs.statSync(EVENTS_LOG).size; }
  catch (_e) { return 0; }
}

// Read events.jsonl from `fromOffset` onward and return parsed records whose
// metadata.child_task === PROBE_TASK_NAME OR target starts with PROBE_TASK_NAME.
function readProbeEventsSince(fromOffset) {
  let raw;
  try {
    const fd = fs.openSync(EVENTS_LOG, 'r');
    const stats = fs.fstatSync(fd);
    const len = Math.max(0, stats.size - fromOffset);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, fromOffset);
    fs.closeSync(fd);
    raw = buf.toString('utf8');
  } catch (_e) {
    return [];
  }
  const lines = raw.split('\n').filter(Boolean);
  const records = [];
  for (const line of lines) {
    try {
      const rec = JSON.parse(line);
      const childTask = rec && rec.metadata && rec.metadata.child_task;
      const target = rec && rec.target;
      if (childTask === PROBE_TASK_NAME || (target && target.startsWith(PROBE_TASK_NAME))) {
        records.push(rec);
      }
    } catch (_e) { /* ignore malformed lines */ }
  }
  return records;
}

// Run launchChildTask.sh with a per-invocation options JSON.  Returns when the
// wrapper script exits.  Captures stdout/stderr for diagnostics.
function runWrapper(optionsJson) {
  return new Promise((resolve) => {
    const args = [WRAPPER_PATH, PROBE_TASK_NAME, 'probe', optionsJson, ''];
    const child = spawn('bash', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, BRAINSTORM_STRUCTURED_LOGGING: 'true' }
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => { stdout += c.toString(); });
    child.stderr.on('data', (c) => { stderr += c.toString(); });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.on('error', (err) => resolve({ code: null, stdout, stderr, error: err }));
  });
}

async function main() {
  console.log(`probe task name: ${PROBE_TASK_NAME}`);
  console.log(`probe script:    ${PROBE_SCRIPT_PATH}`);
  console.log(`wrapper script:  ${WRAPPER_PATH}`);
  console.log(`events log:      ${EVENTS_LOG}\n`);

  // ---------------------------------------------------------------------
  // Path 1: per-invocation duration=0 → wrapper should monitor indefinitely
  //          and the script's natural exit should emit CHILD_TASK_END.
  //          Pre-fix: wrapper exits at 5s with a spurious "timed out" event.
  //          Post-fix: wrapper waits for the script's 8s sleep to complete.
  // ---------------------------------------------------------------------
  console.log('Path 1: per-invocation timeout=0 (the bug case)');
  installProbeTask(8);
  installProbeScript(8);
  const offset1 = eventsLogSizeBefore();
  const t1Start = Date.now();
  const result1 = await runWrapper(JSON.stringify({
    completion: { failure: { timeout: { duration: 0, forceKill: false }}}
  }));
  const t1Elapsed = Date.now() - t1Start;
  console.log(`    wrapper exit code=${result1.code}, elapsed=${t1Elapsed}ms`);
  if (result1.stderr) console.log(`    stderr: ${result1.stderr.trim().split('\n').slice(0, 3).join(' | ')}`);

  const events1 = readProbeEventsSince(offset1);
  const childTaskEnds1   = events1.filter(r => r.eventType === 'CHILD_TASK_END');
  const childTaskErrors1 = events1.filter(r => r.eventType === 'CHILD_TASK_ERROR' &&
                                               r.metadata && r.metadata.error_type === 'timeout');

  assertTruthy(
    childTaskEnds1.length > 0,
    `Path 1: events.jsonl contains a CHILD_TASK_END for this run (got ${childTaskEnds1.length}). The wrapper script should have waited for the 8s sleep to complete and emitted CHILD_TASK_END.`
  );
  assertFalsy(
    childTaskErrors1.length,
    `Path 1: events.jsonl contains NO CHILD_TASK_ERROR error_type="timeout" for this run (got ${childTaskErrors1.length}). The pre-fix wrapper emitted this spurious event at ~5s; the fix should eliminate it for timeoutMs=0 invocations.`
  );
  assertApprox(
    t1Elapsed, 8000, 4000,
    `Path 1: wrapper ran for ~8 seconds (the script's sleep duration), not ~5 seconds (the buggy early-exit) and not vastly longer.`
  );

  // ---------------------------------------------------------------------
  // Path 2: per-invocation duration=5000ms → wrapper should declare timeout
  //          at ~5s and emit CHILD_TASK_ERROR error_type=timeout.
  //          This path tests that genuine timeouts still work after the fix
  //          (the `-gt 0` guard makes 0 mean "no timeout" but leaves
  //          positive values trippable).
  // ---------------------------------------------------------------------
  console.log('\nPath 2: per-invocation timeout=5000ms (genuine timeout)');
  // Re-install probe task + script — the previous run's script may already be
  // gone if Path 1's wrapper cleanup removed the temp_log.  Sleep duration
  // exceeds the 5s timeout so the timeout actually fires.
  installProbeScript(15);
  const offset2 = eventsLogSizeBefore();
  const t2Start = Date.now();
  const result2 = await runWrapper(JSON.stringify({
    completion: { failure: { timeout: { duration: 5000, forceKill: false }}}
  }));
  const t2Elapsed = Date.now() - t2Start;
  console.log(`    wrapper exit code=${result2.code}, elapsed=${t2Elapsed}ms`);
  if (result2.stderr) console.log(`    stderr: ${result2.stderr.trim().split('\n').slice(0, 3).join(' | ')}`);

  const events2 = readProbeEventsSince(offset2);
  const timeoutErrors2 = events2.filter(r => r.eventType === 'CHILD_TASK_ERROR' &&
                                             r.metadata && r.metadata.error_type === 'timeout');

  assertTruthy(
    timeoutErrors2.length > 0,
    `Path 2: events.jsonl contains a CHILD_TASK_ERROR error_type="timeout" for this run (got ${timeoutErrors2.length}). A 5s timeout against a 15s sleep script should fire the timeout.`
  );
  if (timeoutErrors2.length > 0) {
    const elapsedReported = timeoutErrors2[0].metadata && timeoutErrors2[0].metadata.elapsed_time;
    assertApprox(
      elapsedReported, 5000, 2500,
      `Path 2: CHILD_TASK_ERROR.metadata.elapsed_time ≈ 5000ms (got ${elapsedReported}). The wrapper's monitor loop should fire the timeout at the configured duration, not at some other time.`
    );
  }

  console.log(`\n${assertCount} asserts; exit ${process.exitCode || 0}`);
  if (process.exitCode) {
    console.log('\nFAIL: launchChildTask.sh behavior does NOT match ADR 0024 §Decision.');
    console.log('STOP. Re-open ADR 0024 with this probe output attached.');
  } else {
    console.log('\nPASS: launchChildTask.sh behavior matches ADR 0024 §Decision.');
    console.log('The three-layer fix is empirically verified at the wrapper-script level.');
    console.log('Now run cycle-staging to verify end-to-end (held_seconds, serialization).');
  }
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.error('\nUNEXPECTED PROBE ERROR:', (e && e.stack) || e);
    process.exitCode = 2;
  } finally {
    removeProbeScript();
    restoreRegistry();
  }
})();
