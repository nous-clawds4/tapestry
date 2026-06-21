/**
 * Story verified-muters #1 / ADR 0001 — verified muters membership (count + list).
 *
 *   GET /api/get-grapevine-muters?observee=<pk>[&observer=owner]
 *
 * Lists the VERIFIED users who muted <observee> (kind-10000 mute lists, projected
 * as inbound :MUTES edges), with the owner's GrapeRank metrics read straight from
 * each muter's NostrUser node: influence (→ rank), hops, and the three verified
 * counts. v1 is OWNER/HOUSE POV ONLY; a non-owner `observer` is rejected 400
 * (customer cards deferred, exactly like followersWithMetrics.js / ADR 0030).
 *
 * The inbound mirror of followersWithMetrics.js, NOT reportersWithMetrics.js:
 * a :MUTES edge has no per-edge sub-type, so the row shape is the Verified
 * Followers list's six columns — {pubkey, influence, hops, verifiedFollowerCount,
 * verifiedMuterCount, verifiedReporterCount} — with NO reporter-specific fields.
 *
 * This is the LITERAL INVERSE of the verified-muter COUNT query
 * (src/algos/follows-mutes-reports/calculateVerifiedMuterCounts.sh): same
 * `(muter)-[:MUTES]->(mutee)` edge, same `muter.influence >
 * VERIFIED_MUTERS_INFLUENCE_CUTOFF` filter — returning the muters instead of
 * count(). Reusing that exact cutoff is what makes count = list length hold (AC3).
 * The cutoff is passed as a bound `$cutoff` parameter (the safer reporters form).
 *
 * Mirrors the per-query Neo4j deadline + 504 pattern of followersWithMetrics.js
 * (story #34 / ADR 0030) and reportersWithMetrics.js (verified-reporters #2 / ADR
 * 0002); those endpoints are intentionally left untouched (ADR 0001 Option A — a
 * new endpoint).
 */

const neo4j = require('neo4j-driver');
const { getConfigFromFile } = require('../../../utils/config');
const { nip19 } = require('nostr-tools');

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
 * GET /api/get-grapevine-muters
 */
function handleGetGrapevineMuters(req, res) {
  try {
    const observee = req.query.observee;
    const observer = req.query.observer; // v1: owner only (see below)

    // --- Validate observee: 64-char hex, cross-checked via nip19 (cf. followersWithMetrics.js).
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

    // --- v1 is OWNER/HOUSE POV only. Customer observers are deferred (ADR 0001): their
    // metrics live on NostrUserWotMetricsCard, which this endpoint does not yet read.
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

    // The verified cutoff MUST be the muters cutoff — the same config var the count
    // algo uses (calculateVerifiedMuterCounts.sh). This is the count = list length
    // invariant (AC3): same edge + same cutoff ⇒ list length == verifiedMuterCount.
    const cutoff = parseFloat(getConfigFromFile('VERIFIED_MUTERS_INFLUENCE_CUTOFF', 0.05));

    const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
    const session = driver.session();

    // Muters = INBOUND MUTES edges, filtered to VERIFIED (muter influence > cutoff).
    // Owner POV: the metrics ARE the muter NostrUser node's own GrapeRank properties
    // (no NostrUserWotMetricsCard join in v1). The whole verified set is returned; the
    // page sorts/paginates client-side (Story 2), like followers. A :MUTES edge has no
    // per-edge sub-type, so there is no rel binding — the row shape is the Followers six.
    const cypherQuery = `
      MATCH (muter:NostrUser)-[:MUTES]->(observee:NostrUser {pubkey: $observee})
      WHERE muter.influence > $cutoff
      RETURN muter.pubkey AS pubkey,
             muter.influence AS influence,
             muter.hops AS hops,
             muter.verifiedFollowerCount AS verifiedFollowerCount,
             muter.verifiedMuterCount AS verifiedMuterCount,
             muter.verifiedReporterCount AS verifiedReporterCount
    `;

    const queryStartMs = Date.now();
    session.run(cypherQuery, { observee, cutoff }, { timeout: queryTimeoutMs })
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
          console.error('Neo4j query timeout fetching grapevine muters:', { observee, elapsedMs, limitMs: queryTimeoutMs, code: error.code });
          return res.status(504).json({
            success: false,
            message: `Neo4j query timeout after ${elapsedMs}ms (limit ${queryTimeoutMs}ms) fetching muters for ${observee}.`
          });
        }
        console.error('Error fetching grapevine muters:', error);
        res.status(500).json({ success: false, message: `Error fetching grapevine muters: ${error.message}` });
      })
      .finally(() => {
        session.close();
        driver.close();
      });
  } catch (error) {
    console.error('Error in handleGetGrapevineMuters:', error);
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}

module.exports = { handleGetGrapevineMuters };
