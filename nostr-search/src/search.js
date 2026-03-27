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

app.use(express.static(join(__dirname, '..', 'public')));

app.get('/api/search', async (req, res) => {
  const { q, limit = 20, offset = 0 } = req.query;
  if (!q || !q.trim()) {
    return res.json({ hits: [], estimatedTotalHits: 0, processingTimeMs: 0 });
  }

  try {
    const result = await meili.index(INDEX_NAME).search(q.trim(), {
      limit: Math.min(parseInt(limit) || 20, 100),
      offset: parseInt(offset) || 0,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (_req, res) => {
  try {
    const stats = await meili.index(INDEX_NAME).getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`[api] Listening on http://localhost:${PORT}`);
});
