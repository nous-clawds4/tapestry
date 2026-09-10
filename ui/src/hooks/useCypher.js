import { useState, useEffect } from 'react';
import { cypher } from '../api/cypher';

/**
 * React hook for running Cypher queries.
 * @param {string} query - Cypher query (null/undefined to skip)
 * @param {Array} deps - Additional dependencies to re-run the query
 * @param {Object} [params] - Cypher parameters ($-placeholders). Prefer these over
 *   interpolating values into `query`: the server decides read-vs-write by regex-testing
 *   the query TEXT, so an interpolated handle like `…:set` reads as a write and 403s for
 *   unauthenticated callers (ADR graph-curation-ui/0003 Amendment 1).
 * @returns {{ data: Array, loading: boolean, error: Error|null, refetch: Function }}
 */
export function useCypher(query, deps = [], params = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(!!query);
  const [error, setError] = useState(null);

  async function fetchData() {
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await cypher(query, params);
      setData(rows);
    } catch (err) {
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  // `params` is serialized into the dependency list on purpose. A parameterized
  // query's TEXT is constant across subjects — ui/src/utils/conceptCounts.js is
  // the same string for every concept — so depending on `query` alone would not
  // refetch when the caller changes only the params, and the page would keep
  // showing the previous subject's data. (ADR graph-curation-ui/0003 Amendment 1.)
  useEffect(() => {
    fetchData();
  }, [query, JSON.stringify(params), ...deps]);

  return { data, loading, error, refetch: fetchData };
}
