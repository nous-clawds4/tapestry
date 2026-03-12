/**
 * Deterministic d-tag generation for Tapestry events.
 *
 * Convention:
 *   List Headers:  slug(name)
 *   List Items:    slug(name)-hash8(parentUuid)
 *   Sets:          slug(name)-hash8(parentUuid)
 *   Core Nodes:    slug(concept)-suffix  (unchanged, handled in create-concept)
 *   Properties:    slug(prop)-hash8(parentUuid)  (unchanged, handled in generate-property-tree)
 *
 * Versioning nonce: append ~N  (e.g. nostr-relay~1)
 *   Default: no nonce. Use only when multiple versions are needed.
 *
 * Discovery: dTag === base || /^base~\d+$/.test(dTag)
 */

const crypto = require('crypto');

/**
 * Canonical slug derivation. Must match the client-side version exactly.
 * Strips diacritics, lowercases, replaces non-alphanumeric with hyphens.
 */
function slug(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')  // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')                        // non-alphanumeric → hyphen
    .replace(/^-|-$/g, '');                              // trim leading/trailing
}

/**
 * 8-character hash of a string (first 8 hex chars of SHA-256).
 */
function hash8(str) {
  return crypto.createHash('sha256').update(str).digest('hex').slice(0, 8);
}

/**
 * Deterministic d-tag for a standalone event (e.g. List Header).
 *   dTag = slug(name)[~nonce]
 */
function headerDTag(name, nonce) {
  const base = slug(name);
  return nonce != null ? `${base}~${nonce}` : base;
}

/**
 * Deterministic d-tag for a child event (e.g. List Item, Set, Property).
 *   dTag = slug(name)-hash8(parentUuid)[~nonce]
 */
function childDTag(name, parentUuid, nonce) {
  const base = `${slug(name)}-${hash8(parentUuid)}`;
  return nonce != null ? `${base}~${nonce}` : base;
}

/**
 * Generate a random d-tag (fallback for special circumstances).
 * 8 random hex characters.
 */
function randomDTag() {
  return crypto.randomBytes(4).toString('hex');
}

/**
 * Parse a d-tag to extract base and nonce.
 * Returns { base, nonce } where nonce is null if not present.
 */
function parseDTag(dTag) {
  const match = dTag.match(/^(.+)~(\d+)$/);
  if (match) return { base: match[1], nonce: parseInt(match[2], 10) };
  return { base: dTag, nonce: null };
}

/**
 * Find all versions of a d-tag base in a list of d-tags.
 */
function findVersions(baseDTag, allDTags) {
  return allDTags.filter(dt => dt === baseDTag || new RegExp(`^${escapeRegex(baseDTag)}~\\d+$`).test(dt));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  slug,
  hash8,
  headerDTag,
  childDTag,
  randomDTag,
  parseDTag,
  findVersions,
};
