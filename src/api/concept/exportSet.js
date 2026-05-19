/**
 * Story #9 / ADR 0004 — Publish/export a concept (Concept-Graph-rooted).
 *
 * GET /api/concept/:handle/export-set   (owner-only)
 *
 * Enumerates a concept's OWN-authored constituent events so the owner UI can
 * re-publish them via the existing browser `publishEverywhere` primitive
 * (ADR 0004 Option A — no server-side external publisher).
 *
 * Concept-Graph-rooted: from the ConceptHeader we gather the class thread
 * (Superset → IS_A_SUPERSET_OF* → Sets → elements) plus the core nodes
 * (schema, primary property, properties set, the 3 graph nodes incl. the
 * Concept Graph node). Provenance principle (AC-2): only events whose
 * `pubkey` is THIS instance's TA are returned — you never re-export someone
 * else's concept under your identity. The events come straight from strfry,
 * which is the portable signed form (no `graphContext` — that lives only in
 * the Neo4j/JSON layer, never in the signed event).
 */

const { exec } = require('child_process');
const { runCypher } = require('../../lib/neo4j-driver');
const { getOwnerAssistantPubkey } = require('../../utils/assistantKeys');

function strfryScan(filter) {
  return new Promise((resolve, reject) => {
    const safeFilter = JSON.stringify(filter).replace(/'/g, "'\\''");
    exec(`strfry scan '${safeFilter}'`, { maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
      if (error) return reject(error);
      const events = [];
      for (const line of String(stdout).trim().split('\n')) {
        if (!line) continue;
        try { events.push(JSON.parse(line)); } catch {}
      }
      resolve(events);
    });
  });
}

async function handleConceptExportSet(req, res) {
  try {
    const handle = decodeURIComponent(req.params.handle || '');
    if (!handle) {
      return res.status(400).json({ success: false, error: 'handle is required' });
    }

    const taPubkey = getOwnerAssistantPubkey();
    if (!taPubkey) {
      return res.status(500).json({ success: false, error: 'TA pubkey unavailable' });
    }

    // Concept-Graph-rooted traversal: header + class thread + core nodes.
    const rows = await runCypher(
      `
      MATCH (h:ListHeader {uuid: $handle})
      OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(s:Superset)
      OPTIONAL MATCH (h)-[:IS_THE_CONCEPT_FOR]->(:Superset)-[:IS_A_SUPERSET_OF*0..6]->(ss)
      OPTIONAL MATCH (ss)-[:HAS_ELEMENT]->(elem)
      OPTIONAL MATCH (core)-[:IS_THE_JSON_SCHEMA_FOR|IS_THE_PRIMARY_PROPERTY_FOR|IS_THE_PROPERTIES_SET_FOR|IS_THE_PROPERTY_TREE_GRAPH_FOR|IS_THE_CORE_GRAPH_FOR|IS_THE_CONCEPT_GRAPH_FOR]->(h)
      WITH collect(DISTINCT h) + collect(DISTINCT s) + collect(DISTINCT ss) + collect(DISTINCT elem) + collect(DISTINCT core) AS ns
      UNWIND ns AS n
      WITH DISTINCT n
      WHERE n IS NOT NULL AND n.pubkey = $taPubkey AND n.id IS NOT NULL
      RETURN n.id AS id, n.uuid AS uuid
      `,
      { handle, taPubkey }
    );

    const ids = [...new Set(rows.map((r) => r.id).filter(Boolean))];
    if (ids.length === 0) {
      return res.json({ success: true, count: 0, events: [], note: 'no own-authored events for this concept' });
    }

    const events = await strfryScan({ ids });
    res.json({ success: true, count: events.length, events });
  } catch (err) {
    console.error('[concept/export-set]', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = { handleConceptExportSet };
