/**
 * Pure (React-free) helpers for composing a tapestry's as-authored graph model.
 * See ADR tapestries/0002. Kept side-effect-free so the compose/normalize/infer
 * logic is exercised deterministically through the exploration page's DOM.
 */

// Canonical relationship-type table: semantic slug ↔ Neo4j edge alias.
export const CANONICAL_RELS = {
  CLASS_THREAD_PROPAGATION: 'IS_A_SUPERSET_OF',
  CLASS_THREAD_TERMINATION: 'HAS_ELEMENT',
  PROPERTY_ENUMERATION: 'ENUMERATES',
};

/**
 * Resolve a relationshipType slug to its canonical Neo4j alias.
 * Prefer an `alias` declared on the graph's own relationshipTypes; then the
 * canonical table; else the slug is already alias-form (imported concept-graphs
 * store the alias directly as the slug, e.g. "IS_THE_CONCEPT_FOR").
 */
export function toAlias(slug, relTypes = []) {
  if (!slug) return slug;
  const declared = relTypes.find((t) => t.slug === slug);
  if (declared?.alias) return declared.alias;
  return CANONICAL_RELS[slug] || slug;
}

/**
 * Infer a node's kind from its handle/slug (the authored graph carries no explicit
 * type). uuid `39998:` → concept header; a superset slug/uuid → superset; a node
 * with no uuid (a synthetic property like `dog.breed`) → property; else other.
 */
export function inferNodeType(node = {}) {
  const { uuid, slug } = node;
  if (uuid && uuid.startsWith('39998:')) return 'conceptHeader';
  if ((slug && slug.startsWith('superset-for-')) || (uuid && uuid.endsWith('-superset'))) return 'superset';
  if (!uuid) return 'property';
  return 'other';
}

/**
 * Compose the element's graph block with any resolved import graph blocks into one
 * deduped model. Nodes dedup by slug (keeping the first non-empty name/uuid);
 * relationships dedup by `from|alias|to` and are normalized to their canonical alias.
 */
export function composeGraph(elementGraph, importedGraphs = []) {
  const graphs = [elementGraph, ...importedGraphs].filter(Boolean);

  const relTypes = [];
  const relTypeSeen = new Set();
  for (const g of graphs) {
    for (const rt of (g.relationshipTypes || [])) {
      if (rt.slug && !relTypeSeen.has(rt.slug)) { relTypeSeen.add(rt.slug); relTypes.push(rt); }
    }
  }

  const nodesBySlug = new Map();
  for (const g of graphs) {
    for (const n of (g.nodes || [])) {
      if (!n.slug) continue;
      const existing = nodesBySlug.get(n.slug);
      if (!existing) {
        nodesBySlug.set(n.slug, { slug: n.slug, uuid: n.uuid || null, name: n.name || null });
      } else {
        if (!existing.name && n.name) existing.name = n.name;
        if (!existing.uuid && n.uuid) existing.uuid = n.uuid;
      }
    }
  }

  const relsSeen = new Set();
  const relationships = [];
  for (const g of graphs) {
    for (const r of (g.relationships || [])) {
      const from = r.nodeFrom?.slug;
      const to = r.nodeTo?.slug;
      const alias = toAlias(r.relationshipType?.slug, relTypes);
      if (!from || !to || !alias) continue;
      const key = `${from}|${alias}|${to}`;
      if (relsSeen.has(key)) continue;
      relsSeen.add(key);
      relationships.push({ from, to, alias, relTypeSlug: r.relationshipType?.slug });
    }
  }

  return { nodes: [...nodesBySlug.values()], relationships, relationshipTypes: relTypes };
}

/** Bucket a composed graph's relationships by canonical alias for the integration tables. */
export function groupRelationships(composed) {
  const buckets = { enumerations: [], elements: [], subsets: [], spine: [] };
  for (const r of (composed?.relationships || [])) {
    if (r.alias === 'ENUMERATES') buckets.enumerations.push(r);
    else if (r.alias === 'HAS_ELEMENT') buckets.elements.push(r);
    else if (r.alias === 'IS_A_SUPERSET_OF') buckets.subsets.push(r);
    else if (r.alias === 'IS_THE_CONCEPT_FOR') buckets.spine.push(r);
  }
  return buckets;
}

/** Display name for a node slug within a composed graph (falls back to the slug). */
export function nodeName(composed, slug) {
  const n = (composed?.nodes || []).find((x) => x.slug === slug);
  return n?.name || slug;
}
