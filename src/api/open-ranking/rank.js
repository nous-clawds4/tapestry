/**
 * ORE-03 POST /rank/pubkeys (global only). See ADR ore-parity/0001.
 *
 * Pure orchestrator `buildRank(input, deps)` (returns a {httpStatus, headers,
 * body} triple); thin `handleRankPubkeys` supplies the real deps.
 * deps = { fetchInfluences(pubkeys) -> Promise<[{pubkey, influence}]> }.
 *
 * The batch counterpart of ORE-02: rank = round(NostrUser.influence × 100)
 * under the instance's global (owner-baseline) point of view — the same node,
 * property, and rounding as /stats/pubkey, so the two endpoints always agree.
 * ORE-03 requires a rank for every requested pubkey, so unknown pubkeys still
 * rank (floor 0). Personalized ranking is out of scope (W12 / ADR
 * open-ranking/0005 gate).
 */

const { runCypher } = require('../../lib/neo4j-driver');
const { resolveAlgorithm } = require('./capabilities');
const { isValidHexPubkey, oreHeaders, errorTriple, applyTriple } = require('./shared');

// ORE-03: clients SHOULD NOT send more than 1000 pubkeys; we enforce the same
// ceiling as the provider max, counted pre-dedup (ADR ore-parity/0001 decision 4).
const MAX_PUBKEYS = 1000;

/**
 * Real rank dependency: one round trip for the whole batch. OPTIONAL MATCH +
 * COALESCE guarantees a row (influence 0) for pubkeys the graph doesn't know —
 * mirroring the owner branch of get-profile-scores (the ORE-02 source).
 */
async function fetchInfluences(pubkeys) {
  const rows = await runCypher(
    `UNWIND $pubkeys AS p
     OPTIONAL MATCH (u:NostrUser {pubkey: p})
     RETURN p AS pubkey, COALESCE(u.influence, 0) AS influence`,
    { pubkeys }
  );
  return (rows || []).map((r) => ({ pubkey: r.pubkey, influence: Number(r.influence) || 0 }));
}

/**
 * Pure ORE-03 orchestrator.
 * @param {{pubkeys?:string[], algorithm?:string, pov?:string, limit?:number}} input
 * @param {{fetchInfluences:Function}} deps
 * @returns {Promise<{httpStatus:number, headers:Object, body:Object}>}
 */
async function buildRank(input, deps) {
  const body = input || {};

  const pubkeys = body.pubkeys;
  if (!Array.isArray(pubkeys) || pubkeys.length === 0) {
    return errorTriple(422, 'pubkeys must be a non-empty array of 64-char lowercase hex pubkeys');
  }
  if (pubkeys.length > MAX_PUBKEYS) {
    return errorTriple(413, `too many pubkeys (max ${MAX_PUBKEYS})`);
  }
  if (!pubkeys.every(isValidHexPubkey)) {
    return errorTriple(422, 'pubkeys must be a non-empty array of 64-char lowercase hex pubkeys');
  }

  const algo = resolveAlgorithm('/rank/pubkeys', body.algorithm);
  if (!algo) {
    return errorTriple(422, `unsupported algorithm '${body.algorithm}' for /rank/pubkeys`);
  }
  // The global algorithm ignores any supplied pov (ORE-01).

  // Duplicates collapse, first occurrence kept; limit defaulting/clamping uses
  // the deduplicated count (ADR ore-parity/0001 decision 2).
  const deduped = [...new Set(pubkeys)];

  let limit = deduped.length;
  if (body.limit !== undefined && body.limit !== null) {
    limit = Number(body.limit);
    if (!Number.isInteger(limit) || limit <= 0) {
      return errorTriple(422, 'limit must be a positive integer');
    }
    limit = Math.min(limit, deduped.length); // ORE-03: silently clamp to the batch size
  }

  const rows = await deps.fetchInfluences(deduped);
  const influenceByPubkey = new Map((rows || []).map((r) => [r.pubkey, r.influence]));
  // The builder owns ORE-03's every-requested-pubkey contract, whatever the
  // deps returned: a pubkey with no row falls back to influence 0.
  const results = deduped
    .map((p) => ({ pubkey: p, rank: Math.round((Number(influenceByPubkey.get(p)) || 0) * 100) }))
    .sort((a, b) => b.rank - a.rank) // stable sort: ties keep request order (ADR decision 3)
    .slice(0, limit);

  return { httpStatus: 200, headers: oreHeaders(), body: { results } };
}

// Thin Express wrapper: build the real deps, run the orchestrator, apply the triple.
async function handleRankPubkeys(req, res) {
  try {
    const triple = await buildRank(req.body || {}, { fetchInfluences });
    applyTriple(res, triple);
  } catch (err) {
    console.error('Error in ORE /rank/pubkeys:', err);
    applyTriple(res, errorTriple(500, 'internal error'));
  }
}

module.exports = { buildRank, fetchInfluences, handleRankPubkeys };
