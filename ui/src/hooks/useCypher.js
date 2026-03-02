import { useState, useEffect } from 'react';
import { cypher } from '../api/cypher';

/**
 * React hook for running Cypher queries.
 * @param {string} query - Cypher query (null/undefined to skip)
 * @param {Array} deps - Additional dependencies to re-run the query
 * @returns {{ data: Array, loading: boolean, error: Error|null, refetch: Function }}
 */
export function useCypher(query, deps = []) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(!!query);
  const [error, setError] = useState(null);

  async function fetchData() {
    if (!query) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await cypher(query);
      setData(rows);
    } catch (err) {
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [query, ...deps]);

  return { data, loading, error, refetch: fetchData };
}
