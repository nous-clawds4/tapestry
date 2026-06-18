/**
 * Open-Ranking (ORE) provider — public, read-only HTTP surface. See ADR open-ranking/0001.
 *
 * Routes (registered off the /api/ prefix → auto-public via the auth-middleware
 * exemption; nginx forwards .well-known/* and bare paths to the app):
 *   GET  /.well-known/open-ranking.json   ORE-01 capability document
 *   POST /stats/pubkey                     ORE-02 web-of-trust stats for a pubkey
 *
 * index.js re-exports the pure builders so the test suite can drive behavior
 * hermetically (no live Neo4j) — see the testability seam in ADR 0001.
 */

const { buildCapabilityDocument, buildCapabilityResponse } = require('./capabilities');
const { buildStats, handleStatsPubkey } = require('./stats');
const { isValidHexPubkey, oreHeaders, applyTriple } = require('./shared');

// The bare paths this provider owns (used by the error handler below).
const ORE_PATHS = new Set(['/stats/pubkey', '/.well-known/open-ranking.json']);

function handleCapabilityDoc(req, res) {
  applyTriple(res, buildCapabilityResponse());
}

/**
 * ORE-00 malformed-JSON handling. express.json() raises `entity.parse.failed`
 * before the route runs; this 4-arg error middleware turns that into a clean
 * 400 + X-Reason (JSON, ACAO:*) for ORE paths, and forwards everything else.
 */
function oreJsonErrorHandler(err, req, res, next) {
  const isOre = !!(req && ORE_PATHS.has(req.path));
  if (err && err.type === 'entity.parse.failed' && isOre) {
    const headers = oreHeaders({ 'X-Reason': 'malformed JSON' });
    for (const k of Object.keys(headers)) res.set(k, headers[k]);
    return res.status(400).json({ error: 'malformed JSON' });
  }
  return next(err);
}

function registerOpenRankingRoutes(app) {
  app.get('/.well-known/open-ranking.json', handleCapabilityDoc);
  app.post('/stats/pubkey', handleStatsPubkey);
  app.use(oreJsonErrorHandler);
}

module.exports = {
  registerOpenRankingRoutes,
  handleCapabilityDoc,
  handleStatsPubkey,
  oreJsonErrorHandler,
  buildCapabilityDocument,
  buildCapabilityResponse,
  buildStats,
  isValidHexPubkey,
};
