/**
 * The canonical element/set count for a concept — one rule, one place.
 * ADR: engineering-team/decisions/graph-curation-ui/0003-one-canonical-concept-count.md
 *      (including Amendment 1 — query parameters)
 *
 * THE RULE. Start at the concept's Superset via IS_THE_CONCEPT_FOR, then walk
 * IS_A_SUPERSET_OF *forward* — parent-first, per ADR relationship-primitives/0001.
 * Elements are whatever HAS_ELEMENT reaches, matched as :NostrEvent. Sets are the
 * nodes on the superset walk itself (the superset counts as one, at zero hops).
 *
 * The two ways this was previously got wrong, both of which failed *silently*:
 *
 *   - Matching elements as `:ListItem`. A concept used as an element of another
 *     concept carries ListHeader/ConceptHeader and never ListItem, so it vanished.
 *     `firmware concept` held 37 elements and reported 0.
 *   - Reversing the walk to `(sup)<-[:IS_A_SUPERSET_OF*0..5]-`. At zero hops that
 *     still matches the superset itself, so it degrades to "direct members only"
 *     rather than erroring. `word` holds 582 elements under 47 sets and reported 0.
 *
 * THE UUID IS A PARAMETER, NOT INTERPOLATED (Amendment 1). The server gates writes
 * by regex-testing the query TEXT for CREATE|MERGE|DELETE|SET|REMOVE|DETACH|DROP
 * (src/api/neo4j/queryPost.js:17). Kebab-case puts a word boundary before `set`, so
 * interpolating a handle would make the concepts `set`, `properties-set` and
 * `goal-set` look like writes and 403 for every unauthenticated reader — including
 * logged-out visitors and this project's own test runner. Passing the handle as a
 * parameter keeps it out of the query text entirely.
 *
 * No React, no fetch, no side effects — this module is executed directly by the
 * Node test runner, which is the point of it existing separately from the page.
 */

/** The parameter name this query expects; callers pass `{ conceptUuid: <handle> }`. */
export const CONCEPT_UUID_PARAM = 'conceptUuid';

/**
 * Cypher yielding one row of `{ elementCount, setCount }` for a concept.
 *
 * Both counts use `count(DISTINCT …)`, so the cartesian product between the two
 * OPTIONAL MATCHes cannot inflate either figure.
 *
 * Takes no argument: the concept is supplied at execution time as the
 * `$conceptUuid` parameter, so the same query text serves every concept.
 *
 * @returns {string} a complete, parameterized Cypher query.
 */
export function conceptCountsCypher() {
  return `
    MATCH (h:ListHeader {uuid: $conceptUuid})-[:IS_THE_CONCEPT_FOR]->(sup:Superset)
    OPTIONAL MATCH (sup)-[:IS_A_SUPERSET_OF*0..5]->(ss)-[:HAS_ELEMENT]->(elem:NostrEvent)
    OPTIONAL MATCH (sup)-[:IS_A_SUPERSET_OF*0..5]->(setNode)
    RETURN count(DISTINCT elem) AS elementCount,
           count(DISTINCT setNode) AS setCount
    LIMIT 1
  `;
}
