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
