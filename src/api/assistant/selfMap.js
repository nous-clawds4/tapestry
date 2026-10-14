'use strict';
/**
 * The Your Assistant's Treasure Map action's answer (assistant-self-map #1, ADR assistant-self-map/0001 with Amendment
 * 1): the duties the signed-in viewer's own Treasure Map gives their Assistant and which are live, what that
 * Assistant's self-Map should say, the self-Map found now, and whether the two match.
 *
 * Called by GET /api/assistant/attention (src/api/assistant/attention.js) for the session's viewer, with the Assistant
 * that answer already resolved from the session (for the Owner the instance TA). No request parameter reaches it.
 *
 * - The offer is the Duty Menu check's own (resolveOfferInputs + buildOffer), so the two pages never disagree. It is the
 *   instance's Assistant Duties list, so it may name a duty this instance does not publish, or a typed relay: such a
 *   duty is offered and never live (ADR assistant-duties-settings/0001 sub-decision 6).
 * - The viewer's Map is /setup's read (lookupNewest over treasureMapRelays): this instance's relay first.
 * - Live (sub-decisions 3 and 6) is read from what has landed at the offer's relay:
 *   - Scores: the newest Assistant-signed 30382 in this instance's strfry (both publishers re-sign every event every
 *     run), against twice the shortest enabled schedule interval among the tasks that re-sign them for this Assistant
 *     (the BullMQ entries while the queue is on, and a customer's own per-customer timer; else the bare-metal systemd
 *     timer — Amendment 2);
 *   - Concepts: the Assistant's 39998 headers at their relay (this instance's strfry, or the DList relay with no public
 *     address);
 *   - Lists are never live here: their d tags are not Treasure Maps § 5.1's.
 * - The self-Map found (sub-decision 5): this instance's relay first; only when it holds none, one outside round over the
 *   viewer's Map's relays for entries naming the Assistant and the Assistant's kind 10002 write relays (event-named: at
 *   most 50, each guarded) plus the offer's relays. The relay hints come only from entries whose key parses (story 1
 *   review R3-N2). The found version itself rides as `published.event`, exactly as it was read (assistant-self-map #4,
 *   ADR 0003 sub-decision 1), for the page's raw view.
 * - The remembered choice (assistant-self-map #2, ADR 0002 sub-decision 2): the answer carries `selfMapOn`, the choice
 *   file's word for the viewer's own Assistant (true, false, or null when it cannot be read). It moves no mark.
 * - For a press (ADR 0002 sub-decision 3, Amendments 1–4): gatherSelfMap with `forWrite` reads every place at once,
 *   this instance's relay, the press's copy (`stored`) and the outside round, and the newest version wins. It does not
 *   finish when this instance's scan fails; and, when neither this instance's relay nor the copy holds a version (an
 *   Assistant's first press here), unless the Assistant's relay-list lookup finished and one of its write relays
 *   answered (or, having none, one of the other outside relays did, or there were none to ask). A list found nowhere
 *   counts only when every outside configured relay answered, and a relay the DNS guard refuses has not answered.
 *   So after a first press here, a press never builds on anything older than the newest version a press has seen or
 *   signed; a first press reads under those strict rules, whose limits ADR 0002 Amendment 3 item 2 names.
 *
 * Read-only: strfry is only scanned, outside relays are only read, the schedule and choice files are only read, nothing
 * is stored. The press that signs and stores is ADR 0002's own module (sub-decisions 5 and 6).
 */

const { normalizeRelayUrl, MAX_RELAYS } = require('../../lib/relay-list');
const { buildOffer } = require('../../lib/duty-menu');
const { SELF_MAP_KIND, evaluateSelfMap, readSelfEntries, parseKey } = require('../../lib/self-map');

const SCORE_KIND = 30382;
const CONCEPT_HEADER_KIND = 39998;
const SYSTEMD_TIMER = '/etc/systemd/system/processAllTasks.timer';
const DEFAULT_TIMER_MS = 12 * 60 * 60 * 1000;
/** At most this many named Concept d tags are looked up per check. */
const MAX_NAMED_HEADERS = 50;

/** The tasks whose runs re-sign an Assistant's Scores (ADR 0001 sub-decision 6). */
const OWNER_SCORE_TASKS = ['processAllTasks', 'updateAllScoresForOwner', 'exportOwnerKind30382'];
const ALL_CUSTOMER_SCORE_TASKS = ['processAllTasks', 'processAllActiveCustomers'];
const ONE_CUSTOMER_SCORE_TASKS = ['processCustomer', 'updateAllScoresForSingleCustomer', 'exportCustomerKind30382'];

/** What the answer says for this action when its check threw (Amendment 1 item 6). */
const SELF_MAP_CHECK_FAILED = Object.freeze({
  finished: false, done: false, pending: false, reason: 'check-failed',
  mapFound: false, duties: [], shouldSay: [], published: null, current: null, instanceMap: false, selfMapOn: null,
});

/** The real dependencies, required lazily so the module loads in a bare checkout. */
function defaultDeps() {
  return {
    scanLocal: (filter) => require('../setup/status').scanLocalStrict(filter),
    readRelay: (url, filter) => require('../_shared/relaySource').readRelayEvents(url, filter),
    getConfigFromFile: (key, fallback) => require('../../utils/config').getConfigFromFile(key, fallback),
    mapDefaultRelays: () => require('../export/nip85/currentMap').defaultRelays(),
    isPublicRelayHostWithin: (host) => require('../../utils/relayHostGuard').isPublicRelayHostWithin(host),
    now: () => Date.now(),
    readScheduleEntries: () => {
      const config = require('../scheduled-tasks').readConfig();
      return config && Array.isArray(config.entries) ? config.entries : [];
    },
    schedulerEnabled: () => require('../../manage/taskQueue/queue/schedulerSwitch').schedulerEnabled(),
    timerExists: (p = SYSTEMD_TIMER) => require('fs').existsSync(p),
    // The per-customer scheduler's running timer, by the customer's main pubkey (Amendment 2 item 3).
    customerTimerIntervalMs: (pubkey) => require('../customer-schedule').getTimerIntervalMs(pubkey),
    // The remembered self-Map choice, by Assistant pubkey (ADR 0002 sub-decision 2).
    readSelfMapChoice: (pubkey) => require('./selfMapChoice').readSelfMapChoice(pubkey),
  };
}

/** The attention handler's relay read within the relay budget, and NIP-01's newest; required lazily (no cycle). */
const shared = () => require('./attention');
const statusLib = () => require('../setup/status');

/** One read: its answer, or the fallback when it threw. */
const attempt = (fn, fallback) => Promise.resolve().then(fn).catch(() => fallback);

/** A systemd time span as BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL writes it ("12hours", "6h", "1d"), in ms; else null. */
function parseTimeSpan(text) {
  const m = String(text || '').trim().match(/^(\d+)\s*(s|sec|secs|seconds?|m|min|mins|minutes?|h|hr|hrs|hours?|d|days?)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = (m[2] || 's').toLowerCase();
  const scale = unit.startsWith('d') ? 86400000 : unit.startsWith('h') ? 3600000 : (unit === 'm' || unit.startsWith('min')) ? 60000 : 1000;
  return n > 0 ? n * scale : null;
}

/** How many upcoming fires a cron entry's interval is read over (Amendment 2 item 2). */
const CRON_FIRES = 8;

/**
 * One schedule entry's interval in ms: a cron's shortest gap between consecutive fires among its next CRON_FIRES
 * (Amendment 2 item 2, so an irregular schedule never stretches the allowance), else its interval fields.
 */
function entryInterval(entry, now) {
  const cron = entry && typeof entry.cron === 'string' ? entry.cron.trim() : '';
  if (cron) {
    try {
      const it = require('cron-parser').parseExpression(cron, { currentDate: new Date(now) });
      let previous = it.next().getTime();
      let shortest = null;
      for (let i = 1; i < CRON_FIRES; i += 1) {
        const next = it.next().getTime();
        const gap = next - previous;
        if (gap > 0 && (shortest === null || gap < shortest)) shortest = gap;
        previous = next;
      }
      return shortest;
    } catch { return null; }
  }
  const minutes = (Number(entry && entry.intervalDays) || 0) * 1440 + (Number(entry && entry.intervalHours) || 0) * 60 + (Number(entry && entry.intervalMinutes) || 0);
  return minutes > 0 ? minutes * 60000 : null;
}

/**
 * The shortest enabled interval among the schedules that re-sign this Assistant's Scores, in ms, or null when none
 * does (sub-decision 6, Amendment 2 items 1 and 3):
 * - BullMQ entries count only when TASK_QUEUE_ENABLED is exactly "true" (default "false"), as bin/control-panel.js
 *   decides whether to start the queue, and the kill switch is on;
 * - for a customer, their per-customer scheduler's running timer counts too, whatever the flag says;
 * - with neither, the bare-metal systemd timer counts when its unit exists.
 */
function scheduleIntervals({ viewer, isOwner }, d) {
  const now = d.now();
  const who = String(viewer || '').toLowerCase();
  const queueOn = d.getConfigFromFile('TASK_QUEUE_ENABLED', 'false') === 'true'
    && attemptSync(() => d.schedulerEnabled() !== false, true);
  const counts = (e) => {
    if (!e || e.enabled !== true) return false;
    if (isOwner) return OWNER_SCORE_TASKS.includes(e.taskId);
    if (ALL_CUSTOMER_SCORE_TASKS.includes(e.taskId)) return true;
    const customer = e.args && typeof e.args.customer === 'string' ? e.args.customer.toLowerCase() : '';
    return ONE_CUSTOMER_SCORE_TASKS.includes(e.taskId) && customer === who;
  };
  const entries = queueOn ? attemptSync(() => d.readScheduleEntries(), []) : [];
  const intervals = (Array.isArray(entries) ? entries : []).filter(counts).map((e) => entryInterval(e, now)).filter((x) => x > 0);
  if (!isOwner) {
    const timer = attemptSync(() => d.customerTimerIntervalMs(who), null);
    if (Number.isFinite(timer) && timer > 0) intervals.push(timer);
  }
  if (intervals.length) return Math.min(...intervals);
  if (attemptSync(() => d.timerExists(SYSTEMD_TIMER), false) === true) {
    return parseTimeSpan(d.getConfigFromFile('BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL', '')) || DEFAULT_TIMER_MS;
  }
  return null;
}
function attemptSync(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

/** Is this relay this instance's own (read through the local scan, never as outside)? */
const isOwnRelay = (url, d) => statusLib().outsideOnly([url], d).length === 0;

/**
 * The upkeep inputs (sub-decision 6): the Scores' status and the Concepts this Assistant has at their relay.
 * @returns {Promise<{ finished: true, scores, record } | { finished: false, reason }>}
 */
async function readUpkeep({ viewer, assistantPubkey, isOwner, offer, namedHeaders }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const { readWithinBudget, newest } = shared();
  const relayOf = (kind) => { const row = offer.find((r) => r && r.tag === 'duty' && r.key === String(kind)); return row ? row.relay : null; };
  const out = { scores: { status: 'not-scheduled', lastLandedAt: null }, record: { anyHeader: false, headers: new Set() } };

  try {
    const scoreRelay = relayOf(SCORE_KIND);
    // Scores are read from this instance's strfry, so they are live only where the offer names this instance's relay;
    // a typed relay elsewhere is never claimed (ADR assistant-duties-settings/0001 sub-decision 6).
    if (scoreRelay && !isOwnRelay(scoreRelay, d)) out.scores = { status: 'not-published-here', lastLandedAt: null };
    else if (scoreRelay) {
      const interval = scheduleIntervals({ viewer, isOwner }, d);
      const events = await d.scanLocal({ kinds: [SCORE_KIND], authors: [assistantPubkey], limit: 1 });
      const beat = newest((Array.isArray(events) ? events : []).filter((e) => e && e.kind === SCORE_KIND && String(e.pubkey).toLowerCase() === assistantPubkey));
      const lastLandedAt = beat ? beat.created_at : null;
      if (!interval) out.scores = { status: 'not-scheduled', lastLandedAt };
      else if (!beat) out.scores = { status: 'not-landed', lastLandedAt: null };
      else if (d.now() - lastLandedAt * 1000 > 2 * interval) out.scores = { status: 'upkeep-stopped', lastLandedAt };
      else out.scores = { status: 'live', lastLandedAt };
    }
  } catch {
    return { finished: false, reason: 'instance-unanswered' };
  }

  const conceptRelay = relayOf(CONCEPT_HEADER_KIND);
  if (conceptRelay) {
    const ds = [...new Set(namedHeaders)].slice(0, MAX_NAMED_HEADERS);
    const filters = [{ kinds: [CONCEPT_HEADER_KIND], authors: [assistantPubkey], limit: 1 }];
    if (ds.length) filters.push({ kinds: [CONCEPT_HEADER_KIND], authors: [assistantPubkey], '#d': ds });
    let answers;
    if (isOwnRelay(conceptRelay, d)) {
      try { answers = await Promise.all(filters.map((f) => d.scanLocal(f))); } catch { return { finished: false, reason: 'instance-unanswered' }; }
    } else {
      const reads = await Promise.all(filters.map((f) => readWithinBudget(conceptRelay, f, d)));
      if (reads.some((r) => !r || r.status !== 'ok')) return { finished: false, reason: 'no-relay-answered' };
      answers = reads.map((r) => r.events);
    }
    const mine = (e) => e && e.kind === CONCEPT_HEADER_KIND && String(e.pubkey).toLowerCase() === assistantPubkey;
    const [any, named = []] = answers.map((xs) => (Array.isArray(xs) ? xs : []).filter(mine));
    out.record.anyHeader = any.length > 0;
    for (const e of named) {
      const t = (e.tags || []).find((x) => Array.isArray(x) && x[0] === 'd');
      if (t && typeof t[1] === 'string') out.record.headers.add(t[1]);
    }
  }
  return { finished: true, ...out };
}

/**
 * The relays the viewer's Map names for this Assistant: element 3 of its entries naming it, whose key parses. An entry
 * whose key is not a key is absent to readers (Treasure Maps § 4.5; story 1 review R3-N2).
 */
function mapHints(mapEvent, assistantPubkey) {
  const tags = mapEvent && Array.isArray(mapEvent.tags) ? mapEvent.tags : [];
  return tags
    .filter((t) => Array.isArray(t) && parseKey(t[0]) && typeof t[1] === 'string' && t[1].toLowerCase() === assistantPubkey && typeof t[2] === 'string')
    .map((t) => t[2]);
}

/**
 * The self-Map found for one Assistant now (sub-decision 5). `latest` is the newest version found, the base of a press's
 * merge; `published` its self-entries, or null when there is none.
 *
 * With `forWrite` (ADR 0002 sub-decision 3, R1), this instance's relay and the outside round are both read and the
 * newest version across them wins (strictOutsideRound). `stored`, the press's checked copy (Amendment 3 item 1), counts
 * as a version here; without `forWrite` it is ignored. A finished `forWrite` answer also says where `latest` is
 * (Amendment 4 item 1): `onThisRelay` when this instance's scan returned it, and `published.source` 'local', 'copy' (only
 * the copy holds it: neither this instance's scan nor an outside relay returned it) or 'relay'. It is unfinished with `instance-unanswered` when this instance's scan fails, and with `no-relay-answered`
 * when neither this instance nor the copy holds a version and the outside round cannot show there is none (Amendment 1
 * item 1).
 * @returns {Promise<{ finished: true, latest: ?Object, published: ?Object, onThisRelay?: boolean }
 *                  | { finished: false, reason: 'no-relay-answered'|'instance-unanswered' }>}
 */
async function lookupSelfMap({ assistantPubkey, mapEvent, offer, forWrite = false, stored = null }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const { readWithinBudget, newest } = shared();
  const who = String(assistantPubkey || '').toLowerCase();
  const filter = { kinds: [SELF_MAP_KIND], authors: [who] };
  const mine = (e) => e && typeof e === 'object' && e.kind === SELF_MAP_KIND && String(e.pubkey || '').toLowerCase() === who;
  const found = (latest, source) => ({
    finished: true,
    latest,
    published: latest ? { ...readSelfEntries(latest, who), createdAt: latest.created_at, source, eventId: latest.id, event: latest } : null,
  });

  const local = await Promise.resolve().then(() => d.scanLocal(filter))
    .then((events) => ({ ok: true, events: Array.isArray(events) ? events : [] }), () => ({ ok: false, events: [] }));
  const here = newest(local.events.filter(mine));
  if (forWrite) {
    if (!local.ok) return { finished: false, reason: 'instance-unanswered' };
    // The press's copy counts as a version here (Amendment 3 item 1): after a wipe or an older restore, it is the base.
    const hereOrCopy = newest([here, stored].filter(mine));
    const { heldOutside, ...answer } = await strictOutsideRound({ who, here: hereOrCopy, mapEvent, offer, filter, mine, found }, d);
    // Where the base is (Amendment 4 item 1): the press publishes nothing only over a version this instance's relay
    // holds. The same id here and in the copy is here; the same id in the copy and outside is the relay's.
    if (answer.finished) {
      const localIds = new Set(local.events.filter(mine).map((e) => e.id));
      answer.onThisRelay = !!answer.latest && localIds.has(answer.latest.id);
      if (answer.published) {
        answer.published.source = answer.onThisRelay ? 'local'
          : (stored && answer.latest && answer.latest.id === stored.id && !heldOutside ? 'copy' : 'relay');
      }
    }
    return answer;
  }
  if (here) return found(here, 'local');

  const { assistantWriteRelays } = require('./dutyMenu');
  const writes = await attempt(() => assistantWriteRelays({ assistantPubkey: who }, d), []);
  const named = statusLib().outsideOnly([...mapHints(mapEvent, who), ...(Array.isArray(writes) ? writes : [])].map(normalizeRelayUrl).filter(Boolean), d)
    .slice(0, MAX_RELAYS);
  const accepted = await Promise.all(named.map((url) => attempt(async () => ((await d.isPublicRelayHostWithin(new URL(url).hostname)) === true ? url : null), null)));
  const configured = (Array.isArray(offer) ? offer : []).map((row) => row && row.relay).filter(Boolean);
  const relays = statusLib().outsideOnly([...accepted.filter(Boolean), ...configured], d);

  const answers = await Promise.all(relays.map((url) => readWithinBudget(url, filter, d)));
  const answered = answers.filter((a) => a && a.status === 'ok');
  if (!local.ok && answered.length === 0) return { finished: false, reason: 'no-relay-answered' };
  return found(newest(answered.flatMap((a) => (Array.isArray(a.events) ? a.events : [])).filter(mine)), 'relay');
}

/**
 * A press's outside round (ADR 0002 sub-decision 3 with Amendment 1 item 1), once this instance's scan succeeded. It
 * reads, together: the Assistant's write relays (W, from a relay-list lookup that must have finished when nothing is
 * here, a list found nowhere only on every outside configured relay's answer, Amendment 2 item 1), the viewer's Map
 * hints and the offer's outside relays (O). Event-named relays (W and the hints) are read only when the DNS guard finds
 * them public; one it refuses, for whatever reason, has not answered. With a version here (this instance's relay or the
 * press's copy, Amendment 3), the outside is best-effort and the newest wins. With none, the read finishes only when
 * the lookup finished and: one relay of W answered, when W is not empty; else one relay of O answered, or O is empty
 * too. A finished answer carries `heldOutside`, whether an outside relay returned the newest version's id.
 */
async function strictOutsideRound({ who, here, mapEvent, offer, filter, mine, found }, d) {
  const { readWithinBudget, newest } = shared();
  const unanswered = { finished: false, reason: 'no-relay-answered' };
  let lookup = null;
  try { lookup = await require('./dutyMenu').assistantWriteRelayLookup({ assistantPubkey: who, everyRelay: true }, d); } catch { lookup = null; }
  const discovered = !!lookup && lookup.finished === true;
  if (!here && !discovered) return unanswered;

  const outside = (urls) => statusLib().outsideOnly(urls.map(normalizeRelayUrl).filter(Boolean), d);
  const writes = outside(discovered && Array.isArray(lookup.relays) ? lookup.relays : []).slice(0, MAX_RELAYS);
  const hints = outside(mapHints(mapEvent, who)).filter((url) => !writes.includes(url)).slice(0, Math.max(0, MAX_RELAYS - writes.length));
  const offered = outside((Array.isArray(offer) ? offer : []).map((row) => row && row.relay).filter(Boolean))
    .filter((url) => !writes.includes(url) && !hints.includes(url));

  const isPublic = (url) => attempt(async () => (await d.isPublicRelayHostWithin(new URL(url).hostname)) === true, false);
  const readGuarded = async (url) => ((await isPublic(url)) ? readWithinBudget(url, filter, d) : null);
  const [fromWrites, fromHints, fromOffer] = await Promise.all([
    Promise.all(writes.map(readGuarded)),
    Promise.all(hints.map(readGuarded)),
    Promise.all(offered.map((url) => readWithinBudget(url, filter, d))),
  ]);
  const ok = (answers) => answers.filter((a) => a && a.status === 'ok');
  if (!here) {
    if (writes.length > 0 && ok(fromWrites).length === 0) return unanswered;
    if (writes.length === 0 && hints.length + offered.length > 0 && ok([...fromHints, ...fromOffer]).length === 0) return unanswered;
  }
  const events = ok([...fromWrites, ...fromHints, ...fromOffer]).flatMap((a) => (Array.isArray(a.events) ? a.events : [])).filter(mine);
  const latest = newest(here ? [here, ...events] : events);
  const heldOutside = !!latest && events.some((e) => e.id === latest.id);
  return { ...found(latest, latest && latest === here ? 'local' : 'relay'), heldOutside };
}

/** An unfinished answer, with every field (Amendment 1 item 6's shape). */
const unfinished = (reason, { mapFound = false, isOwner = false } = {}) => ({
  finished: false, done: false, pending: false, reason,
  mapFound, duties: [], shouldSay: [], published: null, current: null, instanceMap: Boolean(isOwner),
});

/**
 * The Your Assistant's Treasure Map action for the session's viewer and their own Assistant: the gathered answer, with
 * the remembered choice as `selfMapOn` (ADR 0002 sub-decision 2).
 * @param {{ viewer: string, assistantPubkey: string }} input
 */
async function checkSelfMap({ viewer, assistantPubkey }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const selfMapOn = await Promise.resolve()
    .then(() => d.readSelfMapChoice(String(assistantPubkey || '').toLowerCase()))
    .then((choice) => (choice === true || choice === false ? choice : null), () => null);
  const { answer } = await gatherSelfMap({ viewer, assistantPubkey, forWrite: false }, d);
  return { ...answer, selfMapOn };
}

/**
 * Everything the action and a press need (ADR 0002 sub-decision 3): the answer, without the choice, and the self-Map
 * lookup with its `latest`. `forWrite` is the press's strict read (lookupSelfMap), and `stored` the press's checked copy
 * (Amendment 3 item 1). `lookup` is null when the viewer's Map could not be read.
 * @param {{ viewer: string, assistantPubkey: string, forWrite?: boolean, stored?: ?Object }} input
 * @returns {Promise<{ answer: Object, lookup: ?Object }>}
 */
async function gatherSelfMap({ viewer, assistantPubkey, forWrite = false, stored = null }, deps = {}) {
  const d = { ...defaultDeps(), ...deps };
  const who = String(viewer || '').toLowerCase();
  const assistant = String(assistantPubkey || '').toLowerCase();
  const owner = String(d.getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', '') || '').trim().toLowerCase();
  const isOwner = !!owner && owner === who;
  const { resolveOfferInputs } = require('./dutyMenu');
  const offer = buildOffer(await resolveOfferInputs(who, d));

  const { lookupNewest, treasureMapRelays } = statusLib();
  const mapLookup = await lookupNewest({ kind: 10040, pubkey: who, relays: treasureMapRelays(d) }, d);
  if (!mapLookup.finished) {
    return { answer: unfinished(mapLookup.reason === 'local-unreadable' ? 'instance-unanswered' : 'no-relay-answered', { isOwner }), lookup: null };
  }
  const mapEvent = mapLookup.event || null;

  const namedHeaders = [];
  for (const t of mapEvent && Array.isArray(mapEvent.tags) ? mapEvent.tags : []) {
    const k = Array.isArray(t) ? parseKey(t[0]) : null;
    if (k && k.scope.type === 'd' && k.kinds.includes(CONCEPT_HEADER_KIND)) namedHeaders.push(k.scope.d);
  }
  const [upkeep, lookup] = await Promise.all([
    readUpkeep({ viewer: who, assistantPubkey: assistant, isOwner, offer, namedHeaders }, d),
    lookupSelfMap({ assistantPubkey: assistant, mapEvent, offer, forWrite, stored }, d),
  ]);
  if (!upkeep.finished) return { answer: unfinished(upkeep.reason, { mapFound: !!mapEvent, isOwner }), lookup };
  if (!lookup.finished) return { answer: unfinished(lookup.reason, { mapFound: !!mapEvent, isOwner }), lookup };
  const answer = evaluateSelfMap({ mapEvent, offer, assistantPubkey: assistant, isOwner, scores: upkeep.scores, record: upkeep.record, lookup });
  return { answer, lookup };
}

module.exports = {
  checkSelfMap,
  gatherSelfMap,
  lookupSelfMap,
  readUpkeep,
  scheduleIntervals,
  parseTimeSpan,
  SELF_MAP_CHECK_FAILED,
};
