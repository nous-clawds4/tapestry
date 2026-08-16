/**
 * ORE-01 capability registry — the single source of truth for both the served
 * capability document AND per-request algorithm validation. See ADR open-ranking/0001.
 *
 * Story 1 advertises only /stats/pubkey (Story 2 adds /search/pubkeys; ore-parity #1
 * adds the mandatory /rank/pubkeys, ADR ore-parity/0001). The first element of each
 * endpoint's array is that endpoint's default algorithm (ORE-01).
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
  '/rank/pubkeys': [
    {
      id: 'graperank',
      name: 'GrapeRank',
      pov: false,
      description: "Batch GrapeRank web-of-trust ranking of the supplied pubkeys (influence ×100) from this instance's global point of view. Unknown pubkeys rank 0.",
    },
    // Personalized batch rank stays out until the W12 auth work (ADR open-ranking/0005).
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

/**
 * Pre-prod gate (ADR open-ranking/0005, worksheet W12). The personalized-stats
 * algorithm (`graperank-personalized`, pov:true on /stats/pubkey) is an
 * UNAUTHENTICATED provisioning-enumeration oracle: a `200` vs `422` reply reveals
 * whether a supplied pov is a provisioned customer, and a provisioned pov even
 * returns that customer's personalized web-of-trust view of the target. Until a
 * self-only / ORE-A auth check guards the pov:true path, the algorithm is OMITTED
 * from the served surface — mirroring how personalized *search* is deferred above.
 *
 * `personalizedStats` (default OFF) re-includes it. DO NOT enable it on a public
 * deployment without the auth work (W12) — enabling re-opens the oracle.
 */
function isPersonalizedStatsEnabled() {
  try {
    // Lazy require so the pure builders (and the hermetic test suite that loads
    // this module directly) never touch the settings layer.
    const { getSettings } = require('../../config/settings');
    return (getSettings().openRanking || {}).personalizedStats === true;
  } catch {
    return false; // safe default: gated
  }
}

// The algorithms VISIBLE for an endpoint under the given gate options. Everything
// downstream (the served doc AND per-request resolution) derives from this, so the
// capability document and validation can never drift out of sync (the ORE-01 rule).
function visibleAlgorithms(endpointPath, opts = {}) {
  const algos = CAPABILITIES[endpointPath];
  if (!Array.isArray(algos)) return [];
  if (endpointPath === '/stats/pubkey' && !opts.personalizedStats) {
    return algos.filter((a) => a.id !== 'graperank-personalized');
  }
  return algos;
}

// A fresh deep copy so callers can't mutate the registry.
function buildCapabilityDocument(opts = {}) {
  const doc = {};
  for (const endpointPath of Object.keys(CAPABILITIES)) {
    doc[endpointPath] = JSON.parse(JSON.stringify(visibleAlgorithms(endpointPath, opts)));
  }
  return doc;
}

// ORE-01: default = first element when no id is given; unknown/gated id → null (→ 422).
// A gated personalized request is therefore indistinguishable from any unsupported
// algorithm — the enumeration oracle never runs (no pov check, no score fetch).
function resolveAlgorithm(endpointPath, requestedId, opts = {}) {
  const algos = visibleAlgorithms(endpointPath, opts);
  if (algos.length === 0) return null;
  if (requestedId === undefined || requestedId === null || requestedId === '') return algos[0];
  return algos.find((a) => a.id === requestedId) || null;
}

function buildCapabilityResponse(opts = {}) {
  return {
    httpStatus: 200,
    headers: oreHeaders({ 'Cache-Control': 'public, max-age=300' }),
    body: buildCapabilityDocument(opts),
  };
}

module.exports = {
  CAPABILITIES,
  buildCapabilityDocument,
  resolveAlgorithm,
  buildCapabilityResponse,
  visibleAlgorithms,
  isPersonalizedStatsEnabled,
};
