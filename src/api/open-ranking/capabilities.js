/**
 * ORE-01 capability registry — the single source of truth for both the served
 * capability document AND per-request algorithm validation. See ADR open-ranking/0001.
 *
 * Story 1 advertises only /stats/pubkey (Story 2 adds /search/pubkeys). The first
 * element of each endpoint's array is that endpoint's default algorithm (ORE-01).
 */

const { oreHeaders } = require('./shared');

const CAPABILITIES = {
  '/stats/pubkey': [
    {
      id: 'graperank',
      name: 'GrapeRank',
      pov: false,
      description: "Global GrapeRank web-of-trust rank (influence ×100). The response also carries hops, pagerank, verified inbound counts (followers/muters/reporters) and outbound totals (follows/mutes/reporting).",
    },
    {
      id: 'graperank-personalized',
      name: 'Personalized GrapeRank',
      pov: true,
      description: 'GrapeRank from the supplied point-of-view pubkey. Requires a provisioned POV.',
    },
  ],
  '/search/pubkeys': [
    {
      id: 'graperank',
      name: 'GrapeRank',
      pov: false,
      description: "Profiles matching a free-text query, ranked by this instance's global GrapeRank.",
    },
    // graperank-personalized (pov:true) deferred to Story 3 (worksheet W13).
  ],
};

// A fresh deep copy so callers can't mutate the registry.
function buildCapabilityDocument() {
  return JSON.parse(JSON.stringify(CAPABILITIES));
}

// ORE-01: default = first element when no id is given; unknown id → null (→ 422).
function resolveAlgorithm(endpointPath, requestedId) {
  const algos = CAPABILITIES[endpointPath];
  if (!Array.isArray(algos) || algos.length === 0) return null;
  if (requestedId === undefined || requestedId === null || requestedId === '') return algos[0];
  return algos.find((a) => a.id === requestedId) || null;
}

function buildCapabilityResponse() {
  return {
    httpStatus: 200,
    headers: oreHeaders({ 'Cache-Control': 'public, max-age=300' }),
    body: buildCapabilityDocument(),
  };
}

module.exports = { CAPABILITIES, buildCapabilityDocument, resolveAlgorithm, buildCapabilityResponse };
