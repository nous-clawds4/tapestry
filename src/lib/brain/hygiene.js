/**
 * Second Brain — pure hygiene core (second-brain #2, ADR 0002 decision 2;
 * decomposition taxonomy second-brain #3, ADR 0003 d9).
 *
 * The defect taxonomy for the goal structures, as pure classifiers: rows in,
 * problem records out. CommonJS; requires ONLY the goals core — the shared
 * classification surface (the check and the Goals view can never disagree on
 * what counts as a goal). No fetch, no Neo4j, no strfry.
 *
 * A problem record is { concept, subject, kind, detail } with kind one of:
 *   wrong-direction-membership     — a ConceptHeader with an OUTGOING
 *                                    HAS_ELEMENT edge (headers are never
 *                                    containers; this is the queue's falsified
 *                                    suspicion, encoded as a detector)
 *   membership-declaration-mismatch — an element's membership edge and its
 *                                    z-tag declaration disagree (the
 *                                    reinstall-return signature)
 *   property-record-drift          — the primary-property record disagrees
 *                                    with the schema on key set, required
 *                                    list, or per-key type (cosmetic extras
 *                                    are never defects), or the record itself
 *                                    is unreadable
 *   schema-unreadable              — the SCHEMA side of that comparison is
 *                                    missing/unreadable (split from drift by
 *                                    ADR 0003 d9 / OPEN.md row 85c: it is the
 *                                    schema's defect, not the record's)
 *   machinery-incomplete           — expected header wiring missing or
 *                                    duplicated
 *   unreadable-record              — a goal-concept element the shared
 *                                    classification rejects
 *   dangling-parent-reference      — a goal's parent slug resolves to no goal
 *                                    (ADR 0003 d9)
 *   decomposition-cycle            — a parent chain revisits a goal;
 *                                    self-parenting is the length-1 case
 *                                    (ADR 0003 d9)
 *   duplicate-slug                 — two or more goal records share a slug;
 *                                    parent references and the detail route
 *                                    cannot distinguish them (ADR 0003 d9 —
 *                                    the out-of-contract collision detector)
 *
 * Incoming memberships are SOUND: the goal superset is an element of the
 * set/superset concepts, and every concept header is an element of the
 * concept-header concept (universal — all 44 headers, verified live
 * 2026-07-23). Direction is the discriminator; the /neighbors endpoint erases
 * it, which is how the false defect inventory happened (story Background).
 */

'use strict';

const { parseGoalRow, resolveDecomposition } = require('./goals');

// The six per-concept machinery relationships every sound runtime concept
// carries into its header, plus exactly one outgoing IS_THE_CONCEPT_FOR and
// the universal concept-header class membership.
const MACHINERY_IN = [
  'IS_THE_JSON_SCHEMA_FOR',
  'IS_THE_PRIMARY_PROPERTY_FOR',
  'IS_THE_PROPERTIES_SET_FOR',
  'IS_THE_CONCEPT_GRAPH_FOR',
  'IS_THE_CORE_GRAPH_FOR',
  'IS_THE_PROPERTY_TREE_GRAPH_FOR',
];

function problem(concept, subject, kind, detail) {
  return { concept, subject, kind, detail };
}

function isSupersetLabeled(labels) {
  return Array.isArray(labels) && labels.includes('Superset');
}

/**
 * Classify a header's full directed edge inventory.
 * @param {{concept: string, headerUuid: string, edges: Array<{direction: 'out'|'in', rel: string, otherUuid: string, otherLabels: string[]}>}} input
 * @returns {Array} problem records
 */
function classifyHeaderEdges({ concept, headerUuid, edges }) {
  const problems = [];
  const list = Array.isArray(edges) ? edges : [];

  // Headers are never containers: any outgoing HAS_ELEMENT is wrong-direction.
  for (const e of list) {
    if (e && e.direction === 'out' && e.rel === 'HAS_ELEMENT') {
      problems.push(problem(concept, headerUuid, 'wrong-direction-membership',
        `header ${headerUuid} has an outgoing HAS_ELEMENT edge to ${e.otherUuid} — ` +
        'headers are never containers; membership edges point superset → member.'));
    }
  }

  // Exactly one outgoing IS_THE_CONCEPT_FOR to a Superset.
  const conceptFor = list.filter((e) => e && e.direction === 'out' && e.rel === 'IS_THE_CONCEPT_FOR' && isSupersetLabeled(e.otherLabels));
  if (conceptFor.length !== 1) {
    problems.push(problem(concept, headerUuid, 'machinery-incomplete',
      `header ${headerUuid} must have exactly one outgoing IS_THE_CONCEPT_FOR to its superset; found ${conceptFor.length}.`));
  }

  // Each machinery relationship exactly once, incoming.
  for (const rel of MACHINERY_IN) {
    const n = list.filter((e) => e && e.direction === 'in' && e.rel === rel).length;
    if (n !== 1) {
      problems.push(problem(concept, headerUuid, 'machinery-incomplete',
        `header ${headerUuid} must have exactly one incoming ${rel} machinery relationship; found ${n}.`));
    }
  }

  // The universal concept-header class membership (incoming HAS_ELEMENT from a Superset).
  // DELIBERATE (ADR 0003 d9 / OPEN.md row 85d): an incoming HAS_ELEMENT from a
  // NON-Superset node is neither counted as the class membership nor flagged —
  // no known structure produces such an edge; if a future class-thread change
  // can, give it its own kind rather than widening this filter silently.
  const membership = list.filter((e) => e && e.direction === 'in' && e.rel === 'HAS_ELEMENT' && isSupersetLabeled(e.otherLabels));
  if (membership.length < 1) {
    problems.push(problem(concept, headerUuid, 'machinery-incomplete',
      `header ${headerUuid} is missing its concept-header class membership (incoming HAS_ELEMENT from a superset) — universal on every sound concept.`));
  }

  return problems;
}

/**
 * Classify the concept's element rows for edge/declaration consistency and
 * (goal concept) record readability.
 * @param {{concept: string, elements: Array<{uuid, name, createdAt, json, hasEdge, hasZTag}>, parseRecord: Function|null|undefined}} input
 *   parseRecord: undefined → the shared goals classifier (the default consumer
 *   is the goal concept); null → skip record classification (sibling concepts
 *   whose records are not goals).
 * @returns {Array} problem records
 */
function classifyElementConsistency({ concept, elements, parseRecord }) {
  const parser = parseRecord === undefined ? parseGoalRow : parseRecord;
  const problems = [];
  for (const el of (Array.isArray(elements) ? elements : [])) {
    if (!el || !el.uuid) continue;
    if (el.hasEdge && !el.hasZTag) {
      problems.push(problem(concept, el.uuid, 'membership-declaration-mismatch',
        `element ${el.uuid} has a membership edge but no z-tag declaration naming the concept header — ` +
        'a reinstall would not re-derive this edge.'));
    } else if (!el.hasEdge && el.hasZTag) {
      problems.push(problem(concept, el.uuid, 'membership-declaration-mismatch',
        `element ${el.uuid} declares membership via z-tag but its membership edge is missing — ` +
        'the edge was removed and a reinstall would re-derive it.'));
    }
    if (parser && parser({ uuid: el.uuid, name: el.name, createdAt: el.createdAt, json: el.json }) == null) {
      problems.push(problem(concept, el.uuid, 'unreadable-record',
        `element ${el.uuid} ("${el.name}") is not a readable goal record — the shared classification rejects its json.`));
    }
  }
  return problems;
}

/**
 * Compare the concept's schema object against its primary-property record on
 * the dimensions that matter: key set, required list, per-key type. Cosmetic
 * per-property extras (title, description) are never defects — the record's
 * convention strips definitions to {type}.
 * @param {{concept: string, schemaObject: object, propertySection: object|null}} input
 * @returns {Array} problem records (at most one)
 */
function comparePropertyRecord({ concept, schemaObject, propertySection }) {
  const subject = `${concept}:primary-property`;
  const schemaProps = (schemaObject && typeof schemaObject === 'object' && schemaObject.properties) || null;
  if (!schemaProps) {
    // The SCHEMA side is unreadable — its own kind (ADR 0003 d9, row 85c);
    // the unreadable-RECORD path below stays property-record-drift.
    return [problem(concept, subject, 'schema-unreadable',
      `the schema for ${concept} is missing or unreadable — cannot verify the property record against it.`)];
  }
  const section = (propertySection && typeof propertySection === 'object' && !Array.isArray(propertySection)) ? propertySection : null;
  const sectionProps = (section && section.properties && typeof section.properties === 'object') ? section.properties : null;
  if (!sectionProps) {
    return [problem(concept, subject, 'property-record-drift',
      `the primary-property record for ${concept} is missing or unreadable — it should mirror the schema's properties.`)];
  }

  const schemaKeys = Object.keys(schemaProps);
  const sectionKeys = Object.keys(sectionProps);
  const missing = schemaKeys.filter((k) => !(k in sectionProps));
  const extra = sectionKeys.filter((k) => !(k in schemaProps));
  const typeMismatches = schemaKeys.filter((k) =>
    (k in sectionProps) && ((schemaProps[k] && schemaProps[k].type) !== (sectionProps[k] && sectionProps[k].type)));
  const schemaRequired = [...(schemaObject.required || [])].sort();
  const sectionRequired = [...((section.required) || [])].sort();
  const requiredAgrees = JSON.stringify(schemaRequired) === JSON.stringify(sectionRequired);

  if (missing.length === 0 && extra.length === 0 && typeMismatches.length === 0 && requiredAgrees) {
    return [];
  }
  const parts = [];
  if (missing.length) parts.push(`missing from the property record: ${missing.join(', ')}`);
  if (extra.length) parts.push(`present in the property record but not the schema: ${extra.join(', ')}`);
  if (typeMismatches.length) parts.push(`type disagrees on: ${typeMismatches.join(', ')}`);
  if (!requiredAgrees) parts.push(`required list disagrees (schema [${schemaRequired.join(', ')}] vs record [${sectionRequired.join(', ')}])`);
  return [problem(concept, subject, 'property-record-drift',
    `the primary-property record for ${concept} lags its schema — ${parts.join('; ')}.`)];
}

/**
 * Classify the goal concept's decomposition structure (ADR 0003 d9): the
 * write path refuses these at the contract boundary, so anything found here
 * arrived out-of-contract (raw create-element / save-element-json writes).
 * Records are parsed goal records (the shared classification); resolution
 * rides resolveDecomposition — the one tree truth the API and view use.
 * @param {{concept: string, records: Array}} input
 * @returns {Array} problem records, deterministically ordered
 */
function classifyDecomposition({ concept, records }) {
  const list = Array.isArray(records) ? records : [];
  const problems = [];

  // duplicate-slug: parent refs and the detail route cannot distinguish them.
  const groups = new Map();
  for (const r of list) {
    if (!r || typeof r.slug !== 'string' || r.slug === '') continue;
    if (!groups.has(r.slug)) groups.set(r.slug, []);
    groups.get(r.slug).push(r);
  }
  for (const [slug, sharers] of groups) {
    if (sharers.length > 1) {
      const uuids = sharers.map((r) => r.uuid).sort();
      problems.push(problem(concept, slug, 'duplicate-slug',
        `${sharers.length} goals share the slug '${slug}' (${uuids.join(', ')}) — parent references and the ` +
        'detail route cannot distinguish them; reads resolve to the oldest record.'));
    }
  }

  // dangling-parent-reference: the stated parent slug matches no goal at all.
  for (const r of list) {
    if (r && typeof r.parent === 'string' && r.parent.trim() !== '' && !groups.has(r.parent.trim())) {
      problems.push(problem(concept, r.uuid, 'dangling-parent-reference',
        `goal ${r.uuid} ("${r.name}") references parent slug '${r.parent.trim()}', which resolves to no goal — ` +
        'it renders at the root until the reference is repaired.'));
    }
  }

  // decomposition-cycle: one problem per cycle; subject is the cycle's stable
  // identity (the smallest member uuid), detail names every member.
  const resolved = resolveDecomposition(list);
  const cycles = new Map();
  for (const r of resolved) {
    if (r.cycleOf) {
      if (!cycles.has(r.cycleOf)) cycles.set(r.cycleOf, []);
      cycles.get(r.cycleOf).push(r);
    }
  }
  for (const [cycleId, members] of cycles) {
    const names = members.map((m) => m.slug || m.uuid).sort();
    problems.push(problem(concept, cycleId, 'decomposition-cycle',
      `goals form a parent cycle (${names.join(' ⇄ ')}) — each member renders at the root until the cycle ` +
      'is repaired; self-parenting is the length-1 case.'));
  }

  // Deterministic regardless of input order (the assembleReport convention).
  problems.sort((a, b) => {
    const ka = `${a.kind} ${a.subject || ''}`;
    const kb = `${b.kind} ${b.subject || ''}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return problems;
}

/**
 * Assemble the per-concept results into the report contract
 * { sound, problems, checked }. Deterministic: problems are ordered by
 * (concept, kind, subject) regardless of input order, so two checks on an
 * unchanged graph report identically (AC 1). An absent concept is
 * nothing-to-check — it never contributes problems and never breaks soundness
 * (AC 6; PRD §5.9: an empty brain is a state, not an error).
 * @param {Array<{concept: string, present: boolean, elements?: number, problems?: Array}>} conceptResults
 * @returns {{sound: boolean, problems: Array, checked: Array}}
 */
function assembleReport(conceptResults) {
  const results = Array.isArray(conceptResults) ? conceptResults : [];
  const problems = [];
  const checked = [];
  for (const r of results) {
    if (!r || !r.concept) continue;
    const present = r.present !== false;
    checked.push({
      concept: r.concept,
      present,
      elements: typeof r.elements === 'number' ? r.elements : 0,
      problems: present ? ((r.problems && r.problems.length) || 0) : 0,
    });
    if (present && Array.isArray(r.problems)) problems.push(...r.problems);
  }
  problems.sort((a, b) => {
    const ka = `${a.concept} ${a.kind} ${a.subject || ''}`;
    const kb = `${b.concept} ${b.kind} ${b.subject || ''}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  return { sound: problems.length === 0, problems, checked };
}

module.exports = { classifyHeaderEdges, classifyElementConsistency, comparePropertyRecord, classifyDecomposition, assembleReport, MACHINERY_IN };
