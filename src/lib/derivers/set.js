/**
 * Set Deriver — computes tapestryJSON for Set and Superset nodes.
 *
 * Structure:
 *   - word (universal): slug, name, description, wordTypes — always shared
 *   - <conceptSlug> (concept-scoped): properties specific to this concept — optionally shared
 *   - graphContext (local): identifiers, concept, memberOf, elements, childSets,
 *     parentJsonSchemas, derivedAt — never shared (stripped before packaging)
 */

const { runCypher } = require('../neo4j-driver');
const store = require('../tapestry-store');
const { resolveValue, isLmdbRef } = require('../tapestry-resolve');

/**
 * Retrieve the existing word JSON for a node.
 * Checks LMDB first (from prior offload), then falls back to inline json tag.
 */
async function getExistingWordJson(node) {
  // Check if LMDB already has data from a prior offload
  const existing = store.get(node.tapestryKey);
  if (existing?.data?.word) return existing.data;

  // Fall back to inline json tag in Neo4j
  const rows = await runCypher(`
    MATCH (n { uuid: $uuid })-[:HAS_TAG]->(tag { type: 'json' })
    RETURN tag.value AS value
    LIMIT 1
  `, { uuid: node.uuid });

  if (rows.length === 0 || !rows[0].value) return null;

  const raw = rows[0].value;

  if (isLmdbRef(raw)) {
    const resolved = resolveValue(raw);
    return resolved?.word ? resolved : null;
  }

  try {
    const parsed = JSON.parse(raw);
    return parsed?.word ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Derive tapestryJSON for a Set or Superset node.
 */
async function deriveSet(node) {
  const { uuid, tapestryKey, name, labels } = node;
  const isSuperset = labels.includes('Superset');
  const typeKey = isSuperset ? 'superset' : 'set';

  // Start with existing word JSON
  const base = await getExistingWordJson(node) || {};

  // Ensure word section exists
  if (!base.word) {
    base.word = {
      slug: node.slug || null,
      name: name || null,
      wordTypes: ['word', typeKey],
    };
  }

  // ── Graph queries ──

  // Direct elements (one hop: this node → HAS_ELEMENT → element)
  const directElements = await runCypher(`
    MATCH (s { uuid: $uuid })-[:HAS_ELEMENT]->(e)
    RETURN e.uuid AS uuid, e.tapestryKey AS tapestryKey, e.name AS name,
           e.slug AS slug
    ORDER BY e.name
  `, { uuid });

  // All elements reachable via class thread (recursive)
  const allElements = await runCypher(`
    MATCH (s { uuid: $uuid })-[:IS_A_SUPERSET_OF*0..10]->(child)-[:HAS_ELEMENT]->(e)
    RETURN DISTINCT e.uuid AS uuid, e.tapestryKey AS tapestryKey, e.name AS name,
           e.slug AS slug
    ORDER BY e.name
  `, { uuid });

  // Child Sets (direct subsets)
  const childSets = await runCypher(`
    MATCH (s { uuid: $uuid })-[:IS_A_SUPERSET_OF]->(child)
    RETURN child.uuid AS uuid, child.tapestryKey AS tapestryKey, child.name AS name,
           child.slug AS slug
    ORDER BY child.name
  `, { uuid });

  // Parent concept
  const parentConcept = await runCypher(`
    MATCH (ch:ConceptHeader)-[:IS_THE_CONCEPT_FOR]->(sup)-[:IS_A_SUPERSET_OF*0..10]->(s { uuid: $uuid })
    RETURN ch.uuid AS uuid, ch.tapestryKey AS tapestryKey, ch.name AS name,
           ch.slug AS slug
    LIMIT 1
  `, { uuid });

  // Sets this node is a member of (reverse HAS_ELEMENT)
  const memberOf = await runCypher(`
    MATCH (parent)-[:HAS_ELEMENT]->(n { uuid: $uuid })
    RETURN parent.uuid AS uuid, parent.tapestryKey AS tapestryKey, parent.name AS name
    ORDER BY parent.name
  `, { uuid });

  // Parent supersets (sets this node is a direct subset of)
  const parentSets = await runCypher(`
    MATCH (parent)-[:IS_A_SUPERSET_OF]->(s { uuid: $uuid })
    RETURN parent.uuid AS uuid, parent.tapestryKey AS tapestryKey, parent.name AS name,
           parent.slug AS slug
    ORDER BY parent.name
  `, { uuid });

  // JSON Schemas this node should validate against.
  // IMPORTANT: Only via element membership (HAS_ELEMENT path), not set membership
  // (IS_A_SUPERSET_OF path). A Set that organizes elements within a concept is a
  // structural node, not an element — it shouldn't validate against that concept's schema.
  // e.g., "free nostr relays" is a Set in the "nostr relay" concept but is NOT a nostr relay.
  const schemaRows = await runCypher(`
    MATCH (n { uuid: $uuid })<-[:HAS_ELEMENT]-(parentSet)
          <-[:IS_A_SUPERSET_OF*0..10]-(sup:Superset)
          <-[:IS_THE_CONCEPT_FOR]-(ch:ConceptHeader)
    MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(ch)
    OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    RETURN DISTINCT js.uuid AS schemaUuid, js.tapestryKey AS schemaTapestryKey,
           ch.name AS conceptName, ch.tapestryKey AS conceptTapestryKey,
           head(collect(jt.value)) AS schemaJson
  `, { uuid });

  // ── Concept-scoped section ──
  // Keyed by concept slug. Contains properties intrinsic to the concept
  // (not graph-positional). For sets, this is thin — mostly inherited from
  // existing data. The concept slug provides the natural key for selective sharing.

  const concept = parentConcept[0] || null;
  if (concept?.slug) {
    // Preserve any existing concept-scoped data
    if (!base[concept.slug]) {
      base[concept.slug] = {};
    }
    // Migrate legacy set/superset section if it has concept-intrinsic data
    const legacySection = base[typeKey] || {};
    if (legacySection.description && !base[concept.slug].description) {
      base[concept.slug].description = legacySection.description;
    }
  }

  // Clean up legacy type section (elements/childSets now live in graphContext)
  delete base.set;
  delete base.superset;

  // ── Build parentJsonSchemas with cached validation ──
  const now = Math.floor(Date.now() / 1000);
  const wordData = base.word || {};
  const parentJsonSchemas = schemaRows.map(row => {
    const entry = {
      uuid: row.schemaUuid,
      tapestryKey: row.schemaTapestryKey,
      conceptName: row.conceptName,
      conceptTapestryKey: row.conceptTapestryKey,
      lastValidated: null,
      valid: null,
      errors: [],
    };

    // Attempt validation if we have the schema JSON
    if (row.schemaJson) {
      try {
        // Resolve LMDB refs
        let rawSchema = row.schemaJson;
        if (isLmdbRef(rawSchema)) {
          const resolved = resolveValue(rawSchema);
          rawSchema = resolved || null;
        }
        if (!rawSchema) { return entry; }
        let schemaObj = typeof rawSchema === 'string'
          ? JSON.parse(rawSchema) : rawSchema;
        // Unwrap word-wrapper format
        if (schemaObj.jsonSchema && typeof schemaObj.jsonSchema === 'object') {
          schemaObj = schemaObj.jsonSchema;
        }
        const { $schema, ...schemaNoMeta } = schemaObj;

        const Ajv = require('ajv');
        const ajv = new Ajv({ allErrors: true, strict: false });
        const validate = ajv.compile(schemaNoMeta);
        const valid = validate(wordData);
        entry.lastValidated = now;
        entry.valid = valid;
        entry.errors = valid ? [] : validate.errors.map(
          e => `${e.instancePath || '/'} ${e.message}`
        );
      } catch (e) {
        entry.lastValidated = now;
        entry.valid = false;
        entry.errors = [e.message];
      }
    }

    return entry;
  });

  // ── graphContext ──
  base.graphContext = {
    identifiers: {
      tapestryKey: tapestryKey,
    },
    concept: concept ? {
      tapestryKey: concept.tapestryKey,
      name: concept.name,
    } : null,
    memberOf: memberOf.map(m => ({
      tapestryKey: m.tapestryKey,
      name: m.name,
    })),
    parentSets: parentSets.map(s => ({
      tapestryKey: s.tapestryKey,
      name: s.name,
    })),
    childSets: childSets.map(s => ({
      tapestryKey: s.tapestryKey,
      name: s.name,
      slug: s.slug,
    })),
    elements: {
      direct: directElements.map(e => ({
        tapestryKey: e.tapestryKey,
        name: e.name,
        slug: e.slug,
      })),
      all: allElements.map(e => ({
        tapestryKey: e.tapestryKey,
        name: e.name,
        slug: e.slug,
      })),
      counts: {
        direct: directElements.length,
        all: allElements.length,
      },
    },
    parentJsonSchemas,
    derivedAt: now,
  };

  // Remove old x-tapestry.derived if present (from prior version)
  if (base['x-tapestry']?.derived) {
    delete base['x-tapestry'].derived;
    if (Object.keys(base['x-tapestry']).length === 0) {
      delete base['x-tapestry'];
    }
  }

  return base;
}

module.exports = deriveSet;
