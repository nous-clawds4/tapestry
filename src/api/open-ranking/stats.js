/**
 * ORE-02 POST /stats/pubkey. See ADR open-ranking/0001.
 *
 * The decision logic is the pure orchestrator `buildStats(input, deps)` (returns
 * a { httpStatus, headers, body } triple); the Express wrapper `handleStatsPubkey`
 * supplies the real deps. deps = { ownerPubkey, fetchProfileScores, isPovProvisioned }.
 *
 * POV semantics (ADR): the global `grapevine` algorithm reads the owner baseline
 * (observerPubkey 'owner'); `grapevine-personalized` reads the supplied pov as
 * observer_pubkey, but only for a PROVISIONED pov — an unprovisioned pov gets a
 * 422 (never a silent house fallback). `reports` / `first_seen_at` are omitted.
 */

const { runCypher } = require('../../lib/neo4j-driver');
const { getConfigFromFile } = require('../../utils/config');
const { fetchProfileScores } = require('../export/users/queries/get-profile-scores');
const { resolveAlgorithm } = require('./capabilities');
const { ORE_STATS_TTL, isValidHexPubkey, oreHeaders, errorTriple } = require('./shared');

function getOwnerPubkey() {
  return getConfigFromFile('BRAINSTORM_OWNER_PUBKEY', '');
}

/**
 * A POV is provisioned iff it's the owner baseline or a WoT-metrics card is keyed
 * on it (the customer pipeline keys NostrUserWotMetricsCard.observer_pubkey by the
 * customer's own pubkey). One cheap indexed existence lookup.
 */
async function isPovProvisioned(pov, ownerPubkey) {
  if (pov && ownerPubkey && pov === ownerPubkey) return true;
  const rows = await runCypher(
    'MATCH (c:NostrUserWotMetricsCard {observer_pubkey: $pov}) RETURN count(c) AS n',
    { pov }
  );
  const n = rows && rows[0] ? Number(rows[0].n) : 0;
  return n > 0;
}

// Map a get-profile-scores result into the ORE-02 response body.
function mapScoresToOre(pubkey, s) {
  s = s || {};
  return {
    pubkey,
    rank: Math.round((Number(s.influence) || 0) * 100),
    follows: Number(s.followingCount) || 0,
    followers: Number(s.followerCount) || 0,
    mutes: Number(s.mutingCount) || 0,
    muters: Number(s.muterCount) || 0,
    reporters: Number(s.reporterCount) || 0,
    ttl: ORE_STATS_TTL,
    // NOTE: `reports` and `first_seen_at` intentionally omitted (ADR 0001 §field mapping).
  };
}

/**
 * Pure ORE-02 orchestrator.
 * @param {{pubkey?:string, algorithm?:string, pov?:string}} input - request body
 * @param {{ownerPubkey:string, fetchProfileScores:Function, isPovProvisioned:Function}} deps
 * @returns {Promise<{httpStatus:number, headers:Object, body:Object}>}
 */
async function buildStats(input, deps) {
  const body = input || {};
  const pubkey = body.pubkey;
  if (!isValidHexPubkey(pubkey)) {
    return errorTriple(422, 'invalid or missing pubkey (must be 64-char lowercase hex)');
  }

  const algo = resolveAlgorithm('/stats/pubkey', body.algorithm);
  if (!algo) {
    return errorTriple(422, `unsupported algorithm '${body.algorithm}' for /stats/pubkey`);
  }

  let observerPubkey = 'owner';
  if (algo.pov === true) {
    const pov = body.pov;
    if (!isValidHexPubkey(pov)) {
      return errorTriple(422, "algorithm 'grapevine-personalized' requires a valid pov pubkey");
    }
    const provisioned = await deps.isPovProvisioned(pov);
    if (!provisioned) {
      // POV invariant: do NOT serve the house/owner view under the caller's label.
      return errorTriple(422, 'pov not provisioned');
    }
    observerPubkey = (pov === deps.ownerPubkey) ? 'owner' : pov;
  }
  // For the global algorithm, any supplied pov is ignored (ORE-01).

  const scores = await deps.fetchProfileScores({ pubkey, observerPubkey });
  return { httpStatus: 200, headers: oreHeaders(), body: mapScoresToOre(pubkey, scores) };
}

// Thin Express wrapper: build the real deps, run the orchestrator, apply the triple.
async function handleStatsPubkey(req, res) {
  const { applyTriple } = require('./shared');
  const ownerPubkey = getOwnerPubkey();
  const deps = {
    ownerPubkey,
    fetchProfileScores,
    isPovProvisioned: (pov) => isPovProvisioned(pov, ownerPubkey),
  };
  try {
    const triple = await buildStats(req.body || {}, deps);
    applyTriple(res, triple);
  } catch (err) {
    console.error('Error in ORE /stats/pubkey:', err);
    applyTriple(res, errorTriple(500, 'internal error'));
  }
}

module.exports = { buildStats, mapScoresToOre, isPovProvisioned, handleStatsPubkey };
