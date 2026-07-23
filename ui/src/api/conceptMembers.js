/**
 * conceptMembers — the Firmware Explorer's per-concept Elements & Sets read.
 *
 * A concept's members hang off its Superset:
 *   ConceptHeader —IS_THE_CONCEPT_FOR→ Superset —HAS_ELEMENT→ elements
 *   Superset —IS_A_SUPERSET_OF→ subsets
 *
 * `buildMembersQuery` is a pure function returning a Cypher string keyed on the `$h`
 * PARAMETER (the concept-header handle) — never the interpolated handle. That is
 * load-bearing: /api/neo4j/query classifies a query as a write if its TEXT matches
 * /\b(CREATE|MERGE|DELETE|SET|REMOVE|…)\b/i, so an interpolated handle such as
 * `39998:<pk>:set` would trip `\bSET\b` and 403 the read. The handle rides in params;
 * the query template stays keyword-clean (and injection-safe). See ADR
 * firmware-explorer/0001.
 *
 * "Direct" = the superset's own members (one hop). "Full" = the transitive closure
 * through nested subsets; for elements it also UNIONs the "implicit" members — events
 * z-tagged to the concept header whose HAS_ELEMENT edge may be absent. Both mirror the
 * Concepts admin Elements page. Members are shown regardless of author (this is a
 * structural inspector, not a POV-scoped view).
 */

import { cypher } from './cypher.js';

const MAX_DEPTH = 10;

// Shared RETURN tail — same columns across UNION arms (Cypher requires it).
const ELEMENT_TAIL = `
  OPTIONAL MATCH (e)-[:HAS_TAG]->(j:NostrEventTag {type:'json'})
  WITH DISTINCT e, head(collect(j.value)) AS json
  RETURN e.uuid AS uuid, e.name AS name, json`;

const SET_TAIL = `
  OPTIONAL MATCH (s)-[:HAS_TAG]->(j:NostrEventTag {type:'json'})
  WITH DISTINCT s, head(collect(j.value)) AS json
  RETURN s.uuid AS uuid, s.name AS name, json`;

/**
 * @param {{kind:'elements'|'sets', scope:'direct'|'full'}} opts
 * @returns {string} a Cypher read parameterized on $h (the concept-header handle)
 */
export function buildMembersQuery({ kind, scope } = {}) {
  if (kind !== 'elements' && kind !== 'sets') {
    throw new Error(`buildMembersQuery: unknown kind '${kind}' (expected 'elements' | 'sets')`);
  }
  if (scope !== 'direct' && scope !== 'full') {
    throw new Error(`buildMembersQuery: unknown scope '${scope}' (expected 'direct' | 'full')`);
  }

  if (kind === 'elements') {
    if (scope === 'direct') {
      return `MATCH (h {uuid:$h})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)-[:HAS_ELEMENT]->(e)${ELEMENT_TAIL}`;
    }
    // full: transitive-through-subsets (0.. keeps the superset's own elements too)
    // UNION the implicit z-tag members.
    return `MATCH (h {uuid:$h})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)-[:IS_A_SUPERSET_OF*0..${MAX_DEPTH}]->(ss)-[:HAS_ELEMENT]->(e)${ELEMENT_TAIL}
UNION
MATCH (e)-[:HAS_TAG]->(:NostrEventTag {type:'z', value:$h})${ELEMENT_TAIL}`;
  }

  // kind === 'sets'
  if (scope === 'direct') {
    return `MATCH (h {uuid:$h})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)-[:IS_A_SUPERSET_OF]->(s)${SET_TAIL}`;
  }
  // full: transitive subset closure (1.. — excludes the superset itself)
  return `MATCH (h {uuid:$h})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)-[:IS_A_SUPERSET_OF*1..${MAX_DEPTH}]->(s)${SET_TAIL}`;
}

/**
 * Fetch a concept's members. The header handle travels as the `$h` param.
 * @param {{headerUuid:string, kind:'elements'|'sets', scope:'direct'|'full'}} opts
 * @returns {Promise<Array<{uuid:string, name:string, json:string|null}>>}
 */
export async function fetchConceptMembers({ headerUuid, kind, scope }) {
  return cypher(buildMembersQuery({ kind, scope }), { h: headerUuid });
}
