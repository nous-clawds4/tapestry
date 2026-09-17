/**
 * Client for the concept-graph core-nodes read (ADR tapestries/0004).
 * Returns a concept's 8 core nodes + JSON by header handle, sourced from Neo4j + Tapestry
 * LMDB (relationships from Neo4j, node JSON resolved from LMDB) — the read path behind the
 * tapestry per-concept detail views.
 */

/**
 * Fetch a concept's core nodes by its header handle (uuid), e.g. `39998:<TA>:dog`.
 * @param {string} handle
 * @returns {Promise<{found: boolean, nodes: object}>}
 */
export async function fetchConceptCoreNodes(handle) {
  const res = await fetch(`/api/concept-graph/node/${encodeURIComponent(handle)}/core-nodes`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Failed to fetch concept core nodes');
  return { found: data.found, nodes: data.nodes };
}
