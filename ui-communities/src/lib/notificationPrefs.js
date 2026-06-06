/**
 * Notification preferences (ADR-0037) — device-local, off by default.
 *
 * The pure default/merge core is the sovereignty guarantee: a person who has
 * never set a preference reads as all-off, and unknown/non-boolean stored values
 * are ignored. Persistence is localStorage, keyed per identity, isolated here so
 * a future portable backend is a contained swap. In-app occasions only (Q6).
 */

export const OCCASIONS = [
  { id: 'vouched', label: 'Someone vouches for you' },
  { id: 'new-posts', label: 'New posts in your circles' },
  { id: 'replies', label: 'Replies to you' },
]

// Pure. Every occasion off. (Kept as a literal so it evaluates standalone.)
export function defaultPreferences() {
  return { vouched: false, 'new-posts': false, replies: false }
}

// Pure. Merge stored values over the all-off defaults, keeping only known
// occasion keys with boolean values — missing/unknown/non-boolean → off.
export function mergePreferences(stored) {
  const out = { vouched: false, 'new-posts': false, replies: false }
  if (stored && typeof stored === 'object') {
    for (const key of Object.keys(out)) {
      if (typeof stored[key] === 'boolean') out[key] = stored[key]
    }
  }
  return out
}

function storageKey(pubkey) {
  return `communities:notif-prefs:${pubkey || 'anon'}`
}

export function loadPreferences(pubkey) {
  try {
    const raw = localStorage.getItem(storageKey(pubkey))
    return mergePreferences(raw ? JSON.parse(raw) : null)
  } catch {
    return mergePreferences(null)
  }
}

// Save one occasion. Returns { ok } — localStorage can throw (quota / private
// mode), which the UI treats as a failed save (revert + retry).
export function savePreference(pubkey, occasion, enabled) {
  try {
    const next = { ...loadPreferences(pubkey), [occasion]: !!enabled }
    localStorage.setItem(storageKey(pubkey), JSON.stringify(next))
    return { ok: true }
  } catch {
    return { ok: false }
  }
}
