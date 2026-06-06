/**
 * Pure "signs of life" description (ADR-0036).
 *
 * Given a circle's post timestamps (kind-1111 posts + replies, unix seconds),
 * its founded date, and a reference `now`, return a single plain activity line —
 * or null to omit (no data, or no `now`). Calm about quiet (design principle 11):
 * a dormant circle is stated plainly, never alarmed or hyped. Recency is carried
 * by the phrase itself, never by color.
 *
 * Self-contained (helpers inlined) so it can be evaluated standalone in tests.
 */
export function describeActivity({ postTimes = [], foundedAt = null, now = null }) {
  if (now == null) return null
  const DAY = 86400, WEEK = 7 * DAY, MONTH = 30 * DAY
  const rel = seconds => {
    if (seconds < DAY) return 'today'
    if (seconds < WEEK) return `${Math.floor(seconds / DAY)} days ago`
    if (seconds < MONTH) return `${Math.floor(seconds / WEEK)} weeks ago`
    return `${Math.floor(seconds / MONTH)} months ago`
  }
  const countLabel = n => `${n} post${n === 1 ? '' : 's'} this week`
  const times = Array.isArray(postTimes) ? postTimes : []
  const last = times.length ? Math.max(...times) : null
  if (last != null) {
    const age = now - last
    const recent = times.filter(t => now - t <= WEEK).length
    const tail = recent > 0 ? ` · ${countLabel(recent)}` : ''
    if (age <= DAY) return `Active today${tail}`
    if (age <= WEEK) return `Active this week${tail}`
    return `Quiet lately · last post ${rel(age)}`
  }
  if (foundedAt != null) {
    const age = now - foundedAt
    if (age <= WEEK) return `New circle · founded ${rel(age)}`
    return 'Quiet · no posts yet'
  }
  return null
}
