/**
 * Foothold-invite fulfillment helpers (ADR-0040).
 *
 * `pendingRedemptions` (pure) is the fulfill-once core: given the redemptions of
 * an issuer's invites and the set of codes already fulfilled, return only the new
 * ones. The fulfilled set is tracked device-local (mirrors notif last-seen) to
 * avoid re-publishing the carried vouch on every circle-open — the vouch is also
 * addressable, so a stray re-publish would merely replace, never duplicate.
 */
export function pendingRedemptions(redemptions, fulfilledCodes) {
  const has = fulfilledCodes && typeof fulfilledCodes.has === 'function'
    ? c => fulfilledCodes.has(c)
    : Array.isArray(fulfilledCodes) ? c => fulfilledCodes.includes(c) : () => false
  return (Array.isArray(redemptions) ? redemptions : []).filter(r => r && r.code && !has(r.code))
}

function fulfilledKey(pubkey) { return `communities:invite-fulfilled:${pubkey || 'anon'}` }

export function loadFulfilled(pubkey) {
  try {
    const raw = localStorage.getItem(fulfilledKey(pubkey))
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

export function markFulfilled(pubkey, code) {
  try {
    const set = loadFulfilled(pubkey)
    set.add(code)
    localStorage.setItem(fulfilledKey(pubkey), JSON.stringify([...set]))
  } catch {
    /* ignore (quota / private mode) */
  }
}
