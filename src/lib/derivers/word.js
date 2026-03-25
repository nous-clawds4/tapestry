/**
 * Generic Word Deriver — computes tapestryJSON for any word node.
 *
 * Produces:
 *   - word (universal): slug, name, wordTypes
 *   - graphContext: identifiers, elementOf, parentJsonSchemas, derivedAt
 *
 * This is the base deriver for nodes that don't have a more specific one
 * (Set, Superset, etc.). It does NOT include set-specific fields like
 * elements, childSets, or parentSets.
 */

const { runCypher } = require('../neo4j-driver');
const store = require('../tapestry-store');
const { resolveValue, isLmdbRef } = require('../tapestry-resolve');

/**
 * Resolve the concept-scoped slug for a node from its tapestryJSON in LMDB.
 */
function resolveSlug(tapestryKey) {
  if (!tapestryKey) return null;
  const entry = store.get(tapestryKey);
  const data = entry?.data;
  if (!data) return null;

  for (const key of Object.keys(data)) {
    if (key === 'word' || key === 'graphContext') continue;
    if (data[key]?.slug) return data[key].slug;
  }
  return data.word?.slug || null;
}

function nodeRef(row) {
  return { tapestryKey: row.tapestryKey, slug: resolveSlug(row.tapestryKey) };
}

function deriveSlug(name) {
  if (!name) return null;
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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
 * Derive tapestryJSON for a generic word node.
 */
async function deriveWord(node) {
  const { uuid, tapestryKey, name, labels } = node;

  const base = await getExistingWordJson(node) || {};

  // ── word section ──
  if (!base.word) base.word = {};
  base.word.slug = base.word.slug || node.slug || deriveSlug(name);
  base.word.name = base.word.name || name || null;
  if (!base.word.wordTypes) {
    base.word.wordTypes = ['word'];
  }

  // ── elementOf ──
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

  // ── JSON Schemas ──
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

  // ── Build graphContext first ──
  const now = Math.floor(Date.now() / 1000);

  base.graphContext = {
    identifiers: {
      tapestryKey,
      uuid,
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

  return base;
}

module.exports = deriveWord;
