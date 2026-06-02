/**
 * Newest-by-created_at selection for kind-0 events (rev. 2, Finding 1).
 *
 * Pure (no I/O). The bug: /api/profiles queried external PROFILE_RELAYS first
 * and only fell back to local strfry for *missing* pubkeys, so a fresh local
 * write was masked by a stale external profile. The fix is to gather kind-0
 * events from BOTH sources and keep the one with the greatest created_at.
 *
 * Ties (equal created_at) keep the first-seen event; callers should pass local
 * events first when local should win a tie, but in practice created_at differs.
 */

/**
 * @param {Array<{created_at:number}>} events
 * @returns {object|null} the event with the greatest created_at, or null
 */
function pickNewestEvent(events) {
  let best = null;
  for (const ev of events || []) {
    if (!ev) continue;
    const ts = Number(ev.created_at) || 0;
    if (!best || ts > (Number(best.created_at) || 0)) best = ev;
  }
  return best;
}

/**
 * Group events by pubkey, keeping the newest per pubkey.
 * @param {Array<{pubkey:string, created_at:number}>} events
 * @returns {Map<string, object>} pubkey -> newest event
 */
function mergeNewestByPubkey(events) {
  const latest = new Map();
  for (const ev of events || []) {
    if (!ev || !ev.pubkey) continue;
    const prev = latest.get(ev.pubkey);
    if (!prev || (Number(ev.created_at) || 0) > (Number(prev.created_at) || 0)) {
      latest.set(ev.pubkey, ev);
    }
  }
  return latest;
}

module.exports = { pickNewestEvent, mergeNewestByPubkey };
