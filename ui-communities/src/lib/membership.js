/*
 * §Block-5 membership engine (ADR 0030) — pure, per-viewer roster derivation.
 *
 * Membership is "people carrying a tag for a concept this circle claims,"
 * weighted by how much the VIEWER trusts each asserter. Nothing is stored;
 * the roster is computed per viewer.
 *
 *   score(candidate) = Σ over asserters A of [ wotScore(A) × polarity ]
 *                      counting only A whose wotScore ≥ cutoff
 *   member    iff score ≥ threshold
 *   applicant iff self-tagged but below threshold
 *
 * "No veto" falls out: a −1 from an untrusted asserter (wotScore < cutoff)
 * contributes 0.
 *
 * Inputs are injected so this is pure + testable without the network:
 *   - tags:     [{ asserter, target, concept, polarity }]  (parsed nostr-user-tags)
 *   - wotScore: (asserterPubkey) => number   GrapeRank from the viewer's PoV
 *
 * The live tag reader + the real wotScore wire in once the nostr-user-tag
 * schema is locked (Story 43) — this function does not change then.
 */

export function deriveRoster(circle, tags, wotScore, opts = {}) {
  // This is the single source of truth for the trust-bar defaults. The wire
  // projection reports an unset threshold/cutoff as null (so §26 can inherit);
  // `== null` collapses both null and undefined to the default here. 0 is a
  // legitimate cutoff and is preserved.
  const cutoff = opts.cutoff == null ? 0.5 : opts.cutoff
  const threshold = opts.threshold == null ? 1 : opts.threshold
  const claimed = new Set((circle && circle.claims) || [])

  // Collapse to one assertion per (asserter, target, concept). A nostr-user-tag
  // is an addressable/replaceable event: re-vouching SUPERSEDES, it doesn't
  // stack. The caller passes assertions in publish order; last occurrence wins.
  // Without this, an accidental duplicate would double-count a single voucher.
  const latest = new Map()
  for (const t of tags || []) {
    if (!t || !claimed.has(t.concept)) continue // only tags for a claimed concept
    latest.set(`${t.asserter}|${t.target}|${t.concept}`, t)
  }

  const byCandidate = new Map() // target pubkey -> { score, selfTagged }
  for (const t of latest.values()) {
    const entry = byCandidate.get(t.target) || { score: 0, selfTagged: false }
    const w = wotScore ? wotScore(t.asserter) : 0
    if (typeof w === 'number' && w >= cutoff) {
      // The presence of a tag is a vouch (+1). Only an EXPLICIT negative
      // polarity is a dispute — an absent/zero polarity must never silently
      // flip a vouch into a downvote.
      entry.score += w * (t.polarity < 0 ? -1 : 1)
    }
    if (t.asserter === t.target) entry.selfTagged = true
    byCandidate.set(t.target, entry)
  }

  const members = []
  const applicants = []
  for (const [pubkey, e] of byCandidate) {
    if (e.score >= threshold) members.push({ pubkey, score: e.score })
    else if (e.selfTagged) applicants.push({ pubkey, score: e.score })
  }
  members.sort((a, b) => b.score - a.score)
  applicants.sort((a, b) => b.score - a.score)
  return { members, applicants }
}
