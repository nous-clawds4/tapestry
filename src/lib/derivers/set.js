/**
 * Set Deriver — computes tapestryJSON for Set and Superset nodes.
 *
 * Structure (per glossary/graph-context.md):
 *   - word (universal): slug, name, description, wordTypes, coreMemberOf
 *   - set (concept-scoped): slug, name — present because this is a Set
 *   - superset (concept-scoped): slug, name — present if this is a Superset
 *   - graphContext (local, never shared):
 *       identifiers { tapestryKey, uuid }
 *       parentSets { direct[], indirect[] }
 *       childSets { direct[], indirect[] }
 *       elements { direct[], indirect[] }
 *       elementOf { direct[], indirect[] }
 *       parentJsonSchemas[]
 *       derivedAt
 *
 * Node references in graphContext use { tapestryKey, slug } where slug
 * is resolved from the referenced node's tapestryJSON (concept-scoped slug),
 * NOT from Neo4j node properties.
 */

const { runCypher } = require('../neo4j-driver');
const store = require('../tapestry-store');
const { resolveValue, isLmdbRef } = require('../tapestry-resolve');

async function getExistingWordJson(node) {
  const existing = store.get(node.tapestryKey);
  if (existing?.data?.word) return existing.data;

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
 * Resolve the concept-scoped slug for a node from its tapestryJSON in LMDB.
 * Looks through all top-level keys (excluding word, graphContext) for a .slug field.
 * Falls back to word.slug if no concept-scoped slug found.
 */
function resolveSlug(tapestryKey) {
  if (!tapestryKey) return null;
  const entry = store.get(tapestryKey);
  const data = entry?.data;
  if (!data) return null;

  // Look for concept-scoped slug (first non-word, non-graphContext key with a slug)
  for (const key of Object.keys(data)) {
    if (key === 'word' || key === 'graphContext') continue;
    if (data[key]?.slug) return data[key].slug;
  }
  // Fall back to word.slug
  return data.word?.slug || null;
}

/** Map a query row to a nodeRef { tapestryKey, slug }. */
function nodeRef(row) {
  return {
    tapestryKey: row.tapestryKey,
    slug: resolveSlug(row.tapestryKey),
  };
}

function deriveSlug(name) {
  if (!name) return null;
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function deriveSet(node) {
  const { uuid, tapestryKey, name, labels } = node;
  const isSuperset = labels.includes('Superset');

  const base = await getExistingWordJson(node) || {};

  // ── word section ──
  const wordTypes = ['word'];
  if (isSuperset) wordTypes.push('superset');
  wordTypes.push('set');

  if (!base.word) base.word = {};
  base.word.slug = base.word.slug || node.slug || deriveSlug(name);
  base.word.name = base.word.name || name || null;
  base.word.wordTypes = wordTypes;

  // ── Concept-scoped blocks ──
  if (!base.set) base.set = {};
  base.set.slug = base.set.slug || deriveSlug(name);
  base.set.name = base.set.name || name || null;

  if (isSuperset) {
    if (!base.superset) base.superset = {};
    base.superset.slug = base.superset.slug || deriveSlug(name);
    base.superset.name = base.superset.name || name || null;
  }

  // ── Graph queries (return tapestryKey only — slugs resolved from LMDB) ──

  const directElements = await runCypher(`
    MATCH (s { uuid: $uuid })-[:HAS_ELEMENT]->(e)
    RETURN e.tapestryKey AS tapestryKey
  `, { uuid });

  const indirectElements = await runCypher(`
    MATCH (s { uuid: $uuid })-[:IS_A_SUPERSET_OF*1..10]->(child)-[:HAS_ELEMENT]->(e)
    WHERE NOT (s)-[:HAS_ELEMENT]->(e)
    RETURN DISTINCT e.tapestryKey AS tapestryKey
  `, { uuid });

  const directChildSets = await runCypher(`
    MATCH (s { uuid: $uuid })-[:IS_A_SUPERSET_OF]->(child)
    RETURN child.tapestryKey AS tapestryKey
  `, { uuid });

  const indirectChildSets = await runCypher(`
    MATCH (s { uuid: $uuid })-[:IS_A_SUPERSET_OF*2..10]->(child)
    WHERE NOT (s)-[:IS_A_SUPERSET_OF]->(child)
    RETURN DISTINCT child.tapestryKey AS tapestryKey
  `, { uuid });

  const directParentSets = await runCypher(`
    MATCH (parent)-[:IS_A_SUPERSET_OF]->(s { uuid: $uuid })
    RETURN parent.tapestryKey AS tapestryKey
  `, { uuid });

  const indirectParentSets = await runCypher(`
    MATCH (parent)-[:IS_A_SUPERSET_OF*2..10]->(s { uuid: $uuid })
    WHERE NOT (parent)-[:IS_A_SUPERSET_OF]->(s { uuid: $uuid })
    RETURN DISTINCT parent.tapestryKey AS tapestryKey
  `, { uuid });

  const directElementOf = await runCypher(`
    MATCH (parent)-[:HAS_ELEMENT]->(n { uuid: $uuid })
    RETURN parent.tapestryKey AS tapestryKey
  `, { uuid });

  const indirectElementOf = await runCypher(`
    MATCH (parent)-[:HAS_ELEMENT]->(n { uuid: $uuid })
    MATCH (ancestor)-[:IS_A_SUPERSET_OF*1..10]->(parent)
    WHERE NOT (ancestor)-[:HAS_ELEMENT]->(n { uuid: $uuid })
    RETURN DISTINCT ancestor.tapestryKey AS tapestryKey
  `, { uuid });

  // JSON Schemas — via element membership (explicit HAS_ELEMENT + implicit z-tag)
  const schemaRows = await runCypher(`
    MATCH (n { uuid: $uuid })
    OPTIONAL MATCH (n)<-[:HAS_ELEMENT]-(parentSet)
          <-[:IS_A_SUPERSET_OF*0..10]-(sup:Superset)
          <-[:IS_THE_CONCEPT_FOR]-(h1:ConceptHeader)
    OPTIONAL MATCH (n)-[:HAS_TAG]->(zt:NostrEventTag {type: 'z'})
    OPTIONAL MATCH (h2:ConceptHeader {uuid: zt.value})
    WITH collect(DISTINCT h1) + collect(DISTINCT h2) AS headers
    UNWIND headers AS ch
    WITH DISTINCT ch
    WHERE ch IS NOT NULL
    MATCH (js:JSONSchema)-[:IS_THE_JSON_SCHEMA_FOR]->(ch)
    OPTIONAL MATCH (js)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
    RETURN DISTINCT js.uuid AS schemaUuid, js.tapestryKey AS schemaTapestryKey,
           ch.name AS conceptName, ch.tapestryKey AS conceptTapestryKey,
           head(collect(jt.value)) AS schemaJson
  `, { uuid });

  // ── Build graphContext first (before validation) ──
  const now = Math.floor(Date.now() / 1000);

  base.graphContext = {
    identifiers: { tapestryKey, uuid },
    parentSets: {
      direct: directParentSets.map(nodeRef),
      indirect: indirectParentSets.map(nodeRef),
    },
    childSets: {
      direct: directChildSets.map(nodeRef),
      indirect: indirectChildSets.map(nodeRef),
    },
    elements: {
      direct: directElements.map(nodeRef),
      indirect: indirectElements.map(nodeRef),
    },
    elementOf: {
      direct: directElementOf.map(nodeRef),
      indirect: indirectElementOf.map(nodeRef),
    },
    parentJsonSchemas: [],
    derivedAt: now,
  };

  // ── Validate against schemas ──
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

    if (row.schemaJson) {
      try {
        let rawSchema = row.schemaJson;
        if (isLmdbRef(rawSchema)) {
          const resolved = resolveValue(rawSchema);
          rawSchema = resolved || null;
        }
        if (!rawSchema) return entry;
        let schemaObj = typeof rawSchema === 'string'
          ? JSON.parse(rawSchema) : rawSchema;
        if (schemaObj.jsonSchema && typeof schemaObj.jsonSchema === 'object') {
          schemaObj = schemaObj.jsonSchema;
        }
        const { $schema, ...schemaNoMeta } = schemaObj;

        const Ajv = require('ajv');
        const ajv = new Ajv({ allErrors: true, strict: false });
        const validate = ajv.compile(schemaNoMeta);
        const valid = validate(base);
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

  base.graphContext.parentJsonSchemas = parentJsonSchemas;

  // Remove old artifacts
  if (base['x-tapestry']?.derived) {
    delete base['x-tapestry'].derived;
    if (Object.keys(base['x-tapestry']).length === 0) {
      delete base['x-tapestry'];
    }
  }

  return base;
}

module.exports = deriveSet;
