/**
 * Per-read POV-resolution status (ADR 0002, pov-selectable-tag-surfaces Story 2).
 *
 * The tag reads already resolve a POV (delegate → suffix, minRank) via resolvePov.
 * This module derives a machine-readable HONESTY signal — `povResolution` — that
 * says what filter actually ran (filtered / unfiltered / not-computed), whether an
 * own-POV request silently fell back to house, and whether the resolved suffix's
 * `wot_rank_<suffix>` scores actually exist on this instance.
 *
 * The "provisioned" check reads Meili's index-stats `fieldDistribution` (a map
 * field→doc-count) in O(1) for all suffixes at once, cached briefly. Meili-down
 * yields `scoresExist: null` (unknown) — never a false not-computed claim.
 *
 * Purely additive: no filtering outcome changes; this only DISCLOSES.
 */

const { resolvePov } = require('./pov');

const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';

const CACHE_TTL_OK_MS = 60000;
const CACHE_TTL_FAIL_MS = 10000;

// Single module-level cache entry for the Meili field distribution.
let distCache = null; // { at: number, value: object|null }

function __resetPovStatusCacheForTests() {
  distCache = null;
}

/**
 * Pure. Derive the povResolution status object.
 * Mode precedence: unfiltered (no suffix / non-finite minRank) → not-computed
 * (scoresExist === false) → filtered (scoresExist true OR null/unknown).
 */
function computePovStatus({ requestedPov, delegateSource, povSuffix, minRank, scoresExist }) {
  const suffix = povSuffix || null;
  const rank = Number.isFinite(minRank) ? minRank : null;

  let mode;
  if (!suffix || rank === null) {
    mode = 'unfiltered';
  } else if (scoresExist === false) {
    mode = 'not-computed';
  } else {
    mode = 'filtered';
  }

  const fellBackToHouse = requestedPov === 'user' && delegateSource !== 'user-prefs';

  return {
    mode,
    fellBackToHouse,
    requested: requestedPov,
    delegateSource,
    povSuffix: suffix,
    minRank: rank,
    scoresExist,
  };
}

/** Pure. `null` distribution (probe unavailable) → null; else count>0. */
function scoresExistFor(povSuffix, fieldDistribution) {
  return fieldDistribution ? (fieldDistribution['wot_rank_' + povSuffix] > 0) : null;
}

/**
 * One GET to Meili index-stats. Returns the fieldDistribution map, or null on any
 * failure (non-OK / throw) — never rejects. Cached: 60s on success, 10s on failure.
 */
async function getWotFieldDistribution({ fetchImpl = fetch } = {}) {
  const now = Date.now();
  if (distCache) {
    const ttl = distCache.value ? CACHE_TTL_OK_MS : CACHE_TTL_FAIL_MS;
    if (now - distCache.at < ttl) return distCache.value;
  }
  let value = null;
  try {
    const resp = await fetchImpl(`${MEILI_URL}/indexes/${MEILI_INDEX}/stats`);
    if (resp && resp.ok) {
      const data = await resp.json();
      value = data.fieldDistribution || null;
    }
  } catch { /* down / error → null */ }
  distCache = { at: Date.now(), value };
  return value;
}

/**
 * Async composer every POV-aware read handler calls instead of bare resolvePov.
 * Skips the Meili probe entirely when not filtering (scoresExist: null) — dev
 * boxes add zero requests. `deps` may carry readUserPrefsImpl/loadHousePrefsImpl
 * (threaded to resolvePov) and fetchImpl (threaded to the probe).
 */
async function resolvePovWithStatus({ wotPov, userPubkey }, deps = {}) {
  const resolved = resolvePov({ wotPov, userPubkey }, deps);
  const filtering = !!resolved.povSuffix && Number.isFinite(resolved.minRank);
  let scoresExist = null;
  if (filtering) {
    scoresExist = scoresExistFor(resolved.povSuffix, await getWotFieldDistribution(deps));
  }
  const povResolution = computePovStatus({
    requestedPov: resolved.requestedPov,
    delegateSource: resolved.delegateSource,
    povSuffix: resolved.povSuffix,
    minRank: resolved.minRank,
    scoresExist,
  });
  return { ...resolved, povResolution };
}

module.exports = {
  computePovStatus,
  scoresExistFor,
  getWotFieldDistribution,
  resolvePovWithStatus,
  __resetPovStatusCacheForTests,
};
