/**
 * Story #34 / ADR 0030 — followers list with owner-POV metrics (verified only).
 *
 *   GET /api/get-grapevine-followers?observee=<pk>[&observer=owner]
 *
 * Lists the VERIFIED accounts that follow <observee> — inbound FOLLOWS edges whose
 * follower clears the verification cutoff — with the owner's GrapeRank metrics read
 * straight from each follower's NostrUser node: influence (→ rank), hops, and the
 * three verified counts. v1 is OWNER POV ONLY; a non-owner `observer` is rejected 400
 * (customer cards deferred, exactly like followsWithMetrics.js / ADR 0026).
 *
 * The inbound mirror of followsWithMetrics.js. ADR 0030 chose Option A — a NEW,
 * isolated endpoint, leaving the follows endpoint untouched. The verified filter
 * reuses VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF (the same cutoff the verified-* count
 * algos write into the node properties). The whole verified set is returned; the page
 * sorts/paginates client-side (50/page), like the follows page. Mirrors the per-query
 * Neo4j deadline + 504 pattern (story #5 / ADRs 0024-0025).
 */

const neo4j = require('neo4j-driver');
const { getConfigFromFile } = require('../../../utils/config');
const { nip19 } = require('nostr-tools');

// Verified cutoff — reused from the existing verified-* machinery (/etc/graperank.conf).
// Read at module load; restart the brainstorm process to pick up changes. Default 0.05
// matches the sibling cutoff usage in cypherQueries.js.
const VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF = getConfigFromFile('VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF', '0.05');

function toInt(v) {
  if (v == null) return null;
  if (typeof v.toNumber === 'function') return v.toNumber();
  if (typeof v === 'object' && typeof v.low === 'number') return v.low;
  const n = parseInt(v.toString(), 10);
  return Number.isNaN(n) ? null : n;
}

function toFloat(v) {
  if (v == null) return null;
  const n = parseFloat(v.toString());
  return Number.isNaN(n) ? null : n;
}

function isValidHexPubkey(pk) {
  return typeof pk === 'string' && /^[0-9a-f]{64}$/i.test(pk);
}

/**
 * GET /api/get-grapevine-followers
 */
function handleGetGrapevineFollowers(req, res) {
  try {
    const observee = req.query.observee;
    const observer = req.query.observer; // v1: owner only (see below)

    // --- Validate observee: 64-char hex, cross-checked via nip19 (cf. followsWithMetrics.js).
    if (!observee || !isValidHexPubkey(observee)) {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid observee parameter (expected a 64-character hex pubkey)'
      });
    }
    try {
      const npub = nip19.npubEncode(observee);
      if (!npub.startsWith('npub')) throw new Error('bad encode');
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid observee parameter' });
    }

    // --- v1 is OWNER POV only. Customer observers are deferred (ADR 0030, mirroring
    // ADR 0026): their metrics live on NostrUserWotMetricsCard, which this endpoint
    // does not yet read.
    const ownerPubkey = getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', '');
    if (observer && observer !== 'owner' && observer !== ownerPubkey) {
      return res.status(400).json({
        success: false,
        message: 'customer observers not yet supported — this endpoint currently serves the owner point of view only'
      });
    }

    // --- Neo4j with a driver-layer deadline (story #5 / ADR 0024-0025 pattern).
    const neo4jUri = getConfigFromFile('NEO4J_URI', 'bolt://localhost:7687');
    const neo4jUser = getConfigFromFile('NEO4J_USER', 'neo4j');
    const neo4jPassword = getConfigFromFile('NEO4J_PASSWORD', 'neo4j');
    const queryTimeoutMs = parseInt(getConfigFromFile('NEO4J_QUERY_TIMEOUT_MS', 15000), 10);

    const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
    const session = driver.session();

    // Followers = INBOUND FOLLOWS edges, filtered to VERIFIED (follower influence > cutoff).
    // Owner POV: the metrics ARE the follower NostrUser node's own GrapeRank properties
    // (no NostrUserWotMetricsCard join in v1). The whole verified set is returned; the
    // page sorts by verifiedFollowerCount desc and paginates client-side, like follows.
    const cypherQuery = `
      MATCH (follower:NostrUser)-[:FOLLOWS]->(observee:NostrUser {pubkey: $observee})
      WHERE follower.influence > ${VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF}
      RETURN follower.pubkey AS pubkey,
             follower.influence AS influence,
             follower.hops AS hops,
             follower.verifiedFollowerCount AS verifiedFollowerCount,
             follower.verifiedMuterCount AS verifiedMuterCount,
             follower.verifiedReporterCount AS verifiedReporterCount
    `;

    const queryStartMs = Date.now();
    session.run(cypherQuery, { observee }, { timeout: queryTimeoutMs })
      .then(result => {
        const data = result.records
          .map(r => ({
            pubkey: r.get('pubkey') ?? null,
            influence: toFloat(r.get('influence')),
            hops: toInt(r.get('hops')),
            verifiedFollowerCount: toInt(r.get('verifiedFollowerCount')),
            verifiedMuterCount: toInt(r.get('verifiedMuterCount')),
            verifiedReporterCount: toInt(r.get('verifiedReporterCount'))
          }))
          // Defensive: drop any null-pubkey row.
          .filter(row => row.pubkey);

        res.status(200).json({
          success: true,
          observer: 'owner',
          observee,
          count: data.length,
          data
        });
      })
      .catch(error => {
        const elapsedMs = Date.now() - queryStartMs;
        const isTimeout = error && typeof error.code === 'string' && /TransactionTimedOut/i.test(error.code);
        if (isTimeout) {
          console.error('Neo4j query timeout fetching grapevine followers:', { observee, elapsedMs, limitMs: queryTimeoutMs, code: error.code });
          return res.status(504).json({
            success: false,
            message: `Neo4j query timeout after ${elapsedMs}ms (limit ${queryTimeoutMs}ms) fetching followers for ${observee}.`
          });
        }
        console.error('Error fetching grapevine followers:', error);
        res.status(500).json({ success: false, message: `Error fetching grapevine followers: ${error.message}` });
      })
      .finally(() => {
        session.close();
        driver.close();
      });
  } catch (error) {
    console.error('Error in handleGetGrapevineFollowers:', error);
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}

module.exports = { handleGetGrapevineFollowers };
