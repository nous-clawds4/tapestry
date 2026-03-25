/**
 * Tapestry Key API — manage tapestryKey, tapestryJSON, and tapestryJsonUpdatedAt
 * on Neo4j nodes, backed by the LMDB tapestry-store.
 *
 * Endpoints:
 *   GET  /api/tapestry-key/status         — count of initialized vs uninitialized nodes
 *   POST /api/tapestry-key/initialize     — assign tapestryKey to all nodes that lack one
 *   GET  /api/tapestry-key/:key           — fetch tapestryJSON from LMDB by tapestryKey
 *   POST /api/tapestry-key/:key           — write tapestryJSON to LMDB and update Neo4j timestamp
 */

const crypto = require('crypto');
const { runCypher, writeCypher } = require('../../lib/neo4j-driver');
const store = require('../../lib/tapestry-store');
const { toLmdbRef } = require('../../lib/tapestry-resolve');
const { deriveByKey, deriveAll, registeredLabels } = require('../../lib/tapestry-derive');
const { registerAll } = require('../../lib/derivers');

// Register all derivers on first load
registerAll();

/**
 * Generate a v4 UUID.
 */
function uuidv4() {
  return crypto.randomUUID();
}

// ── Status ──

/**
 * GET /api/tapestry-key/status
 * Returns counts of nodes with/without tapestryKey.
 */
async function handleStatus(req, res) {
  try {
    const rows = await runCypher(`
      MATCH (n)
      WHERE n.uuid IS NOT NULL OR n.id IS NOT NULL
      WITH n,
           CASE WHEN n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}' THEN true ELSE false END AS initialized
      RETURN initialized, count(n) AS count
    `);

    const result = { initialized: 0, uninitialized: 0, total: 0 };
    for (const row of rows) {
      if (row.initialized) {
        result.initialized = Number(row.count);
      } else {
        result.uninitialized = Number(row.count);
      }
    }
    result.total = result.initialized + result.uninitialized;

    // For each initialized node, check its LMDB status
    let lmdbDerived = 0, lmdbEmpty = 0, lmdbMissing = 0;
    if (result.initialized > 0) {
      const keyRows = await runCypher(`
        MATCH (n)
        WHERE n.tapestryKey IS NOT NULL AND n.tapestryKey <> '{}'
        RETURN n.tapestryKey AS tk
      `);
      for (const row of keyRows) {
        const entry = store.get(row.tk);
        if (!entry) {
          lmdbMissing++;
        } else {
          const data = entry.data;
          if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
            lmdbEmpty++;
          } else {
            lmdbDerived++;
          }
        }
      }
    }
    result.lmdb = {
      derived: lmdbDerived,
      empty: lmdbEmpty,
      missing: lmdbMissing,
    };

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[tapestry-key] status error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Initialize ──

/**
 * POST /api/tapestry-key/initialize
 * Assigns a tapestryKey (v4 UUID) and tapestryJSON='{}' to every node
 * that doesn't already have a tapestryKey (or has tapestryKey='{}').
 * Returns the count of nodes initialized.
 */
async function handleInitialize(req, res) {
  try {
    // Find all nodes without a real tapestryKey
    const nodes = await runCypher(`
      MATCH (n)
      WHERE (n.uuid IS NOT NULL OR n.id IS NOT NULL)
        AND (n.tapestryKey IS NULL OR n.tapestryKey = '{}')
      RETURN elementId(n) AS elementId
    `);

    if (nodes.length === 0) {
      return res.json({ success: true, data: { initialized: 0, message: 'All nodes already have a tapestryKey.' } });
    }

    // Assign keys in batches of 500
    const BATCH_SIZE = 500;
    let total = 0;

    for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
      const batch = nodes.slice(i, i + BATCH_SIZE);
      const assignments = batch.map(n => ({
        elementId: n.elementId,
        tapestryKey: uuidv4(),
      }));

      await writeCypher(`
        UNWIND $assignments AS a
        MATCH (n) WHERE elementId(n) = a.elementId
        SET n.tapestryKey = a.tapestryKey,
            n.tapestryJsonUpdatedAt = null
      `, { assignments });

      total += batch.length;
    }

    res.json({ success: true, data: { initialized: total } });
  } catch (err) {
    console.error('[tapestry-key] initialize error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Get tapestryJSON ──

/**
 * GET /api/tapestry-key/:key
 * Fetch a tapestryJSON entry from LMDB.
 */
function handleGet(req, res) {
  try {
    const { key } = req.params;
    const entry = store.get(key);
    if (!entry) {
      return res.status(404).json({ success: false, error: 'Not found in LMDB' });
    }
    res.json({ success: true, data: entry });
  } catch (err) {
    console.error('[tapestry-key] get error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Put tapestryJSON ──

/**
 * POST /api/tapestry-key/:key
 * Write tapestryJSON to LMDB and update tapestryJsonUpdatedAt in Neo4j.
 * Body: { data: { ... }, rebuiltFrom?: string }
 */
async function handlePut(req, res) {
  try {
    const { key } = req.params;
    const { data, rebuiltFrom } = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ success: false, error: 'Request body must include a "data" object.' });
    }

    // Write to LMDB
    const meta = rebuiltFrom ? { rebuiltFrom } : {};
    const envelope = store.put(key, data, meta);

    // Update Neo4j timestamp
    await writeCypher(`
      MATCH (n { tapestryKey: $key })
      SET n.tapestryJsonUpdatedAt = $ts
    `, { key, ts: envelope.updatedAt });

    res.json({ success: true, data: envelope });
  } catch (err) {
    console.error('[tapestry-key] put error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Offload ──

/**
 * POST /api/tapestry-key/offload
 * Move a NostrEventTag's inline value into LMDB, replacing it with an lmdb: pointer.
 *
 * Body: { elementId: string }
 *   elementId: the Neo4j elementId of the NostrEventTag node to offload
 *
 * The tag must have type="json" and an inline (non-lmdb:) value.
 * The parent NostrEvent's tapestryKey is used as the LMDB key.
 */
async function handleOffload(req, res) {
  try {
    const { elementId } = req.body;
    if (!elementId) {
      return res.status(400).json({ success: false, error: 'elementId is required.' });
    }

    // Fetch the tag and its parent event's tapestryKey
    const rows = await runCypher(`
      MATCH (ev)-[:HAS_TAG]->(tag)
      WHERE elementId(tag) = $elementId AND tag.type = 'json'
      RETURN tag.value AS value, ev.tapestryKey AS tapestryKey, elementId(tag) AS tagId
    `, { elementId });

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'NostrEventTag not found or not type=json.' });
    }

    const { value, tapestryKey } = rows[0];

    if (!tapestryKey) {
      return res.status(400).json({ success: false, error: 'Parent NostrEvent has no tapestryKey. Run initialize first.' });
    }

    if (typeof value === 'string' && value.startsWith('lmdb:')) {
      return res.json({ success: true, data: { alreadyOffloaded: true, tapestryKey } });
    }

    // Parse the inline JSON
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      return res.status(400).json({ success: false, error: 'Tag value is not valid JSON.' });
    }

    // Write to LMDB
    const envelope = await store.put(tapestryKey, parsed, { rebuiltFrom: 'offload' });

    // Replace inline value with LMDB pointer
    const ref = toLmdbRef(tapestryKey);
    await writeCypher(`
      MATCH (tag) WHERE elementId(tag) = $elementId
      SET tag.value = $ref
    `, { elementId, ref });

    // Update parent's timestamp
    await writeCypher(`
      MATCH (n { tapestryKey: $tapestryKey })
      SET n.tapestryJsonUpdatedAt = $ts
    `, { tapestryKey, ts: envelope.updatedAt });

    res.json({ success: true, data: { tapestryKey, lmdbRef: ref, updatedAt: envelope.updatedAt } });
  } catch (err) {
    console.error('[tapestry-key] offload error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Resolve ──

/**
 * GET /api/tapestry-key/resolve/:key
 * Resolve a tapestryKey: if LMDB has an entry, return it.
 * If not, check if the node has a json tag and return that inline value.
 * This provides a unified read path regardless of storage location.
 */
async function handleResolve(req, res) {
  try {
    const { key } = req.params;

    // Try LMDB first
    const entry = store.get(key);
    if (entry) {
      return res.json({ success: true, source: 'lmdb', data: entry });
    }

    // Fall back to inline json tag
    const rows = await runCypher(`
      MATCH (n { tapestryKey: $key })-[:HAS_TAG]->(tag { type: 'json' })
      RETURN tag.value AS value
      LIMIT 1
    `, { key });

    if (rows.length > 0 && rows[0].value) {
      try {
        const parsed = JSON.parse(rows[0].value);
        return res.json({ success: true, source: 'inline', data: { data: parsed } });
      } catch {
        return res.json({ success: true, source: 'inline-raw', data: { data: rows[0].value } });
      }
    }

    res.status(404).json({ success: false, error: 'No tapestryJSON found (LMDB or inline).' });
  } catch (err) {
    console.error('[tapestry-key] resolve error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Bulk Offload ──

/**
 * POST /api/tapestry-key/offload-all
 * Offload all inline json tags to LMDB in one batch.
 * Returns count of tags offloaded.
 */
async function handleOffloadAll(req, res) {
  try {
    // Find all json tags that are still inline (not lmdb: prefixed)
    const tags = await runCypher(`
      MATCH (ev)-[:HAS_TAG]->(tag {type: 'json'})
      WHERE NOT tag.value STARTS WITH 'lmdb:'
        AND ev.tapestryKey IS NOT NULL
      RETURN elementId(tag) AS tagId, tag.value AS value, ev.tapestryKey AS tapestryKey
    `);

    if (tags.length === 0) {
      return res.json({ success: true, data: { offloaded: 0, message: 'All json tags are already offloaded.' } });
    }

    let offloaded = 0;
    let errors = 0;

    for (const { tagId, value, tapestryKey } of tags) {
      try {
        const parsed = JSON.parse(value);
        const envelope = await store.put(tapestryKey, parsed, { rebuiltFrom: 'offload-all' });
        const ref = toLmdbRef(tapestryKey);

        await writeCypher(`
          MATCH (tag) WHERE elementId(tag) = $tagId
          SET tag.value = $ref
        `, { tagId, ref });

        await writeCypher(`
          MATCH (n { tapestryKey: $tapestryKey })
          SET n.tapestryJsonUpdatedAt = $ts
        `, { tapestryKey, ts: envelope.updatedAt });

        offloaded++;
      } catch (err) {
        console.error(`[tapestry-key] offload-all: failed for tag ${tagId}:`, err.message);
        errors++;
      }
    }

    res.json({ success: true, data: { offloaded, errors, total: tags.length } });
  } catch (err) {
    console.error('[tapestry-key] offload-all error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/tapestry-key/offload-status
 * Return counts of inline vs offloaded json tags.
 */
async function handleOffloadStatus(req, res) {
  try {
    const rows = await runCypher(`
      MATCH (ev)-[:HAS_TAG]->(tag {type: 'json'})
      WITH tag,
           CASE WHEN tag.value STARTS WITH 'lmdb:' THEN true ELSE false END AS offloaded
      RETURN offloaded, count(tag) AS count
    `);

    const result = { inline: 0, offloaded: 0, total: 0 };
    for (const row of rows) {
      if (row.offloaded) {
        result.offloaded = Number(row.count);
      } else {
        result.inline = Number(row.count);
      }
    }
    result.total = result.inline + result.offloaded;

    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[tapestry-key] offload-status error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Derive ──

/**
 * POST /api/tapestry-key/derive/:key
 * Derive tapestryJSON for a single node by its tapestryKey.
 */
async function handleDerive(req, res) {
  try {
    const { key } = req.params;
    const result = await deriveByKey(key);
    if (!result) {
      return res.status(404).json({ success: false, error: 'Node not found or no deriver for its type.' });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[tapestry-key] derive error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * POST /api/tapestry-key/derive-all/:label
 * Derive tapestryJSON for all nodes with the given label.
 */
async function handleDeriveAll(req, res) {
  try {
    const { label } = req.params;
    const result = await deriveAll(label);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('[tapestry-key] derive-all error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/tapestry-key/derive-status
 * List registered derivers and counts of derived vs underived nodes per label.
 */
async function handleDeriveStatus(req, res) {
  try {
    const labels = registeredLabels();
    const status = [];

    for (const label of labels) {
      const rows = await runCypher(`
        MATCH (n:${label})
        WHERE n.tapestryKey IS NOT NULL
        WITH n,
             CASE WHEN n.tapestryJsonUpdatedAt IS NOT NULL THEN true ELSE false END AS derived
        RETURN derived, count(n) AS count
      `);

      const entry = { label, derived: 0, underived: 0, total: 0 };
      for (const row of rows) {
        if (row.derived) entry.derived = Number(row.count);
        else entry.underived = Number(row.count);
      }
      entry.total = entry.derived + entry.underived;
      status.push(entry);
    }

    res.json({ success: true, data: status });
  } catch (err) {
    console.error('[tapestry-key] derive-status error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

// ── Route Registration ──

function registerTapestryKeyRoutes(app) {
  app.get('/api/tapestry-key/status', handleStatus);
  app.post('/api/tapestry-key/initialize', handleInitialize);
  app.get('/api/tapestry-key/offload-status', handleOffloadStatus);
  app.post('/api/tapestry-key/offload', handleOffload);
  app.post('/api/tapestry-key/offload-all', handleOffloadAll);
  app.get('/api/tapestry-key/derive-status', handleDeriveStatus);
  app.post('/api/tapestry-key/derive-all/:label', handleDeriveAll);
  app.post('/api/tapestry-key/derive/:key', handleDerive);
  app.get('/api/tapestry-key/resolve/:key', handleResolve);
  app.get('/api/tapestry-key/:key', handleGet);
  app.post('/api/tapestry-key/:key', handlePut);
}

module.exports = {
  registerTapestryKeyRoutes,
  handleStatus, handleInitialize, handleGet, handlePut,
  handleOffload, handleOffloadAll, handleOffloadStatus, handleResolve,
};
