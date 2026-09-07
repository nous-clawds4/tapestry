/**
 * Per-relay presence probe — ADR treasure-map-relay-presence/0001.
 *
 * GET /api/relay/presence?relay=<one ws(s) url>&pubkey=<64-hex>&kind=<int>
 *
 * Answers, for ONE relay, whether it holds the author's newest event of that kind:
 *   { success: true, relay, status: 'present'|'absent'|'unreachable', event, error }
 * where `event` is `{ id, created_at }` or null.
 *
 * Deliberately one relay per request: the caller fans out and renders each row as it lands,
 * so a dead relay stalls its own row instead of the whole panel (story AC-5). The sibling
 * endpoint /api/relay/external stays as it is — it merges across relays by design.
 */

const HEX64 = /^[0-9a-fA-F]{64}$/;
const WS_URL = /^wss?:\/\/.+/i;

function bad(res, error) {
  return res.status(400).json({ success: false, error });
}

/**
 * @param {Object} req  express request (uses req.query)
 * @param {Object} res  express response
 * @param {Object} [deps]  { probe } — injectable, in the _shared/relaySource DI idiom.
 */
async function handleRelayPresence(req, res, deps = {}) {
  const probe = deps.probe || require('../_shared/relaySource').probeRelayForEvent;
  const query = req.query || {};
  const relay = typeof query.relay === 'string' ? query.relay.trim() : '';
  const pubkey = typeof query.pubkey === 'string' ? query.pubkey.trim() : '';
  const kindRaw = typeof query.kind === 'string' ? query.kind.trim() : '';

  if (!relay) return bad(res, 'relay is required (one ws:// or wss:// URL)');
  // One relay per request — a comma list is the /api/relay/external shape, not this one.
  if (relay.includes(',')) return bad(res, 'exactly one relay per request');
  if (!WS_URL.test(relay)) return bad(res, 'relay must be a ws:// or wss:// URL');
  if (!HEX64.test(pubkey)) return bad(res, 'pubkey is required (64 hex characters)');
  if (!/^\d+$/.test(kindRaw)) return bad(res, 'kind is required (a non-negative integer)');

  const kind = Number(kindRaw);
  if (!Number.isInteger(kind)) return bad(res, 'kind is required (a non-negative integer)');

  let result;
  try {
    result = await probe(relay, { kinds: [kind], authors: [pubkey.toLowerCase()], limit: 1 });
  } catch (err) {
    // A probe that throws tells us nothing about the relay, which is exactly "unreachable".
    result = { status: 'unreachable', event: null, error: err && err.message ? err.message : String(err) };
  }

  // A relay-level failure is a 200 carrying the status: the row needs the outcome, and a
  // non-2xx would conflate transport with what the relay said.
  return res.json({
    success: true,
    relay,
    status: result.status,
    // Only what the caller renders. The full event is already on the caller's screen.
    event: result.event ? { id: result.event.id, created_at: result.event.created_at } : null,
    error: result.error || null,
  });
}

module.exports = { handleRelayPresence };
