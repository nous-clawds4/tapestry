'use strict';

/**
 * curated-dlist-update #6 — POST /api/dlist-curation/update: Update list publishes what I approved (ADR
 * engineering-team/decisions/done/curated-dlist-update/0006-update-publishes.md, with its Amendments 1 and 2; the copy
 * convention, ADR 0001).
 *
 *   body: { list: "39998:<my assistant>:<d>", copy: [{ original, version }], refresh: [{ copy, original, version }],
 *           delete: [{ copy, id }], upgrade: { dropsMarker } | null }: references with version pins, never events.
 *
 * Flow:
 * - guards, in order: Origin → verified session → the CALLER's assistant key → the body (400 / 403 / 413);
 * - strict reads in both places, this instance's strfry and the list's relay: my header, my list and my assistant's
 *   deletion requests for this call's copies, then the shared list my header names. A failed or capped read → 503
 *   { couldntCheck };
 * - every intent is checked against those reads before anything is signed → 409 { stale };
 * - each event is built from what was read (./updateEvents.js), and signed;
 * - published in order, copies and refreshes, then deletions, then the upgrade: this instance first, then each DList
 *   relay, at most 4 in flight per relay. A send starts only in a call's first 25 seconds (Amendment 2);
 * - each place is read back, in the time left before the call's 45-second deadline → 200 { success, results }, per item
 *   and per place. Nothing is retried.
 * The events are letters in the relay: nothing here touches the graph.
 *
 * Every side effect is injected through createUpdateHandler(deps) (test/curated-dlist-update-publish.test.js).
 */

const { SENTINEL, classifyBValue } = require('../../lib/bValueForms');
const { copyD, composeCopy, composeDeletion, composeUpgrade, validateUpdateBody, itemRef, tagValue } = require('./updateEvents');

const ROUTE = '/api/dlist-curation/update';
const ITEM_KINDS = [9999, 39999];
const OLDER_TYPE = 'inherit-items';
/** Each item read asks for at most this many events, the preview's LIST_ITEMS_LIMIT; an answer this long is capped (Amendment 1). */
const READ_LIMIT = 500;
const IN_FLIGHT_PER_RELAY = 4;
const SCAN_TIMEOUT_MS = 10000;
const CONNECT_TIMEOUT_MS = 5000;
const PUBLISH_TIMEOUT_MS = 5000;
// Amendment 2: each call answers within 45 seconds of the handler's start, inside nginx's 60-second proxy default.
const DEADLINE_MS = 45000;
/** Kept at the end of a call for the read-back. */
const READBACK_RESERVE_MS = 10000;
/** A send starts only before this: the deadline, less the read-back's reserve and one send's worst case (a connection, then a publish). */
const SEND_CUTOFF_MS = DEADLINE_MS - READBACK_RESERVE_MS - (CONNECT_TIMEOUT_MS + PUBLISH_TIMEOUT_MS);
const NOT_SENT = 'not sent: out of time';
const READBACK_OUT_OF_TIME = "sent, but couldn't read it back: out of time";
const SHARED_HEADER = /^39998:[0-9a-f]{64}:.+$/;
// A newer nostr library fulfills a failed connection with this text instead of rejecting (ADR honest-publish-reporting/0001).
const CONNECTION_FAILURE = /^connection failure/i;
const NO_ASSISTANT = 'no Tapestry Assistant is provisioned for this account';
// The places, in the preview's words (listReadGaps).
const THIS_INSTANCE = 'this instance’s strfry';
const THE_RELAY = 'the community relay';

// nostr-tools and ws: the container's copies, else the repo's (src/api/strfry/commands/publishEvent.js's fallback,
// OPEN.md row 271). Loaded lazily, so the suite loads this module without either.
const CONTAINER_MODULES = '/usr/local/lib/node_modules/brainstorm/node_modules';
let _nt = null;
function nt() {
  if (!_nt) {
    try { _nt = require(`${CONTAINER_MODULES}/nostr-tools`); } catch { _nt = require('nostr-tools'); }
  }
  return _nt;
}
function ensureWebSocket() {
  if (typeof globalThis.WebSocket !== 'undefined') return;
  try { globalThis.WebSocket = require(`${CONTAINER_MODULES}/ws`); } catch { globalThis.WebSocket = require('ws'); }
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** The nostr library sometimes throws a bare string, not an Error. */
function normalizeError(err) {
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || String(err);
  if (err == null) return 'unknown error';
  try { return JSON.stringify(err); } catch { return String(err); }
}

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); }),
  ]).finally(() => clearTimeout(timer));
}

function wsOnly(urls) {
  return (Array.isArray(urls) ? urls : [])
    .filter((u) => typeof u === 'string' && /^wss?:\/\/.+/i.test(u.trim()))
    .map((u) => u.trim());
}

/** The later of two versions; on a tie the one read first stays, as the preview merges (this instance first). */
const newer = (e, prev) => (!prev || (Number(e.created_at) || 0) > (Number(prev.created_at) || 0) ? e : prev);

const qValues = (e) => (e && Array.isArray(e.tags) ? e.tags : [])
  .filter((t) => Array.isArray(t) && t[0] === 'q' && typeof t[1] === 'string').map((t) => t[1]);
// A copy is my assistant's item under my header that carries a q (ADR 0001 §5), judged on its newest version (Amendment 1).
const isCopy = (e) => qValues(e).length > 0;

/**
 * Guard 1 (ADR 0006 §1). A browser always sends Origin on a cross-site POST, so an Origin naming a host other than the
 * request's Host is refused; with no Origin (curl, in-container) the request goes on to the session check. Hosts are
 * compared by name, because nginx forwards Host without the port (`$host`) and the UI's dev proxy rewrites it.
 */
function sameHost(req) {
  const headers = (req && req.headers) || {};
  if (headers.origin === undefined) return true;
  try {
    return new URL(String(headers.origin)).hostname.toLowerCase() === new URL(`http://${headers.host}`).hostname.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * My header's one real link, by the house rule (src/lib/bValueForms.js: a real `b` beats the sentinel): exactly one `b`
 * naming a coordinate or an event id, and it must name a kind-39998 header. → `{ coord, type, marker }`, or null.
 */
function realLinkOf(header) {
  const bs = (header && Array.isArray(header.tags) ? header.tags : []).filter((t) => Array.isArray(t) && t[0] === 'b');
  const real = bs.filter((t) => ['a-tag', 'event-id'].includes(classifyBValue(t[1])));
  if (real.length !== 1 || !SHARED_HEADER.test(real[0][1])) return null;
  return { coord: real[0][1], type: real[0][2], marker: bs.some((t) => t[1] === SENTINEL) };
}

/** The newest of my assistant's deletion requests that names `address` in its `a`, as a timestamp, or null. */
function deletedAt(requests, address) {
  let at = null;
  for (const r of requests) {
    if (!(Array.isArray(r.tags) && r.tags.some((t) => Array.isArray(t) && t[0] === 'a' && t[1] === address))) continue;
    const t = Number(r.created_at) || 0;
    if (at === null || t > at) at = t;
  }
  return at;
}

/** `fn` over `items`, with at most `limit` running at once, started in order. */
async function eachInFlight(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/* ── reads ───────────────────────────────────────────────────────────────── */

/** One strict read of one place → `{ place, ok, events, error }`. A failure is never an empty answer. */
async function readPlace(d, place, filter) {
  try {
    if (place === 'local') {
      const events = await d.scan(filter);
      return { place, ok: true, events: Array.isArray(events) ? events : [] };
    }
    const answer = await d.readRelay(place, filter);
    if (!answer || answer.status !== 'ok') return { place, ok: false, events: [], error: (answer && answer.error) || 'unreachable' };
    return { place, ok: true, events: Array.isArray(answer.events) ? answer.events : [] };
  } catch (err) {
    return { place, ok: false, events: [], error: normalizeError(err) };
  }
}

const readPlaces = (d, places, filter) => Promise.all(places.map((place) => readPlace(d, place, filter)));

/**
 * One read that gets only the time left before `deadline` (Amendment 2): raced against a timer for that time, and not
 * started when none is left. A read that runs out → `{ ok: false, outOfTime: true }`; the read itself goes on to its own
 * timeout, and its answer is dropped. The clock is read once, so a clock that moves only as steps finish can't hold it.
 */
async function readBefore(d, place, filter, deadline) {
  const left = deadline - d.nowMs();
  const outOfTime = { place, ok: false, events: [], outOfTime: true };
  if (!(left > 0)) return outOfTime;
  let timer;
  try {
    return await Promise.race([
      readPlace(d, place, filter),
      new Promise((resolve) => { timer = setTimeout(() => resolve(outOfTime), left); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * What a read couldn't cover, in the preview's words (listReadGaps; ADR 0006 §2): each place that failed and, for a
 * limited read, an answer at the limit, which may have stopped short (Amendment 1).
 */
function gapsOf(reads, what, cappedWords) {
  const gaps = reads.filter((r) => !r.ok).map((r) => `${what} on ${r.place === 'local' ? THIS_INSTANCE : THE_RELAY}`);
  if (cappedWords && reads.some((r) => r.ok && r.events.length >= READ_LIMIT)) gaps.push(cappedWords);
  return gaps;
}

/**
 * The items filed under `coord` (a `z`), merged as the preview merges them: one entry per reference, holding its newest
 * version and every version read in either place.
 */
function mergeItems(reads, coord, { kinds, author } = {}) {
  const byRef = new Map();
  for (const r of reads) {
    for (const e of r.events) {
      if (!e || typeof e.id !== 'string' || !kinds.includes(e.kind)) continue;
      if (author && e.pubkey !== author) continue;
      if (!(Array.isArray(e.tags) && e.tags.some((t) => Array.isArray(t) && t[0] === 'z' && t[1] === coord))) continue;
      const ref = itemRef(e);
      const slot = byRef.get(ref) || { newest: null, versions: [] };
      if (!slot.versions.some((v) => v.id === e.id)) slot.versions.push(e);
      slot.newest = newer(e, slot.newest);
      byRef.set(ref, slot);
    }
  }
  return byRef;
}

/* ── the real seams (the defaults) ───────────────────────────────────────── */

/** `strfry scan <filter>`, with an argument list and never a shell → the events. A failure, a timeout or a non-zero exit rejects. */
function scanStrfry(filter) {
  const { spawn } = require('child_process');
  return new Promise((resolve, reject) => {
    let timer = null;
    let settled = false;
    const finish = (fn, v) => { if (!settled) { settled = true; clearTimeout(timer); fn(v); } };
    const proc = spawn('strfry', ['scan', JSON.stringify(filter)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    timer = setTimeout(() => {
      proc.kill('SIGKILL');
      finish(reject, new Error(`strfry scan timed out after ${SCAN_TIMEOUT_MS}ms`));
    }, SCAN_TIMEOUT_MS);
    proc.stdout.on('data', (c) => { out += c; });
    proc.stderr.on('data', (c) => { err += c; });
    proc.on('error', (e) => finish(reject, e));
    proc.on('close', (code) => {
      if (code !== 0) {
        finish(reject, new Error(`strfry scan exited ${code}${err.trim() ? `: ${err.trim().slice(0, 200)}` : ''}`));
        return;
      }
      const events = [];
      for (const line of out.split('\n')) {
        const s = line.trim();
        if (!s) continue;
        try { events.push(JSON.parse(s)); } catch { /* a strfry log line */ }
      }
      finish(resolve, events);
    });
  });
}

/**
 * Publishes over one connection per relay for the length of one call, so a relay that can't be reached costs one
 * connection attempt, not one per event; `close()` ends them. A refused connection rejects every send to that relay.
 */
function relaySessions() {
  const open = new Map();
  return {
    publish(event, url) {
      if (!open.has(url)) {
        const connecting = Promise.resolve().then(() => {
          ensureWebSocket();
          return withTimeout(nt().Relay.connect(url), CONNECT_TIMEOUT_MS, 'connection timed out');
        });
        connecting.catch(() => { /* reported for each event sent to it */ });
        open.set(url, connecting);
      }
      return open.get(url).then((relay) => withTimeout(relay.publish(event), PUBLISH_TIMEOUT_MS, `no answer within ${PUBLISH_TIMEOUT_MS}ms`));
    },
    close() {
      for (const connecting of open.values()) {
        connecting.then((relay) => { try { relay.close(); } catch { /* already closed */ } }, () => {});
      }
      open.clear();
    },
  };
}

function defaultDeps() {
  return {
    requireAuth: (req, res) => require('../trustedList').requireAuth(req, res),
    getKeys: (pubkey) => require('../../utils/assistantKeys').getAssistantKeys(pubkey),
    scan: scanStrfry,
    readRelay: (url, filter) => require('../_shared/relaySource').readRelayEvents(url, filter, {
      connect: (u) => { ensureWebSocket(); return nt().Relay.connect(u); },
      verify: (event) => nt().verifyEvent(event),
    }),
    publishLocal: (event) => require('../trustedList').publishToStrfry(event),
    publishRelay: null, // by default, relaySessions(): one connection per relay for each call
    sign: (template, privkeyHex) => nt().finalizeEvent(template, Uint8Array.from(Buffer.from(privkeyHex, 'hex'))),
    now: () => Math.floor(Date.now() / 1000),
    // Amendment 2: the call's clock, in milliseconds, read at call time. `now` stays the created_at clock.
    nowMs: () => Date.now(),
    localOnly: () => require('./index').isLocalOnly(),
    relays: () => {
      const settings = require('../../config/settings').getSettings();
      return (settings && settings.aRelays && settings.aRelays.aDListRelays) || [];
    },
  };
}

/* ── publish and read back ───────────────────────────────────────────────── */

/**
 * §4's read-back for one place, in the time left before `deadline` (Amendment 2). Every event sent there is re-read by
 * id: `published` when it is there, `not-stored` when it isn't (strfry import exits 0 even when it rejects an event). For
 * a deletion that is stored, the copy is re-read too: `gone`, or `still-there` (AC-9). A read that fails or runs out of
 * time claims nothing: the events are `failed`, "sent, but couldn't read it back: …", and a copy re-read leaves `copy`
 * unset.
 */
async function readBack(d, place, signed, assistant, deadline) {
  const sent = signed.filter((s) => s.places[place] && s.places[place].sent);
  if (sent.length === 0) return;
  const got = await readBefore(d, place, { ids: sent.map((s) => s.event.id) }, deadline);
  if (!got.ok) {
    const error = got.outOfTime ? READBACK_OUT_OF_TIME : `sent, but couldn't read it back: ${got.error}`;
    for (const s of sent) s.places[place] = { status: 'failed', error };
    return;
  }
  const present = new Set(got.events.map((e) => e && e.id));
  for (const s of sent) s.places[place] = { status: present.has(s.event.id) ? 'published' : 'not-stored' };
  const deletions = sent.filter((s) => s.action === 'delete' && s.places[place].status === 'published');
  if (deletions.length === 0) return;
  const copies = await readBefore(d, place, { kinds: [39999], authors: [assistant], '#d': deletions.map((s) => s.copyD) }, deadline);
  if (!copies.ok) return;
  for (const s of deletions) {
    const named = new Set(s.versionIds);
    const left = copies.events.some((e) => e && e.pubkey === assistant && tagValue(e, 'd') === s.copyD
      && (named.has(e.id) || (Number(e.created_at) || 0) <= (Number(s.event.created_at) || 0)));
    s.places[place].copy = left ? 'still-there' : 'gone';
  }
}

const couldntCheck = (res, gaps) => res.status(503).json({
  success: false, error: `couldn't check ${gaps.join('; ')}; nothing was signed`, couldntCheck: gaps,
});
const staleAnswer = (res, stale) => res.status(409).json({
  success: false, error: 'the list changed since the preview; nothing was signed', stale,
});

/* ── the handler ─────────────────────────────────────────────────────────── */

async function update(req, res, d) {
  // Amendment 2: the call's clock starts here, before the guards and the reads.
  const started = d.nowMs();
  const deadline = started + DEADLINE_MS;
  const sendCutoff = started + SEND_CUTOFF_MS;
  // Checked before each send starts, never once for a batch: a send not started by the cutoff isn't started.
  const canSend = () => d.nowMs() < sendCutoff;
  // Guard 1: the Origin.
  if (!sameHost(req)) return res.status(403).json({ success: false, error: 'a request from another site is refused' });
  // Guard 2: a verified session. Its pubkey is the only identity; nobody named in the body is ever used.
  const sessionPubkey = d.requireAuth(req, res);
  if (!sessionPubkey) return undefined;
  // Guard 3: the caller's own assistant — the instance's for the owner, their own key for anyone else.
  const keys = await d.getKeys(sessionPubkey);
  if (!keys || !keys.pubkey || !keys.privkey) return res.status(400).json({ success: false, error: NO_ASSISTANT });
  // Guard 4: the body — references only; the list must be my assistant's; at most 50 intents.
  const checked = validateUpdateBody(req.body);
  if (!checked.body) return res.status(checked.status || 400).json({ success: false, error: checked.error });
  const body = checked.body;
  if (body.list.pubkey !== keys.pubkey) return res.status(403).json({ success: false, error: "list must be your assistant's own curated header" });
  if (!checked.ok) return res.status(checked.status).json({ success: false, error: checked.error });

  const assistant = keys.pubkey;
  const myAddress = body.list.coord;
  const relays = wsOnly(d.relays());
  const listRelay = relays[0] || null;
  const places = listRelay ? ['local', listRelay] : ['local'];
  const addressFor = (originalRef) => `39999:${assistant}:${copyD(myAddress, originalRef)}`;
  // Amendment 2, change 3: only the deletion requests that name this call's copies — each copy intent's derived address
  // and each refresh's copy, never a delete's. §3's timing needs no others.
  const copyAddresses = [...new Set([...body.copy.map((x) => addressFor(x.original)), ...body.refresh.map((x) => x.copy)])];

  // §2: re-read everything, strictly, in both places — my header, my list and the deletion requests first. A call with no
  // copies or refreshes reads no deletion requests.
  const [headerReads, mineReads, deletionReads] = await Promise.all([
    readPlaces(d, places, { kinds: [39998], authors: [assistant], '#d': [body.list.d] }),
    readPlaces(d, places, { kinds: [39999], authors: [assistant], '#z': [myAddress], limit: READ_LIMIT }),
    copyAddresses.length > 0
      ? readPlaces(d, places, { kinds: [5], authors: [assistant], '#a': copyAddresses, limit: READ_LIMIT })
      : [],
  ]);
  const gaps = [
    ...gapsOf(headerReads, 'your assistant’s header'),
    ...gapsOf(mineReads, 'your list', 'every item on your list (more than one read returns)'),
    ...gapsOf(deletionReads, 'your assistant’s deletion requests', 'every deletion request by your assistant (more than one read returns)'),
  ];
  if (gaps.length > 0) return couldntCheck(res, gaps);

  // My header, the newest of the two places. It must name the shared list as its one real link.
  let header = null;
  for (const r of headerReads) {
    for (const e of r.events) {
      if (e && e.kind === 39998 && e.pubkey === assistant && tagValue(e, 'd') === body.list.d) header = newer(e, header);
    }
  }
  const link = header ? realLinkOf(header) : null;
  if (!link) {
    return staleAnswer(res, [{
      action: 'header', ref: myAddress,
      reason: header ? 'your assistant’s header doesn’t name one shared list' : 'your assistant’s header wasn’t found in either place',
    }]);
  }

  // Then the shared list it names.
  const sharedReads = await readPlaces(d, places, { kinds: ITEM_KINDS, '#z': [link.coord], limit: READ_LIMIT });
  const sharedGaps = gapsOf(sharedReads, 'the shared list', 'every item on the shared list (more than one read returns)');
  if (sharedGaps.length > 0) return couldntCheck(res, sharedGaps);

  const shared = mergeItems(sharedReads, link.coord, { kinds: ITEM_KINDS });
  const mine = mergeItems(mineReads, myAddress, { kinds: [39999], author: assistant });
  const requests = deletionReads.flatMap((r) => r.events).filter((e) => e && e.kind === 5 && e.pubkey === assistant);
  const nameOf = (e) => tagValue(e, 'name') || '(unnamed)';

  // §2's checks, for every intent before anything is signed (with Amendment 1: a target must be one of my assistant's copies).
  const stale = [];
  const writes = [];
  for (const x of body.copy) {
    const original = shared.has(x.original) ? shared.get(x.original).newest : null;
    if (!original || original.id !== x.version) {
      stale.push({ action: 'copy', ref: x.original, reason: 'its original is no longer on the shared list at that version' });
      continue;
    }
    const address = addressFor(x.original);
    const there = mine.has(address) ? mine.get(address).newest : null;
    if (there && (!isCopy(there) || qValues(there).includes(x.version))) {
      stale.push({ action: 'copy', ref: x.original, reason: 'your list already holds an item at its copy’s address' });
      continue;
    }
    writes.push({ action: 'copy', ref: x.original, copy: address, original, existing: there, name: nameOf(original) });
  }
  for (const x of body.refresh) {
    const target = mine.has(x.copy) ? mine.get(x.copy).newest : null;
    if (!target || !isCopy(target)) {
      stale.push({ action: 'refresh', ref: x.copy, reason: 'it is no longer one of your assistant’s copies' });
      continue;
    }
    const original = shared.has(x.original) ? shared.get(x.original).newest : null;
    if (!original || original.id !== x.version) {
      stale.push({ action: 'refresh', ref: x.copy, reason: 'its original is no longer on the shared list at that version' });
      continue;
    }
    if (addressFor(x.original) !== x.copy) {
      stale.push({ action: 'refresh', ref: x.copy, reason: 'its d-tag isn’t the one derived from that original' });
      continue;
    }
    if (qValues(target).includes(x.version)) {
      stale.push({ action: 'refresh', ref: x.copy, reason: 'it already holds that version' });
      continue;
    }
    writes.push({ action: 'refresh', ref: x.copy, copy: x.copy, original, existing: target, name: nameOf(original) });
  }
  for (const x of body.delete) {
    const slot = mine.get(x.copy);
    if (!slot || !isCopy(slot.newest)) {
      stale.push({ action: 'delete', ref: x.copy, reason: 'it is no longer one of your assistant’s copies' });
      continue;
    }
    if (slot.newest.id !== x.id) {
      stale.push({ action: 'delete', ref: x.copy, reason: 'the copy changed since the preview' });
      continue;
    }
    writes.push({ action: 'delete', ref: x.copy, slot, name: nameOf(slot.newest) });
  }
  if (body.upgrade) {
    if (link.type !== OLDER_TYPE) {
      stale.push({ action: 'upgrade', ref: myAddress, reason: 'your assistant’s header no longer uses the older link' });
    } else if (body.upgrade.dropsMarker !== link.marker) {
      stale.push({ action: 'upgrade', ref: myAddress, reason: 'whether your assistant’s header carries the “deliberately unaffiliated” marker changed' });
    } else {
      writes.push({ action: 'upgrade', ref: myAddress, name: 'your assistant’s header' });
    }
  }
  if (stale.length > 0) return staleAnswer(res, stale);

  // §3: build each event from what was read, then sign. A re-copy is timed after my assistant's newest deletion request
  // for its address, which this instance would otherwise refuse (§10).
  const at = Number(d.now());
  const relayHint = listRelay || '';
  const signed = writes.map((w) => {
    let template;
    if (w.action === 'copy' || w.action === 'refresh') {
      const after = deletedAt(requests, w.copy);
      template = composeCopy({
        original: w.original, headerAddress: myAddress, relay: relayHint,
        now: after === null ? at : Math.max(at, after + 1), existing: w.existing,
      });
    } else if (w.action === 'delete') {
      const { newest, versions } = w.slot;
      template = composeDeletion({ copy: { ...newest, d: tagValue(newest, 'd'), ids: versions.map((v) => v.id), versions }, assistant, now: at });
    } else {
      template = composeUpgrade({ header, now: at });
    }
    const event = d.sign(template, keys.privkey);
    const extra = w.action === 'delete' ? { copyD: tagValue(w.slot.newest, 'd'), versionIds: w.slot.versions.map((v) => v.id) } : {};
    return { action: w.action, ref: w.ref, copy: w.copy, name: w.name, event, places: {}, ...extra };
  });

  // §4: copies and refreshes, then deletions, then the upgrade — so my list's items are in place before its header
  // changes what the list means. This instance first, then each DList relay, at most 4 in flight per relay. A send whose
  // turn comes after the cutoff isn't started: "not sent: out of time" at that place (Amendment 2).
  const localOnly = !!d.localOnly();
  for (const group of [['copy', 'refresh'], ['delete'], ['upgrade']]) {
    const batch = signed.filter((s) => group.includes(s.action));
    if (batch.length === 0) continue;
    for (const s of batch) {
      if (!canSend()) { s.places.local = { status: 'failed', error: NOT_SENT }; continue; }
      try { await d.publishLocal(s.event); s.places.local = { sent: true }; }
      catch (err) { s.places.local = { status: 'failed', error: normalizeError(err) }; }
    }
    if (localOnly) {
      for (const s of batch) for (const url of relays) s.places[url] = { status: 'skipped', reason: 'local-only publish policy' };
      continue;
    }
    await Promise.all(relays.map((url) => eachInFlight(batch, IN_FLIGHT_PER_RELAY, async (s) => {
      if (!canSend()) { s.places[url] = { status: 'failed', error: NOT_SENT }; return; }
      try {
        const said = await d.publishRelay(s.event, url);
        // The settled value is read as well as the status, so a fulfilled "connection failure: …" can't read as sent.
        s.places[url] = CONNECTION_FAILURE.test(String(said)) ? { status: 'failed', error: String(said) } : { sent: true };
      } catch (err) {
        s.places[url] = { status: 'failed', error: normalizeError(err) };
      }
    })));
  }
  // Each place is read back in the time left before the deadline, so the call answers within 45 seconds (Amendment 2).
  await Promise.all((localOnly ? ['local'] : ['local', ...relays]).map((place) => readBack(d, place, signed, assistant, deadline)));

  // §5: per item and per place.
  const results = signed.map((s) => ({
    action: s.action,
    ref: s.ref,
    ...(s.copy && s.copy !== s.ref ? { copy: s.copy } : {}),
    name: s.name,
    id: s.event.id,
    places: s.places,
  }));
  return res.json({ success: true, results });
}

function createUpdateHandler(deps = {}) {
  const base = { ...defaultDeps(), ...deps };
  return async function handleUpdate(req, res) {
    const sessions = base.publishRelay ? null : relaySessions();
    const d = sessions ? { ...base, publishRelay: (event, url) => sessions.publish(event, url) } : base;
    try {
      return await update(req, res, d);
    } catch (err) {
      return res.status(500).json({ success: false, error: normalizeError(err) });
    } finally {
      if (sessions) sessions.close();
    }
  };
}

module.exports = { ROUTE, createUpdateHandler };
