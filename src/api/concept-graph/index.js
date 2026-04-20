/**
 * Tapestry Concept Graph — context-window-efficient API for AI agents.
 *
 * Provides a two-tier access pattern:
 *   1. Shallow summaries — compact fingerprints of every node so an AI agent
 *      can orient itself within a small token budget.
 *   2. Targeted expansion — full node content retrieved via stable `uuid` handles.
 *
 * Endpoints:
 *   GET /api/concept-graph/summaries
 *     All ConceptHeaders as compact summaries (name, description snippet, counts).
 *
 *   GET /api/concept-graph/node/:handle
 *     Full content for a single node identified by its uuid handle.
 *
 *   GET /api/concept-graph/node/:handle/neighbors
 *     One-hop neighbors of a node, returned as summaries grouped by relationship type.
 *
 *   GET /api/concept-graph/subgraph/:handle
 *     BFS tree of summaries rooted at the node (query param: depth, default 1, max 3).
 */

const { runCypher } = require('../../lib/neo4j-driver');

// ─── Summaries ────────────────────────────────────────────────────────────────

async function handleSummaries(req, res) {
  try {
    const rows = await runCypher(`
      MATCH (n:ConceptHeader)
      OPTIONAL MATCH (n)-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:HAS_ELEMENT]->(e)
      OPTIONAL MATCH (n)-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF]->(s)
      WITH n, count(distinct e) AS elementCount, count(distinct s) AS setCount
      OPTIONAL MATCH (p:Property)-[:IS_THE_PRIMARY_PROPERTY_FOR]->(n)
      WITH n, elementCount, setCount, count(distinct p) AS propertyCount
      OPTIONAL MATCH (n)-[:HAS_TAG]->(jt:NostrEventTag {type: 'json'})
      WITH n, elementCount, setCount, propertyCount, jt
      RETURN
        n.uuid        AS handle,
        n.name        AS name,
        left(coalesce(n.content, ''), 200) AS description,
        jt.value      AS jsonTag,
        labels(n)     AS labels,
        elementCount,
        setCount,
        propertyCount
      ORDER BY n.name
    `);

    const summaries = rows.map(row => {
      let description = row.description || '';
      if (!description && row.jsonTag) {
        try {
          const parsed = JSON.parse(row.jsonTag);
          description = parsed.conceptHeader?.description || parsed.word?.name || '';
          description = description.slice(0, 200);
        } catch (_) {}
      }
      const { jsonTag, ...rest } = row;
      return { ...rest, description };
    });

    res.json({ success: true, count: summaries.length, summaries });
  } catch (err) {
    console.error('[concept-graph] summaries error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Full node ────────────────────────────────────────────────────────────────

async function handleNode(req, res) {
  const handle = decodeURIComponent(req.params.handle);
  try {
    const rows = await runCypher(`
      MATCH (n {uuid: $handle})
      OPTIONAL MATCH (n)-[:HAS_TAG]->(t:NostrEventTag)
      WITH n, collect({ type: t.type, value: t.value }) AS tags
      RETURN n, labels(n) AS labels, tags
    `, { handle });

    if (!rows.length) {
      return res.status(404).json({ success: false, error: `No node found with uuid: ${handle}` });
    }

    const row = rows[0];
    res.json({ success: true, node: { ...row.n, labels: row.labels, tags: row.tags } });
  } catch (err) {
    console.error('[concept-graph] node error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Neighbors ───────────────────────────────────────────────────────────────

async function handleNeighbors(req, res) {
  const handle = decodeURIComponent(req.params.handle);
  try {
    const rows = await runCypher(`
      MATCH (n {uuid: $handle})-[r]-(neighbor)
      WHERE NOT neighbor:NostrEventTag
      RETURN
        type(r)                       AS relationship,
        neighbor.uuid                 AS handle,
        neighbor.name                 AS name,
        labels(neighbor)              AS labels,
        left(neighbor.content, 150)   AS description
      ORDER BY relationship, neighbor.name
    `, { handle });

    // Group by relationship type
    const grouped = {};
    for (const row of rows) {
      const rel = row.relationship;
      if (!grouped[rel]) grouped[rel] = [];
      grouped[rel].push({
        handle: row.handle,
        name: row.name,
        labels: row.labels,
        description: row.description,
      });
    }

    res.json({ success: true, sourceHandle: handle, neighbors: grouped });
  } catch (err) {
    console.error('[concept-graph] neighbors error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Subgraph (BFS) ──────────────────────────────────────────────────────────

async function handleSubgraph(req, res) {
  const handle = decodeURIComponent(req.params.handle);
  const depth = Math.min(parseInt(req.query.depth, 10) || 1, 3);

  try {
    // Fetch root node summary
    const rootRows = await runCypher(`
      MATCH (n {uuid: $handle})
      RETURN n.uuid AS handle, n.name AS name, labels(n) AS labels,
             left(n.content, 200) AS description
    `, { handle });

    if (!rootRows.length) {
      return res.status(404).json({ success: false, error: `No node found with uuid: ${handle}` });
    }

    const root = { ...rootRows[0], children: {} };

    // BFS — each level fetches neighbors of all nodes collected in the prior level
    async function expand(node, remainingDepth) {
      if (remainingDepth <= 0) return;

      const neighborRows = await runCypher(`
        MATCH (n {uuid: $handle})-[r]-(neighbor)
        WHERE NOT neighbor:NostrEventTag
        RETURN
          type(r)                     AS relationship,
          neighbor.uuid               AS handle,
          neighbor.name               AS name,
          labels(neighbor)            AS labels,
          left(neighbor.content, 150) AS description
        ORDER BY relationship, neighbor.name
      `, { handle: node.handle });

      for (const row of neighborRows) {
        const rel = row.relationship;
        if (!node.children[rel]) node.children[rel] = [];
        const child = {
          handle: row.handle,
          name: row.name,
          labels: row.labels,
          description: row.description,
          children: {},
        };
        node.children[rel].push(child);
        await expand(child, remainingDepth - 1);
      }
    }

    await expand(root, depth);

    res.json({ success: true, depth, subgraph: root });
  } catch (err) {
    console.error('[concept-graph] subgraph error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ─── Router registration ─────────────────────────────────────────────────────

function registerConceptGraphRoutes(app) {
  app.get('/api/concept-graph/summaries',             handleSummaries);
  app.get('/api/concept-graph/node/:handle/neighbors', handleNeighbors);
  app.get('/api/concept-graph/node/:handle',           handleNode);
  app.get('/api/concept-graph/subgraph/:handle',       handleSubgraph);
}

module.exports = { registerConceptGraphRoutes };
