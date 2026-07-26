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
const { parseWorkRecordRow, groupWorkRecordsByGoal, sortRecordsByRecency } = require('../../lib/brain/work-records');
const { parseProposalRow, groupProposalsByGoal, openProposals, proposalEntry } = require('../../lib/brain/proposals');
const { parseSignalRow, groupSignalsByGoal, signalEntry } = require('../../lib/brain/signals');
const { familyEntries, assembleExport } = require('../../lib/brain/export');
const {
  DEFAULT_MAX_ANCHOR_DISTANCE, SURRENDERED, UNAVAILABLE,
  parseEstimate, deriveTerms, resolveAnchor, boundarySteps,
} = require('../../lib/brain/direction');

const GOAL_CONCEPT_SLUG = 'tapestry-owner-goal';

// Bounded orientation (second-brain #5, ADR 0005 d11/d15) — the single cap on
// the orient roots slice, so the payload stays flat as the corpus grows.
const ORIENT_ROOT_CAP = 24;

// External Resource pointers (second-brain #4, ADR 0004 d1) — the concept is
// runtime-created (never firmware-seeded); the read is tolerant of its absence
// (no header ⇒ no rows ⇒ an empty pointer set, never an error).
const RESOURCE_CONCEPT_SLUG = 'tapestry-external-resource';

// Work records (second-brain #5, ADR 0005 d10) — the concept is runtime-created
// (never firmware-seeded); the read is tolerant of its absence (no header ⇒ no
// rows ⇒ an empty record set, never an error).
const WORK_RECORD_CONCEPT_SLUG = 'tapestry-work-record';

// Proposals (second-brain #6, ADR 0006 d10) — the concept is runtime-created
// (never firmware-seeded); the read is tolerant of its absence (no header ⇒ no
// rows ⇒ an empty proposal set, never an error).
const PROPOSAL_CONCEPT_SLUG = 'tapestry-proposal';

// Priority signals (second-brain #7, ADR 0007 d10) — the concept is
// runtime-created (never firmware-seeded); the read is tolerant of its absence
// (no header ⇒ no rows ⇒ an empty signal set, never an error).
const SIGNAL_CONCEPT_SLUG = 'tapestry-priority-signal';

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

// The same goal read, but keeping the RAW rows alongside the resolved records
// (operational-direction #1, ADR 0001 d6): the direction core reads
// chanceOfSuccess off the raw json, which parseGoalRow drops. One union, both
// shapes — readResolvedGoals stays untouched for every other caller.
async function readGoalRowsAndResolved(taPubkey) {
  const headerUuid = `39998:${taPubkey}:${GOAL_CONCEPT_SLUG}`;
  const [explicitRows, implicitRows] = await Promise.all([
    runCypher(EXPLICIT_CYPHER, { headerUuid }),
    runCypher(IMPLICIT_CYPHER, { headerUuid }),
  ]);
  const byUuid = new Map();
  for (const row of [...explicitRows, ...implicitRows]) {
    if (row && row.uuid && !byUuid.has(row.uuid)) byUuid.set(row.uuid, row);
  }
  const rows = [...byUuid.values()];
  const records = rows.map(parseGoalRow).filter(Boolean);
  return { rowByUuid: byUuid, resolved: resolveDecomposition(records) };
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

// Work records for this owner (second-brain #5, ADR 0005 d10). The SAME
// ConceptElements union the goals/resources use, on the work-record concept's
// header — tolerant of the concept being absent (a fresh instance answers []).
async function readWorkRecords(taPubkey) {
  const headerUuid = `39998:${taPubkey}:${WORK_RECORD_CONCEPT_SLUG}`;
  const [explicitRows, implicitRows] = await Promise.all([
    runCypher(EXPLICIT_CYPHER, { headerUuid }),
    runCypher(IMPLICIT_CYPHER, { headerUuid }),
  ]);
  const byUuid = new Map();
  for (const row of [...explicitRows, ...implicitRows]) {
    if (row && row.uuid && !byUuid.has(row.uuid)) byUuid.set(row.uuid, row);
  }
  return [...byUuid.values()].map(parseWorkRecordRow).filter(Boolean);
}

// Proposal facts for this owner (second-brain #6, ADR 0006 d10). The SAME
// ConceptElements union the goals/resources/records use, on the proposal concept's
// header — tolerant of the concept being absent (a fresh instance answers []).
async function readProposals(taPubkey) {
  const headerUuid = `39998:${taPubkey}:${PROPOSAL_CONCEPT_SLUG}`;
  const [explicitRows, implicitRows] = await Promise.all([
    runCypher(EXPLICIT_CYPHER, { headerUuid }),
    runCypher(IMPLICIT_CYPHER, { headerUuid }),
  ]);
  const byUuid = new Map();
  for (const row of [...explicitRows, ...implicitRows]) {
    if (row && row.uuid && !byUuid.has(row.uuid)) byUuid.set(row.uuid, row);
  }
  return [...byUuid.values()].map(parseProposalRow).filter(Boolean);
}

// Priority signals for this owner (second-brain #7, ADR 0007 d10). The SAME
// ConceptElements union the goals/resources/records/proposals use, on the
// signal concept's header — tolerant of the concept being absent (a fresh
// instance answers []).
async function readSignals(taPubkey) {
  const headerUuid = `39998:${taPubkey}:${SIGNAL_CONCEPT_SLUG}`;
  const [explicitRows, implicitRows] = await Promise.all([
    runCypher(EXPLICIT_CYPHER, { headerUuid }),
    runCypher(IMPLICIT_CYPHER, { headerUuid }),
  ]);
  const byUuid = new Map();
  for (const row of [...explicitRows, ...implicitRows]) {
    if (row && row.uuid && !byUuid.has(row.uuid)) byUuid.set(row.uuid, row);
  }
  return [...byUuid.values()].map(parseSignalRow).filter(Boolean);
}

// One family's raw rows ({uuid, name, createdAt, json}) — the SAME explicit ∪
// implicit union every reader above uses, returned unparsed so the export can
// carry the RAW stored sections verbatim (second-brain #8, ADR 0008 d3).
// Tolerant of an absent concept (no header ⇒ no rows ⇒ an empty family).
async function readFamilyRows(taPubkey, conceptSlug) {
  const headerUuid = `39998:${taPubkey}:${conceptSlug}`;
  const [explicitRows, implicitRows] = await Promise.all([
    runCypher(EXPLICIT_CYPHER, { headerUuid }),
    runCypher(IMPLICIT_CYPHER, { headerUuid }),
  ]);
  const byUuid = new Map();
  for (const row of [...explicitRows, ...implicitRows]) {
    if (row && row.uuid && !byUuid.has(row.uuid)) byUuid.set(row.uuid, row);
  }
  return [...byUuid.values()];
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
    // The resolver-winner: oldest createdAt, uuid tie-break — the same truth the
    // tree and the list read use for a duplicated slug. An unknown slug yields no
    // winner: goal:null with empty pointers/records (an empty state, not an error).
    const winner = matches.length === 0 ? null : [...matches].sort((a, b) => {
      const ca = typeof a.createdAt === 'number' ? a.createdAt : Infinity;
      const cb = typeof b.createdAt === 'number' ? b.createdAt : Infinity;
      if (ca !== cb) return ca - cb;
      return a.uuid < b.uuid ? -1 : 1;
    })[0];

    const now = Date.now();
    const mine = winner ? (groupResourcesByGoal(await readResourceRecords(taPubkey)).get(winner.slug) || []) : [];
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

    // Records (second-brain #5, ADR 0005 d10; extended #6, ADR 0006 d10): the
    // goal's append-only spine — work records AND proposal facts, each projected
    // to the record-entry shape and MERGED newest-date first (the morning-review
    // reads downward). Produced locators resolve against `mine` into pointer
    // cards. Empty when there is no winner (unknown slug) — no hardcoded
    // placeholder. `_createdAt` is an internal tie-break key, stripped on the way out.
    const wr = winner ? (groupWorkRecordsByGoal(await readWorkRecords(taPubkey)).get(winner.slug) || []) : [];
    const workEntries = wr.map((r) => ({
      date: r.happenedOn,
      type: r.type,
      summary: r.summary,
      session: r.session,
      questions: Array.isArray(r.questions) ? r.questions : [],
      produced: (Array.isArray(r.produced) ? r.produced : [])
        .map((loc) => mine.find((res) => res.locator === loc))
        .filter(Boolean)
        .map((res) => ({
          title: res.title,
          locatorKind: res.locatorKind,
          locator: res.locator,
          freshness: deriveFreshness(res, now),
          freshnessDays: freshnessDays(res, now),
        })),
      _createdAt: r.createdAt,
    }));
    // Proposal facts (second-brain #6, ADR 0006 d10): proposed/approved/skipped,
    // projected to the same record-entry shape (session/questions/produced empty)
    // and merged into the spine. RecordEntry renders any type word unchanged.
    const pf = winner ? (groupProposalsByGoal(await readProposals(taPubkey)).get(winner.slug) || []) : [];
    const proposalEntries = pf.map((r) => ({
      ...proposalEntry(r),
      session: null,
      questions: [],
      produced: [],
      _createdAt: r.createdAt,
    }));
    // Priority signals (second-brain #7, ADR 0007 d10): ONE stored fact touches
    // TWO goals — the grouper fans it out under both slugs, and each side is
    // worded from this goal's perspective at read (the other goal's current
    // display name resolves from the already-loaded goal set; a vanished goal
    // falls back to its slug).
    const sf = winner ? (groupSignalsByGoal(await readSignals(taPubkey)).get(winner.slug) || []) : [];
    const signalEntries = sf.map((r) => {
      const side = r.prefers === winner.slug ? 'prefers' : 'over';
      const otherSlug = side === 'prefers' ? r.over : r.prefers;
      const other = resolved.find((g) => g.slug === otherSlug);
      return {
        ...signalEntry(r, side, other ? other.name : null),
        session: null,
        questions: [],
        produced: [],
        _createdAt: r.createdAt,
      };
    });
    const records = [...workEntries, ...proposalEntries, ...signalEntries]
      .sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        if (da !== db) return da < db ? 1 : -1;               // newest date first
        return (b._createdAt || 0) - (a._createdAt || 0);     // createdAt tie-break
      })
      .map(({ _createdAt, ...entry }) => entry);

    const parent = winner && winner.parentUuid ? resolved.find((r) => r.uuid === winner.parentUuid) : null;
    const goal = winner ? {
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
    } : null;
    return res.json({ success: true, goal, pointers, records });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/brain/orient — bounded, corpus-independent session orientation
// (second-brain #5, ADR 0005 d11). A fresh session states which goals exist and
// which one it serves from a payload whose SIZE stays flat as the corpus grows:
// a goalCount scalar, a CAPPED slice of the root goals, and — when asked
// (?goal=<slug>) — the served goal in full with its deliverable/boundary
// verbatim and its (bounded) ancestry. Boundedness is a property of the response
// (the session's token budget); a sub-linear server index is Phase 4.
async function handleGetOrient(req, res) {
  if (!isOwner(req) && !req.localTrusted) {
    return res.status(403).json({ success: false, error: 'Owner access required' });
  }
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'Assistant identity unavailable' });
    }
    const resolved = await readResolvedGoals(taPubkey);
    // "What exists": a count, plus a bounded slice of the root (parent-less)
    // goals — capped so the slice never grows with the corpus.
    const roots = sortGoals(resolved)
      .filter((r) => !r.parentUuid)
      .slice(0, ORIENT_ROOT_CAP)
      .map((r) => ({ slug: r.slug, name: r.name, standing: deriveStanding(r, { hasChildren: r.hasChildren }) }));

    // "Where its goal sits": the served goal in full (when named), resolver-
    // winner just like the detail read, with its ancestry chain (bounded by tree
    // depth, not N) and deliverable/boundary verbatim.
    let served = null;
    const wantSlug = req.query && typeof req.query.goal === 'string' ? req.query.goal : null;
    if (wantSlug) {
      const matches = resolved.filter((r) => r.slug === wantSlug);
      const winner = matches.length === 0 ? null : [...matches].sort((a, b) => {
        const ca = typeof a.createdAt === 'number' ? a.createdAt : Infinity;
        const cb = typeof b.createdAt === 'number' ? b.createdAt : Infinity;
        if (ca !== cb) return ca - cb;
        return a.uuid < b.uuid ? -1 : 1;
      })[0];
      if (winner) {
        const ancestry = [];
        let cur = winner.parentUuid ? resolved.find((r) => r.uuid === winner.parentUuid) : null;
        let guard = 0;
        while (cur && guard < 32) {
          ancestry.push({ slug: cur.slug, name: cur.name });
          cur = cur.parentUuid ? resolved.find((r) => r.uuid === cur.parentUuid) : null;
          guard++;
        }
        served = {
          slug: winner.slug,
          name: winner.name,
          statement: winner.statement,
          standing: deriveStanding(winner, { hasChildren: winner.hasChildren }),
          captureDate: resolveCaptureDate(winner),
          deliverable: winner.deliverable,
          boundary: winner.boundary,
          parentSlug: ancestry.length ? ancestry[0].slug : null,
          parentName: ancestry.length ? ancestry[0].name : null,
          ancestry,
        };
      }
    }
    return res.json({ success: true, goalCount: resolved.length, roots, served });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

// GET /api/brain/proposals — the Proposal queue's read (second-brain #6, ADR
// 0006 d11). The OPEN proposals only: a `proposed` fact with no decision
// referencing it (openProposals derives this at read — never a stored flag).
// Each is projected to an owner-facing card (the nominated goal's NAME resolved
// from the goals read; the passed-over runners-up likewise). An empty or absent
// concept answers {success:true, proposals:[]} — an empty queue is a state, not
// an error. No numeric score (AC6); the card carries comparisons and words only.
async function handleGetProposals(req, res) {
  if (!isOwner(req) && !req.localTrusted) {
    return res.status(403).json({ success: false, error: 'Owner access required' });
  }
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'Assistant identity unavailable' });
    }
    const [proposals, resolved] = await Promise.all([
      readProposals(taPubkey),
      readResolvedGoals(taPubkey),
    ]);
    const nameBySlug = new Map();
    for (const g of resolved) {
      if (g && typeof g.slug === 'string' && !nameBySlug.has(g.slug)) nameBySlug.set(g.slug, g.name);
    }
    const open = openProposals(proposals).map((p) => ({
      proposalId: p.slug,
      goal: p.goal,
      goalName: nameBySlug.get(p.goal) || p.goal,
      whyNow: p.whyNow,
      passedOver: (Array.isArray(p.passedOver) ? p.passedOver : []).map((x) => ({
        goal: x.goal,
        goalName: nameBySlug.get(x.goal) || x.goal,
        whyNot: x.whyNot,
      })),
      madeOn: p.happenedOn,
    }));
    return res.json({ success: true, proposals: open });
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

// GET /api/brain/direction/:slug — may this goal be run under operational
// direction, and on what terms? (operational-direction #1, ADR 0001 d1/d6.)
//
// Read-only: it resolves the owner-ratified anchor, checks ratification
// staleness, and transcribes the run's terms from the goal. It writes nothing.
//
// It does NOT render the boundary verdict. Boundaries are prose, so that
// judgment is a blinded gate-judge the Director spawns (ADR d5) — this handler
// reports the steps needing one via `boundaryReview` and never blesses what it
// did not check. At the v1 policy distance the chain is one goal, so
// `boundaryReview.required` is false and the question does not arise.
async function handleGetDirection(req, res) {
  if (!isOwner(req) && !req.localTrusted) {
    return res.status(403).json({ success: false, error: 'Owner access required' });
  }
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'Assistant identity unavailable' });
    }
    const goalSlug = String((req.params && req.params.slug) || '').trim();
    if (!goalSlug) {
      return res.json({ success: false, eligible: false, refusal: 'goal-not-found', error: 'no goal slug was given.' });
    }

    // The anchor distance is a POLICY parameter, owner-set (PRD §7.5/§7.6).
    // v1 is 0 — the anchor must be the goal itself. Raising it is a policy act.
    const raw = process.env.BRAINSTORM_MAX_ANCHOR_DISTANCE;
    const parsedLimit = raw === undefined ? NaN : Number(raw);
    const maxAnchorDistance = Number.isInteger(parsedLimit) && parsedLimit >= 0
      ? parsedLimit
      : DEFAULT_MAX_ANCHOR_DISTANCE;

    const [{ rowByUuid, resolved }, proposals] = await Promise.all([
      readGoalRowsAndResolved(taPubkey),
      readProposals(taPubkey),
    ]);

    // Ordered boundary verdicts, one per step in boundaryReview.steps order
    // (ADR 0002 d11). Absent/empty ⇒ none supplied ⇒ the core refuses
    // `boundary-unjudged` whenever steps exist. This parameter is NOT a trust
    // boundary — see ADR 0002 d11; the controls are the blinded judge, the
    // journal, and operator audit, exactly as for every other gate.
    const rawVerdicts = String((req.query && req.query.verdicts) || '').trim();
    const boundaryVerdicts = rawVerdicts === ''
      ? undefined
      : rawVerdicts.split(',').map((v) => v.trim().toLowerCase());

    const outcome = resolveAnchor({ goals: resolved, proposals, goalSlug, maxAnchorDistance, boundaryVerdicts });

    // Built ONCE, above the branch, so both envelopes carry the same shape and a
    // caller never branches on outcome to find the steps (ADR 0003 d14). The
    // asymmetry this replaces was the round-2 defect: `roles/director.md` tells
    // the Director to read `boundaryReview.steps` on a `boundary-unjudged`
    // refusal, and the refusal envelope did not carry it.
    // `required` answers only "is there judging work outstanding?" (d15) — it is
    // NOT "were there steps", which read `true` on an already-judged success.
    const boundaryReview = {
      required: outcome.refusal === 'boundary-unjudged',
      steps: outcome.steps || [],
    };

    if (!outcome.eligible) {
      return res.json({
        success: false,
        eligible: false,
        refusal: outcome.refusal,
        error: outcome.error,
        detail: outcome.detail || null,
        chain: outcome.chain || [],
        maxAnchorDistance,
        boundaryReview,
      });
    }

    const target = resolved.find((g) => g && g.slug === goalSlug) || null;
    const terms = deriveTerms(target, parseEstimate(target ? rowByUuid.get(target.uuid) : null));

    // Only the two boundary strings per step — the blinding the judge depends on.
    // Built from what the walk ACTUALLY visited (ADR 0002 d13): the core returns
    // the steps alongside the chain, so a duplicated ancestor slug can no longer
    // surface a different record's boundary text to a judge.
    return res.json({
      success: true,
      eligible: true,
      anchor: outcome.anchor,
      terms,
      surrendered: SURRENDERED,
      unavailable: UNAVAILABLE,
      chain: outcome.chain || [],
      maxAnchorDistance,
      boundaryReview,
      derivedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('brain/direction error:', error);
    return res.status(500).json({ success: false, error: 'Failed to resolve direction eligibility' });
  }
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

// GET /api/brain/export — the dated, identity-free artifact of the owner's
// brain content (second-brain #8, ADR 0008 d1/d3): each family's parser-valid
// rows as {name, section} with the RAW stored section VERBATIM (membership is
// the parser's call; fidelity is raw — a protection artifact never silently
// drops what the owner stored). A pure read on the same union the other reads
// use: provisions nothing, changes nothing, answers as a dated attachment
// download. No uuids, no created-at stamps, no assistant identity anywhere in
// the artifact (§5.9 — the portability seed carries content, not identity).
async function handleGetExport(req, res) {
  if (!isOwner(req) && !req.localTrusted) {
    return res.status(403).json({ success: false, error: 'Owner access required' });
  }
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'Assistant identity unavailable' });
    }
    const [goalRows, resourceRows, workRows, proposalRows, signalRows] = await Promise.all([
      readFamilyRows(taPubkey, GOAL_CONCEPT_SLUG),
      readFamilyRows(taPubkey, RESOURCE_CONCEPT_SLUG),
      readFamilyRows(taPubkey, WORK_RECORD_CONCEPT_SLUG),
      readFamilyRows(taPubkey, PROPOSAL_CONCEPT_SLUG),
      readFamilyRows(taPubkey, SIGNAL_CONCEPT_SLUG),
    ]);
    const takenOn = new Date().toISOString().slice(0, 10);
    const artifact = assembleExport({
      goals: familyEntries(goalRows, 'tapestryOwnerGoal', parseGoalRow),
      resources: familyEntries(resourceRows, 'externalResource', parseResourceRow),
      workRecords: familyEntries(workRows, 'workRecord', parseWorkRecordRow),
      proposals: familyEntries(proposalRows, 'proposal', parseProposalRow),
      signals: familyEntries(signalRows, 'prioritySignal', parseSignalRow),
    }, takenOn);
    res.setHeader('Content-Disposition', `attachment; filename="brain-export-${takenOn}.json"`);
    return res.json(artifact);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

function registerBrainRoutes(app) {
  app.get('/api/brain/goals', handleGetGoals);
  app.get('/api/brain/orient', handleGetOrient);
  app.get('/api/brain/proposals', handleGetProposals);
  app.get('/api/brain/direction/:slug', handleGetDirection);
  app.get('/api/brain/goals/:slug', handleGetGoalDetail);
  app.get('/api/brain/hygiene', handleGetHygiene);
  app.get('/api/brain/export', handleGetExport);
}

module.exports = { registerBrainRoutes };
