/**
 * Firmware Loader
 *
 * Reads from firmware/active/ to provide canonical definitions for:
 * - Relationship type aliases (canonical slug → Neo4j relationship name)
 * - Concept definitions (naming forms, descriptions)
 * - Element definitions
 *
 * The server reads from firmware at runtime. Updating firmware = swapping
 * the active symlink. See docs/FIRMWARE.md in tapestry-cli.
 */

const fs = require('fs');
const path = require('path');

// ── Locate firmware directory ────────────────────────────────

const FIRMWARE_DIR = path.resolve(__dirname, '../../../firmware/active');

let _manifest = null;
let _relationshipTypes = null;
let _concepts = null;
let _aliasToCanonical = null;
let _canonicalToAlias = null;

function firmwareDir() {
  return FIRMWARE_DIR;
}

function getManifest() {
  if (!_manifest) {
    const manifestPath = path.join(FIRMWARE_DIR, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Firmware manifest not found at ${manifestPath}. Is firmware/active symlinked?`);
    }
    _manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }
  return _manifest;
}

// ── Relationship Types ───────────────────────────────────────

function loadRelationshipTypes() {
  if (_relationshipTypes) return _relationshipTypes;

  const manifest = getManifest();
  _relationshipTypes = {};
  _aliasToCanonical = {};
  _canonicalToAlias = {};

  for (const entry of manifest.relationshipTypes) {
    const filePath = path.join(FIRMWARE_DIR, entry.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`[firmware] Missing relationship type file: ${entry.file}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const rt = data.relationshipType;
    _relationshipTypes[rt.slug] = data;
    _canonicalToAlias[rt.slug] = rt.alias;
    _aliasToCanonical[rt.alias] = rt.slug;
  }

  return _relationshipTypes;
}

/**
 * Get the Neo4j alias for a canonical relationship type slug.
 * e.g., 'CLASS_THREAD_INITIATION' → 'IS_THE_CONCEPT_FOR'
 */
function relAlias(canonicalSlug) {
  loadRelationshipTypes();
  const alias = _canonicalToAlias[canonicalSlug];
  if (!alias) {
    // Fallback: maybe they passed an alias directly (backward compat)
    if (_aliasToCanonical[canonicalSlug]) return canonicalSlug;
    throw new Error(`[firmware] Unknown relationship type: ${canonicalSlug}`);
  }
  return alias;
}

/**
 * Get the canonical slug for a Neo4j alias.
 * e.g., 'IS_THE_CONCEPT_FOR' → 'CLASS_THREAD_INITIATION'
 */
function relCanonical(alias) {
  loadRelationshipTypes();
  return _aliasToCanonical[alias] || null;
}

/**
 * Get all relationship type data.
 * Returns: { CANONICAL_SLUG: { word: {...}, relationshipType: {...} }, ... }
 */
function allRelationshipTypes() {
  return loadRelationshipTypes();
}

// ── Concepts ─────────────────────────────────────────────────

function loadConcepts() {
  if (_concepts) return _concepts;

  const manifest = getManifest();
  _concepts = {};

  for (const entry of manifest.concepts) {
    // Support both directory format (dir + conceptHeader) and legacy flat format (file)
    const filePath = entry.dir
      ? path.join(FIRMWARE_DIR, entry.dir, entry.conceptHeader)
      : path.join(FIRMWARE_DIR, entry.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`[firmware] Missing concept file: ${filePath}`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    _concepts[entry.slug] = data;
  }

  return _concepts;
}

/**
 * Get concept definition by slug.
 * Returns the full JSON (word + conceptHeader sections).
 */
function getConcept(slug) {
  loadConcepts();
  return _concepts[slug] || null;
}

/**
 * Get all concept definitions.
 */
function allConcepts() {
  return loadConcepts();
}

/**
 * Get the firmware JSON Schema template for a concept by slug.
 * Returns the full word wrapper (word + jsonSchema sections), or null if not available.
 * The coreMemberOf UUID will be "<uuid>" — caller must inject the real UUID.
 */
function getConceptSchema(slug) {
  const manifest = getManifest();
  const entry = manifest.concepts.find(c => c.slug === slug);
  if (!entry || !entry.dir || !entry.jsonSchema) return null;

  const schemaPath = path.join(FIRMWARE_DIR, entry.dir, entry.jsonSchema);
  if (!fs.existsSync(schemaPath)) return null;

  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

// ── Elements ─────────────────────────────────────────────────

/**
 * Load elements for a given category (e.g., 'json-data-types', 'node-types').
 */
function loadElements(category) {
  const manifest = getManifest();
  const entries = (manifest.elements || {})[category];
  if (!entries) return [];

  const results = [];
  for (const entry of entries) {
    const filePath = path.join(FIRMWARE_DIR, entry.file);
    if (!fs.existsSync(filePath)) {
      console.warn(`[firmware] Missing element file: ${entry.file}`);
      continue;
    }
    results.push(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  }
  return results;
}

// ── TA Pubkey ────────────────────────────────────────────────
// The Tapestry Assistant pubkey is needed to compute deterministic concept UUIDs.
// Read from environment, brainstorm.conf, or secure storage.

let _taPubkey = null;

function getTAPubkey() {
  if (_taPubkey) return _taPubkey;

  // 1. Environment variable
  if (process.env.TA_PUBKEY) {
    _taPubkey = process.env.TA_PUBKEY;
    return _taPubkey;
  }

  // 2. Read BRAINSTORM_RELAY_PUBKEY or derive from BRAINSTORM_RELAY_PRIVKEY in brainstorm.conf
  try {
    const confPath = '/etc/brainstorm.conf';
    if (fs.existsSync(confPath)) {
      const conf = fs.readFileSync(confPath, 'utf8');
      // Try pubkey directly first
      const pubMatch = conf.match(/BRAINSTORM_RELAY_PUBKEY=["']?([0-9a-f]{64})["']?/);
      if (pubMatch) {
        _taPubkey = pubMatch[1];
        return _taPubkey;
      }
      // Fall back to deriving from privkey
      const privMatch = conf.match(/BRAINSTORM_RELAY_PRIVKEY=["']?([0-9a-f]{64})["']?/);
      if (privMatch) {
        const nt = require('nostr-tools/pure');
        const privBytes = Uint8Array.from(Buffer.from(privMatch[1], 'hex'));
        _taPubkey = Buffer.from(nt.getPublicKey(privBytes)).toString('hex');
        return _taPubkey;
      }
    }
  } catch (e) {
    // Fall through
  }

  // 3. Try secure storage
  try {
    const SecureKeyStorage = require('../../lib/secure-key-storage');
    const storage = new SecureKeyStorage({ storagePath: '/var/lib/brainstorm/secure-keys' });
    // Note: getRelayKeys is async, but we need sync here. Use the cached file directly.
    const keysPath = path.join('/var/lib/brainstorm/secure-keys', 'tapestry-assistant.json');
    if (fs.existsSync(keysPath)) {
      const keys = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
      if (keys.pubkey) {
        _taPubkey = keys.pubkey;
        return _taPubkey;
      }
    }
  } catch (e) {
    // Fall through
  }

  console.warn('[firmware] Could not determine TA pubkey — conceptUuid() will return null');
  return null;
}

// ── Concept UUIDs (computed from TA pubkey + slug) ───────────
// With deterministic d-tags, concept UUIDs are: 39998:<pubkey>:<slug>
// No need for defaults.json concept UUID mapping.

/**
 * Get the a-tag UUID for a firmware concept by slug.
 * e.g., conceptUuid('superset') → '39998:11f23fe4...:superset'
 */
function conceptUuid(slug) {
  const pubkey = getTAPubkey();
  if (!pubkey) return null;

  // Verify slug is a known firmware concept
  const manifest = getManifest();
  const entry = manifest.concepts.find(c => c.slug === slug);
  if (!entry) return null;

  return `39998:${pubkey}:${slug}`;
}

/**
 * Reverse lookup: a-tag UUID → firmware concept slug.
 * e.g., '39998:11f23fe4...:superset' → 'superset'
 */
function conceptSlugFromUuid(uuid) {
  if (!uuid) return null;

  // With deterministic d-tags, the slug is the d-tag portion of the UUID
  // Format: 39998:<pubkey>:<slug>
  const parts = uuid.split(':');
  if (parts.length === 3 && (parts[0] === '39998' || parts[0] === '9998')) {
    const candidateSlug = parts[2];
    // Verify it's a known firmware concept
    const manifest = getManifest();
    if (manifest.concepts.find(c => c.slug === candidateSlug)) {
      return candidateSlug;
    }
  }

  return null;
}

// ── Cache invalidation ───────────────────────────────────────

/**
 * Clear all cached firmware data. Call after swapping the active symlink.
 */
function clearCache() {
  _manifest = null;
  _relationshipTypes = null;
  _concepts = null;
  _aliasToCanonical = null;
  _canonicalToAlias = null;
  _taPubkey = null;
}

module.exports = {
  firmwareDir,
  getManifest,
  getTAPubkey,
  relAlias,
  relCanonical,
  allRelationshipTypes,
  getConcept,
  allConcepts,
  getConceptSchema,
  loadElements,
  conceptUuid,
  conceptSlugFromUuid,
  clearCache,
};
