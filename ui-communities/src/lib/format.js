/* Display helpers used across components. */

export function getInitials(name) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/* Deterministic OKLCH hue from a member id — same input always produces
 * the same avatar color, no random reshuffling between renders. */
const HUES = [
  280, 315, 245, 25, 195, 340, 165, 50, 220, 0, 130, 295, 30, 200, 320,
]
export function getAvatarBg(id) {
  const numeric = parseInt(String(id).replace(/\D/g, ''), 10) - 1
  const hue = HUES[Number.isFinite(numeric) ? Math.abs(numeric) % HUES.length : 0]
  return `oklch(0.58 0.14 ${hue})`
}

export function formatCount(n) {
  if (typeof n !== 'number') return n
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1)}k`
  return `${Math.round(n / 1000)}k`
}

export function trustTier(level) {
  if (level >= 0.85) return { label: 'Well-established', tone: 'strong' }
  if (level >= 0.6) return { label: 'Active participant', tone: 'medium' }
  return { label: 'Newer to this circle', tone: 'soft' }
}

/* Short display form for a hex pubkey when we have no kind-0 profile.
 * Renders as `npub1<first4>…<last4>` from the hex, good enough as a
 * stable visual handle until profile resolution lands (Slice 2 NB-1). */
export function npubShort(hex) {
  if (!hex || typeof hex !== 'string') return ''
  const clean = hex.replace(/^0x/, '')
  if (clean.length < 12) return `npub1${clean}`
  return `npub1${clean.slice(0, 4)}…${clean.slice(-4)}`
}

export function relativeTime(seconds) {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return ''
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - seconds)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return `${Math.floor(diff / 604800)}w ago`
}
