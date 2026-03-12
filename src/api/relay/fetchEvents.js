/**
 * Fetch nostr events from external relays using a generic filter.
 *
 * GET /api/relay/external?filter=<JSON>&relays=wss://relay1,wss://relay2
 *
 * filter: JSON-encoded nostr filter (e.g. {"kinds":[10040],"authors":["abc..."]})
 * relays: comma-separated relay URLs
 */

const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';
const WS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/ws';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require(WS_PATH);
}

const { SimplePool } = require(NOSTR_TOOLS_PATH);

const FETCH_TIMEOUT_MS = 8000;

async function handleFetchExternalEvents(req, res) {
  const { filter: filterStr, relays } = req.query;

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
