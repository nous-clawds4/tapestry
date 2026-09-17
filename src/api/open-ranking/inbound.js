/**
 * ORE-06 POST /followers + ORE-07 POST /muters (global only). See ADR ore-parity/0002.
 *
 * Twin endpoints over the verified-inbound line share one pure orchestrator
 * `buildInbound(input, deps, endpointPath)` (returns a {httpStatus, headers, body}
 * triple), exported as bound `buildFollowers` / `buildMuters`; thin wrappers
 * supply the real deps. deps = { fetchVerifiedInbound(endpointPath, pubkey, limit)
 *   -> Promise<{ rows: [{pubkey, influence}], total }> }.
 *
 * results = the target's VERIFIED followers/muters (per-edge WoT cutoff — the
 * same line the profile's verified-* surfaces use), each ranked by their OWN
 * global GrapeRank (round(influence × 100), the house scale). total = the live
 * verified-set cardinality from the same filtered scan, independent of `limit`
 * truncation (may drift from /stats/pubkey's batch-written verified*Count
 * between recomputes — documented, ADR 0002 Option C). Unknown targets are the
 * honest empty 200 (no 404), matching the provider-wide posture.
 */

const neo4j = require('neo4j-driver');
const { runCypher } = require('../../lib/neo4j-driver');
const { getConfigFromFile } = require('../../utils/config');
const { resolveAlgorithm } = require('./capabilities');
const { isValidHexPubkey, oreHeaders, errorTriple, applyTriple } = require('./shared');

// Rel + cutoff whitelist — the Cypher embeds ONLY these tokens, never request input.
const EDGES = {
  '/followers': { rel: 'FOLLOWS', cutoffKey: 'VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF' },
  '/muters': { rel: 'MUTES', cutoffKey: 'VERIFIED_MUTERS_INFLUENCE_CUTOFF' },
};

const DEFAULT_LIMIT = 50;    // ORE-06/07 "sensible default" (the spec's own example value)
const MAX_LIMIT = 1000;      // the spec's client SHOULD-NOT ceiling; over -> 422 (no clamp here)

/**
 * Real inbound dependency: two bounded, parameterized statements — top-N rows
 * (query-ordered: influence DESC, pubkey ASC for deterministic ties) and the
 * live verified-set count over the same filter. Cutoff is bound as $cutoff
 * (the mutersWithMetrics "safer form"); both statements run under the house
 * per-query deadline (NEO4J_QUERY_TIMEOUT_MS).
 */
async function fetchVerifiedInbound(endpointPath, pubkey, limit) {
  const edge = EDGES[endpointPath];
  const cutoff = parseFloat(getConfigFromFile(edge.cutoffKey, '0.05'));
  const timeoutMs = parseInt(getConfigFromFile('NEO4J_QUERY_TIMEOUT_MS', 15000), 10);
  const txConfig = { timeout: timeoutMs };
  // LIMIT demands a Bolt INTEGER — a plain JS number serializes as a float and
  // Neo4j rejects it (22N03 "found 50.0"). neo4j.int() pins the wire type.
  const params = { pubkey, cutoff, limit: neo4j.int(Math.trunc(limit)) };

  const rows = await runCypher(
    `MATCH (t:NostrUser {pubkey: $pubkey})
     MATCH (x:NostrUser)-[:${edge.rel}]->(t)
     WHERE x.influence > $cutoff
     RETURN x.pubkey AS pubkey, x.influence AS influence
     ORDER BY x.influence DESC, x.pubkey ASC
     LIMIT $limit`,
    params, txConfig
  );
  const counted = await runCypher(
    `MATCH (t:NostrUser {pubkey: $pubkey})
     MATCH (x:NostrUser)-[:${edge.rel}]->(t)
     WHERE x.influence > $cutoff
     RETURN count(x) AS total`,
    params, txConfig
  );
  return {
    rows: (rows || []).map((r) => ({ pubkey: r.pubkey, influence: Number(r.influence) || 0 })),
    total: counted && counted[0] ? Number(counted[0].total) || 0 : 0,
  };
}

/**
 * Pure ORE-06/07 orchestrator (shared by both twins).
 * @param {{pubkey?:string, algorithm?:string, pov?:string, limit?:number}} input
 * @param {{fetchVerifiedInbound:Function}} deps
 * @param {'/followers'|'/muters'} endpointPath
 * @returns {Promise<{httpStatus:number, headers:Object, body:Object}>}
 */
async function buildInbound(input, deps, endpointPath) {
  const body = input || {};

  const pubkey = body.pubkey;
  if (!isValidHexPubkey(pubkey)) {
    return errorTriple(422, 'invalid or missing pubkey (must be 64-char lowercase hex)');
  }

  const algo = resolveAlgorithm(endpointPath, body.algorithm);
  if (!algo) {
    return errorTriple(422, `unsupported algorithm '${body.algorithm}' for ${endpointPath}`);
  }
  // The global algorithm ignores any supplied pov (ORE-01).

  let limit = DEFAULT_LIMIT;
  if (body.limit !== undefined && body.limit !== null) {
    limit = Number(body.limit);
    if (!Number.isInteger(limit) || limit <= 0 || limit > MAX_LIMIT) {
      return errorTriple(422, `limit must be a positive integer <= ${MAX_LIMIT}`);
    }
  }

  const { rows, total } = await deps.fetchVerifiedInbound(endpointPath, pubkey, limit);
  // Trust the query's ordering; own the shape: every result carries a pubkey,
  // influence floors to rank 0, and the response never exceeds `limit`.
  const results = (rows || [])
    .filter((r) => r && typeof r.pubkey === 'string' && r.pubkey.length > 0)
    .slice(0, limit)
    .map((r) => ({ pubkey: r.pubkey, rank: Math.round((Number(r.influence) || 0) * 100) }));

  return { httpStatus: 200, headers: oreHeaders(), body: { results, total: Number(total) || 0 } };
}

const buildFollowers = (input, deps) => buildInbound(input, deps, '/followers');
const buildMuters = (input, deps) => buildInbound(input, deps, '/muters');

// Thin Express wrappers: real deps, run the orchestrator, apply the triple.
function makeHandler(endpointPath) {
  return async function handleInbound(req, res) {
    try {
      const triple = await buildInbound(req.body || {}, { fetchVerifiedInbound }, endpointPath);
      applyTriple(res, triple);
    } catch (err) {
      console.error(`Error in ORE ${endpointPath}:`, err);
      applyTriple(res, errorTriple(500, 'internal error'));
    }
  };
}

const handleFollowers = makeHandler('/followers');
const handleMuters = makeHandler('/muters');

module.exports = { buildFollowers, buildMuters, fetchVerifiedInbound, handleFollowers, handleMuters };
