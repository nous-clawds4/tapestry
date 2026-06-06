/**
 * Pure detection for offered live updates (ADR-0035).
 *
 * Given a freshly-fetched list of posts, the set of post ids currently
 * displayed, and the viewer's pubkey, return how many are genuinely "new":
 * not already displayed and not authored by the viewer (the viewer's own
 * posts surface immediately on send, so they are never counted as new).
 *
 * This is a detector only — the caller stores the count and never injects the
 * fetched posts until the member taps, which keeps the displayed conversation
 * from shifting (the sovereignty constraint, design principle 7).
 */
export function countNewPosts(freshPosts, displayedIds, viewerPubkey) {
  if (!Array.isArray(freshPosts)) return 0
  const isDisplayed = displayedIds && typeof displayedIds.has === 'function'
    ? id => displayedIds.has(id)
    : () => false
  let count = 0
  for (const p of freshPosts) {
    if (!p || !p.id) continue
    if (isDisplayed(p.id)) continue
    if (p.author === viewerPubkey) continue
    count++
  }
  return count
}
