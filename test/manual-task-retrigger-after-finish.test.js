/**
 * Story #25 / ADR 0022 — Manual task re-triggers should work after the previous
 * attempt finishes.
 *
 * The fix is mechanically tiny: add `removeOnComplete: true` and
 * `removeOnFail: true` to the single `queue.add` call at
 * src/manage/taskQueue/queue/index.js:185. These options map to BullMQ's
 * `{count: 0}` keepJobs semantics, which routes finalized jobs through the
 * immediate-removal Lua branch (per ADR 0022 §Constraints and grounded facts).
 * With the per-job hash deleted on finalization, a subsequent `queue.add` with
 * the same `jobId` finds nothing in any state and creates a fresh job —
 * restoring ADR 0012's documented `wait`/`active`-only dedup contract.
 *
 * These tests use source/structural sentinels (the project convention for the
 * task-queue tests; see test/task-queue-bullmq.test.js for precedent). The
 * sentinels pin the ADR-required code shape + the ADR-amendment text shape.
 *
 * Behavioral proof — actual re-trigger creating a new BullMQ job, actual
 * concurrent-fire dedup of an active job, actual scheduled-fire non-regression
 * — is exercised by:
 *   (a) the one-shot empirical probe `test/probe-bullmq-removeOnComplete-
 *       immediate.js` which the Implementer must write and run inside the
 *       container per ADR 0022 §Pre-implementation empirical probe; and
 *   (b) the cycle-local smoke at staging+prod cycle time (AC #7).
 *
 * T1..T8 : FAIL pre-implementation, PASS post.
 * T9..T10: probe-file existence + shape sentinels (also FAIL pre, PASS post).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const QUEUE_MODULE     = path.join(ROOT, 'src/manage/taskQueue/queue/index.js');
const SCHEDULER_MODULE = path.join(ROOT, 'src/manage/taskQueue/queue/scheduler.js');
const ADR_0012         = path.join(ROOT, 'engineering-team/decisions/task-queue-scheduler/0012-task-queue-phase-1-bullmq.md');
const PROBE_SCRIPT     = path.join(ROOT, 'test/probe-bullmq-removeOnComplete-immediate.js');

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (_e) { return null; }
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// Helper: extract the **Dedup:** section body from ADR 0012 (until the next
// top-level **Xxxx:** marker or markdown heading).
function dedupSectionOf(adrText) {
  if (!adrText) return null;
  const m = adrText.match(/\*\*Dedup:\*\*([\s\S]*?)(?=\n\*\*[A-Z][\w ]+:\*\*|\n###|\n##)/);
  return m ? m[1] : null;
}

// Helper: extract Option A's body from ADR 0012 (until the next ### header).
function optionABodyOf(adrText) {
  if (!adrText) return null;
  const m = adrText.match(/### Option A[\s\S]*?(?=\n### Option B)/);
  return m ? m[0] : null;
}

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once story #25 is implemented per ADR 0022.
// ---------------------------------------------------------------------------

test('T1: src/manage/taskQueue/queue/index.js enqueueTask passes removeOnComplete: true to queue.add (AC #1, #3; ADR 0022 §Implementation 1)', () => {
  const src = readSafe(QUEUE_MODULE);
  assert(src !== null, 'Queue module missing at ' + QUEUE_MODULE);
  const enqueueRe = /async\s+function\s+enqueueTask[\s\S]*?return\s+queue\.add\s*\(([\s\S]*?\))\s*;/;
  const m = src.match(enqueueRe);
  assert(
    m,
    'Could not locate the enqueueTask function returning queue.add — has the function shape changed? (AC #1, #3; ADR 0022 §Implementation 1)'
  );
  assert(
    /removeOnComplete\s*:\s*true/.test(m[1]),
    'enqueueTask\'s queue.add call must pass `removeOnComplete: true` so completed job hashes are removed immediately as part of completion finalization. Without this, BullMQ\'s queue.add dedups against the completed hash forever and manual re-triggers after completion are silently blocked. (AC #1, #3; ADR 0022 §Implementation 1)'
  );
});

test('T2: src/manage/taskQueue/queue/index.js enqueueTask passes removeOnFail: true to queue.add (AC #2; ADR 0022 §Implementation 1)', () => {
  const src = readSafe(QUEUE_MODULE);
  assert(src !== null, 'Queue module missing at ' + QUEUE_MODULE);
  const enqueueRe = /async\s+function\s+enqueueTask[\s\S]*?return\s+queue\.add\s*\(([\s\S]*?\))\s*;/;
  const m = src.match(enqueueRe);
  assert(m, 'Could not locate the enqueueTask function returning queue.add (AC #2; ADR 0022 §Implementation 1)');
  assert(
    /removeOnFail\s*:\s*true/.test(m[1]),
    'enqueueTask\'s queue.add call must pass `removeOnFail: true` so failed job hashes are removed immediately on failure finalization. Without this, manual re-triggers after a failure are silently blocked — defeating the recovery-from-failure path. (AC #2; ADR 0022 §Implementation 1)'
  );
});

test('T3: computeJobId still uses `${taskName}:${pubkey}` for customer args and bare `taskName` for non-customer (AC #4 — preserves concurrent-fire dedup)', () => {
  const src = readSafe(QUEUE_MODULE);
  assert(src !== null, 'Queue module missing at ' + QUEUE_MODULE);
  // Pin the customer-task formula by source pattern.
  assert(
    /\$\{taskName\}:\$\{customerArgs\.pubkey\}/.test(src),
    'computeJobId must still produce `${taskName}:${customerArgs.pubkey}` for customer tasks. AC #4 requires concurrent-fire dedup to be preserved — two simultaneous /api/run-task triggers for the same (taskName, pubkey) while one is `active` must join the same job. The stable jobId formula is what makes that work; the immediate-removal option only fires on completion, not preemptively. (AC #4; ADR 0022 §Decision)'
  );
  // Pin the non-customer return path: `return taskName;` with no suffix.
  assert(
    /return\s+taskName\s*;/.test(src),
    'computeJobId\'s non-customer return path must still return `taskName` (bare). Same reason as the customer branch — concurrent-fire dedup for non-customer tasks relies on this stable formula. (AC #4)'
  );
});

test('T4: scheduler.js still calls queue.upsertJobScheduler (AC #5 — scheduled-fire path untouched by the primary fix)', () => {
  const src = readSafe(SCHEDULER_MODULE);
  assert(src !== null, 'Scheduler module missing at ' + SCHEDULER_MODULE);
  assert(
    /queue\.upsertJobScheduler\s*\(/.test(src),
    'scheduler.js must still call queue.upsertJobScheduler. AC #5 requires no regression to the scheduled-fire path. Story #25 / ADR 0022 explicitly leave this code path untouched (the stretch goal to also pass removeOnComplete/removeOnFail here would also pass this sentinel — both forms keep the upsertJobScheduler call). (AC #5)'
  );
});

test('T5: ADR 0012\'s "Dedup" section acknowledges BullMQ\'s actual cross-state dedup (AC #6 — text matches actual behavior)', () => {
  const adr = readSafe(ADR_0012);
  assert(adr !== null, 'ADR 0012 missing at ' + ADR_0012);
  const dedup = dedupSectionOf(adr);
  assert(dedup, 'Could not locate the **Dedup:** section in ADR 0012');
  // The amended section must acknowledge dedup-across-completed-and-failed
  // (not only wait/active as the original text claimed).
  const acknowledged =
    (/completed/i.test(dedup) && /(failed|fail)/i.test(dedup)) ||
    /all\s+(job\s+)?states/i.test(dedup);
  assert(
    acknowledged,
    'ADR 0012\'s **Dedup:** section must acknowledge that BullMQ dedups across all job states (including completed and failed), not only wait/active as the original text claimed. The amendment is required by story #25 AC #6 — the documented contract must match actual code behavior. (AC #6; ADR 0022 §Implementation 2)'
  );
});

test('T6: ADR 0012\'s "Dedup" section documents the removeOnComplete: true + removeOnFail: true mechanism (AC #6)', () => {
  const adr = readSafe(ADR_0012);
  assert(adr !== null, 'ADR 0012 missing');
  const dedup = dedupSectionOf(adr);
  assert(dedup, 'Could not locate the **Dedup:** section in ADR 0012');
  assert(
    /removeOnComplete\s*:\s*true/.test(dedup),
    'ADR 0012\'s **Dedup:** section must document the `removeOnComplete: true` mechanism that restores the wait/active-only dedup window. (AC #6; ADR 0022 §Implementation 2)'
  );
  assert(
    /removeOnFail\s*:\s*true/.test(dedup),
    'ADR 0012\'s **Dedup:** section must also document `removeOnFail: true` (the failure-recovery path). (AC #6; ADR 0022 §Implementation 2)'
  );
});

test('T7: ADR 0012 cross-references ADR 0022 (AC #6 — readers can follow the amendment trail)', () => {
  const adr = readSafe(ADR_0012);
  assert(adr !== null, 'ADR 0012 missing');
  // The amendment must include an explicit cross-reference to ADR 0022 somewhere
  // in the document (Dedup section, Cons list, or a top-of-file amendment note).
  assert(
    /ADR\s*0022|adr[-_]?0022|0022[-_]manual-task-retrigger/i.test(adr),
    'ADR 0012 must cross-reference ADR 0022 so readers can follow the amendment trail. Add the reference in the Dedup section, the Cons list, or a top-of-file amendment note. (AC #6; ADR 0022 §Implementation 2)'
  );
});

test('T8: ADR 0012\'s Option A Cons list notes the BullBoard completed/failed visibility loss (AC #6 — readers understand the trade-off)', () => {
  const adr = readSafe(ADR_0012);
  assert(adr !== null, 'ADR 0012 missing');
  const optionA = optionABodyOf(adr);
  assert(optionA, 'Could not locate Option A body in ADR 0012');
  // Find the Cons block within Option A.
  const consMatch = optionA.match(/\*\*Cons\*\*([\s\S]*?)(?=\n###|\n\*\*[A-Z][\w ]+\*\*\n|$)/);
  assert(consMatch, 'Could not locate Option A\'s **Cons** sub-list in ADR 0012');
  const cons = consMatch[1];
  assert(
    /BullBoard/i.test(cons) && /(completed|failed)/i.test(cons),
    'Option A\'s **Cons** list must note that BullBoard\'s completed/failed views are empty for queues using removeOnComplete:true / removeOnFail:true — `events.jsonl` is the durable failure record. Operators reading the ADR need to understand the trade-off they\'re inheriting. (AC #6; ADR 0022 §Implementation 2)'
  );
});

test('T9: empirical probe script exists at test/probe-bullmq-removeOnComplete-immediate.js (ADR 0022 §Pre-implementation empirical probe)', () => {
  const src = readSafe(PROBE_SCRIPT);
  assert(
    src !== null,
    'Probe script must exist at ' + PROBE_SCRIPT + '. ADR 0022 mandates this script as a pre-implementation empirical check — the Implementer runs it inside the container (`docker exec tapestry node /usr/local/lib/node_modules/brainstorm/test/probe-bullmq-removeOnComplete-immediate.js`) to confirm that the installed BullMQ ^5.76.10 actually behaves the way the GitHub-master source said it would. If the probe fails, the ADR must be re-opened.'
  );
});

test('T10: probe script exercises both removeOnComplete: true and removeOnFail: true paths and compares job.id across re-adds (loose shape check)', () => {
  const src = readSafe(PROBE_SCRIPT);
  assert(src !== null, 'Probe script missing — T9 must pass first.');
  // Loose grep: confirm both options are exercised.
  assert(
    /removeOnComplete\s*:\s*true/.test(src),
    'Probe script must add at least one job with `removeOnComplete: true` to verify BullMQ\'s installed behavior matches the ADR claim. (ADR 0022 §Pre-implementation empirical probe step 2)'
  );
  assert(
    /removeOnFail\s*:\s*true/.test(src),
    'Probe script must also verify `removeOnFail: true` by submitting a job whose Worker throws. (ADR 0022 §Pre-implementation empirical probe step 6)'
  );
  // Confirm the script imports BullMQ — without this, the probe is a stub.
  assert(
    /require\s*\(\s*['"]bullmq['"]\s*\)/.test(src),
    'Probe script must `require("bullmq")` to exercise the actual installed library. (ADR 0022 §Pre-implementation empirical probe)'
  );
  // Confirm it captures job.id — the empirical claim is "second add returns a
  // DIFFERENT job.id once the first job's hash is gone."
  assert(
    /\.id\b/.test(src),
    'Probe script must capture and compare job.id across two adds with the same jobId — the empirical proof that the first one was removed and the second is fresh. (ADR 0022 §Pre-implementation empirical probe step 5)'
  );
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
