/**
 * Second Brain — read surface (second-brain #1, ADR 0001 decision 3).
 *
 * GET /api/brain/goals — the Goals view's read: the owner's goals from the
 * adopted tapestry-owner-goal concept, explicit class-thread members united
 * with implicit z-tag members (the ConceptElements pattern), classified and
 * sorted by the pure core. Strfry-free and mutation-free by construction —
 * the import surface below is the whole of it (S-audited).
 *
 * Gate: in-handler `isOwner(req) || req.localTrusted` (the wipe.js template).
 * Route-level requireOwner would 401 the loopback conversational agent —
 * capture happens in conversation, and the agent reads back through this
 * endpoint (ADR Context). Host-side :7778 is the remote caller class
 * (security-auth-exposure/0001) and gets 403 here.
 *
 * An empty or absent concept answers {success:true, goals:[]} — an empty
 * brain is a state, not an error (PRD §5.9; the cold-start view is the
 * onboarding). Reads never provision or mutate anything.
 */

'use strict';

const { runCypher } = require('../../lib/neo4j-driver');
const { isOwner } = require('../../middleware/auth');
const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');
const { parseGoalRow, deriveStanding, resolveCaptureDate, sortGoals, resolveDecomposition } = require('../../lib/brain/goals');
const { classifyHeaderEdges, classifyElementConsistency, comparePropertyRecord, classifyDecomposition, assembleReport } = require('../../lib/brain/hygiene');
const { parseResourceRow, deriveFreshness, freshnessDays, groupResourcesByGoal } = require('../../lib/brain/resources');

const GOAL_CONCEPT_SLUG = 'tapestry-owner-goal';

// External Resource pointers (second-brain #4, ADR 0004 d1) — the concept is
// runtime-created (never firmware-seeded); the read is tolerant of its absence
// (no header ⇒ no rows ⇒ an empty pointer set, never an error).
const RESOURCE_CONCEPT_SLUG = 'tapestry-external-resource';

// The hygiene check's confirmed scope (story #2, planning gate): the two
// work-item concepts. parseRecord: null skips goal-record classification on
// the sibling — its elements are projects, not goals.
const HYGIENE_CONCEPTS = [
  { slug: GOAL_CONCEPT_SLUG, parseRecord: parseGoalRow },
  { slug: 'project-for-the-engineering-team', parseRecord: null },
];

// Explicit members: the directed downward walk from the concept's superset.
// Direction is the stray filter — incoming HAS_ELEMENT edges (the goal
// superset is itself an element of the set/superset concepts) never match.
const EXPLICIT_CYPHER = `
  MATCH (h:NostrEvent {uuid: $headerUuid})-[:IS_THE_CONCEPT_FOR]->(s:Superset)
  MATCH (s)-[:IS_A_SUPERSET_OF*0..10]->(ss)-[:HAS_ELEMENT]->(e:NostrEvent)
  WHERE e.kind = 39999
  OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
  WITH DISTINCT e, head(collect(j.value)) AS json
  RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json`;

// Implicit members: elements z-tagged to the concept header whose HAS_ELEMENT
// edge may be missing (reinstall re-derives such wiring from the same z tag).
const IMPLICIT_CYPHER = `
  MATCH (e:NostrEvent)-[:HAS_TAG]->(:NostrEventTag {type: 'z', value: $headerUuid})
  WHERE e.kind = 39999
  OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
  WITH DISTINCT e, head(collect(j.value)) AS json
  RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json`;

// The concept's goal rows (explicit walk ∪ implicit z-tag members), parsed and
// decomposition-resolved through the shared core — the one read the list and
// the per-goal detail share (ADR 0003 d4/d5).
async function readResolvedGoals(taPubkey) {
  const headerUuid = `39998:${taPubkey}:${GOAL_CONCEPT_SLUG}`;
  const [explicitRows, implicitRows] = await Promise.all([
    runCypher(EXPLICIT_CYPHER, { headerUuid }),
    runCypher(IMPLICIT_CYPHER, { headerUuid }),
  ]);
  const byUuid = new Map();
  for (const row of [...explicitRows, ...implicitRows]) {
    if (row && row.uuid && !byUuid.has(row.uuid)) byUuid.set(row.uuid, row);
  }
  const records = [...byUuid.values()].map(parseGoalRow).filter(Boolean);
  // parentUuid is the resolved attachment (null = render at root — dangling and
  // cycle-broken refs degrade there); hasChildren feeds the standing rule.
  return resolveDecomposition(records);
}

// External Resource pointers for this owner (second-brain #4, ADR 0004 d5). The
// SAME ConceptElements union the goals use, on the resource concept's header —
// tolerant of the concept being absent (a fresh instance answers []).
async function readResourceRecords(taPubkey) {
  const headerUuid = `39998:${taPubkey}:${RESOURCE_CONCEPT_SLUG}`;
  const [explicitRows, implicitRows] = await Promise.all([
    runCypher(EXPLICIT_CYPHER, { headerUuid }),
    runCypher(IMPLICIT_CYPHER, { headerUuid }),
  ]);
  const byUuid = new Map();
  for (const row of [...explicitRows, ...implicitRows]) {
    if (row && row.uuid && !byUuid.has(row.uuid)) byUuid.set(row.uuid, row);
  }
  return [...byUuid.values()].map(parseResourceRow).filter(Boolean);
}

async function handleGetGoals(req, res) {
  if (!isOwner(req) && !req.localTrusted) {
    return res.status(403).json({ success: false, error: 'Owner access required' });
  }
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'Assistant identity unavailable' });
    }
    const resolved = await readResolvedGoals(taPubkey);
    // Pointer counts for the tree row (ADR 0004 d5/d10) — grouped at query time
    // by the goal slug each resource points at (no denormalized column).
    const countByGoal = groupResourcesByGoal(await readResourceRecords(taPubkey));
    const goals = sortGoals(resolved).map((r) => ({
      uuid: r.uuid,
      name: r.name,
      slug: r.slug,
      statement: r.statement,
      origin: r.origin,
      capturedOn: r.capturedOn,
      createdAt: r.createdAt,
      standing: deriveStanding(r, { hasChildren: r.hasChildren }),
      captureDate: resolveCaptureDate(r),
      deliverable: r.deliverable,
      boundary: r.boundary,
      parent: r.parent,
      parentUuid: r.parentUuid,
      hasChildren: r.hasChildren,
      pointerCount: (countByGoal.get(r.slug) || []).length,
    }));
    return res.json({ success: true, goals });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/brain/goals/:slug — the one-spine Goal detail read (second-brain #4,
// ADR 0004 d5; ADR 0003 d11 scheduled it). Intent + pointers (freshness derived
// at read time) + records ([] in story 4 — producers are stories 5–7). An
// unknown slug answers {goal:null} — an empty state, not an error.
async function handleGetGoalDetail(req, res) {
  if (!isOwner(req) && !req.localTrusted) {
    return res.status(403).json({ success: false, error: 'Owner access required' });
  }
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'Assistant identity unavailable' });
    }
    const slug = req.params.slug;
    const resolved = await readResolvedGoals(taPubkey);
    const matches = resolved.filter((r) => r.slug === slug);
    if (matches.length === 0) {
      return res.json({ success: true, goal: null, pointers: [], records: [] });
    }
    // The resolver-winner: oldest createdAt, uuid tie-break — the same truth the
    // tree and the list read use for a duplicated slug.
    const winner = [...matches].sort((a, b) => {
      const ca = typeof a.createdAt === 'number' ? a.createdAt : Infinity;
      const cb = typeof b.createdAt === 'number' ? b.createdAt : Infinity;
      if (ca !== cb) return ca - cb;
      return a.uuid < b.uuid ? -1 : 1;
    })[0];
    const parent = winner.parentUuid ? resolved.find((r) => r.uuid === winner.parentUuid) : null;

    const now = Date.now();
    const mine = groupResourcesByGoal(await readResourceRecords(taPubkey)).get(winner.slug) || [];
    const pointers = mine
      .slice()
      .sort((a, b) => {
        const da = a.notedOn || '';
        const db = b.notedOn || '';
        if (da !== db) return da < db ? 1 : -1;              // newest noted-on first
        return (b.createdAt || 0) - (a.createdAt || 0);
      })
      .map((r) => ({
        title: r.title,
        locatorKind: r.locatorKind,
        locator: r.locator,
        whyKept: r.whyKept,
        keywords: r.keywords,
        notedOn: r.notedOn,
        lastVerified: r.lastVerified,
        freshness: deriveFreshness(r, now),
        freshnessDays: freshnessDays(r, now),
      }));

    const goal = {
      uuid: winner.uuid,
      name: winner.name,
      slug: winner.slug,
      statement: winner.statement,
      origin: winner.origin,
      capturedOn: winner.capturedOn,
      createdAt: winner.createdAt,
      standing: deriveStanding(winner, { hasChildren: winner.hasChildren }),
      captureDate: resolveCaptureDate(winner),
      deliverable: winner.deliverable,
      boundary: winner.boundary,
      parent: winner.parent,
      parentUuid: winner.parentUuid,
      parentSlug: parent ? parent.slug : null,
      parentName: parent ? parent.name : null,
      hasChildren: winner.hasChildren,
      pointerCount: pointers.length,
    };
    return res.json({ success: true, goal, pointers, records: [] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── Hygiene (second-brain #2, ADR 0002) ──────────────────────────────────
// Directed, parameterized queries only — never the /neighbors view, whose
// direction-erasure produced the false defect inventory this story corrects.

// A header's full directed edge inventory, both directions, with labels.
const HEADER_EDGES_CYPHER = `
  MATCH (h:NostrEvent {uuid: $headerUuid})-[r]->(t)
  RETURN 'out' AS direction, type(r) AS rel, t.uuid AS otherUuid, labels(t) AS otherLabels
  UNION ALL
  MATCH (h:NostrEvent {uuid: $headerUuid})<-[r]-(s)
  RETURN 'in' AS direction, type(r) AS rel, s.uuid AS otherUuid, labels(s) AS otherLabels`;

// Explicit members via the directed downward walk (the 0001 EXPLICIT_CYPHER
// shape), each annotated with whether its z-tag declaration is present.
const ELEMENTS_WITH_EDGE_CYPHER = `
  MATCH (h:NostrEvent {uuid: $headerUuid})-[:IS_THE_CONCEPT_FOR]->(s:Superset)
  MATCH (s)-[:IS_A_SUPERSET_OF*0..10]->(ss)-[:HAS_ELEMENT]->(e:NostrEvent)
  WHERE e.kind = 39999
  OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
  OPTIONAL MATCH (e)-[:HAS_TAG]->(z:NostrEventTag {type: 'z', value: $headerUuid})
  WITH DISTINCT e, head(collect(DISTINCT j.value)) AS json, count(DISTINCT z) > 0 AS hasZTag
  RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json, hasZTag AS hasZTag`;

// Implicit members: z-tag declarations (the 0001 IMPLICIT_CYPHER shape).
const ELEMENTS_WITH_ZTAG_CYPHER = `
  MATCH (e:NostrEvent)-[:HAS_TAG]->(:NostrEventTag {type: 'z', value: $headerUuid})
  WHERE e.kind = 39999
  OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type: 'json'})
  WITH DISTINCT e, head(collect(j.value)) AS json
  RETURN e.uuid AS uuid, e.name AS name, e.created_at AS createdAt, json AS json`;

// The json tags of the two nodes the property comparison needs.
const NODE_JSON_CYPHER = `
  UNWIND $uuids AS u
  MATCH (n:NostrEvent {uuid: u})-[:HAS_TAG]->(t:NostrEventTag {type: 'json'})
  RETURN n.uuid AS uuid, t.value AS json`;

const HEADER_PRESENT_CYPHER = 'MATCH (h:NostrEvent {uuid: $headerUuid}) RETURN h.uuid AS uuid';

function parseJsonSafe(s) {
  if (typeof s !== 'string' || s === '') return null;
  try { return JSON.parse(s); } catch { return null; }
}

// The schema wrapper's single concept-object: jsonSchema.properties[<key>].
function extractSchemaObject(wrapper) {
  const schema = wrapper && wrapper.jsonSchema;
  const props = schema && schema.properties;
  if (!props || typeof props !== 'object') return null;
  const keys = Object.keys(props);
  if (keys.length !== 1) return null;
  const obj = props[keys[0]];
  return (obj && typeof obj === 'object') ? obj : null;
}

async function checkConcept({ slug, parseRecord }, taPubkey) {
  const headerUuid = `39998:${taPubkey}:${slug}`;
  const present = await runCypher(HEADER_PRESENT_CYPHER, { headerUuid });
  if (!present || present.length === 0) {
    return { concept: slug, present: false };
  }

  const edges = await runCypher(HEADER_EDGES_CYPHER, { headerUuid });
  const problems = classifyHeaderEdges({ concept: slug, headerUuid, edges });

  // Full outer join of edge-side and z-tag-side membership.
  const [edgeRows, ztagRows] = await Promise.all([
    runCypher(ELEMENTS_WITH_EDGE_CYPHER, { headerUuid }),
    runCypher(ELEMENTS_WITH_ZTAG_CYPHER, { headerUuid }),
  ]);
  const byUuid = new Map();
  for (const row of edgeRows) {
    if (row && row.uuid) byUuid.set(row.uuid, { ...row, hasEdge: true, hasZTag: !!row.hasZTag });
  }
  for (const row of ztagRows) {
    if (!row || !row.uuid) continue;
    const existing = byUuid.get(row.uuid);
    if (existing) existing.hasZTag = true;
    else byUuid.set(row.uuid, { ...row, hasEdge: false, hasZTag: true });
  }
  const elements = [...byUuid.values()];
  problems.push(...classifyElementConsistency({ concept: slug, elements, parseRecord }));

  // Decomposition structure (second-brain #3, ADR 0003 d9) — goal concept
  // only: parent refs live in goal records, parsed by the shared classifier.
  if (typeof parseRecord === 'function') {
    const records = elements
      .map((el) => parseRecord({ uuid: el.uuid, name: el.name, createdAt: el.createdAt, json: el.json }))
      .filter(Boolean);
    problems.push(...classifyDecomposition({ concept: slug, records }));
  }

  // Property-record comparison — node uuids resolved from the machinery edges,
  // never assumed from d-tag convention. If the machinery is missing, the
  // classifyHeaderEdges problems above already say so specifically.
  const schemaEdge = edges.find((e) => e.direction === 'in' && e.rel === 'IS_THE_JSON_SCHEMA_FOR');
  const ppEdge = edges.find((e) => e.direction === 'in' && e.rel === 'IS_THE_PRIMARY_PROPERTY_FOR');
  if (schemaEdge && ppEdge) {
    const jsonRows = await runCypher(NODE_JSON_CYPHER, { uuids: [schemaEdge.otherUuid, ppEdge.otherUuid] });
    const jsonByUuid = new Map(jsonRows.map((r) => [r.uuid, r.json]));
    const schemaObject = extractSchemaObject(parseJsonSafe(jsonByUuid.get(schemaEdge.otherUuid)));
    const ppWrapper = parseJsonSafe(jsonByUuid.get(ppEdge.otherUuid));
    problems.push(...comparePropertyRecord({
      concept: slug,
      schemaObject,
      propertySection: ppWrapper && ppWrapper.property,
    }));
  }

  return { concept: slug, present: true, elements: elements.length, problems };
}

async function handleGetHygiene(req, res) {
  if (!isOwner(req) && !req.localTrusted) {
    return res.status(403).json({ success: false, error: 'Owner access required' });
  }
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'Assistant identity unavailable' });
    }
    const results = [];
    for (const concept of HYGIENE_CONCEPTS) {
      results.push(await checkConcept(concept, taPubkey));
    }
    const report = assembleReport(results);
    return res.json({ success: true, sound: report.sound, problems: report.problems, checked: report.checked });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

function registerBrainRoutes(app) {
  app.get('/api/brain/goals', handleGetGoals);
  app.get('/api/brain/goals/:slug', handleGetGoalDetail);
  app.get('/api/brain/hygiene', handleGetHygiene);
}

module.exports = { registerBrainRoutes };
