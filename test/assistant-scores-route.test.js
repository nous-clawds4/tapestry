'use strict';
/**
 * assistant-scores #1: the Scores read and the Recalculate press — the server half.
 *
 * Story: engineering-team/stories/assistant-scores/1-the-scores-page.md
 * ADR:   engineering-team/decisions/assistant-scores/0001-a-session-bound-scores-read-and-recalculate-route.md
 * Plan:  engineering-team/stories/assistant-scores/1-the-scores-page.test-plan.md
 * Other halves: test/assistant-scores-page.test.js (words, helpers, client calls, page sources) and
 * tests/brainstorm/assistant-scores.spec.js (what a viewer sees). Words and canned answers: test/helpers/scoresFixtures.js.
 *
 * Classes (all stack-free; src/api/assistant/scores.js through the seams the ADR's Implementation notes name:
 * getConfigFromFile, getAssistantPubkeyFor, getCustomer, scanLocal, countLocal, taskQueue, readScheduleEntries,
 * loadRegistry, resolveTaskTimeout, now):
 *   G — the read: last published, how many, whose Assistant, the pipeline by role, the session alone.   [AC-1, AC-4, AC-5]
 *   Q — the run state: running / queued / null / unknown, by the self-Map check's task lists.            [AC-2, AC-3]
 *   P — the press: the role's task, its args and timeout, the refusals in order, one run at a time.      [AC-2–AC-5]
 *   R — the wiring: the route table, the registration, the docs, and the task names' one rule.          [AC-4, AC-6]
 *
 * Everything FAILS against the current code: src/api/assistant/scores.js does not exist, no route is registered, and
 * selfMap.js does not export its task lists.
 *
 * Round 2 (ADR Amendment 1, after review round 1): P5 re-aimed to `processCustomer-<viewer>`; G9 the read's own 500
 * words (N3); R5 the count through src/lib/strfryScanStrict.js countStrict (N4); R6 the docs (N1, N7). The jobIds
 * themselves are checked against BullMQ in test/task-queue-jobid-valid.test.js.
 */

const fs = require('fs');
const path = require('path');
const F = require('./helpers/scoresFixtures');

const REPO = path.resolve(__dirname, '..');
const MODULE = path.join(REPO, 'src/api/assistant/scores.js');
const SELF_MAP = path.join(REPO, 'src/api/assistant/selfMap.js');
const QUEUE = path.join(REPO, 'src/manage/taskQueue/queue/index.js');
const REGISTRY = path.join(REPO, 'src/manage/taskQueue/taskRegistry.json');
const ROUTE_ACCESS = path.join(REPO, 'src/middleware/routeAccess.js');
const API_INDEX = path.join(REPO, 'src/api/index.js');
const OPENAPI = path.join(REPO, 'src/api/openapi.yaml');
const BIBLE = path.join(REPO, 'BIBLE.md');

// Accounts and their Assistants.
const OWNER = '0a'.repeat(32);
const TA = 'aa'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);
const OTHER_CUSTOMER = 'dd'.repeat(32);
const OTHER_ASSISTANT = 'd1'.repeat(32);
const ADMIN = '0b'.repeat(32);            // an Admin with an Assistant and no Customer record
const ADMIN_ASSISTANT = 'b1'.repeat(32);
const ADMIN_CUSTOMER = '0e'.repeat(32);   // an Admin who is also an active Customer
const ADMIN_CUSTOMER_ASSISTANT = 'e1'.repeat(32);
const INACTIVE = '0d'.repeat(32);          // an inactive Customer
const INACTIVE_ASSISTANT = 'd2'.repeat(32);
const GUEST = '0f'.repeat(32);             // signed in, no role, an Assistant anyway
const GUEST_ASSISTANT = 'f1'.repeat(32);
const NO_KEY = '1f'.repeat(32);            // an active Customer with no Assistant key

const ASSISTANTS = {
  [OWNER]: TA, [CUSTOMER]: CUSTOMER_ASSISTANT, [OTHER_CUSTOMER]: OTHER_ASSISTANT, [ADMIN]: ADMIN_ASSISTANT,
  [ADMIN_CUSTOMER]: ADMIN_CUSTOMER_ASSISTANT, [INACTIVE]: INACTIVE_ASSISTANT, [GUEST]: GUEST_ASSISTANT,
};
const CUSTOMERS = {
  [CUSTOMER]: { pubkey: CUSTOMER, id: 7, name: 'alice', directory: 'alice', status: 'active' },
  [OTHER_CUSTOMER]: { pubkey: OTHER_CUSTOMER, id: 8, name: 'bob', directory: 'bob', status: 'active' },
  [ADMIN_CUSTOMER]: { pubkey: ADMIN_CUSTOMER, id: 9, name: 'carol', directory: 'carol', status: 'active' },
  [INACTIVE]: { pubkey: INACTIVE, id: 10, name: 'dave', directory: 'dave', status: 'inactive' },
  [NO_KEY]: { pubkey: NO_KEY, id: 11, name: 'erin', directory: 'erin', status: 'active' },
};
const TIMEOUTS = { updateAllScoresForOwner: 14_400_000, processCustomer: 3_600_000 };
const NOW_MS = 1_760_100_000_000;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function rel(p) { return path.relative(REPO, p); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function src(p) {
  const s = safeRead(p);
  assert(s.length > 0, `${rel(p)} must exist`);
  return s;
}
const show = (x) => JSON.stringify(x);

/** Run fn with the console quiet: the handler logs every press and refusal. */
async function quiet(fn) {
  const saved = [console.log, console.warn, console.error];
  console.log = console.warn = console.error = () => {};
  try { return await fn(); } finally { [console.log, console.warn, console.error] = saved; }
}

function mod() {
  let m;
  try { m = require(MODULE); } catch (e) {
    throw new Error(`ADR § Implementation notes: ${rel(MODULE)} must exist and load in a bare checkout — ${e.message}`);
  }
  for (const name of ['createScoresStatusHandler', 'createRecalculateHandler']) {
    assert(typeof m[name] === 'function', `ADR § Implementation notes: ${rel(MODULE)} must export ${name}(deps)`);
  }
  return m;
}

// ─── The fakes ───────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A BullMQ queue holding `jobs` ({ id, name, data, state }). Every reader BullMQ offers filters by state, so the
 * module may ask with getJobs or the per-state getters; each call is recorded.
 */
function fakeQueue(name, jobs, { throws = false } = {}) {
  const asked = [];
  const pick = (types) => {
    if (throws) throw new Error('fixture: the queue read failed');
    const list = Array.isArray(types) ? types : [types];
    asked.push(...list);
    return jobs.filter((j) => list.includes(j.state));
  };
  return {
    name,
    asked,
    getJobs: async (types) => pick(types || ['active', 'waiting', 'delayed', 'prioritized', 'paused']),
    getActive: async () => pick(['active']),
    getWaiting: async () => pick(['waiting']),
    getPrioritized: async () => pick(['prioritized']),
    getDelayed: async () => pick(['delayed']),
  };
}

/** The world a test runs in: who is who, what strfry holds, and what the task queue holds. */
function world({
  queueEnabled = 'true',
  available = true,
  jobs = [],                  // [{ task, state, data }]
  throwsOn = null,            // a task whose queue read throws
  entries = [],               // schedule entries
  events = null,              // what scanLocal answers (default: two of the Assistant's own)
  scanThrows = false,
  count = F.COUNT,
  countThrows = false,
  enqueueThrows = false,
  customerThrows = false,
} = {}) {
  const calls = { scan: [], count: [], enqueue: [], queueTouched: 0, availableAsked: 0 };
  const byTask = {};
  let n = 0;
  for (const j of jobs) {
    (byTask[j.task] = byTask[j.task] || []).push({ id: j.id || `job-${n += 1}`, name: j.task, data: { taskName: j.task, ...(j.data || {}) }, state: j.state });
  }
  const queues = {};
  const taskQueue = {
    isQueueAvailable: async () => { calls.availableAsked += 1; return available; },
    getQueue: (task) => {
      calls.queueTouched += 1;
      if (!queues[task]) queues[task] = fakeQueue(task, byTask[task] || [], { throws: task === throwsOn });
      return queues[task];
    },
    getAllQueues: () => Object.values(queues),
    enqueueTask: async (args) => {
      calls.enqueue.push(args);
      if (enqueueThrows) throw new Error('fixture: Redis refused the add');
      return { id: 'enqueued' };
    },
  };
  const registry = {
    tasks: {
      updateAllScoresForOwner: { name: 'Update All Scores For Owner', scope: 'owner' },
      processCustomer: { name: 'Process Customer', arguments: { customer: true } },
    },
  };
  const deps = {
    getConfigFromFile: (key, fallback) => ({ BRAINSTORM_OWNER_PUBKEY: OWNER, TASK_QUEUE_ENABLED: queueEnabled }[key] ?? fallback),
    getAdminPubkeys: () => [ADMIN, ADMIN_CUSTOMER],
    getAssistantPubkeyFor: async (pubkey) => ASSISTANTS[pubkey] || null,
    getCustomer: async (pubkey) => {
      if (customerThrows) throw new Error('fixture: CustomerManager failed');
      return CUSTOMERS[pubkey] || null;
    },
    scanLocal: async (filter) => {
      calls.scan.push(filter);
      if (scanThrows) throw new Error('fixture: strfry scan failed');
      if (events) return events;
      const author = filter.authors && filter.authors[0];
      return [{ id: '01', kind: F.SCORE_KIND, pubkey: author, created_at: F.LATEST_AT, tags: [['d', OTHER_CUSTOMER]] }];
    },
    countLocal: async (filter) => {
      calls.count.push(filter);
      if (countThrows) throw new Error('fixture: strfry count failed');
      return count;
    },
    taskQueue: () => taskQueue,
    readScheduleEntries: () => entries,
    loadRegistry: () => registry,
    resolveTaskTimeout: (taskDef, reg) => {
      const name = Object.keys(reg.tasks).find((k) => reg.tasks[k] === taskDef);
      return { timeoutMs: TIMEOUTS[name] || 1_800_000, timeoutSource: 'fixture' };
    },
    now: () => NOW_MS,
  };
  return { deps, calls, queues };
}

function reqFor(pubkey, { query = {}, body = {}, authenticated = true } = {}) {
  return { session: pubkey ? { authenticated, pubkey } : {}, query, body, params: {}, headers: {} };
}

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(b) { this.body = b; return this; },
    send(b) { this.body = b; return this; },
  };
}

async function read(pubkey, w, opts) {
  const res = fakeRes();
  await quiet(() => mod().createScoresStatusHandler(w.deps)(reqFor(pubkey, opts), res));
  return res;
}

async function press(pubkey, w, opts) {
  const res = fakeRes();
  await quiet(() => mod().createRecalculateHandler(w.deps)(reqFor(pubkey, opts), res));
  return res;
}

const runOf = async (pubkey, w) => (await read(pubkey, w)).body.run;

// ── G — the read ─────────────────────────────────────────────────────────────────────────────────────────────────────

test("G1: a Customer's read answers their own Assistant, the newest 30382 it signed here, and the count (AC-1)", async () => {
  const w = world({
    events: [
      { id: 'a', kind: F.SCORE_KIND, pubkey: CUSTOMER_ASSISTANT, created_at: 1000, tags: [] },
      { id: 'b', kind: F.SCORE_KIND, pubkey: CUSTOMER_ASSISTANT, created_at: 3000, tags: [] },
      { id: 'c', kind: F.SCORE_KIND, pubkey: OTHER_ASSISTANT, created_at: 9000, tags: [] }, // someone else's: never "mine"
      { id: 'd', kind: 1, pubkey: CUSTOMER_ASSISTANT, created_at: 8000, tags: [] },         // not a Trusted Assertion
    ],
  });
  const res = await read(CUSTOMER, w);
  const b = res.body;
  assert(res.statusCode === 200 && b && b.success === true, `expected 200 { success: true, … }, got ${res.statusCode} ${show(b)}`);
  assert(b.signedIn === true && b.hasAssistant === true, `signedIn and hasAssistant must be true — got ${show(b)}`);
  assert(b.assistantPubkey === CUSTOMER_ASSISTANT, `the viewer's own Assistant — got ${show(b.assistantPubkey)}`);
  assert(b.published && b.published.finished === true, `published.finished must be true — got ${show(b.published)}`);
  assert(b.published.latestAt === 3000, `latestAt is the newest 30382 signed by THEIR Assistant (3000), not another author's or another kind — got ${show(b.published.latestAt)}`);
  assert(b.published.count === F.COUNT, `count comes from the strfry count — got ${show(b.published.count)}`);
  assert(b.pipeline === 'customer', `an active Customer's pipeline is 'customer' — got ${show(b.pipeline)}`);
  assert(w.calls.scan.length >= 1, 'the read must scan this instance\'s strfry');
  for (const f of w.calls.scan) {
    assert(show(f.kinds) === show([F.SCORE_KIND]) && show(f.authors) === show([CUSTOMER_ASSISTANT]),
      `every scan asks for kind ${F.SCORE_KIND} by the viewer's Assistant only — got ${show(f)}`);
  }
  assert(w.calls.count.length === 1, `one count — got ${w.calls.count.length}`);
  const cf = w.calls.count[0];
  assert(show(cf.kinds) === show([F.SCORE_KIND]) && show(cf.authors) === show([CUSTOMER_ASSISTANT]) && cf.limit === undefined,
    `the count filter is { kinds: [${F.SCORE_KIND}], authors: [their Assistant] } with no limit — got ${show(cf)}`);
});

test("G2: the Owner's read answers the instance TA and the 'owner' pipeline (AC-1)", async () => {
  const w = world();
  const b = (await read(OWNER, w)).body;
  assert(b && b.assistantPubkey === TA, `the Owner's Assistant is the TA — got ${show(b && b.assistantPubkey)}`);
  assert(b.pipeline === 'owner', `the Owner's pipeline is 'owner' — got ${show(b.pipeline)}`);
  assert(w.calls.scan.every((f) => show(f.authors) === show([TA])), `scans ask for the TA's events — got ${show(w.calls.scan)}`);
  assert(b.published.latestAt === F.LATEST_AT, `latestAt — got ${show(b.published.latestAt)}`);
});

test('G3: an Assistant that has published none reads latestAt null and count 0 — "not yet", not a failure (AC-1)', async () => {
  const w = world({ events: [], count: 0 });
  const b = (await read(CUSTOMER, w)).body;
  assert(b && b.published && b.published.finished === true, `a scan that answered is finished — got ${show(b && b.published)}`);
  assert(b.published.latestAt === null, `latestAt null — got ${show(b.published.latestAt)}`);
  assert(b.published.count === 0, `count 0 is a real count, not null — got ${show(b.published.count)}`);
});

test('G4: a failed scan is never read as "not yet"; a failed count alone leaves the time and makes the count null (ADR sub-decision 2)', async () => {
  let b = (await read(CUSTOMER, world({ scanThrows: true }))).body;
  assert(b && b.success === true, `a failed scan still answers — got ${show(b)}`);
  assert(b.published && b.published.finished === false, `a failed scan makes published.finished false — got ${show(b.published)}`);
  assert(!('latestAt' in b.published) || b.published.latestAt === undefined,
    `a failed scan must not answer a latestAt (null would read as "not yet") — got ${show(b.published)}`);
  b = (await read(CUSTOMER, world({ countThrows: true }))).body;
  assert(b.published.finished === true && b.published.latestAt === F.LATEST_AT, `the time still shows — got ${show(b.published)}`);
  assert(b.published.count === null, `a failed count is null — got ${show(b.published.count)}`);
});

test('G5: signed out, or not authenticated, reads nothing and answers signedIn false (AC-5)', async () => {
  for (const [label, req] of [['no session', null], ['an unauthenticated session', CUSTOMER]]) {
    const w = world();
    const res = fakeRes();
    const r = req === null ? reqFor(null) : reqFor(req, { authenticated: false });
    await quiet(() => mod().createScoresStatusHandler(w.deps)(r, res));
    assert(res.statusCode === 200 && res.body && res.body.success === true && res.body.signedIn === false,
      `${label}: expected 200 { success: true, signedIn: false } — got ${res.statusCode} ${show(res.body)}`);
    assert(w.calls.scan.length === 0 && w.calls.count.length === 0 && w.calls.queueTouched === 0,
      `${label}: nothing is read — got ${show(w.calls)}`);
  }
});

test('G6: a viewer with no Assistant here answers hasAssistant false and reads nothing (AC-5)', async () => {
  const w = world();
  const res = await read(NO_KEY, w);
  assert(res.statusCode === 200 && res.body && res.body.success === true && res.body.signedIn === true && res.body.hasAssistant === false,
    `expected { success: true, signedIn: true, hasAssistant: false } — got ${show(res.body)}`);
  assert(w.calls.scan.length === 0 && w.calls.count.length === 0 && w.calls.queueTouched === 0, `nothing is read — got ${show(w.calls)}`);
});

test('G7: an Admin who is not a Customer, a guest and an inactive Customer still see their status, with pipeline and run null (AC-5)', async () => {
  for (const [label, who, assistant] of [['an Admin', ADMIN, ADMIN_ASSISTANT], ['a guest', GUEST, GUEST_ASSISTANT], ['an inactive Customer', INACTIVE, INACTIVE_ASSISTANT]]) {
    const w = world({ jobs: [{ task: 'processAllActiveCustomers', state: 'active' }] });
    const b = (await read(who, w)).body;
    assert(b && b.success === true && b.hasAssistant === true && b.assistantPubkey === assistant, `${label}: their Assistant — got ${show(b)}`);
    assert(b.published && b.published.finished === true && b.published.latestAt === F.LATEST_AT, `${label}: the status still shows — got ${show(b.published)}`);
    assert(b.pipeline === null, `${label}: pipeline null — got ${show(b.pipeline)}`);
    assert(b.run === null, `${label}: run null (nothing to be running) — got ${show(b.run)}`);
  }
  const b = (await read(ADMIN_CUSTOMER, world())).body;
  assert(b.pipeline === 'customer', `an Admin who is also an active Customer has the 'customer' pipeline — got ${show(b.pipeline)}`);
});

test('G8: the read takes the viewer from the session alone — a pubkey in the query or body changes nothing (AC-4)', async () => {
  const w = world();
  const b = (await read(CUSTOMER, w, { query: { pubkey: OTHER_CUSTOMER, assistant: OTHER_ASSISTANT }, body: { pubkey: OTHER_CUSTOMER } })).body;
  assert(b && b.assistantPubkey === CUSTOMER_ASSISTANT, `still the session viewer's Assistant — got ${show(b && b.assistantPubkey)}`);
  const named = show(w.calls.scan) + show(w.calls.count);
  assert(w.calls.scan.length > 0 && !named.includes(OTHER_ASSISTANT) && !named.includes(OTHER_CUSTOMER),
    `no read names the other person — got ${named}`);
});

// ── Q — the run state ───────────────────────────────────────────────────────────────────────────────────────────────

test("Q1: the Owner's run — active on any owner score task is running, waiting is queued, running wins (AC-2, AC-3)", async () => {
  assert(await runOf(OWNER, world()) === null, 'no jobs: run null');
  assert(await runOf(OWNER, world({ jobs: [{ task: 'updateAllScoresForOwner', state: 'active' }] })) === 'running',
    'an active updateAllScoresForOwner is running');
  assert(await runOf(OWNER, world({ jobs: [{ task: 'processAllTasks', state: 'waiting' }] })) === 'queued',
    'a waiting processAllTasks is queued (it re-signs the Owner\'s Scores)');
  assert(await runOf(OWNER, world({ jobs: [{ task: 'exportOwnerKind30382', state: 'prioritized' }] })) === 'queued',
    'a prioritized exportOwnerKind30382 is queued');
  assert(await runOf(OWNER, world({ jobs: [
    { task: 'updateAllScoresForOwner', state: 'waiting' },
    { task: 'processAllTasks', state: 'active' },
  ] })) === 'running', 'running wins over queued');
});

test("Q2: a Customer's run — their own manual job counts, another Customer's does not (AC-3)", async () => {
  const mine = { pubkey: CUSTOMER, customerId: '7', customerName: 'alice' };
  const theirs = { pubkey: OTHER_CUSTOMER, customerId: '8', customerName: 'bob' };
  assert(await runOf(CUSTOMER, world({ jobs: [{ task: 'processCustomer', state: 'waiting', data: { customerArgs: mine } }] })) === 'queued',
    'their waiting processCustomer is queued');
  assert(await runOf(CUSTOMER, world({ jobs: [{ task: 'exportCustomerKind30382', state: 'active', data: { customerArgs: mine } }] })) === 'running',
    'their active exportCustomerKind30382 is running');
  assert(await runOf(CUSTOMER, world({ jobs: [{ task: 'processCustomer', state: 'active', data: { customerArgs: theirs } }] })) === null,
    "another Customer's run is not theirs");
});

test("Q3: a scheduled fire counts by its entry's customer, compared case-insensitively (AC-3)", async () => {
  const entries = [
    { id: 'e-mine', taskId: 'processCustomer', enabled: true, args: { customer: CUSTOMER.toUpperCase() } },
    { id: 'e-theirs', taskId: 'processCustomer', enabled: true, args: { customer: OTHER_CUSTOMER } },
  ];
  assert(await runOf(CUSTOMER, world({ entries, jobs: [{ task: 'processCustomer', state: 'active', data: { entryId: 'e-mine' } }] })) === 'running',
    "an active fire of the viewer's own entry is running");
  assert(await runOf(CUSTOMER, world({ entries, jobs: [{ task: 'processCustomer', state: 'active', data: { entryId: 'e-theirs' } }] })) === null,
    "a fire of another Customer's entry is not theirs");
  assert(await runOf(CUSTOMER, world({ entries, jobs: [{ task: 'processCustomer', state: 'active', data: { entryId: 'e-gone' } }] })) === null,
    'a fire whose entry is gone is not theirs');
});

test("Q4: an orchestrator for every Customer counts for each Customer, and Owner and Customer tasks don't cross (AC-3)", async () => {
  assert(await runOf(CUSTOMER, world({ jobs: [{ task: 'processAllActiveCustomers', state: 'active' }] })) === 'running',
    'processAllActiveCustomers re-signs every Customer\'s Scores');
  assert(await runOf(CUSTOMER, world({ jobs: [{ task: 'processAllTasks', state: 'waiting' }] })) === 'queued',
    'processAllTasks counts for a Customer too');
  assert(await runOf(CUSTOMER, world({ jobs: [{ task: 'updateAllScoresForOwner', state: 'active' }] })) === null,
    "the Owner's own task is not a Customer's run");
  assert(await runOf(OWNER, world({ jobs: [{ task: 'processCustomer', state: 'active', data: { customerArgs: { pubkey: CUSTOMER } } }] })) === null,
    "a Customer's task is not the Owner's run");
});

test("Q5: a delayed job never counts — a Job Scheduler's next fire waits there (ADR sub-decision 3)", async () => {
  const w = world({ jobs: [{ task: 'updateAllScoresForOwner', state: 'delayed' }, { task: 'processCustomer', state: 'delayed', data: { customerArgs: { pubkey: CUSTOMER } } }] });
  assert(await runOf(OWNER, w) === null, "the Owner's delayed fire is not queued");
  assert(await runOf(CUSTOMER, world({ jobs: [{ task: 'processCustomer', state: 'delayed', data: { customerArgs: { pubkey: CUSTOMER } } }] })) === null,
    "a Customer's delayed fire is not queued");
  assert(w.calls.queueTouched > 0, 'the path under test ran: the queues were read');
});

test("Q6: the run is 'unknown' when the queue is off, unavailable, or a read throws — never a claim either way (story § Open questions)", async () => {
  let w = world({ queueEnabled: 'false', jobs: [{ task: 'updateAllScoresForOwner', state: 'active' }] });
  let b = (await read(OWNER, w)).body;
  assert(b && b.run === 'unknown', `TASK_QUEUE_ENABLED false: run 'unknown' — got ${show(b && b.run)}`);
  assert(w.calls.queueTouched === 0, 'with the queue off the queue module is not touched');
  assert(b.published && b.published.latestAt === F.LATEST_AT, 'the status still shows');
  b = (await read(OWNER, world({ available: false }))).body;
  assert(b.run === 'unknown', `Redis unavailable: run 'unknown' — got ${show(b.run)}`);
  b = (await read(OWNER, world({ throwsOn: 'updateAllScoresForOwner' }))).body;
  assert(b.success === true && b.run === 'unknown', `a queue read that throws: run 'unknown', still 200 — got ${show(b)}`);
});

// ── P — the press ───────────────────────────────────────────────────────────────────────────────────────────────────

function onlyEnqueue(w) {
  assert(w.calls.enqueue.length === 1, `exactly one enqueue — got ${w.calls.enqueue.length}: ${show(w.calls.enqueue)}`);
  return w.calls.enqueue[0];
}
const noParams = (q) => !q || (typeof q === 'object' && Object.keys(q).length === 0);

test("P1: the Owner's press enqueues updateAllScoresForOwner, with no customer and the task's own timeout, and answers 202 queued (AC-2)", async () => {
  const w = world();
  const res = await press(OWNER, w);
  assert(res.statusCode === 202, `expected 202 — got ${res.statusCode} ${show(res.body)}`);
  assert(res.body && res.body.success === true && res.body.run === 'queued', `expected { success: true, run: 'queued' } — got ${show(res.body)}`);
  const args = onlyEnqueue(w);
  assert(args.taskName === F.PIPELINE_TASKS.owner, `taskName ${F.PIPELINE_TASKS.owner} — got ${show(args.taskName)}`);
  assert(!args.customerArgs, `no customer args for the Owner — got ${show(args.customerArgs)}`);
  assert(noParams(args.queryParams), `no query params — got ${show(args.queryParams)}`);
  assert(args.timeoutMs === TIMEOUTS.updateAllScoresForOwner, `the timeout resolved for the task (${TIMEOUTS.updateAllScoresForOwner}) — got ${show(args.timeoutMs)}`);
});

test("P2: an active Customer's press enqueues their own processCustomer, with run-task's customer args (AC-2)", async () => {
  const w = world();
  const res = await press(CUSTOMER, w);
  assert(res.statusCode === 202 && res.body && res.body.run === 'queued', `expected 202 queued — got ${res.statusCode} ${show(res.body)}`);
  const args = onlyEnqueue(w);
  assert(args.taskName === F.PIPELINE_TASKS.customer, `taskName ${F.PIPELINE_TASKS.customer} — got ${show(args.taskName)}`);
  const c = args.customerArgs || {};
  assert(c.pubkey === CUSTOMER && c.customerId === '7' && c.customerName === 'alice',
    `customerArgs { pubkey, customerId as a string, customerName } from the Customer record — got ${show(c)}`);
  assert(noParams(args.queryParams), `no query params — got ${show(args.queryParams)}`);
  assert(args.timeoutMs === TIMEOUTS.processCustomer, `the timeout resolved for processCustomer — got ${show(args.timeoutMs)}`);
});

test('P3: an Admin who is also an active Customer presses as a Customer (AC-2)', async () => {
  const w = world();
  const res = await press(ADMIN_CUSTOMER, w);
  assert(res.statusCode === 202, `expected 202 — got ${res.statusCode} ${show(res.body)}`);
  const args = onlyEnqueue(w);
  assert(args.taskName === 'processCustomer' && args.customerArgs && args.customerArgs.pubkey === ADMIN_CUSTOMER,
    `their own processCustomer — got ${show(args)}`);
});

test('P4: a press while a run of theirs is queued or running answers 409 already, carries the run, and enqueues nothing (AC-3)', async () => {
  for (const [state, run] of [['active', 'running'], ['waiting', 'queued']]) {
    const w = world({ jobs: [{ task: 'processCustomer', state, data: { customerArgs: { pubkey: CUSTOMER } } }] });
    const res = await press(CUSTOMER, w);
    assert(res.statusCode === 409, `${state}: expected 409 — got ${res.statusCode} ${show(res.body)}`);
    assert(res.body && res.body.success === false && res.body.code === F.CODES.already && res.body.run === run,
      `${state}: expected { success: false, code: '${F.CODES.already}', run: '${run}' } — got ${show(res.body)}`);
    assert(w.calls.enqueue.length === 0, `${state}: nothing enqueued — got ${show(w.calls.enqueue)}`);
  }
  const w = world({ jobs: [{ task: 'processAllActiveCustomers', state: 'active' }] });
  const res = await press(CUSTOMER, w);
  assert(res.statusCode === 409 && w.calls.enqueue.length === 0, `an orchestrator run counts too — got ${res.statusCode} ${show(w.calls.enqueue)}`);
});

test("P5: two presses that race past the check enqueue one jobId — run-task's own, `processCustomer-<viewer>` (AC-3; re-aimed by Amendment 1)", async () => {
  const w = world();
  const handler = mod().createRecalculateHandler(w.deps);
  const [a, b] = [fakeRes(), fakeRes()];
  await quiet(() => Promise.all([handler(reqFor(CUSTOMER), a), handler(reqFor(CUSTOMER), b)]));
  assert(a.statusCode === 202 || b.statusCode === 202, `at least one press is accepted — got ${a.statusCode}, ${b.statusCode}`);
  let computeJobId;
  try { ({ computeJobId } = require(QUEUE)); } catch (e) { throw new Error(`${rel(QUEUE)} must load (run \`npm ci\`): ${e.message}`); }
  const ids = new Set(w.calls.enqueue.map((x) => computeJobId(x.taskName, x.customerArgs)));
  // Re-aimed by ADR Amendment 1: BullMQ rejects the one-colon `processCustomer:<pubkey>`; the separator is `-`.
  assert(ids.size === 1 && ids.has(`processCustomer-${CUSTOMER}`),
    `every enqueue dedups to run-task's jobId processCustomer-<viewer> — got ${show([...ids])}`);
  const ow = world();
  await press(OWNER, ow);
  const ownerId = computeJobId(onlyEnqueue(ow).taskName, onlyEnqueue(ow).customerArgs);
  assert(ownerId === 'updateAllScoresForOwner', `the Owner's press dedups to run-task's jobId — got ${show(ownerId)}`);
});

test('P6: the press names nobody — another pubkey or task in the query or body still runs only the caller\'s own pipeline (AC-4)', async () => {
  const w = world();
  const res = await press(CUSTOMER, w, {
    query: { pubkey: OTHER_CUSTOMER, taskName: 'processAllTasks', warmStart: 'true' },
    body: { pubkey: OTHER_CUSTOMER, taskName: 'processAllTasks', customerArgs: { pubkey: OTHER_CUSTOMER } },
  });
  assert(res.statusCode === 202, `expected 202 — got ${res.statusCode} ${show(res.body)}`);
  const args = onlyEnqueue(w);
  assert(args.taskName === 'processCustomer', `the caller's pipeline, not the requested task — got ${show(args.taskName)}`);
  assert(args.customerArgs && args.customerArgs.pubkey === CUSTOMER, `the caller, not the named pubkey — got ${show(args.customerArgs)}`);
  assert(noParams(args.queryParams), `nothing from the request reaches the task — got ${show(args.queryParams)}`);
});

test('P7: a signed-out or unauthenticated press answers 401 not-signed-in and starts nothing (AC-4)', async () => {
  for (const [label, req] of [['no session', reqFor(null)], ['an unauthenticated session', reqFor(CUSTOMER, { authenticated: false })]]) {
    const w = world();
    const res = fakeRes();
    await quiet(() => mod().createRecalculateHandler(w.deps)(req, res));
    assert(res.statusCode === 401 && res.body && res.body.success === false && res.body.code === F.CODES.notSignedIn,
      `${label}: expected 401 { success: false, code: '${F.CODES.notSignedIn}' } — got ${res.statusCode} ${show(res.body)}`);
    assert(w.calls.enqueue.length === 0 && w.calls.queueTouched === 0, `${label}: nothing starts — got ${show(w.calls)}`);
  }
});

test('P8: no Assistant here answers 403 no-assistant, before the pipeline is asked (AC-5)', async () => {
  const w = world();
  const res = await press(NO_KEY, w); // an active Customer with no Assistant key
  assert(res.statusCode === 403 && res.body && res.body.code === F.CODES.noAssistant,
    `expected 403 { code: '${F.CODES.noAssistant}' } — got ${res.statusCode} ${show(res.body)}`);
  assert(w.calls.enqueue.length === 0, `nothing enqueued — got ${show(w.calls.enqueue)}`);
});

test('P9: an Admin who is not a Customer, a guest and an inactive Customer answer 403 no-pipeline and start nothing (AC-5)', async () => {
  for (const [label, who] of [['an Admin', ADMIN], ['a guest', GUEST], ['an inactive Customer', INACTIVE]]) {
    const w = world();
    const res = await press(who, w);
    assert(res.statusCode === 403 && res.body && res.body.success === false && res.body.code === F.CODES.noPipeline,
      `${label}: expected 403 { success: false, code: '${F.CODES.noPipeline}' } — got ${res.statusCode} ${show(res.body)}`);
    assert(w.calls.enqueue.length === 0, `${label}: nothing enqueued`);
  }
});

test('P10: with the queue off or unavailable a press answers 503 queue-unavailable and enqueues nothing (ADR sub-decision 4)', async () => {
  for (const [label, opts] of [['the flag off', { queueEnabled: 'false' }], ['Redis unavailable', { available: false }], ['a queue read that throws', { throwsOn: 'processCustomer' }]]) {
    const w = world(opts);
    const res = await press(CUSTOMER, w);
    assert(res.statusCode === 503 && res.body && res.body.success === false && res.body.code === F.CODES.queueUnavailable,
      `${label}: expected 503 { code: '${F.CODES.queueUnavailable}' } — got ${res.statusCode} ${show(res.body)}`);
    assert(w.calls.enqueue.length === 0, `${label}: nothing enqueued`);
  }
});

test('P11: an enqueue that throws answers 500 { success: false } rather than claiming a run (ADR sub-decision 4)', async () => {
  const w = world({ enqueueThrows: true });
  const res = await press(OWNER, w);
  assert(w.calls.enqueue.length === 1, 'the path under test ran: the enqueue was tried');
  assert(res.statusCode === 500 && res.body && res.body.success === false, `expected 500 { success: false } — got ${res.statusCode} ${show(res.body)}`);
  assert(res.body.run !== 'queued', `a failed enqueue must not answer run 'queued' — got ${show(res.body)}`);
});

// ── R — the wiring ──────────────────────────────────────────────────────────────────────────────────────────────────

test('R1: the route table opens the read to everyone and the press to a signed-in person, with its reason (AC-4)', () => {
  const ra = require(ROUTE_ACCESS);
  const get = ra.ROUTE_ACCESS[`GET ${F.ROUTES.status}`];
  assert(get && get.access === 'public' && get.kind === 'read', `'GET ${F.ROUTES.status}': PUBLIC_READ — got ${show(get)}`);
  const post = ra.ROUTE_ACCESS[`POST ${F.ROUTES.recalculate}`];
  assert(post && post.access === 'signed-in' && post.kind === 'action' && typeof post.why === 'string' && post.why.length > 0,
    `'POST ${F.ROUTES.recalculate}': allow('signed-in', why) — got ${show(post)}`);
  assert(ra.resolveRouteAccess('POST', F.ROUTES.recalculate) === 'signed-in', 'the press resolves signed-in');
  assert(ra.resolveRouteAccess('GET', F.ROUTES.status) === 'public', 'the read resolves public');
});

test('R2: src/api/index.js registers both routes', () => {
  const s = src(API_INDEX);
  const esc = (p) => p.replace(/\//g, '\\/');
  assert(new RegExp(`app\\.get\\(\\s*['"\`]${esc(F.ROUTES.status)}['"\`]\\s*,`).test(s), `register app.get('${F.ROUTES.status}', …)`);
  assert(new RegExp(`app\\.post\\(\\s*['"\`]${esc(F.ROUTES.recalculate)}['"\`]\\s*,`).test(s), `register app.post('${F.ROUTES.recalculate}', …)`);
});

test('R3: the API docs carry both routes — openapi.yaml and the BIBLE API table', () => {
  const o = src(OPENAPI);
  for (const p of [F.ROUTES.status, F.ROUTES.recalculate]) assert(o.includes(`  ${p}:`), `${rel(OPENAPI)} must document ${p}`);
  const b = src(BIBLE);
  assert(new RegExp(`\\| GET \\| \`${F.ROUTES.status.replace(/\//g, '\\/')}\` \\|`).test(b), `BIBLE.md's API table needs a row for GET ${F.ROUTES.status}`);
  assert(new RegExp(`\\| POST \\| \`${F.ROUTES.recalculate.replace(/\//g, '\\/')}\` \\|`).test(b), `BIBLE.md's API table needs a row for POST ${F.ROUTES.recalculate}`);
});

test("R4: the tasks a press enqueues are real registry tasks and sit in the self-Map check's matching lists (ADR § Consequences)", () => {
  const m = mod();
  assert(m.PIPELINE_TASKS && m.PIPELINE_TASKS.owner === F.PIPELINE_TASKS.owner && m.PIPELINE_TASKS.customer === F.PIPELINE_TASKS.customer,
    `scores.js exports PIPELINE_TASKS ${show(F.PIPELINE_TASKS)} — got ${show(m.PIPELINE_TASKS)}`);
  const sm = require(SELF_MAP);
  for (const name of ['OWNER_SCORE_TASKS', 'ALL_CUSTOMER_SCORE_TASKS', 'ONE_CUSTOMER_SCORE_TASKS']) {
    assert(Array.isArray(sm[name]), `selfMap.js must export ${name} (ADR § Implementation notes) — got ${show(sm[name])}`);
  }
  assert(sm.OWNER_SCORE_TASKS.includes(F.PIPELINE_TASKS.owner), `${F.PIPELINE_TASKS.owner} is in OWNER_SCORE_TASKS`);
  assert(sm.ONE_CUSTOMER_SCORE_TASKS.includes(F.PIPELINE_TASKS.customer), `${F.PIPELINE_TASKS.customer} is in ONE_CUSTOMER_SCORE_TASKS`);
  const registry = JSON.parse(src(REGISTRY));
  for (const t of Object.values(F.PIPELINE_TASKS)) assert(registry.tasks && registry.tasks[t], `${t} must be a registry task`);
  assert(registry.tasks[F.PIPELINE_TASKS.customer].arguments && registry.tasks[F.PIPELINE_TASKS.customer].arguments.customer === true,
    `${F.PIPELINE_TASKS.customer} takes a customer`);
});

// ── Round 2 (ADR Amendment 1) ──────────────────────────────────────────────────────────────────────────────────────

test("G9: a read that fails answers 500 with the read's own words, not the press's (Amendment 1, N3)", async () => {
  const w = world({ customerThrows: true });
  const res = await read(CUSTOMER, w);
  assert(res.statusCode === 500 && res.body && res.body.success === false, `expected 500 { success: false } — got ${res.statusCode} ${show(res.body)}`);
  assert(res.body.error === F.AMENDMENT_1.readFailed, `expected "${F.AMENDMENT_1.readFailed}" — got ${show(res.body.error)}`);
});

test('R5: the count is read with countStrict from src/lib/strfryScanStrict.js; scores.js keeps no count reader of its own (Amendment 1, N4)', () => {
  const s = src(MODULE);
  assert(/require\(\s*['"][./]*\/lib\/strfryScanStrict(?:\.js)?['"]\s*\)/.test(s) && /\bcountStrict\b/.test(s),
    "scores.js must read the count through require('../../lib/strfryScanStrict').countStrict");
  assert(!/function\s+countLocalStrict\b/.test(s), 'scores.js must not define its own countLocalStrict');
  assert(!/['"]--count['"]/.test(s), 'scores.js must not spawn `strfry scan --count` itself');
});

test('R6: the docs say a signed-out press is refused by the route table, and that queued means waiting or prioritized (Amendment 1, N1, N7)', () => {
  const o = src(OPENAPI);
  const at = (p) => { const i = o.indexOf(`  ${p}:`); assert(i >= 0, `openapi documents ${p}`); const next = o.slice(i + 3).search(/\n  \/[a-zA-Z]/); return next < 0 ? o.slice(i) : o.slice(i, i + 3 + next); };
  assert(/prioritized/.test(at(F.ROUTES.status)), `openapi's ${F.ROUTES.status} says queued counts prioritized jobs too`);
  assert(/route table/i.test(at(F.ROUTES.recalculate)), `openapi's ${F.ROUTES.recalculate} says the 401 comes from the route table`);
  const row = (src(BIBLE).split('\n').find((l) => l.startsWith(`| POST | \`${F.ROUTES.recalculate}\` |`)) || '');
  assert(/route table/i.test(row), `the BIBLE row for POST ${F.ROUTES.recalculate} says the signed-out 401 comes from the route table`);
});

// ── runner ──────────────────────────────────────────────────────────────────────────────────────────────────────────

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
  console.log(`assistant-scores-route: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
