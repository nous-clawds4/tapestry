/**
 * Fetch kind 7 reactions from external nostr relays.
 *
 * GET /api/reactions/external?eventId=<hex>&relays=wss://relay1,wss://relay2
 *
 * Uses nostr-tools SimplePool to query the specified relays for kind 7
 * events referencing the given event ID via #e tag.
 */

const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';
const WS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/ws';

// Inject WebSocket global for nostr-tools SimplePool (Node has no native WebSocket)
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require(WS_PATH);
}

const { SimplePool } = require(NOSTR_TOOLS_PATH);

const FETCH_TIMEOUT_MS = 8000; // 8s timeout

async function handleFetchExternalReactions(req, res) {
  const { eventId, relays } = req.query;

  if (!eventId) {
    return res.status(400).json({ success: false, error: 'eventId is required' });
  }

  if (!relays) {
    return res.status(400).json({ success: false, error: 'relays is required (comma-separated wss:// URLs)' });
  }

  const relayList = relays.split(',').map(r => r.trim()).filter(r => r.startsWith('wss://') || r.startsWith('ws://'));

  if (relayList.length === 0) {
    return res.status(400).json({ success: false, error: 'No valid relay URLs provided' });
  }

  const pool = new SimplePool();

  try {
    const events = await Promise.race([
      pool.querySync(relayList, { kinds: [7], '#e': [eventId] }),
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

module.exports = { handleFetchExternalReactions };
