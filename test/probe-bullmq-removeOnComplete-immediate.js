#!/usr/bin/env node
/**
 * Empirical probe — ADR 0022 §Pre-implementation empirical probe.
 *
 * Verifies, against the actually-installed bullmq (^5.76.10), that:
 *   - `removeOnComplete: true` deletes the per-job hash as part of completion
 *     finalization (so a subsequent queue.add with the same jobId creates a
 *     fresh job — different job.id).
 *   - `removeOnFail: true` does the same on failure.
 *
 * If either ASSERT fails, the architecture in ADR 0022 §Decision is wrong for
 * the installed BullMQ version. STOP, re-open ADR 0022, and re-design.
 *
 * Run inside the tapestry container (where bullmq + Redis are reachable):
 *
 *   docker exec tapestry node \
 *     /usr/local/lib/node_modules/brainstorm/test/probe-bullmq-removeOnComplete-immediate.js
 *
 * This script is NOT registered in test/test.js — it's a one-shot empirical
 * check, not a regression test (the test/manual-task-retrigger-after-finish
 * .test.js sentinels protect the file's existence + shape).
 */

const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');

const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const QUEUE_NAME = `__probe-removeOnComplete-${Date.now()}`;
const JOB_ID = 'fixed';
const OPTS = { jobId: JOB_ID, removeOnComplete: true, removeOnFail: true };

let assertCount = 0;
function assertEq(actual, expected, label) {
  assertCount++;
  if (actual === expected) {
    console.log(`  ✓ ASSERT-PASS  ${label} (got ${JSON.stringify(actual)})`);
  } else {
    console.log(`  ✗ ASSERT-FAIL  ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    process.exitCode = 1;
  }
}
function assertNeq(actual, notExpected, label) {
  assertCount++;
  if (actual !== notExpected) {
    console.log(`  ✓ ASSERT-PASS  ${label} (got ${JSON.stringify(actual)}, distinct from ${JSON.stringify(notExpected)})`);
  } else {
    console.log(`  ✗ ASSERT-FAIL  ${label}: expected NOT ${JSON.stringify(notExpected)}, got ${JSON.stringify(actual)}`);
    process.exitCode = 1;
  }
}
function assertGt(actual, threshold, label) {
  assertCount++;
  if (actual > threshold) {
    console.log(`  ✓ ASSERT-PASS  ${label} (got ${JSON.stringify(actual)}, > ${JSON.stringify(threshold)})`);
  } else {
    console.log(`  ✗ ASSERT-FAIL  ${label}: expected > ${JSON.stringify(threshold)}, got ${JSON.stringify(actual)}`);
    process.exitCode = 1;
  }
}
function assertTruthy(actual, label) {
  assertCount++;
  if (actual) {
    console.log(`  ✓ ASSERT-PASS  ${label}`);
  } else {
    console.log(`  ✗ ASSERT-FAIL  ${label}: expected truthy, got ${JSON.stringify(actual)}`);
    process.exitCode = 1;
  }
}

function waitForEvent(emitter, event, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeoutMs);
    emitter.once(event, (...args) => { clearTimeout(t); resolve(args); });
  });
}

async function main() {
  console.log(`probe queue: ${QUEUE_NAME}`);
  console.log(`probe Redis: ${REDIS_HOST}:${REDIS_PORT}`);
  console.log(`probe bullmq: ${require('bullmq/package.json').version}\n`);

  const connection = new Redis({ host: REDIS_HOST, port: REDIS_PORT, maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE_NAME, { connection });

  // Both Paths use a fixed jobId so the SECOND queue.add tests dedup-after-
  // finalization. job.id always equals the jobId we set, so freshness is
  // proved by Worker-invocation count, not by comparing job.ids.

  // -----------------------------------------------------------------
  // Path 1: removeOnComplete: true — job completes successfully
  // -----------------------------------------------------------------
  console.log('Path 1: removeOnComplete: true (successful completion)');
  let okInvocations = 0;
  const okWorker = new Worker(
    QUEUE_NAME,
    async () => { okInvocations++; return 'ok'; },
    { connection }
  );

  const job1 = await queue.add('probe', { phase: 'complete-1' }, OPTS);
  assertTruthy(job1.id, 'add #1 returned a job.id');

  await waitForEvent(okWorker, 'completed', 5000);
  // BullMQ removes the hash as part of completion finalization. Give the
  // Lua script a beat to land in Redis state we can observe.
  await new Promise(r => setTimeout(r, 50));

  const afterComplete = await queue.getJob(JOB_ID);
  assertEq(
    afterComplete,
    undefined,
    `queue.getJob('${JOB_ID}') AFTER completion is undefined (hash was removed by removeOnComplete:true)`
  );

  const job2 = await queue.add('probe', { phase: 'complete-2' }, OPTS);
  assertTruthy(job2.id, 'add #2 returned a job.id');
  await waitForEvent(okWorker, 'completed', 5000);
  await new Promise(r => setTimeout(r, 50));

  assertEq(
    okInvocations,
    2,
    'Worker callback ran TWICE for two adds with the same jobId (proves the second add created a fresh execution, dedup did not block after completion)'
  );

  await okWorker.close();

  // -----------------------------------------------------------------
  // Path 2: removeOnFail: true — job throws
  // -----------------------------------------------------------------
  console.log('\nPath 2: removeOnFail: true (Worker throws)');
  let failInvocations = 0;
  const failWorker = new Worker(
    QUEUE_NAME,
    async () => { failInvocations++; throw new Error('probe-induced-failure'); },
    { connection }
  );

  const job3 = await queue.add('probe', { phase: 'fail-1' }, OPTS);
  assertTruthy(job3.id, 'add #3 returned a job.id');

  await waitForEvent(failWorker, 'failed', 5000);
  await new Promise(r => setTimeout(r, 50));

  const afterFail = await queue.getJob(JOB_ID);
  assertEq(
    afterFail,
    undefined,
    `queue.getJob('${JOB_ID}') AFTER failure is undefined (hash was removed by removeOnFail:true)`
  );

  const job4 = await queue.add('probe', { phase: 'fail-2' }, OPTS);
  assertTruthy(job4.id, 'add #4 returned a job.id');
  await waitForEvent(failWorker, 'failed', 5000);
  await new Promise(r => setTimeout(r, 50));

  assertEq(
    failInvocations,
    2,
    'Worker callback ran TWICE for two adds with the same jobId after failures (proves removeOnFail:true unblocks re-trigger after a failed attempt)'
  );

  await failWorker.close();

  // -----------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------
  console.log('\nCleanup');
  await queue.obliterate({ force: true });
  await queue.close();
  await connection.quit();

  console.log(`\n${assertCount} asserts; exit ${process.exitCode || 0}`);
  if (process.exitCode) {
    console.log('\nFAIL: BullMQ behavior does NOT match ADR 0022 §Decision claim.');
    console.log('STOP implementation. Re-open ADR 0022 with these results.');
  } else {
    console.log('\nPASS: BullMQ behavior matches ADR 0022 §Decision claim.');
    console.log('Safe to proceed with src/manage/taskQueue/queue/index.js:185 change.');
  }
}

main().catch(e => {
  console.error('\nUNEXPECTED PROBE ERROR:', e && e.stack || e);
  process.exit(2);
});
