/**
 * Set Deriver — computes tapestryJSON for Set and Superset nodes.
 *
 * Strategy: Start with the existing word JSON (from the json tag, already
 * in LMDB from offload). Then enrich:
 *   - Type-specific section (set/superset): elements, directElements, childSets, counts
 *   - graphContext (universal): concept, memberOf, validatesAgainst, derivedAt
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

  // JSON Schemas this node should validate against
  const validatesAgainst = await runCypher(`
    MATCH (ch:ConceptHeader)-[:IS_THE_CONCEPT_FOR]->(sup)-[:IS_A_SUPERSET_OF*0..10]->(s { uuid: $uuid })
    MATCH (ch)-[:IS_THE_CONCEPT_FOR]->()-[:IS_A_SUPERSET_OF*0..3]->()<-[:IS_THE_JSON_SCHEMA_FOR]-(js)
    RETURN DISTINCT js.uuid AS uuid, js.tapestryKey AS tapestryKey, js.name AS name
  `, { uuid });

  base.graphContext = {
    concept: parentConcept[0] ? {
      uuid: parentConcept[0].uuid,
      tapestryKey: parentConcept[0].tapestryKey,
      name: parentConcept[0].name,
    } : null,
    memberOf: memberOf.map(m => ({
      uuid: m.uuid,
      tapestryKey: m.tapestryKey,
      name: m.name,
    })),
    validatesAgainst: validatesAgainst.map(s => ({
      uuid: s.uuid,
      tapestryKey: s.tapestryKey,
      name: s.name,
    })),
    derivedAt: Math.floor(Date.now() / 1000),
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
