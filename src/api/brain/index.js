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
const { parseGoalRow, deriveStanding, resolveCaptureDate, sortGoals } = require('../../lib/brain/goals');

const GOAL_CONCEPT_SLUG = 'tapestry-owner-goal';

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

async function handleGetGoals(req, res) {
  if (!isOwner(req) && !req.localTrusted) {
    return res.status(403).json({ success: false, error: 'Owner access required' });
  }
  try {
    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'Assistant identity unavailable' });
    }
    const headerUuid = `39998:${taPubkey}:${GOAL_CONCEPT_SLUG}`;
    const [explicitRows, implicitRows] = await Promise.all([
      runCypher(EXPLICIT_CYPHER, { headerUuid }),
      runCypher(IMPLICIT_CYPHER, { headerUuid }),
    ]);
    const byUuid = new Map();
    for (const row of [...explicitRows, ...implicitRows]) {
      if (row && row.uuid && !byUuid.has(row.uuid)) byUuid.set(row.uuid, row);
    }
    const records = [...byUuid.values()]
      .map(parseGoalRow)
      .filter(Boolean);
    const goals = sortGoals(records).map((r) => ({
      uuid: r.uuid,
      name: r.name,
      statement: r.statement,
      origin: r.origin,
      capturedOn: r.capturedOn,
      createdAt: r.createdAt,
      standing: deriveStanding(r),
      captureDate: resolveCaptureDate(r),
    }));
    return res.json({ success: true, goals });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

function registerBrainRoutes(app) {
  app.get('/api/brain/goals', handleGetGoals);
}

module.exports = { registerBrainRoutes };
