/**
 * ORE-05 POST /search/pubkeys (global only). See ADR open-ranking/0002.
 *
 * Pure orchestrator `buildSearch(input, deps)` (returns a {httpStatus, headers,
 * body} triple); thin `handleSearchPubkeys` supplies the real deps.
 * deps = { ownerSuffix, searchProfiles(query, limit, ownerSuffix) -> Promise<hit[]> }.
 *
 * Ranking is the instance's GLOBAL (owner) POV: the real searchProfiles calls
 * nostr-search-api directly with sort=wot_rank_<ownerSuffix>:desc (ownerSuffix =
 * getOwnerAssistantPubkey().slice(0,8); the runtime TA helper — never hardcoded).
 * Personalized search (any provisioned pov) is deferred to Story 3 (worksheet W13).
 */

const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
const { resolveAlgorithm } = require('./capabilities');
const { ORE_SEARCH_TTL, oreHeaders, errorTriple, applyTriple } = require('./shared');

// Same backend the Meili proxy forwards to (src/api/search/profiles/meili/index.js).
const NOSTR_SEARCH_URL = process.env.NOSTR_SEARCH_URL || 'http://nostr-search-api:3069';

const QUERY_MAX = 512;     // ORE-05 client SHOULD NOT exceed; we enforce as provider max.
const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 200;     // matches the Meili proxy's internal cap.
const SEARCH_TIMEOUT_MS = 5000;  // bound the outbound call so a hung search-api can't pin a worker.

/**
 * Real search dependency: query the profiles index under the owner POV's rank
 * column. Returns the raw profile hit array (profiles only — the search-api's
 * tag/NIP-05 merging lives in the proxy, not here).
 */
async function searchProfiles(query, limit, ownerSuffix) {
  const url = new URL('/api/search', NOSTR_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('limit', String(limit));
  if (ownerSuffix) url.searchParams.set('sort', `wot_rank_${ownerSuffix}:desc`);
  const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) });
  if (!resp.ok) throw new Error(`nostr-search-api returned ${resp.status}`);
  const data = await resp.json();
  return Array.isArray(data.hits) ? data.hits : [];
}

// Map a profile hit → the ORE-05 result shape. rank floors to 0 for profiles
// unscored under the owner POV (ORE has no 404 for unknown pubkeys).
function mapHitToResult(hit, ownerSuffix) {
  hit = hit || {};
  return {
    pubkey: hit.pubkey || hit.id,
    rank: Math.round(Number(hit[`wot_rank_${ownerSuffix}`]) || 0),
  };
}

/**
 * Pure ORE-05 orchestrator.
 * @param {{query?:string, algorithm?:string, pov?:string, limit?:number}} input
 * @param {{ownerSuffix:string, searchProfiles:Function}} deps
 * @returns {Promise<{httpStatus:number, headers:Object, body:Object}>}
 */
async function buildSearch(input, deps) {
  const body = input || {};

  const query = typeof body.query === 'string' ? body.query : null;
  if (!query || query.trim() === '' || query.length > QUERY_MAX) {
    return errorTriple(422, `query must be a non-empty string of at most ${QUERY_MAX} characters`);
  }

  const algo = resolveAlgorithm('/search/pubkeys', body.algorithm);
  if (!algo) {
    return errorTriple(422, `unsupported algorithm '${body.algorithm}' for /search/pubkeys`);
  }
  // The global algorithm ignores any supplied pov (ORE-01).

  let limit = LIMIT_DEFAULT;
  if (body.limit !== undefined && body.limit !== null) {
    limit = Number(body.limit);
    if (!Number.isInteger(limit) || limit <= 0 || limit > LIMIT_MAX) {
      return errorTriple(422, `limit must be a positive integer <= ${LIMIT_MAX}`);
    }
  }

  const hits = await deps.searchProfiles(query, limit, deps.ownerSuffix);
  // Drop any malformed hit lacking both pubkey and id — every ORE-05 result MUST carry a pubkey.
  const results = (hits || [])
    .map((h) => mapHitToResult(h, deps.ownerSuffix))
    .filter((r) => r.pubkey);
  return { httpStatus: 200, headers: oreHeaders(), body: { results, ttl: ORE_SEARCH_TTL } };
}

// Thin Express wrapper: build the real deps, run the orchestrator, apply the triple.
async function handleSearchPubkeys(req, res) {
  const ownerSuffix = (getOwnerAssistantPubkey() || '').slice(0, 8) || null;
  const deps = { ownerSuffix, searchProfiles };
  try {
    applyTriple(res, await buildSearch(req.body || {}, deps));
  } catch (err) {
    console.error('Error in ORE /search/pubkeys:', err);
    applyTriple(res, errorTriple(500, 'internal error'));
  }
}

module.exports = { buildSearch, handleSearchPubkeys, searchProfiles, mapHitToResult };
