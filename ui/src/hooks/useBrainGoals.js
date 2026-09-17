import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook: fetch the owner's goals from `/api/brain/goals` (second-brain #1,
 * ADR 0001 decision 5). Returns { goals, loading, error, refetch }.
 *
 * Refetches on window focus / visibility and polls lightly while the tab is
 * visible, so a capture made in conversation appears in an open Goals view
 * (the design guide's new-row highlight rides these refreshes). Mirrors the
 * useGrapevineFollows fetch convention (AbortController cleanup).
 */
const POLL_MS = 20000;

export default function useBrainGoals() {
  const [goals, setGoals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const firstLoadDone = useRef(false);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    if (!firstLoadDone.current) setLoading(true);
    setError(null);

    fetch('/api/brain/goals', { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && Array.isArray(json.goals)) {
          setGoals(json.goals);
        } else {
          setGoals(null);
          setError(json?.error || 'No data');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setGoals(null);
        setError(err.message || 'Fetch failed');
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          firstLoadDone.current = true;
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [tick]);

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

  return { goals, loading, error, refetch };
}
