'use strict';
/**
 * Every jobId the task queue computes is one BullMQ accepts — checked by BullMQ itself, not by a copy of its rule.
 *
 * ADR:    engineering-team/decisions/assistant-scores/0001-a-session-bound-scores-read-and-recalculate-route.md
 *         Amendment 1 (which amends task-queue-scheduler ADRs 0012 and 0022: the customer separator only)
 * Plan:   engineering-team/stories/assistant-scores/1-the-scores-page.test-plan.md § Round 2
 * Review: engineering-team/reviews/assistant-scores/1-the-scores-page.md Blocking 1
 *
 * Why it exists: computeJobId gave customer tasks `${taskName}:${pubkey}`, and the installed BullMQ rejects any custom
 * jobId whose split(':') length isn't 3 ("Custom Id cannot contain :"). Every test that touched the queue faked
 * enqueueTask, so the rule never ran; every customer task through /api/run-task and the Scores page's press failed.
 *
 * How: a real bullmq Job is built over a minimal queue stub and asked to validateOptions — the check queue.add runs before
 * it touches Redis — so no Redis is needed and the library's own rule is the oracle.
 *
 *   V1 — every registry task's non-customer jobId, and every customer task's jobId, passes BullMQ's validation.  [Amendment 1 §1]
 *   V2 — the dedup contract holds: one stable id per (task, pubkey), distinct across pubkeys and tasks.     [ADR 0022, AC #4]
 *   V3 — the harness is not vacuous: ids BullMQ forbids (one colon, all digits) are rejected through it.     [Amendment 1 §2]
 *
 * V1 FAILS against the code before Amendment 1 (every customer task's id is rejected); V2 and V3 pass before and after.
 */

const path = require('path');

const REPO = path.resolve(__dirname, '..');
const QUEUE = path.join(REPO, 'src/manage/taskQueue/queue/index.js');
const REGISTRY = path.join(REPO, 'src/manage/taskQueue/taskRegistry.json');

const PUBKEY = 'a1'.repeat(32);
const OTHER = 'b2'.repeat(32);

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
const show = (x) => JSON.stringify(x);

function load(p, what) {
  try { return require(p); } catch (e) { throw new Error(`${path.relative(REPO, p)} must load (${what}; run \`npm ci\`): ${e.message}`); }
}
function computeJobId() {
  const m = load(QUEUE, 'the task queue module');
  assert(typeof m.computeJobId === 'function', 'src/manage/taskQueue/queue/index.js must export computeJobId');
  return m.computeJobId;
}
function registry() { return load(REGISTRY, 'the task registry'); }

/** BullMQ's own verdict on a custom jobId: null when accepted, else its error message. */
function bullmqRejects(jobId) {
  const { Job } = load('bullmq', 'BullMQ');
  // The fields Job's constructor and validateOptions read; nothing here reaches Redis.
  const queue = { name: 'jobid-guard', opts: {}, qualifiedName: 'bull:jobid-guard', keys: {}, toKey: (k) => `bull:jobid-guard:${k}`, client: Promise.resolve({}) };
  try {
    const job = new Job(queue, 'jobid-guard', {}, { jobId, removeOnComplete: true, removeOnFail: true }, jobId);
    job.validateOptions(job.asJSON());
    return null;
  } catch (e) {
    return e && e.message ? e.message : String(e);
  }
}

// ── V — the ids ──────────────────────────────────────────────────────────────────────────────────────────────────────

test("V1: every jobId computeJobId gives a registry task — with customer args where the task takes a customer — passes BullMQ's own validation (Amendment 1 §1)", () => {
  const compute = computeJobId();
  const tasks = registry().tasks || {};
  const names = Object.keys(tasks);
  assert(names.length > 0, 'the registry lists tasks');
  const rejected = [];
  let customerTasks = 0;
  for (const name of names) {
    const plain = compute(name, null);
    const why = bullmqRejects(plain);
    if (why) rejected.push(`${plain} → ${why}`);
    const def = tasks[name] || {};
    if (def.arguments && def.arguments.customer) {
      customerTasks += 1;
      const customerArgs = { pubkey: PUBKEY, customerId: '7', customerName: 'alice' };
      const id = compute(name, customerArgs);
      const whyC = bullmqRejects(id);
      if (whyC) rejected.push(`${id.slice(0, 40)}… → ${whyC}`);
    }
  }
  assert(customerTasks > 0, 'the registry has customer tasks (processCustomer among them), so the customer branch is exercised');
  assert(rejected.length === 0,
    `BullMQ rejects ${rejected.length} jobId(s) the queue would compute — every such add fails at /api/run-task: ${rejected.slice(0, 5).join('; ')}`);
});

test('V2: the dedup contract holds — one stable id per (task, pubkey), different for another pubkey or task, never the bare task name (ADR 0022, AC #4)', () => {
  const compute = computeJobId();
  const args = (pubkey) => ({ pubkey, customerId: '7', customerName: 'alice' });
  const a1 = compute('processCustomer', args(PUBKEY));
  const a2 = compute('processCustomer', { ...args(PUBKEY), customerName: 'renamed' });
  assert(a1 === a2, `the same (task, pubkey) gives the same id whatever the other args — got ${show([a1, a2])}`);
  assert(a1 !== compute('processCustomer', args(OTHER)), 'another pubkey gives another id');
  assert(a1 !== compute('updateAllScoresForSingleCustomer', args(PUBKEY)), 'another task gives another id');
  assert(a1 !== 'processCustomer' && a1.includes(PUBKEY) && a1.startsWith('processCustomer'), `a customer id names the task and the pubkey — got ${show(a1)}`);
  assert(compute('updateAllScoresForOwner', null) === 'updateAllScoresForOwner', 'a non-customer id is the bare task name');
});

test('V3: the guard is real — BullMQ, through the same harness, rejects a one-colon id and an all-digit id (Amendment 1 §2)', () => {
  const colon = bullmqRejects(`processCustomer:${PUBKEY}`);
  assert(colon && /cannot contain :/i.test(colon), `a one-colon id must be rejected by BullMQ — got ${show(colon)}`);
  const digits = bullmqRejects('12345');
  assert(digits && /integer/i.test(digits), `an all-digit id must be rejected by BullMQ — got ${show(digits)}`);
  assert(bullmqRejects('updateAllScoresForOwner') === null, 'a plain task name is accepted');
});

// ── runner ───────────────────────────────────────────────────────────────────────────────────────────────────────────

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log(`  ✅ ${t.name}`);
    } catch (e) {
      fail++;
      failures.push({ name: t.name, error: e.message });
      console.log(`  ❌ ${t.name}\n      ${e.message}`);
    }
  }
  console.log(`task-queue-jobid-valid: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
