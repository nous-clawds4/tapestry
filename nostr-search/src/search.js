import express from 'express';
import { MeiliSearch } from 'meilisearch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3069');
const MEILI_URL = process.env.MEILI_URL || 'http://localhost:7700';
const INDEX_NAME = 'profiles';

const meili = new MeiliSearch({ host: MEILI_URL });
const app = express();

// Will be set by startup.js after ingest module loads
let ingestModule = null;
export function setIngestModule(mod) {
  ingestModule = mod;
}

app.use(express.static(join(__dirname, '..', 'public')));

app.get('/api/search', async (req, res) => {
  const { q, limit = 20, offset = 0 } = req.query;
  if (!q || !q.trim()) {
    return res.json({ hits: [], estimatedTotalHits: 0, processingTimeMs: 0 });
  }

  try {
    const maxLimit = Math.min(parseInt(limit) || 100, 200);
    const parsedOffset = parseInt(offset) || 0;
    const { sort: sortParam, wotFilter, wotFilters: wotFiltersParam } = req.query;

    const sortRules = sortParam ? [sortParam] : ['wot_followers:desc'];

    // Parse WoT filter config from preferences
    let wotFilterConfig = {};
    try { if (wotFiltersParam) wotFilterConfig = JSON.parse(wotFiltersParam); } catch {}

    // Build Meilisearch filter expression from enabled filters
    // Null scores are treated as 0, so "wot_rank > 0" effectively filters them out
    const filterParts = [];
    for (const [metric, cfg] of Object.entries(wotFilterConfig)) {
      if (cfg?.enabled && cfg.cutoff > 0) {
        filterParts.push(`wot_${metric} >= ${cfg.cutoff}`);
      }
    }

    // Two-phase search: scored results first (sorted by followers), then unscored backfill
    let result;
    if (wotFilter === 'false') {
      // Explicitly no WoT filtering
      result = await meili.index(INDEX_NAME).search(q.trim(), {
        limit: maxLimit, offset: parsedOffset, sort: sortRules,
      });
    } else {
      // Phase 1: search WoT-scored profiles with filters applied
      const phase1Filter = filterParts.length > 0
        ? filterParts.join(' AND ')
        : 'wot_followers > 0';
      const wotResult = await meili.index(INDEX_NAME).search(q.trim(), {
        limit: maxLimit, offset: parsedOffset, sort: sortRules,
        filter: phase1Filter,
      });

      // Re-sort scored results explicitly (Meilisearch sort is a tiebreaker
      // within text-relevance tiers, so we re-sort to guarantee order)
      const sortField = sortParam ? sortParam.split(':')[0] : 'wot_followers';
      const ascending = sortParam?.includes(':asc');
      const sortedWot = [...wotResult.hits].sort((a, b) => {
        const diff = (b[sortField] || 0) - (a[sortField] || 0); // descending by default
        return ascending ? -diff : diff;
      });

      // If filters are active, null/missing scores = 0, so unscored profiles
      // should NOT appear (they fail the filter). Only backfill when no filters are set.
      const hasActiveFilters = filterParts.length > 0;
      let merged;

      if (hasActiveFilters) {
        // Filters active: only show results that passed the filter
        merged = sortedWot.slice(0, maxLimit);
      } else {
        // No filters: backfill with unscored results after scored ones
        const allResult = await meili.index(INDEX_NAME).search(q.trim(), {
          limit: maxLimit, offset: parsedOffset,
        });
        const seenIds = new Set(sortedWot.map(h => h.id));
        const unscoredHits = allResult.hits.filter(h => !seenIds.has(h.id));
        merged = [...sortedWot, ...unscoredHits].slice(0, maxLimit);
      }

      result = {
        hits: merged,
        query: q.trim(),
        processingTimeMs: wotResult.processingTimeMs || 0,
        estimatedTotalHits: wotResult.estimatedTotalHits,
        _wotCount: wotResult.hits.length,
        _filtered: hasActiveFilters,
      };
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (_req, res) => {
  try {
    const meiliStats = await meili.index(INDEX_NAME).getStats();
    const ingestStats = ingestModule ? ingestModule.getIngestStats() : null;
    res.json({ ...meiliStats, ingest: ingestStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/resync — trigger re-ingestion from strfry.
 * Reconnects to the relay and re-fetches all kind 0 events.
 */
app.post('/api/resync', (req, res) => {
  if (!ingestModule) {
    return res.status(503).json({ error: 'Ingester not available' });
  }
  const result = ingestModule.resync();
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`[api] Listening on http://localhost:${PORT}`);
});

/**
 * POST /api/bulk-ingest — trigger full re-index of all kind 0 profiles from strfry.
 * Streams via /api/strfry/scan/stream to avoid memory limits.
 */
let bulkIngestModule = null;
export function setBulkIngestModule(mod) {
  bulkIngestModule = mod;
}

app.post('/api/bulk-ingest', async (req, res) => {
  if (!bulkIngestModule) {
    return res.status(503).json({ error: 'Bulk ingest module not loaded' });
  }
  // Don't await — return immediately, ingest runs in background
  const status = bulkIngestModule.getBulkStatus();
  if (status.status === 'fetching' || status.status === 'indexing') {
    return res.json({ status: 'already_running', ...status });
  }
  bulkIngestModule.runBulkIngest().catch(err => console.error('[bulk-ingest] Unhandled:', err));
  res.json({ status: 'started' });
});

app.get('/api/bulk-ingest/status', (req, res) => {
  if (!bulkIngestModule) {
    return res.json({ status: 'idle' });
  }
  res.json(bulkIngestModule.getBulkStatus());
});

/**
 * POST /api/load-scores — batch-upsert WoT scores into the profiles index.
 * Body: { povPubkey, metrics: ["rank", "followers"], scores: [{ pubkey, wot_rank, wot_followers }, ...] }
 *
 * This upserts documents by primary key (pubkey). If the profile already exists,
 * the score fields are merged in. If not, a document is created with just the scores
 * (kind 0 profile fields will be filled in when the profile is eventually ingested).
 */
app.post('/api/load-scores', express.json({ limit: '50mb' }), async (req, res) => {
  const { povPubkey, metrics, scores } = req.body;

  if (!scores || !Array.isArray(scores) || scores.length === 0) {
    return res.status(400).json({ error: 'No scores provided' });
  }

  try {
    const index = meili.index(INDEX_NAME);

    // Ensure WoT fields are filterable and sortable
    const wotFields = metrics.map(m => `wot_${m}`);
    const currentSettings = await index.getSettings();

    const filterableSet = new Set(currentSettings.filterableAttributes || []);
    const sortableSet = new Set(currentSettings.sortableAttributes || []);
    let settingsChanged = false;

    for (const field of [...wotFields, 'wot_pov']) {
      if (!filterableSet.has(field)) { filterableSet.add(field); settingsChanged = true; }
      if (!sortableSet.has(field)) { sortableSet.add(field); settingsChanged = true; }
    }

    if (settingsChanged) {
      await index.updateSettings({
        filterableAttributes: [...filterableSet],
        sortableAttributes: [...sortableSet],
      });
      console.log(`[meili] Updated filterable/sortable: ${wotFields.join(', ')}`);
    }

    // Prepare documents: each score becomes an upsert on the pubkey
    const docs = scores.map(s => ({
      id: s.pubkey,
      ...s,
      wot_pov: povPubkey,
      wot_updated_at: Math.floor(Date.now() / 1000),
    }));

    // Batch PARTIAL update in chunks (merges with existing profile data, doesn't overwrite)
    const CHUNK = 5000;
    let totalProcessed = 0;
    for (let i = 0; i < docs.length; i += CHUNK) {
      const chunk = docs.slice(i, i + CHUNK);
      await index.updateDocuments(chunk, { primaryKey: 'id' });
      totalProcessed += chunk.length;
    }

    console.log(`[meili] Loaded ${totalProcessed} WoT scores (${wotFields.join(', ')}) from POV ${povPubkey?.slice(0, 12)}...`);

    res.json({
      loaded: totalProcessed,
      metrics: wotFields,
      povPubkey,
    });
  } catch (err) {
    console.error('[meili] load-scores error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export { app };
