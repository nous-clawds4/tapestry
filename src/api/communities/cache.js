/*
 * Trivial in-process TTL cache for Communities API responses.
 *
 * Key shape: "<communityATag>:<viewerPubkey>" for member-roster scores,
 *            "list:<viewerPubkey>" for the per-viewer community list.
 *
 * Default TTL: 60000 ms (60 seconds) per ADR-0006. Eviction: FIFO when
 * size > 200 entries (Maps preserve insertion order).
 *
 * Per-process; cold-starts on each container boot. No cross-process
 * consistency; acceptable at v1 scale.
 */

const DEFAULT_TTL_MS = 60000
const MAX_ENTRIES = 200

const store = new Map()

function evictIfFull() {
  if (store.size <= MAX_ENTRIES) return
  // Map preserves insertion order; first key is the oldest.
  const firstKey = store.keys().next().value
  if (firstKey !== undefined) store.delete(firstKey)
}

/**
 * Return a cached value or compute it via `computeFn` and cache the result.
 *
 * @param {string} key
 * @param {() => Promise<any>} computeFn
 * @param {number} [ttlMs=60000]
 * @returns {Promise<any>}
 */
async function getOrCompute(key, computeFn, ttlMs = DEFAULT_TTL_MS) {
  const now = Date.now()
  const cached = store.get(key)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }
  const value = await computeFn()
  store.set(key, { value, expiresAt: now + ttlMs })
  evictIfFull()
  return value
}

function clearCache() {
  store.clear()
}

module.exports = { getOrCompute, clearCache, DEFAULT_TTL_MS, MAX_ENTRIES }
