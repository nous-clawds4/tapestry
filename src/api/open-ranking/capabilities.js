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
      id: 'grapevine',
      name: 'Grapevine',
      pov: false,
      description: "Global web-of-trust rank from this instance's grapevine (GrapeRank influence ×100).",
    },
    {
      id: 'grapevine-personalized',
      name: 'Personalized Grapevine',
      pov: true,
      description: 'Web-of-trust rank from the supplied point-of-view pubkey. Requires a provisioned POV.',
    },
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
