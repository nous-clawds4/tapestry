/**
 * Everything this instance has offered to the community.
 *
 * GET /api/my-offerings   (public read)
 *
 * The bulk sibling of /api/concept/:handle/sharing-state (ADR
 * shared-concepts-legibility/0002). Both stores answer for ALL of one author's
 * headers in a single query, so this costs two queries regardless of how many
 * concepts have been offered — where calling the single-coordinate endpoint per
 * row would cost N strfry scans (each a process spawn) plus N relay round trips.
 *
 * The page's promise is COMPLETENESS, which decides the failure handling:
 *
 *   relay unreachable → the local list is still complete and only PUBLICATION
 *                       is unknown, so rows render with published:null.
 *   local scan fails  → the row set itself is unknown, so this returns non-200.
 *                       An empty list would assert "you have offered nothing",
 *                       the one lie a completeness page must never tell.
 *
 * That asymmetry is deliberate (ADR 0002 Decision), not inherited from the
 * single-coordinate handler's swallow.
 *
 * The tri-state rule itself lives in src/lib/sharingState.js and is NOT
 * restated here — two endpoints now compute sharing state and the rule has
 * exactly one home.
 */

'use strict';

const { exec } = require('child_process');
const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
const { classifyBValue, dispositionOf } = require('../../lib/bValueForms');
const { carriesSelfPointer, resolveSharingState } = require('../../lib/sharingState');

const NOSTR_TOOLS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools';
const WS_PATH = '/usr/local/lib/node_modules/brainstorm/node_modules/ws';

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require(WS_PATH);
}

const { SimplePool } = require(NOSTR_TOOLS_PATH);

// Hardwired for now; the eventual source is the relevant relay set from the
// concept graph (story Out of scope — one more call site for that sweep).
const COMMUNITY_RELAY = 'wss://dcosl.brainstorm.world';
const RELAY_TIMEOUT_MS = 8000;
const HEADER_KIND = 39998;

/** Local strfry scan — the selfDeclare.js:34 helper pattern. Rejects on failure. */
function strfryScan(filter) {
  return new Promise((resolve, reject) => {
    const safeFilter = JSON.stringify(filter).replace(/'/g, "'\\''");
    exec(`strfry scan '${safeFilter}'`, { maxBuffer: 32 * 1024 * 1024 }, (error, stdout) => {
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

/** Newest event per addressable coordinate. */
function newestByCoord(events) {
  const byCoord = new Map();
  for (const ev of events || []) {
    const d = (ev.tags || []).find((t) => t[0] === 'd')?.[1];
    if (d == null) continue;
    const coord = `${ev.kind}:${ev.pubkey}:${d}`;
    const prev = byCoord.get(coord);
    if (!prev || ev.created_at > prev.created_at) byCoord.set(coord, ev);
  }
  return byCoord;
}

/** A header's tag value, or null. */
const tagValue = (ev, name, idx = 1) => {
  const t = (ev.tags || []).find((x) => x[0] === name);
  return t && typeof t[idx] === 'string' && t[idx].trim() !== '' ? t[idx] : null;
};

/**
 * The community relay's copy of this author's headers.
 * {ok:false} means the relay could not be asked — NOT that it holds nothing.
 */
async function fetchRelayHeaders(filter) {
  const pool = new SimplePool();
  try {
    const events = await Promise.race([
      pool.querySync([COMMUNITY_RELAY], filter),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), RELAY_TIMEOUT_MS)),
    ]);
    return { ok: true, byCoord: newestByCoord(events), error: null };
  } catch (err) {
    return { ok: false, byCoord: new Map(), error: err.message };
  } finally {
    try { pool.close([COMMUNITY_RELAY]); } catch { /* already closed */ }
  }
}

async function handleMyOfferings(req, res) {
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'TA pubkey unavailable' });
    }
    const filter = { kinds: [HEADER_KIND], authors: [taPubkey] };

    // The local read is NOT wrapped in a swallow: if it fails we do not know the
    // row set, and an empty list would be a false claim of completeness.
    let localEvents;
    try {
      localEvents = await strfryScan(filter);
    } catch (err) {
      return res.status(503).json({
        success: false,
        error: `Could not read local declarations: ${err.message}`,
      });
    }

    const relay = await fetchRelayHeaders(filter);

    const offerings = [];
    for (const [coord, ev] of newestByCoord(localEvents)) {
      if (!carriesSelfPointer(ev, coord)) continue; // declared = points at itself

      // Classification at the handler seam (ADR 0001 amendment) — the pure core
      // stays zero-require, so bValueForms is applied here.
      const bValues = (ev.tags || [])
        .filter((t) => Array.isArray(t) && t[0] === 'b' && typeof t[1] === 'string')
        .map((t) => t[1].trim());
      const disposition = dispositionOf(bValues, coord);
      const wiredTo = [...new Set(bValues.filter(
        (v) => v !== coord && ['a-tag', 'event-id'].includes(classifyBValue(v)),
      ))];

      const state = resolveSharingState({
        coord, disposition, wiredTo, relayEvent: relay.byCoord.get(coord) || null, relayOk: relay.ok,
      });

      offerings.push({
        coord,
        name: tagValue(ev, 'names'),
        description: tagValue(ev, 'description'),
        declaredAt: ev.created_at,
        published: state.published,
      });
    }

    offerings.sort((a, b) => b.declaredAt - a.declaredAt);

    return res.json({
      success: true,
      ta: taPubkey,
      relay: COMMUNITY_RELAY,
      relayOk: relay.ok,
      relayError: relay.error,
      offerings,
    });
  } catch (error) {
    console.error('concept/my-offerings error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { handleMyOfferings };
