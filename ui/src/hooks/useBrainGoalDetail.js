import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook: fetch one goal's one-spine detail from `/api/brain/goals/:slug`
 * (second-brain #4, ADR 0004 d5). Returns
 * { goal, pointers, records, loading, error, refetch }.
 *
 * Mirrors useBrainGoals' fetch/poll/refetch/AbortController convention so a
 * resource attached or verified in conversation appears in an open detail view.
 * `goal` is null for an unknown slug (an empty state, not an error); `records`
 * is present-but-empty until stories 5–7 add producers.
 */
const POLL_MS = 20000;

export default function useBrainGoalDetail(slug) {
  const [goal, setGoal] = useState(null);
  const [pointers, setPointers] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const firstLoadDone = useRef(false);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!slug) return undefined;
    const controller = new AbortController();
    if (!firstLoadDone.current) setLoading(true);
    setError(null);

    fetch(`/api/brain/goals/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success) {
          setGoal(json.goal || null);
          setPointers(Array.isArray(json.pointers) ? json.pointers : []);
          setRecords(Array.isArray(json.records) ? json.records : []);
        } else {
          setGoal(null);
          setPointers([]);
          setRecords([]);
          setError(json?.error || 'No data');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setGoal(null);
        setPointers([]);
        setRecords([]);
        setError(err.message || 'Fetch failed');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          firstLoadDone.current = true;
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [tick, slug]);

  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === 'visible') refetch();
    };
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onWake);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refetch();
    }, POLL_MS);
    return () => {
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onWake);
      clearInterval(interval);
    };
  }, [refetch]);

  return { goal, pointers, records, loading, error, refetch };
}
