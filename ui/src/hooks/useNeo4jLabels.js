import { useState, useEffect } from 'react';

/**
 * Fetch all distinct node labels currently in Neo4j.
 * Excludes internal labels (NostrEventTag) by default.
 * Returns { labels: string[], loading: boolean, error: string|null }
 */
const EXCLUDE_LABELS = ['NostrEventTag'];

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 60000; // 1 minute

export default function useNeo4jLabels() {
  const [labels, setLabels] = useState(_cache || []);
  const [loading, setLoading] = useState(!_cache);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Use cache if fresh
    if (_cache && Date.now() - _cacheTime < CACHE_TTL) {
      setLabels(_cache);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    fetch('/api/neo4j/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cypher: `CALL db.labels() YIELD label RETURN label ORDER BY label`,
      }),
      signal: controller.signal,
    })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          const all = d.data
            .map(row => row.label)
            .filter(l => !EXCLUDE_LABELS.includes(l));
          _cache = all;
          _cacheTime = Date.now();
          setLabels(all);
        } else {
          setError(d.error || 'Failed to fetch labels');
        }
      })
      .catch(e => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  return { labels, loading, error };
}
