/**
 * Tapestry LMDB Store — key-value storage for serialized/derived representations.
 *
 * Each entry is keyed by a node's `tapestryKey` (a v4 UUID assigned once, never changed).
 * Values are JSON envelopes: { updatedAt, rebuiltFrom?, data }
 *
 * Usage:
 *   const store = require('../lib/tapestry-store');
 *
 *   // Read
 *   const entry = store.get('some-uuid-v4');
 *   // → { updatedAt: 1711245600, data: { ... } } or null
 *
 *   // Write
 *   store.put('some-uuid-v4', { elements: [...] }, { rebuiltFrom: 'class-thread-traversal' });
 *
 *   // Delete
 *   store.remove('some-uuid-v4');
 *
 *   // Stats
 *   const { count, sizeBytes } = store.stats();
 */

const { open } = require('lmdb');
const path = require('path');

const DATA_DIR = process.env.TAPESTRY_LMDB_PATH
  || path.join(process.env.HOME || '/root', '.tapestry', 'lmdb');

let _db = null;

/**
 * Get or create the singleton LMDB database.
 */
function getDb() {
  if (!_db) {
    _db = open({
      path: DATA_DIR,
      compression: true,
      // 256 MB map size — grows automatically on most platforms
      mapSize: 256 * 1024 * 1024,
    });
    console.log(`[tapestry-store] LMDB opened at ${DATA_DIR}`);
  }
  return _db;
}

/**
 * Get a tapestryJSON entry by key.
 * @param {string} key - tapestryKey (v4 UUID)
 * @returns {object|null} The stored envelope, or null if not found.
 */
function get(key) {
  const db = getDb();
  const val = db.get(key);
  return val ?? null;
}

/**
 * Store a tapestryJSON entry.
 * @param {string} key - tapestryKey (v4 UUID)
 * @param {object} data - The derived JSON to store
 * @param {object} [meta] - Optional metadata (rebuiltFrom, etc.)
 * @returns {Promise<object>} The stored envelope (resolves after write is durable).
 */
async function put(key, data, meta = {}) {
  const db = getDb();
  const envelope = {
    updatedAt: Math.floor(Date.now() / 1000),
    ...meta,
    data,
  };
  await db.put(key, envelope);
  return envelope;
}

/**
 * Remove a tapestryJSON entry.
 * @param {string} key - tapestryKey (v4 UUID)
 * @returns {Promise<void>}
 */
async function remove(key) {
  const db = getDb();
  await db.remove(key);
}

/**
 * Get store statistics.
 * @returns {{ count: number, path: string }}
 */
function stats() {
  const db = getDb();
  const stat = db.getStats();
  return {
    count: stat.entryCount ?? 0,
    path: DATA_DIR,
  };
}

/**
 * List all keys (for debugging / admin).
 * @param {number} [limit=100]
 * @returns {string[]}
 */
function listKeys(limit = 100) {
  const db = getDb();
  const keys = [];
  for (const { key } of db.getRange({ limit })) {
    keys.push(key);
  }
  return keys;
}

/**
 * Close the LMDB database (for clean shutdown).
 */
function close() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = { get, put, remove, stats, listKeys, close, getDb };
