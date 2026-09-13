/**
 * Fetch nostr events from external relays using a generic filter.
 *
 * GET /api/relay/external?filter=<JSON>&relays=wss://relay1,wss://relay2[&strict=1]
 *
 * filter: JSON-encoded nostr filter (e.g. {"kinds":[10040],"authors":["abc..."]})
 * relays: comma-separated relay URLs
 *
 * Without `strict`, the relays are read together through SimplePool.querySync and merged:
 *   { success: true, events, count, relays }
 * querySync resolves empty when a relay refuses the connection, so there "no events" can also
 * mean "not reached" (OPEN.md row 280).
 *
 * With `strict=1` (curated-dlist-update ADR 0005 §1), each ws/wss relay is read on its own, in
 * parallel, through relaySource.readRelayEvents, which answers only from a relay proven reachable.
 * The whole read is bounded by FETCH_TIMEOUT_MS, and the events are merged by id:
 *   { success: true, events, count, relays, unreachable }
 *       at least one relay was read; `unreachable` lists any that weren't
 *   { success: false, events: [], error: "Could not read <relay>: <reason>[; …]", relays, unreachable }
 *       none of them could be read
 */

// nostr-tools / ws via the container's absolute path — required only in the non-strict path, so
// the module loads without them (the presence handler's idiom).
const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';
const WS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/ws';

const FETCH_TIMEOUT_MS = 8000;

/**
 * Strict mode: every relay read through `read` at once. A relay that hasn't answered inside
 * FETCH_TIMEOUT_MS, or whose read throws, is unreachable.
 */
async function readStrict(res, relayList, filter, read) {
  const answers = await Promise.all(relayList.map(async (url) => {
    let timer;
    try {
      return await Promise.race([
        Promise.resolve().then(() => read(url, filter)),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timeout')), FETCH_TIMEOUT_MS); }),
      ]);
    } catch (err) {
      return { status: 'unreachable', events: [], error: err && err.message ? err.message : String(err) };
    } finally {
      clearTimeout(timer);
    }
  }));

  const seen = new Set();
  const events = [];
  const unreachable = [];
  const reasons = [];
  answers.forEach((answer, i) => {
    if (!answer || answer.status !== 'ok') {
      unreachable.push(relayList[i]);
      reasons.push(`${relayList[i]}: ${(answer && answer.error) || 'no answer'}`);
      return;
    }
    for (const ev of Array.isArray(answer.events) ? answer.events : []) {
      if (ev && typeof ev.id === 'string' && !seen.has(ev.id)) {
        seen.add(ev.id);
        events.push(ev);
      }
    }
  });

  if (unreachable.length === relayList.length) {
    return res.json({ success: false, events: [], error: `Could not read ${reasons.join('; ')}`, relays: relayList, unreachable });
  }
  return res.json({ success: true, events, count: events.length, relays: relayList, unreachable });
}

/**
 * @param {Object} req  express request (uses req.query)
 * @param {Object} res  express response
 * @param {Object} [deps]  { readRelay } — the strict reader, injectable in the _shared/relaySource
 *                         DI idiom.
 */
async function handleFetchExternalEvents(req, res, deps = {}) {
  const { filter: filterStr, relays, strict } = req.query;

  if (!filterStr) {
    return res.status(400).json({ success: false, error: 'filter is required (JSON-encoded nostr filter)' });
  }

  if (!relays) {
    return res.status(400).json({ success: false, error: 'relays is required (comma-separated wss:// URLs)' });
  }

  let filter;
  try {
    filter = JSON.parse(filterStr);
  } catch {
    return res.status(400).json({ success: false, error: 'Invalid JSON in filter parameter' });
  }

  const relayList = relays.split(',').map(r => r.trim()).filter(r => r.startsWith('wss://') || r.startsWith('ws://'));

  if (relayList.length === 0) {
    return res.status(400).json({ success: false, error: 'No valid relay URLs provided' });
  }

  if (strict === '1' || strict === 'true') {
    const read = deps && typeof deps.readRelay === 'function'
      ? deps.readRelay
      : require('../_shared/relaySource').readRelayEvents;
    return readStrict(res, relayList, filter, read);
  }

  if (typeof globalThis.WebSocket === 'undefined') {
    globalThis.WebSocket = require(WS_PATH);
  }
  const { SimplePool } = require(NOSTR_TOOLS_PATH);
  const pool = new SimplePool();

  try {
    const events = await Promise.race([
      pool.querySync(relayList, filter),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), FETCH_TIMEOUT_MS)),
    ]);

    // Deduplicate by event ID
    const seen = new Set();
    const unique = [];
    for (const ev of events) {
      if (!seen.has(ev.id)) {
        seen.add(ev.id);
        unique.push(ev);
      }
    }

    res.json({ success: true, events: unique, count: unique.length, relays: relayList });
  } catch (err) {
    res.json({ success: false, events: [], error: err.message, relays: relayList });
  } finally {
    try { pool.close(relayList); } catch {}
  }
}

module.exports = { handleFetchExternalEvents };
