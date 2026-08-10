/**
 * Read a concept header's sharing state.
 *
 * GET /api/concept/:handle/sharing-state   (public read)
 *
 * The owner's ruling (ADR shared-concepts-legibility/0001): "shared" means
 * published to a public relay — declared locally is not enough. So this asks
 * one question of two stores:
 *
 *   local strfry              → is it declared here?
 *   wss://dcosl.brainstorm.world → is it shared?
 *
 * Reading local state from strfry rather than Neo4j is deliberate: POST
 * /api/concept/:handle/self-declare decides idempotency from strfry, so the
 * badge this feeds must read the same store or it could contradict the very
 * button it labels.
 *
 * Public on purpose — it reveals nothing an observer could not read off the
 * relay directly. Only the WRITE path (self-declare) is owner-gated.
 *
 * The relay's failure/emptiness distinction is preserved all the way through
 * to `published: null`. See the pure core in src/lib/sharingState.js.
 */

'use strict';

const { exec } = require('child_process');
const { classifyBValue, dispositionOf } = require('../../lib/bValueForms');
const { resolveSharingState } = require('../../lib/sharingState');

const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';
const WS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/ws';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require(WS_PATH);
}

const { SimplePool } = require(NOSTR_TOOLS_PATH);

// Hardwired for now; the eventual source is the relevant relay set from the
// concept graph (story Out of scope — this is one more call site for that sweep).
const COMMUNITY_RELAY = 'wss://dcosl.brainstorm.world';
const RELAY_TIMEOUT_MS = 8000;

const HANDLE_RE = /^(\d+):([0-9a-f]{64}):(.+)$/;

/** Local strfry scan — the selfDeclare.js:34 helper pattern. */
function strfryScan(filter) {
  return new Promise((resolve, reject) => {
    const safeFilter = JSON.stringify(filter).replace(/'/g, "'\\''");
    exec(`strfry scan '${safeFilter}'`, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(error);
      const events = [];
      for (const line of String(stdout).trim().split('\n')) {
        if (!line) continue;
        try { events.push(JSON.parse(line)); } catch { /* skip unparseable line */ }
      }
      resolve(events);
    });
  });
}

const newest = (events) => (events || []).reduce((a, b) => (!a || b.created_at > a.created_at ? b : a), null);

/**
 * The community relay's copy of one addressable coordinate.
 * Returns {ok, event} — ok:false means the relay could not be asked, which is
 * NOT the same as "no such event" and must not be flattened into one.
 */
async function fetchRelayCopy(filter) {
  const pool = new SimplePool();
  try {
    const events = await Promise.race([
      pool.querySync([COMMUNITY_RELAY], filter),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), RELAY_TIMEOUT_MS)),
    ]);
    return { ok: true, event: newest(events), error: null };
  } catch (err) {
    return { ok: false, event: null, error: err.message };
  } finally {
    try { pool.close([COMMUNITY_RELAY]); } catch { /* pool already closed */ }
  }
}

async function handleConceptSharingState(req, res) {
  try {
    const handle = decodeURIComponent(req.params.handle || '');
    const m = handle.match(HANDLE_RE);
    if (!m) {
      return res.status(400).json({ success: false, error: 'handle must be kind:pubkey:d-tag' });
    }
    const kind = Number(m[1]);
    const pubkey = m[2];
    const dTag = m[3];

    // The handle's OWN pubkey, not the TA: this read answers for any header.
    // The own-header restriction belongs to the write path.
    const filter = { kinds: [kind], authors: [pubkey], '#d': [dTag] };

    const [localEvent, relay] = await Promise.all([
      strfryScan(filter).then(newest).catch(() => null),
      fetchRelayCopy(filter),
    ]);

    // Classification at the handler seam (ADR amendment 2026-08-09) — the pure
    // core stays zero-require, so bValueForms is applied here, not in the lib.
    const bValues = (localEvent && Array.isArray(localEvent.tags) ? localEvent.tags : [])
      .filter((t) => Array.isArray(t) && t[0] === 'b' && typeof t[1] === 'string')
      .map((t) => t[1].trim());
    const disposition = dispositionOf(bValues, handle);
    // The sentinel locates nothing and must never reach wiredTo, where the UI
    // would render it as a broken link.
    const wiredTo = [...new Set(bValues.filter(
      (v) => v !== handle && ['a-tag', 'event-id'].includes(classifyBValue(v)),
    ))];

    const state = resolveSharingState({
      coord: handle, disposition, wiredTo, relayEvent: relay.event, relayOk: relay.ok,
    });

    return res.json({
      success: true,
      handle,
      local: state.local,
      published: state.published,
      relay: COMMUNITY_RELAY,
      relayError: relay.error,
    });
  } catch (error) {
    console.error('concept/sharing-state error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { handleConceptSharingState };
