'use strict';
/**
 * Pure, dependency-free search-quality scorer. See ADR 0004.
 * No I/O, no globals — every function is deterministic for given inputs so the
 * regression gate is reproducible.
 */

function toRelevantSet(judged) {
  return new Set((judged || []).filter(Boolean));
}

/** Fraction of judged-relevant items appearing within the top-k hits. */
function recallAtK(hitPubkeys, judged, k) {
  const rel = toRelevantSet(judged);
  if (rel.size === 0) return 0;
  const top = (hitPubkeys || []).slice(0, k);
  let found = 0;
  for (const id of rel) if (top.includes(id)) found++;
  return found / rel.size;
}

/** Reciprocal rank of the first judged-relevant hit; 0 if none are relevant. */
function mrr(hitPubkeys, judged) {
  const rel = toRelevantSet(judged);
  if (rel.size === 0) return 0;
  const hits = hitPubkeys || [];
  for (let i = 0; i < hits.length; i++) {
    if (rel.has(hits[i])) return 1 / (i + 1);
  }
  return 0;
}

function mean(nums) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

/**
 * Roll per-query results into an overall summary, preserving the per-query
 * breakdown verbatim (so the report stays auditable — AC-4) and echoing the
 * corpus/index reference the run was scored against (AC-1).
 */
function aggregate(perQuery, opts) {
  const entries = perQuery || [];
  const overall = {
    recall: mean(entries.map(e => Number(e.recall) || 0)),
    mrr: mean(entries.map(e => Number(e.mrr) || 0)),
    n: entries.length,
  };
  return { overall, corpus: (opts && opts.corpus) || null, perQuery: entries };
}

/**
 * Regression-gate decision (AC-2). Pure: given the overall score, the baseline
 * config, and per-query results, decide pass/fail and name the regressed
 * queries. Boundary is inclusive — exactly baseline-minus-tolerance PASSES.
 */
function evaluateGate(overall, baselineCfg, perQuery) {
  const baseline = baselineCfg && typeof baselineCfg.baseline === 'number' ? baselineCfg.baseline : 0;
  const tolerance = baselineCfg && typeof baselineCfg.tolerance === 'number' ? baselineCfg.tolerance : 0;
  const pass = Number(overall) >= baseline - tolerance;
  const regressed = (perQuery || [])
    .filter(p => typeof p.baseline === 'number' && Number(p.recall) < p.baseline)
    .map(p => p.id);
  return { pass, regressed };
}

module.exports = { recallAtK, mrr, aggregate, evaluateGate };
