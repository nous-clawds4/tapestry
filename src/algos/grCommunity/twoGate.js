/*
 * GR-Community two-gate weighting (PLAN.md §4).
 *
 * Each rating's confidence weight is the product of two gates:
 *   gate 1: the rater's baseline GR influence in [0, 1]
 *           (filters bots and unestablished accounts)
 *   gate 2: the rater's GR-Community influence for THIS community in [0, 1]
 *           (filters outsiders, including high-reputation outsiders)
 *
 * Multiplicative gating means both must be non-trivial for a rating to count.
 * A bot has gate-1 near zero; a high-reputation outsider has gate-2 near zero;
 * Sybil-via-endorsement requires building both, which is exponentially harder.
 */

function twoGateWeight(baselineGr, communityGr) {
  const b = typeof baselineGr === 'number' && baselineGr > 0 ? baselineGr : 0
  const c = typeof communityGr === 'number' && communityGr > 0 ? communityGr : 0
  return b * c
}

module.exports = { twoGateWeight }
