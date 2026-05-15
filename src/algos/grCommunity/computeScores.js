/*
 * GR-Community scoring — pure fixed-point iteration.
 *
 * No I/O. Deterministic input → deterministic output. The caller is
 * responsible for resolving raw endorsement/veto events into the
 * { rater, target } shape and for providing baseline GR scores.
 *
 * Algorithm (per PLAN.md §4):
 *   - Seeds: c[p] = 1 (fixed; never iterated).
 *   - Non-seeds: c[p] = clamp(sum(weight * rating) / sum(weight), 0, 1)
 *     where weight(rater) = baselineGr(rater) * c(rater) (the two gates)
 *     and rating is +1 for endorse, -1 for veto.
 *   - Iterate until max |c_new[p] - c[p]| < convergenceThreshold or
 *     until maxIterations is reached.
 *
 * Self-ratings are excluded (rater === target is silently dropped).
 *
 * Output is bounded to pubkeys that appear in seeds, endorsements, or vetoes.
 * Pubkeys present only in baselineGr but with no signals are NOT in the
 * result map.
 */

const { twoGateWeight } = require('./twoGate.js')

const WEIGHTING_MODEL_ID = 'gr-community-default-v1'

const DEFAULTS = {
  maxIterations: 60,
  convergenceThreshold: 0.001,
  weightingModel: WEIGHTING_MODEL_ID,
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

function asNumberMap(obj) {
  if (obj instanceof Map) return obj
  const m = new Map()
  if (!obj) return m
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number') m.set(k, v)
  }
  return m
}

/**
 * Compute GR-Community scores.
 *
 * @param {object} input
 * @param {string[]} input.seeds - seed pubkeys (community_gr fixed at 1).
 * @param {Array<{rater: string, target: string}>} input.endorsements
 * @param {Array<{rater: string, target: string}>} input.vetoes
 * @param {Map<string, number>|Record<string, number>} input.baselineGr - baseline GR in [0, 1].
 * @param {object} [input.options]
 * @returns {{ scores: Map<string, number>, iterations: number }}
 */
function computeGrCommunityScores(input) {
  const {
    seeds = [],
    endorsements = [],
    vetoes = [],
    baselineGr = {},
    options = {},
  } = input || {}

  const opts = { ...DEFAULTS, ...options }
  if (opts.weightingModel !== WEIGHTING_MODEL_ID) {
    throw new Error(
      `Unknown weightingModel "${opts.weightingModel}". Slice 2 supports "${WEIGHTING_MODEL_ID}" only.`,
    )
  }

  const baseline = asNumberMap(baselineGr)
  const seedSet = new Set(seeds)

  // Collect all pubkeys that appear in seeds or in any signal (rater or target).
  // The result map is bounded to this universe — pubkeys in baselineGr alone
  // are not in the output.
  const universe = new Set(seeds)
  // Filter self-ratings and build the signal list.
  const signals = []
  for (const e of endorsements) {
    if (!e || !e.rater || !e.target || e.rater === e.target) continue
    universe.add(e.rater)
    universe.add(e.target)
    signals.push({ rater: e.rater, target: e.target, rating: +1 })
  }
  for (const v of vetoes) {
    if (!v || !v.rater || !v.target || v.rater === v.target) continue
    universe.add(v.rater)
    universe.add(v.target)
    signals.push({ rater: v.rater, target: v.target, rating: -1 })
  }

  // Index signals by target for O(targets * signals/target) iteration.
  const signalsByTarget = new Map()
  for (const s of signals) {
    let arr = signalsByTarget.get(s.target)
    if (!arr) {
      arr = []
      signalsByTarget.set(s.target, arr)
    }
    arr.push(s)
  }

  // Initialize community-GR scores. Seeds fixed at 1; others start at 0.
  let c = new Map()
  for (const p of universe) {
    c.set(p, seedSet.has(p) ? 1 : 0)
  }

  let iterations = 0
  for (let iter = 1; iter <= opts.maxIterations; iter++) {
    iterations = iter
    const cNext = new Map(c)
    let maxDelta = 0

    for (const target of universe) {
      if (seedSet.has(target)) continue // seeds are fixed
      const arr = signalsByTarget.get(target)
      if (!arr || arr.length === 0) {
        // No signals for this target — score is 0 (initial value, unchanged).
        continue
      }
      let numerator = 0
      let denominator = 0
      for (const s of arr) {
        const w = twoGateWeight(baseline.get(s.rater) || 0, c.get(s.rater) || 0)
        if (w === 0) continue
        numerator += w * s.rating
        denominator += w
      }
      const next = denominator > 0 ? clamp01(numerator / denominator) : 0
      const prev = c.get(target) || 0
      const delta = Math.abs(next - prev)
      if (delta > maxDelta) maxDelta = delta
      cNext.set(target, next)
    }

    c = cNext
    if (maxDelta < opts.convergenceThreshold) break
  }

  return { scores: c, iterations }
}

module.exports = { computeGrCommunityScores, WEIGHTING_MODEL_ID, DEFAULTS }
