/*
 * §Block-5 membership engine (ADR 0030) — pure, per-viewer roster derivation.
 *
 * Membership is "people an assertion attaches to a tag-element this circle
 * claims," counted among asserters the VIEWER trusts. Nothing is stored; the
 * roster is computed per viewer. The model is COUNT-based, mirroring the
 * server's `aggregateProfilesTagged` + `applyDisputesFunction` exactly
 * (confirmed by Vinney 2026-06-05 — the system is valence-naive by design; it
 * counts trusted asserters, it does NOT sum WoT weight):
 *
 *   applications(C) = # asserters A with wotScore(A) ≥ cutoff who APPLY a
 *                     claimed tag-element to C    (presence/+polarity = apply)
 *   disputes(C)     = # such asserters who DISPUTE (explicit −polarity)
 *   member    iff applications ≥ threshold AND applications > disputes
 *   applicant iff self-applied but not a member
 *
 *   - `cutoff`    = the WoT gate (binary; mirrors the server PoV's `minRank` —
 *                   asserters below it don't count). "No veto" falls out: a
 *                   dispute from an untrusted asserter is simply not counted.
 *   - `threshold` = the minimum trusted APPLICATIONS for membership (mirrors
 *                   `applyDisputesFunction`'s `cutoff`; integer; 1 vs N≥2 per Q4).
 *   NB the two-part gate is NOT net-difference: apps=5,disputes=4,threshold=2 →
 *   MEMBER here (5≥2 and 5>4), whereas apps−disputes≥2 would reject it.
 *
 * Inputs are injected so this is pure + testable without the network:
 *   - tags:     [{ asserter, target, concept, polarity }]  (parsed nostr-user-tags)
 *   - wotScore: (asserterPubkey) => number   GrapeRank from the viewer's PoV
 *
 * PRODUCTION PATH (ADR 0030, resolved 2026-06-05): the live roster is served by
 * the brainstorm server's `aggregateProfilesTagged` + `applyDisputesFunction`
 * over the circle's claimed tag-elements at the resolved PoV (house in v1) — the
 * server owns the WoT/Meili scoring (app-as-consumer). This pure function is the
 * SEMANTIC REFERENCE for that math, the test oracle, and an offline house-PoV
 * fallback — not the production scorer. A "claim" is a kind-39999 tag-ELEMENT
 * coord `39999:<founder>:<slug>`; `t.concept` here is that coord.
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

  // Per target: COUNT trusted applications vs disputes (binary WoT gate),
  // mirroring the server's count primitive — not a weighted sum.
  const byCandidate = new Map() // target -> { applications, disputes, selfApplied }
  for (const t of latest.values()) {
    const entry = byCandidate.get(t.target) || { applications: 0, disputes: 0, selfApplied: false }
    const w = wotScore ? wotScore(t.asserter) : 0
    // The presence of a tag is an apply. Only an EXPLICIT negative polarity is a
    // dispute — an absent/zero polarity must never silently become a dispute.
    const isApply = !(t.polarity < 0)
    if (typeof w === 'number' && w >= cutoff) {
      if (isApply) entry.applications += 1
      else entry.disputes += 1
    }
    // Applicant standing tracks self-application regardless of trust weight, so
    // an untrusted outsider who self-tags still surfaces as an applicant.
    if (t.asserter === t.target && isApply) entry.selfApplied = true
    byCandidate.set(t.target, entry)
  }

  const members = []
  const applicants = []
  for (const [pubkey, e] of byCandidate) {
    const row = { pubkey, applications: e.applications, disputes: e.disputes }
    if (e.applications >= threshold && e.applications > e.disputes) members.push(row)
    else if (e.selfApplied) applicants.push(row)
  }
  members.sort((a, b) => b.applications - a.applications)
  applicants.sort((a, b) => b.applications - a.applications)
  return { members, applicants }
}
