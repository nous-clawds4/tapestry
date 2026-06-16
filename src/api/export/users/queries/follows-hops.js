/**
 * Follows-hops query handler (story profile #38, ADR 0034).
 *
 * GET /api/get-follows-hops?source=<hex>&target=<hex>
 *
 * Returns the LIVE directed FOLLOWS shortest-path distance from `source` to
 * `target` (cap 20), computed via native Cypher shortestPath through the pooled
 * Bolt driver. Public read (no auth) — see src/middleware/auth.js.
 *
 * Three-state contract:
 *   { success: true,  hops: <int 0..20> }  path found (incl. self-view 0)
 *   { success: true,  hops: null }         no path within cap        → UI renders ∞
 *   { success: false, error }              bad input / lookup error / timeout → UI "—"
 *
 * FOLLOWS is directed, so hops(A→B) need not equal hops(B→A). The 20 cap is a
 * literal in the query (Neo4j cannot parameterize variable-length bounds); the
 * pubkeys are bound parameters ($src/$tgt), so user input is never interpolated.
 */

const { runCypher } = require('../../../../lib/neo4j-driver');

// Per-query deadline. A high-cap shortestPath on the prod-scale graph must be
// bounded so a profile view never hangs; on timeout we degrade to "—", not ∞.
const HOPS_QUERY_TIMEOUT_MS = 2500;

const HEX64 = /^[0-9a-f]{64}$/;

// Cap = 20 hops, a LITERAL in the query: Neo4j cannot parameterize a
// variable-length bound, and 20 is fixed config (not user input). A pair with
// no directed FOLLOWS path within 20 is reported as ∞.
const CYPHER =
  'MATCH p = shortestPath((a:NostrUser {pubkey: $src})-[:FOLLOWS*..20]->(b:NostrUser {pubkey: $tgt})) ' +
  'RETURN length(p) AS hops';

async function handleGetFollowsHops(req, res) {
  const source = (req.query.source || '').trim();
  const target = (req.query.target || '').trim();

  if (!HEX64.test(source) || !HEX64.test(target)) {
    return res.status(400).json({
      success: false,
      error: 'source and target must each be a 64-character hex pubkey',
    });
  }

  // A node is 0 hops from itself. shortestPath with [:FOLLOWS*..20] has an
  // implicit lower bound of 1, so it would look for a cycle and wrongly yield
  // ∞ for self-view — short-circuit instead.
  if (source === target) {
    return res.json({ success: true, hops: 0 });
  }

  try {
    const rows = await runCypher(
      CYPHER,
      { src: source, tgt: target },
      { timeout: HOPS_QUERY_TIMEOUT_MS }
    );
    if (rows.length === 0) {
      // No directed FOLLOWS path within the cap.
      return res.json({ success: true, hops: null });
    }
    return res.json({ success: true, hops: rows[0].hops });
  } catch (error) {
    console.error('Error computing follows-hops:', error);
    return res.json({ success: false, error: error.message });
  }
}

module.exports = { handleGetFollowsHops };
