'use strict';
/**
 * The Scores page's read and its Recalculate press (assistant-scores #1, ADR assistant-scores/0001).
 *
 * GET /api/assistant/scores — session-shaped, like GET /api/assistant/attention. For the signed-in viewer's own
 * Assistant here (the Owner's is the instance TA): when it last published Trusted Assertions (the created_at of the
 * newest kind 30382 it signed on this instance's strfry; both publishers re-sign every event every run), how many it
 * has published, which pipeline recalculates the viewer's scores, and whether a run of the viewer's is queued or running.
 *
 * POST /api/assistant/scores/recalculate — a narrow, session-bound press: the request names nothing. The Owner's run is
 * updateAllScoresForOwner; an active Customer's (an Admin who is one included) is their own processCustomer; nobody
 * else has one here. Refusals come first, each starting nothing: 401 not-signed-in, 403 no-assistant, 403 no-pipeline,
 * 503 queue-unavailable, 409 already. Otherwise it enqueues on the task's own BullMQ queue with run-task's own jobId
 * (computeJobId: processCustomer:<pubkey>, updateAllScoresForOwner), so two presses, or a press and an operator's
 * trigger, join one run (ADR 0022).
 *
 * "A run of mine" is read with the self-Map check's own task lists (selfMap.js, ADR assistant-self-map/0001
 * sub-decision 6), so the two pages cannot disagree: running when a matching job is active, queued when one is waiting
 * or prioritized, never delayed (a Job Scheduler's next fire waits there), and 'unknown' when the queue is off,
 * unavailable, or a read throws.
 */

const HEX64 = /^[0-9a-f]{64}$/i;
const SCORE_KIND = 30382;
/** strfry's count of an Assistant's 30382s is one index walk; give it this long. */
const COUNT_TIMEOUT_MS = 15000;

/** Each role's one pipeline: the registry task a press enqueues (ADR sub-decision 1). */
const PIPELINE_TASKS = Object.freeze({ owner: 'updateAllScoresForOwner', customer: 'processCustomer' });

const CODES = Object.freeze({
  NOT_SIGNED_IN: 'not-signed-in',
  NO_ASSISTANT: 'no-assistant',
  NO_PIPELINE: 'no-pipeline',
  QUEUE_UNAVAILABLE: 'queue-unavailable',
  ALREADY: 'already',
  FAILED: 'failed',
});

/** For API callers and the logs; the page has its own words for each code. */
const WORDS = {
  [CODES.NOT_SIGNED_IN]: 'Sign in to recalculate your scores.',
  [CODES.NO_ASSISTANT]: "You don't have a Tapestry Assistant on this instance yet.",
  [CODES.NO_PIPELINE]: "Your scores aren't calculated on this instance. That's done for the Owner and for Customers.",
  [CODES.QUEUE_UNAVAILABLE]: "This instance's task queue isn't available right now.",
  [CODES.ALREADY]: 'A recalculation is already queued or running.',
  [CODES.FAILED]: 'This instance could not start a recalculation.',
};

/** `strfry scan --count <filter>`, as an integer; rejects on an error, a timeout or anything that is not one. */
function countLocalStrict(filter) {
  const { execFile } = require('child_process');
  return new Promise((resolve, reject) => {
    execFile('strfry', ['scan', '--count', JSON.stringify(filter)], { timeout: COUNT_TIMEOUT_MS }, (err, stdout) => {
      if (err) return reject(err);
      const n = Number(String(stdout).trim().split('\n').pop());
      return Number.isInteger(n) && n >= 0 ? resolve(n) : reject(new Error('strfry scan --count printed no count'));
    });
  });
}

/** The real dependencies, required lazily so the module loads in a bare checkout. */
function defaultDeps() {
  return {
    getConfigFromFile: (key, fallback) => require('../../utils/config').getConfigFromFile(key, fallback),
    getAssistantPubkeyFor: (pubkey) => require('../../utils/assistantKeys').getAssistantPubkeyFor(pubkey),
    getCustomer: async (pubkey) => {
      const CustomerManager = require('../../utils/customerManager');
      const cm = new CustomerManager();
      await cm.initialize();
      return cm.getCustomer(pubkey);
    },
    scanLocal: (filter) => require('../setup/status').scanLocalStrict(filter),
    countLocal: (filter) => countLocalStrict(filter),
    taskQueue: () => require('../../manage/taskQueue/queue'),
    readScheduleEntries: () => {
      const config = require('../scheduled-tasks').readConfig();
      return config && Array.isArray(config.entries) ? config.entries : [];
    },
    // The registry the queue itself was built from (initTaskQueue's own path).
    loadRegistry: () => {
      const fs = require('fs');
      const path = require('path');
      const manageDir = require('../../utils/brainstormConfig').get('BRAINSTORM_MODULE_MANAGE_DIR') || path.join(__dirname, '../../manage');
      return JSON.parse(fs.readFileSync(path.join(manageDir, 'taskQueue/taskRegistry.json'), 'utf8'));
    },
    resolveTaskTimeout: (taskDef, registry) => require('../../utils/taskTimeout').resolveTaskTimeout(taskDef, registry),
    now: () => Date.now(),
  };
}

/** The session's viewer, lower-cased, or null when there is no verified session. */
function viewerOf(req) {
  const session = req && req.session;
  return session && session.authenticated === true && typeof session.pubkey === 'string' && HEX64.test(session.pubkey)
    ? session.pubkey.toLowerCase()
    : null;
}

/**
 * Whose Assistant, and which pipeline (ADR sub-decision 1). The Owner first; then an active Customer, whatever their
 * admin status; anyone else has no pipeline here.
 * @returns {Promise<{ assistantPubkey: ?string, pipeline: 'owner'|'customer'|null, customerArgs: ?Object }>}
 */
async function resolveViewer({ viewer }, d) {
  const assistant = await d.getAssistantPubkeyFor(viewer);
  if (typeof assistant !== 'string' || !HEX64.test(assistant)) return { assistantPubkey: null, pipeline: null, customerArgs: null };
  const assistantPubkey = assistant.toLowerCase();
  const owner = String(d.getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', '') || '').toLowerCase();
  if (owner && viewer === owner) return { assistantPubkey, pipeline: 'owner', customerArgs: null };
  const customer = await d.getCustomer(viewer);
  if (customer && customer.status === 'active') {
    // run-task's and the scheduler's shape (entryResolver.js), so the jobId is run-task's own.
    const customerArgs = { pubkey: customer.pubkey, customerId: String(customer.id), customerName: customer.name };
    return { assistantPubkey, pipeline: 'customer', customerArgs };
  }
  return { assistantPubkey, pipeline: null, customerArgs: null };
}

/**
 * When the Assistant last published, and how many (ADR sub-decision 2). The two reads fail apart: a failed scan is
 * never "not yet", and a failed count leaves the time.
 * @returns {Promise<{ finished: true, latestAt: ?number, count: ?number } | { finished: false }>}
 */
async function readPublished({ assistantPubkey }, d) {
  const filter = { kinds: [SCORE_KIND], authors: [assistantPubkey] };
  const [scan, count] = await Promise.allSettled([d.scanLocal({ ...filter, limit: 1 }), d.countLocal(filter)]);
  if (scan.status !== 'fulfilled') return { finished: false };
  const { newest } = require('./attention');
  const events = Array.isArray(scan.value) ? scan.value : [];
  const own = events.filter((e) => e && e.kind === SCORE_KIND && String(e.pubkey).toLowerCase() === assistantPubkey);
  const latest = newest(own);
  return {
    finished: true,
    latestAt: latest && Number.isFinite(latest.created_at) ? latest.created_at : null,
    count: count.status === 'fulfilled' && Number.isInteger(count.value) ? count.value : null,
  };
}

/**
 * Is a run of the viewer's queued or running? (ADR sub-decision 3.)
 * @returns {Promise<'running'|'queued'|'unknown'|null>}
 */
async function readRunState({ viewer, pipeline }, d) {
  if (!pipeline) return null;
  if (d.getConfigFromFile('TASK_QUEUE_ENABLED', 'false') !== 'true') return 'unknown';
  try {
    const queues = d.taskQueue();
    if (!(await queues.isQueueAvailable())) return 'unknown';
    const { OWNER_SCORE_TASKS, ALL_CUSTOMER_SCORE_TASKS, ONE_CUSTOMER_SCORE_TASKS } = require('./selfMap');
    let entries = null;
    const isViewers = (job) => {
      const data = (job && job.data) || {};
      if (data.customerArgs && String(data.customerArgs.pubkey || '').toLowerCase() === viewer) return true;
      if (data.entryId) {
        if (!entries) entries = d.readScheduleEntries() || [];
        const entry = entries.find((e) => e && e.id === data.entryId);
        return !!(entry && entry.args && String(entry.args.customer || '').toLowerCase() === viewer);
      }
      return false;
    };
    // Every job on these tasks is the viewer's run; on ONE_CUSTOMER_SCORE_TASKS only their own.
    const groups = pipeline === 'owner'
      ? [[OWNER_SCORE_TASKS, () => true]]
      : [[ALL_CUSTOMER_SCORE_TASKS, () => true], [ONE_CUSTOMER_SCORE_TASKS, isViewers]];
    let state = null;
    for (const [tasks, matches] of groups) {
      for (const task of tasks) {
        const queue = queues.getQueue(task);
        if (!queue) continue;
        if ((await queue.getJobs(['active'])).some(matches)) return 'running';
        if (!state && (await queue.getJobs(['waiting', 'prioritized'])).some(matches)) state = 'queued';
      }
    }
    return state;
  } catch {
    return 'unknown';
  }
}

function createScoresStatusHandler(deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  return async function handleScoresStatus(req, res) {
    const viewer = viewerOf(req);
    if (!viewer) return res.json({ success: true, signedIn: false });
    try {
      const who = await resolveViewer({ viewer }, d);
      if (!who.assistantPubkey) return res.json({ success: true, signedIn: true, hasAssistant: false });
      const [published, run] = await Promise.all([
        readPublished({ assistantPubkey: who.assistantPubkey }, d),
        readRunState({ viewer, pipeline: who.pipeline }, d),
      ]);
      return res.json({
        success: true,
        signedIn: true,
        hasAssistant: true,
        assistantPubkey: who.assistantPubkey,
        published,
        pipeline: who.pipeline,
        run,
      });
    } catch (err) {
      console.error('[assistant/scores] could not read the Scores answer:', err && err.message ? err.message : err);
      return res.status(500).json({ success: false, error: WORDS[CODES.FAILED] });
    }
  };
}

function createRecalculateHandler(deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const refuse = (res, status, code, extra = {}) => res.status(status).json({ success: false, code, error: WORDS[code], ...extra });
  return async function handleRecalculateScores(req, res) {
    const viewer = viewerOf(req);
    if (!viewer) return refuse(res, 401, CODES.NOT_SIGNED_IN);
    const who8 = viewer.slice(0, 8);
    try {
      const who = await resolveViewer({ viewer }, d);
      if (!who.assistantPubkey) {
        console.log(`[assistant/scores] ${who8}: refused — ${CODES.NO_ASSISTANT}`);
        return refuse(res, 403, CODES.NO_ASSISTANT);
      }
      if (!who.pipeline) {
        console.log(`[assistant/scores] ${who8}: refused — ${CODES.NO_PIPELINE}`);
        return refuse(res, 403, CODES.NO_PIPELINE);
      }
      const run = await readRunState({ viewer, pipeline: who.pipeline }, d);
      if (run === 'unknown') {
        console.warn(`[assistant/scores] ${who8}: refused — ${CODES.QUEUE_UNAVAILABLE}`);
        return refuse(res, 503, CODES.QUEUE_UNAVAILABLE);
      }
      if (run) {
        console.log(`[assistant/scores] ${who8}: refused — ${CODES.ALREADY} (${run})`);
        return refuse(res, 409, CODES.ALREADY, { run });
      }
      const taskName = PIPELINE_TASKS[who.pipeline];
      const registry = d.loadRegistry();
      const taskDef = registry && registry.tasks ? registry.tasks[taskName] : null;
      if (!taskDef) throw new Error(`${taskName} is not in the task registry`);
      const { timeoutMs } = d.resolveTaskTimeout(taskDef, registry);
      // Nothing from the request reaches the task: no query params, no customer but the session's own.
      await d.taskQueue().enqueueTask({ taskName, customerArgs: who.customerArgs, queryParams: {}, timeoutMs });
      console.log(`[assistant/scores] ${who8} → ${taskName} queued`);
      return res.status(202).json({ success: true, run: 'queued' });
    } catch (err) {
      console.error(`[assistant/scores] ${who8}: could not start a recalculation:`, err && err.message ? err.message : err);
      return refuse(res, 500, CODES.FAILED);
    }
  };
}

const handleScoresStatus = createScoresStatusHandler();
const handleRecalculateScores = createRecalculateHandler();

module.exports = {
  createScoresStatusHandler,
  createRecalculateHandler,
  handleScoresStatus,
  handleRecalculateScores,
  resolveViewer,
  readPublished,
  readRunState,
  PIPELINE_TASKS,
  CODES,
  WORDS,
};
