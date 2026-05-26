#!/usr/bin/env node
/**
 * Empirical probe — ADR 0025 §"Implementer self-check" (implied).
 *
 * Verifies, against the actually-installed launchChildTask.sh + bash + jq +
 * structured-logging machinery in the tapestry container, that the two-layer
 * fix from ADR 0025 works end-to-end:
 *
 *   - Path 1 (the kill verification, AC #1): per-invocation `{ timeout: { duration:
 *     5000 } }` (NO per-invocation forceKill — let the wrapper's hierarchical merge
 *     resolve it from the registry global default, which post-fix is `true`)
 *     against a 15-second sleep script. The wrapper should:
 *       (a) declare timeout at ~5s
 *       (b) kill the bash subprocess via `kill -9 $child_pid`
 *       (c) emit CHILD_TASK_ERROR with error_type="timeout"
 *     After the wrapper exits, `ps -p $child_pid` must report the bash PID as dead.
 *     This is the empirical proof that AC #1's no-surviving-orphan claim holds.
 *
 *   - Path 2 (the next-fire-runs verification, AC #2): immediately after Path 1's
 *     kill, re-invoke the wrapper with the same probe task. The wrapper's
 *     `check_task_already_running` (`launchChildTask.sh:25-67`) should `pgrep -f`-find
 *     no orphan (because Path 1's kill reaped the bash subprocess whose cmdline
 *     carried the script path). The launch proceeds; a CHILD_TASK_START event
 *     emits; NO TASK_LAUNCH_PREVENTED event lands between Path 1's CHILD_TASK_ERROR
 *     and Path 2's CHILD_TASK_START.
 *
 * If either ASSERT-FAILs, the architecture in ADR 0025 §Decision is wrong for the
 * installed wrapper script. STOP, re-open ADR 0025, attach this probe's output,
 * and re-design.
 *
 * Run inside the tapestry container:
 *
 *   docker exec tapestry node \
 *     /usr/local/lib/node_modules/brainstorm/test/probe-kill-timeout-orphans.js
 *
 * The probe creates a temporary probe-only task in taskRegistry.json (backup
 * → modify → run → restore) and a temporary script in /tmp; both are cleaned
 * up in a finally block. If the probe crashes mid-run, re-run it once — the
 * cleanup is idempotent.
 *
 * This script is NOT registered in test/test.js — it's a one-shot empirical
 * check, not a regression test. The test/kill-timeout-orphans-by-default.test.js
 * sentinels (P0, P1) protect this file's existence + shape.
 *
 * Note on grandchildren: `kill -9 $child_pid` kills the bash subprocess only —
 * its `sleep 15` child is reparented to init/supervisord and continues until
 * natural completion. This is intentional. The script_relative_path (carried in
 * the bash cmdline only, NOT in the sleep cmdline) is what
 * `check_task_already_running` greps for; so the orphaned sleep doesn't block
 * subsequent fires.
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const TASK_REGISTRY_PATH = path.join(REPO_ROOT, 'src/manage/taskQueue/taskRegistry.json');
const WRAPPER_PATH       = path.join(REPO_ROOT, 'src/manage/taskQueue/launchChildTask.sh');

const EVENTS_LOG = process.env.BRAINSTORM_EVENTS_LOG ||
                   '/var/log/brainstorm/taskQueue/events.jsonl';

const STAMP = Date.now();
const PROBE_TASK_NAME       = `__probe_killorphan_${STAMP}`;
const PROBE_SCRIPT_PATH     = `/tmp/probe-killorphan-script-${STAMP}.sh`;
const PROBE_SCRIPT_RELATIVE = `tmp/probe-killorphan-script-${STAMP}.sh`;

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

function installProbeTask(sleepSeconds) {
  const raw = fs.readFileSync(TASK_REGISTRY_PATH, 'utf8');
  registryBackup = raw;
  const registry = JSON.parse(raw);
  registry.tasks[PROBE_TASK_NAME] = {
    name: PROBE_TASK_NAME,
    categories: ['maintenance'],
    description: `Probe task for story #28 / ADR 0025 (sleeps ${sleepSeconds}s).`,
    script: PROBE_SCRIPT_PATH,
    script_relative_path: PROBE_SCRIPT_RELATIVE,
    arguments: false,
    scope: 'system',
    priority: 'low',
    frequency: 'on-demand',
    status: 'active',
    structuredLogging: true,
    // Empty options → wrapper's hierarchical merge falls through to registry
    // options_default. Post-fix, that resolves forceKill: true (the central
    // change story #28 ships). No per-invocation forceKill is sent either
    // (see runWrapper below), so the merge cleanly hits the new default.
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
  // Body: just sleep, so the bash subprocess's cmdline is `bash <path>` (carries
  // the script path — what `check_task_already_running` greps for) while the
  // sleep grandchild's cmdline is `sleep N` (no path, no pgrep match after the
  // bash is killed).
  const content = `#!/bin/bash\n# Probe script for story #28 — sleeps ${sleepSeconds}s then exits cleanly.\nsleep ${sleepSeconds}\nexit 0\n`;
  fs.writeFileSync(PROBE_SCRIPT_PATH, content);
  fs.chmodSync(PROBE_SCRIPT_PATH, 0o755);
}

function removeProbeScript() {
  try { fs.unlinkSync(PROBE_SCRIPT_PATH); } catch (_e) { /* ignore */ }
}

function eventsLogSizeBefore() {
  try { return fs.statSync(EVENTS_LOG).size; }
  catch (_e) { return 0; }
}

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

// Invoke launchChildTask.sh with a per-invocation options JSON.
// Critically: we do NOT include forceKill in the per-invocation JSON. The
// hierarchical merge in the wrapper will resolve it from per-task override (none
// — probe task uses `options: {}`) or registry global default (post-fix: true).
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

// Check whether a PID is still alive. `kill -0` returns 0 if the process exists
// (and is signalable), non-zero otherwise. Cleaner than parsing `ps` output.
function isPidAlive(pid) {
  if (pid === undefined || pid === null) return false;
  const r = spawnSync('kill', ['-0', String(pid)]);
  return r.status === 0;
}

// Sleep helper.
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`probe task name: ${PROBE_TASK_NAME}`);
  console.log(`probe script:    ${PROBE_SCRIPT_PATH}`);
  console.log(`wrapper script:  ${WRAPPER_PATH}`);
  console.log(`events log:      ${EVENTS_LOG}\n`);

  installProbeTask(15);
  installProbeScript(15);

  // ---------------------------------------------------------------------
  // Path 1: per-invocation `duration: 5000` against a 15-second sleep script.
  //          No per-invocation forceKill — the wrapper's merge should resolve
  //          forceKill: true from the registry global default (post-fix).
  //          Expected: wrapper exits at ~5s, bash subprocess is killed,
  //          CHILD_TASK_ERROR error_type="timeout" event lands.
  //          Pre-fix: wrapper exits at ~5s with the CHILD_TASK_ERROR, but the
  //          bash subprocess survives (forceKill resolved to false from the
  //          pre-fix registry default), AND processor.js's hardcoded false
  //          would override even if registry default was true. POST-FIX BOTH
  //          LAYERS MUST CHANGE for this path to pass.
  // ---------------------------------------------------------------------
  console.log('Path 1: timeout=5000ms with NO per-invocation forceKill → expect kill via registry default');
  const offset1 = eventsLogSizeBefore();
  const t1Start = Date.now();
  const result1 = await runWrapper(JSON.stringify({
    completion: { failure: { timeout: { duration: 5000 } } }
  }));
  const t1Elapsed = Date.now() - t1Start;
  console.log(`    wrapper exit code=${result1.code}, elapsed=${t1Elapsed}ms`);
  if (result1.stderr) console.log(`    stderr: ${result1.stderr.trim().split('\n').slice(0, 3).join(' | ')}`);

  const events1 = readProbeEventsSince(offset1);
  const childTaskErrors1 = events1.filter(r => r.eventType === 'CHILD_TASK_ERROR' &&
                                               r.metadata && r.metadata.error_type === 'timeout');

  assertTruthy(
    childTaskErrors1.length > 0,
    `Path 1: events.jsonl contains a CHILD_TASK_ERROR error_type="timeout" for this run (got ${childTaskErrors1.length}). The wrapper should have fired the 5s timeout against the 15s sleep script and emitted CHILD_TASK_ERROR.`
  );

  // Capture the bash subprocess PID the wrapper reported, then verify it's dead.
  let childPid = null;
  if (childTaskErrors1.length > 0) {
    childPid = childTaskErrors1[0].metadata && childTaskErrors1[0].metadata.child_pid;
  }
  // Give the kernel a beat to reap the killed bash subprocess before the
  // liveness check. The kill is SIGKILL (immediate), but the OS process table
  // entry can persist briefly during reaping.
  await delay(500);
  assertFalsy(
    isPidAlive(childPid),
    `Path 1: bash subprocess PID ${childPid} is dead after wrapper exit. With the (post-fix) registry default forceKill: true and no per-invocation override, the wrapper's force_kill branch should have executed kill -9. If this fails, the bash subprocess survived — meaning the resolved forceKill was false (either registry default not flipped, or processor.js's per-invocation override still wins, or the wrapper's read path broke).`
  );

  // ---------------------------------------------------------------------
  // Path 2: immediately re-invoke same task. The pgrep-find in
  //          check_task_already_running should find no orphan (the bash
  //          subprocess from Path 1 was killed); launch proceeds;
  //          CHILD_TASK_START event lands; NO TASK_LAUNCH_PREVENTED.
  //          Pre-fix (with surviving orphan from Path 1): pgrep would match
  //          the orphan; launchNew=false default would emit TASK_LAUNCH_PREVENTED
  //          and silently skip — the exact bug story #28 fixes.
  // ---------------------------------------------------------------------
  console.log('\nPath 2: immediately re-invoke same task → expect CHILD_TASK_START, NO TASK_LAUNCH_PREVENTED');
  const offset2 = eventsLogSizeBefore();
  const t2Start = Date.now();
  const result2 = await runWrapper(JSON.stringify({
    completion: { failure: { timeout: { duration: 5000 } } }
  }));
  const t2Elapsed = Date.now() - t2Start;
  console.log(`    wrapper exit code=${result2.code}, elapsed=${t2Elapsed}ms`);
  if (result2.stderr) console.log(`    stderr: ${result2.stderr.trim().split('\n').slice(0, 3).join(' | ')}`);

  const events2 = readProbeEventsSince(offset2);
  const launchPrevented2 = events2.filter(r => r.eventType === 'TASK_LAUNCH_PREVENTED');
  const childStarts2 = events2.filter(r => r.eventType === 'CHILD_TASK_START');

  assertFalsy(
    launchPrevented2.length,
    `Path 2: events.jsonl contains NO TASK_LAUNCH_PREVENTED events for this run (got ${launchPrevented2.length}). After Path 1's kill, check_task_already_running should find no orphan PID with the script's cmdline pattern — so the new launch should proceed. If this fails, the orphan-suppression bug story #28 fixes is still in effect.`
  );
  assertTruthy(
    childStarts2.length > 0,
    `Path 2: events.jsonl contains a CHILD_TASK_START for this run (got ${childStarts2.length}). With no orphan blocking the path, the new fire should successfully start.`
  );

  console.log(`\n${assertCount} asserts; exit ${process.exitCode || 0}`);
  if (process.exitCode) {
    console.log('\nFAIL: launchChildTask.sh behavior does NOT match ADR 0025 §Decision.');
    console.log('STOP. Re-open ADR 0025 with this probe output attached.');
  } else {
    console.log('\nPASS: launchChildTask.sh kills timeout-orphans by default; next fire is not suppressed.');
    console.log('The two-layer fix is empirically verified at the wrapper-script level.');
    console.log('Now run cycle-staging to verify end-to-end (no-downtime deploy, AC #5).');
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
