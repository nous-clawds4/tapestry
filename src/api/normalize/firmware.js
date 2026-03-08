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

// ── Instance UUIDs (from defaults.json) ──────────────────────
// These are the live a-tag UUIDs for BIOS concepts in the current graph.
// Firmware defines the structure; defaults.json records the instance data.
// Eventually this will be generated from the graph or stored in firmware.

let _instanceUuids = null;

function loadInstanceUuids() {
  if (_instanceUuids) return _instanceUuids;

  const defaultsPath = path.resolve(__dirname, '../../concept-graph/parameters/defaults.json');
  if (!fs.existsSync(defaultsPath)) {
    console.warn('[firmware] defaults.json not found — conceptUuid() will return null');
    _instanceUuids = {};
    return _instanceUuids;
  }
  const defaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));
  const cuuids = defaults.conceptUUIDs || {};
  const ruuids = defaults.relationshipTypeUUIDs || {};

  // Map firmware slugs → instance UUIDs
  // The keys in defaults.json use camelCase; we map from firmware kebab-case slugs
  _instanceUuids = {
    concepts: {
      'relationship':          cuuids.relationship,
      'relationship-type':     cuuids.relationshipType,
      'node-type':             cuuids.nodeType,
      'set':                   cuuids.set,
      'superset':              cuuids.superset,
      'json-schema':           cuuids.JSONSchema,
      'property':              cuuids.property,
      'primary-property':      cuuids.primaryProperty,
      'list':                  cuuids.list,
      'json-data-type':        cuuids.jsonDataType,
      'graph-type':            cuuids.graphType,
      'graph':                 cuuids.graph,
    },
    relationshipTypes: ruuids,
  };

  return _instanceUuids;
}

/**
 * Get the live a-tag UUID for a firmware concept by slug.
 * e.g., conceptUuid('superset') → '39998:2d1fe...:21cbf5be-...'
 */
function conceptUuid(slug) {
  const inst = loadInstanceUuids();
  return (inst.concepts || {})[slug] || null;
}

/**
 * Reverse lookup: a-tag UUID → firmware concept slug.
 * e.g., '39998:2d1fe...:21cbf5be-...' → 'superset'
 */
function conceptSlugFromUuid(uuid) {
  const inst = loadInstanceUuids();
  for (const [slug, u] of Object.entries(inst.concepts || {})) {
    if (u === uuid) return slug;
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
  _instanceUuids = null;
}

module.exports = {
  firmwareDir,
  getManifest,
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
