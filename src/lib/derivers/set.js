/**
 * Set Deriver — computes tapestryJSON for Set and Superset nodes.
 *
 * Strategy: Start with the existing word JSON (from the json tag, already
 * in LMDB from offload). Then enrich:
 *   - Type-specific section (set/superset): elements, directElements, childSets, counts
 *   - graphContext (universal): identifiers, concept, memberOf, parentJsonSchemas, derivedAt
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

  // ── Type-specific queries ──

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

  // Child Sets
  const childSets = await runCypher(`
    MATCH (s { uuid: $uuid })-[:IS_A_SUPERSET_OF]->(child)
    RETURN child.uuid AS uuid, child.tapestryKey AS tapestryKey, child.name AS name,
           child.slug AS slug
    ORDER BY child.name
  `, { uuid });

  // Build/enrich the type-specific section
  const typeSection = base[typeKey] || {};
  typeSection.slug = typeSection.slug || node.slug || null;
  typeSection.name = typeSection.name || name || null;
  typeSection.elements = allElements.map(e => ({
    uuid: e.uuid,
    tapestryKey: e.tapestryKey,
    name: e.name,
    slug: e.slug,
  }));
  typeSection.directElements = directElements.map(e => ({
    uuid: e.uuid,
    tapestryKey: e.tapestryKey,
    name: e.name,
    slug: e.slug,
  }));
  typeSection.childSets = childSets.map(s => ({
    uuid: s.uuid,
    tapestryKey: s.tapestryKey,
    name: s.name,
    slug: s.slug,
  }));
  typeSection.counts = {
    directElements: directElements.length,
    allElements: allElements.length,
    childSets: childSets.length,
  };

  base[typeKey] = typeSection;

  // ── graphContext (universal) ──

  // Parent concept
  const parentConcept = await runCypher(`
    MATCH (ch:ConceptHeader)-[:IS_THE_CONCEPT_FOR]->(sup)-[:IS_A_SUPERSET_OF*0..10]->(s { uuid: $uuid })
    RETURN ch.uuid AS uuid, ch.tapestryKey AS tapestryKey, ch.name AS name
    LIMIT 1
  `, { uuid });

  // Sets this node is a member of (reverse HAS_ELEMENT)
  const memberOf = await runCypher(`
    MATCH (parent)-[:HAS_ELEMENT]->(n { uuid: $uuid })
    RETURN parent.uuid AS uuid, parent.tapestryKey AS tapestryKey, parent.name AS name
    ORDER BY parent.name
  `, { uuid });

  // JSON Schemas this node should validate against (with schema JSON for validation)
  const schemaRows = await runCypher(`
    MATCH (ch:ConceptHeader)-[:IS_THE_CONCEPT_FOR]->(sup)-[:IS_A_SUPERSET_OF*0..10]->(s { uuid: $uuid })
    MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(ch)
    OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    RETURN DISTINCT js.tapestryKey AS schemaTapestryKey,
           ch.name AS conceptName, ch.tapestryKey AS conceptTapestryKey,
           head(collect(jt.value)) AS schemaJson
  `, { uuid });

  // Build parentJsonSchemas with cached validation
  const now = Math.floor(Date.now() / 1000);
  const wordData = base.word || {};
  const parentJsonSchemas = schemaRows.map(row => {
    const entry = {
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

        // Lazy-load Ajv (synchronous require since we're in Node)
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

  base.graphContext = {
    identifiers: {
      tapestryKey: tapestryKey,
    },
    concept: parentConcept[0] ? {
      tapestryKey: parentConcept[0].tapestryKey,
      name: parentConcept[0].name,
    } : null,
    memberOf: memberOf.map(m => ({
      tapestryKey: m.tapestryKey,
      name: m.name,
    })),
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
