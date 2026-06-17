/**
 * Follows-hops PATHS query handler (story profile #39, ADR 0035).
 *
 * GET /api/get-follows-hops-paths?source=<hex>&target=<hex>
 *
 * Returns up to 25 equally-short directed FOLLOWS paths (cap 20) from `source`
 * to `target`, each an ordered list of nodes [{pubkey, influence}] — the data
 * for the follows-hops path page. Owner-PoV `influence` (a NostrUser node
 * property) lets the client render each card's rank (Math.round(influence*100)).
 * Public read (no auth). Companion to the #38 count endpoint /api/get-follows-hops.
 *
 * Three-state contract (as ADR 0034/0035):
 *   { success:true, hops:<int>, paths:[[{pubkey,influence},...],...], truncated }
 *       path(s) found (incl. self-view: hops 0, one single-node path)
 *   { success:true, hops:null, paths:[] }   no path within cap        → UI renders ∞
 *   { success:false, error }                bad input / lookup error / timeout → UI "—"
 *
 * FOLLOWS is directed; the cap 20 and LIMIT 25 are literals (Neo4j cannot
 * parameterize a variable-length bound); the pubkeys are bound parameters.
 */

const { runCypher } = require('../../../../lib/neo4j-driver');

// Per-query deadline. allShortestPaths at cap 20 on the prod-scale graph must be
// bounded so a view never hangs; on timeout we degrade to "—", not a false path.
const HOPS_PATHS_QUERY_TIMEOUT_MS = 3000;

const HEX64 = /^[0-9a-f]{64}$/;

// All equally-short directed FOLLOWS paths (cap 20), bounded to 25 paths.
const CYPHER =
  'MATCH p = allShortestPaths((a:NostrUser {pubkey: $src})-[:FOLLOWS*..20]->(b:NostrUser {pubkey: $tgt})) ' +
  'RETURN [n IN nodes(p) | { pubkey: n.pubkey, influence: n.influence }] AS nodes ' +
  'LIMIT 25';

// Single-node lookup for the self-view "path" — its Owner-PoV influence (card rank).
const SELF_CYPHER = 'MATCH (a:NostrUser {pubkey: $src}) RETURN a.influence AS influence';

async function handleGetFollowsHopsPaths(req, res) {
  const source = (req.query.source || '').trim();
  const target = (req.query.target || '').trim();

  if (!HEX64.test(source) || !HEX64.test(target)) {
    return res.status(400).json({
      success: false,
      error: 'source and target must each be a 64-character hex pubkey',
    });
  }

  try {
    // Self-view: a node is 0 hops from itself — a single-card "path", no traversal.
    if (source === target) {
      const rows = await runCypher(SELF_CYPHER, { src: source }, { timeout: HOPS_PATHS_QUERY_TIMEOUT_MS });
      const influence = rows.length ? (rows[0].influence ?? null) : null;
      return res.json({
        success: true,
        hops: 0,
        paths: [[{ pubkey: source, influence }]],
        truncated: false,
      });
    }

    const rows = await runCypher(CYPHER, { src: source, tgt: target }, { timeout: HOPS_PATHS_QUERY_TIMEOUT_MS });
    if (rows.length === 0) {
      // No directed FOLLOWS path within the cap.
      return res.json({ success: true, hops: null, paths: [] });
    }
    const paths = rows.map(r => r.nodes);
    return res.json({
      success: true,
      hops: paths[0].length - 1,
      paths,
      truncated: rows.length === 25,
    });
  } catch (error) {
    console.error('Error computing follows-hops paths:', error);
    return res.json({ success: false, error: error.message });
  }
}

module.exports = { handleGetFollowsHopsPaths };
