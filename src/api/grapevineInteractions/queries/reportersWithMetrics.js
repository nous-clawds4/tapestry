/**
 * Story verified-reporters #2 / ADR 0002 — verified reporters membership.
 *
 *   GET /api/get-grapevine-reporters?observee=<pk>[&observer=owner]
 *
 * Lists the VERIFIED users who NIP-56-reported <observee>, with the owner's
 * GrapeRank metrics read straight from each reporter's NostrUser node: influence
 * (→ rank), hops, and the three verified counts — plus each REPORTS edge's own
 * report_type + timestamp (story #4 / ADR 0004). v1 is OWNER/HOUSE POV ONLY.
 * Customer observers are deferred: their scores live on NostrUserWotMetricsCard
 * (see ADR 0026 §Decision and userdata.js:40-85), so a non-owner `observer` is 400.
 *
 * This is the LITERAL INVERSE of the verified-reporter COUNT query
 * (src/algos/follows-mutes-reports/calculateVerifiedReporterCounts.sh): same
 * `(reporter)-[:REPORTS]->(reported)` edge, same `reporter.influence >
 * VERIFIED_REPORTERS_INFLUENCE_CUTOFF` filter — returning the reporters instead of
 * count(). Reusing that exact cutoff is what makes count = list length hold (AC3).
 *
 * Mirrors the per-query Neo4j deadline + 504 pattern of followsWithMetrics.js
 * (story #29 / ADR 0026) and followersWithMetrics.js (story #34 / ADR 0030); those
 * endpoints are intentionally left untouched (ADR 0002 Option A — a new endpoint).
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
 * GET /api/get-grapevine-reporters
 */
function handleGetGrapevineReporters(req, res) {
  try {
    const observee = req.query.observee;
    const observer = req.query.observer; // v1: owner only (see below)

    // --- Validate observee: 64-char hex, cross-checked via nip19 (cf. followsWithMetrics.js:48-60).
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

    // --- v1 is OWNER/HOUSE POV only. Customer observers are deferred (ADR 0002): their
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

    // The verified cutoff MUST be the reporters cutoff — the same config var the count
    // algo uses (calculateVerifiedReporterCounts.sh). This is the count = list length
    // invariant (AC3): same edge + same cutoff ⇒ list length == verifiedReporterCount.
    const cutoff = parseFloat(getConfigFromFile('VERIFIED_REPORTERS_INFLUENCE_CUTOFF', 0.05));

    const driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
    const session = driver.session();

    // Owner/House POV: the metrics ARE each reporter's own NostrUser node GrapeRank
    // properties. Only VERIFIED reporters (influence above the cutoff) are returned —
    // the inverse of the count query. No NostrUserWotMetricsCard join in v1.
    // Bind the REPORTS edge (rel) so its per-report properties — report_type and
    // timestamp — come back alongside the reporter's node metrics (story #4 / ADR 0004).
    // One row per REPORTS edge (no de-duplication / aggregation here), so a reporter who
    // filed more than one report type appears once per report — report-centric, by design.
    const cypherQuery = `
      MATCH (observee:NostrUser {pubkey: $observee})<-[rel:REPORTS]-(reporter:NostrUser)
      WHERE reporter.influence > $cutoff
      RETURN reporter.pubkey AS pubkey,
             reporter.influence AS influence,
             reporter.hops AS hops,
             reporter.verifiedFollowerCount AS verifiedFollowerCount,
             reporter.verifiedMuterCount AS verifiedMuterCount,
             reporter.verifiedReporterCount AS verifiedReporterCount,
             rel.report_type AS reportType,
             rel.timestamp AS timestamp
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
            verifiedReporterCount: toInt(r.get('verifiedReporterCount')),
            reportType: r.get('reportType') ?? null,
            timestamp: toInt(r.get('timestamp'))
          }))
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
          console.error('Neo4j query timeout fetching grapevine reporters:', { observee, elapsedMs, limitMs: queryTimeoutMs, code: error.code });
          return res.status(504).json({
            success: false,
            message: `Neo4j query timeout after ${elapsedMs}ms (limit ${queryTimeoutMs}ms) fetching reporters for ${observee}.`
          });
        }
        console.error('Error fetching grapevine reporters:', error);
        res.status(500).json({ success: false, message: `Error fetching grapevine reporters: ${error.message}` });
      })
      .finally(() => {
        session.close();
        driver.close();
      });
  } catch (error) {
    console.error('Error in handleGetGrapevineReporters:', error);
    res.status(500).json({ success: false, message: `Server error: ${error.message}` });
  }
}

module.exports = { handleGetGrapevineReporters };
