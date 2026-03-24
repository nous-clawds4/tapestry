/**
 * Tapestry Value Resolver — transparently resolves LMDB-backed values.
 *
 * Any string property in Neo4j can hold either:
 *   1. An inline value (the actual data, as today)
 *   2. An LMDB pointer: "lmdb:<tapestryKey>"
 *
 * The resolver detects the prefix and fetches from LMDB when needed.
 *
 * Usage:
 *   const { resolveValue, isLmdbRef, toLmdbRef } = require('../lib/tapestry-resolve');
 *
 *   // Resolve a value (inline or LMDB pointer)
 *   const json = resolveValue(tag.value);
 *   // → the actual data, regardless of storage location
 *
 *   // Check if a value is an LMDB reference
 *   if (isLmdbRef(tag.value)) { ... }
 *
 *   // Create an LMDB reference string
 *   const ref = toLmdbRef('a3f7c2d1-...');
 *   // → "lmdb:a3f7c2d1-..."
 */

const store = require('./tapestry-store');

const LMDB_PREFIX = 'lmdb:';

/**
 * Check if a value is an LMDB reference.
 * @param {*} value
 * @returns {boolean}
 */
function isLmdbRef(value) {
  return typeof value === 'string' && value.startsWith(LMDB_PREFIX);
}

/**
 * Extract the tapestryKey from an LMDB reference string.
 * @param {string} ref - e.g. "lmdb:a3f7c2d1-..."
 * @returns {string} The key portion
 */
function extractKey(ref) {
  return ref.slice(LMDB_PREFIX.length);
}

/**
 * Create an LMDB reference string from a tapestryKey.
 * @param {string} key - tapestryKey (v4 UUID)
 * @returns {string} e.g. "lmdb:a3f7c2d1-..."
 */
function toLmdbRef(key) {
  return LMDB_PREFIX + key;
}

/**
 * Resolve a value: if it's an LMDB pointer, fetch from the store.
 * Otherwise return the value as-is.
 *
 * For LMDB-backed values, returns the `data` field of the stored envelope,
 * or null if the key is not found in LMDB.
 *
 * @param {*} value - The raw value from Neo4j (or anywhere)
 * @returns {*} The resolved value
 */
function resolveValue(value) {
  if (!isLmdbRef(value)) return value;
  const key = extractKey(value);
  const entry = store.get(key);
  return entry?.data ?? null;
}

/**
 * Resolve a value and return the full LMDB envelope (including metadata).
 * Returns null for non-LMDB values or missing entries.
 *
 * @param {*} value
 * @returns {{ updatedAt: number, rebuiltFrom?: string, data: * } | null}
 */
function resolveEnvelope(value) {
  if (!isLmdbRef(value)) return null;
  const key = extractKey(value);
  return store.get(key);
}

/**
 * Batch-resolve an array of values. Useful for resolving multiple
 * tag values in a single pass.
 *
 * @param {Array<*>} values
 * @returns {Array<*>} Resolved values
 */
function resolveValues(values) {
  return values.map(resolveValue);
}

/**
 * Deep-resolve an object: walk all string properties and resolve
 * any LMDB references found. Handles nested objects and arrays.
 * Returns a new object (does not mutate the input).
 *
 * @param {*} obj
 * @returns {*} A copy with all LMDB refs resolved
 */
function resolveDeep(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return resolveValue(obj);
  if (Array.isArray(obj)) return obj.map(resolveDeep);
  if (typeof obj === 'object') {
    const resolved = {};
    for (const [k, v] of Object.entries(obj)) {
      resolved[k] = resolveDeep(v);
    }
    return resolved;
  }
  return obj;
}

module.exports = {
  LMDB_PREFIX,
  isLmdbRef,
  extractKey,
  toLmdbRef,
  resolveValue,
  resolveEnvelope,
  resolveValues,
  resolveDeep,
};
