/**
 * Build a circle's NIP-22 root coordinate (the uppercase `A` tag value) from a
 * projected circle. Declaration circles key on their real founder (kind-39998);
 * bespoke circles fall back to founder/curator (and an optional viewer fallback,
 * preserving the prior CommunityDetail behavior). Shared by the discovery grid
 * and the circle detail so both build the coordinate identically (ADR-0036).
 */
export function circleATag(circle, viewerFallback = null) {
  if (!circle || !circle.slug) return null
  const kind = circle.model === 'declaration' ? '39998' : '39999'
  const author = circle.model === 'declaration'
    ? circle.founder
    : (circle.founder || circle.curator || viewerFallback)
  if (!author) return null
  return `${kind}:${author}:${circle.slug}`
}
