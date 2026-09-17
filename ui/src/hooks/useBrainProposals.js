import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook: fetch the owner's open proposals from `/api/brain/proposals` (second-brain
 * #6, ADR 0006 d11/d12), and decide them (approve / skip-with-reason). Returns
 * { proposals, loading, error, refetch, approve, skip }.
 *
 * Mirrors useBrainGoals' fetch/poll/refetch/AbortController convention so a
 * proposal made in conversation appears in an open queue. approve/skip POST to the
 * gated normalize primitives (same-origin, owner session) and refetch on success —
 * a decided proposal leaves the queue (open-ness is derived server-side).
 */
const POLL_MS = 20000;

export default function useBrainProposals() {
  const [proposals, setProposals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const firstLoadDone = useRef(false);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    if (!firstLoadDone.current) setLoading(true);
    setError(null);

    fetch('/api/brain/proposals', { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && Array.isArray(json.proposals)) {
          setProposals(json.proposals);
        } else {
          setProposals(null);
          setError(json?.error || 'No data');
        }
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setProposals(null);
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

  const approve = useCallback(async (proposalId) => {
    const r = await fetch('/api/normalize/approve-proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId }),
    }).then((x) => x.json()).catch((e) => ({ success: false, error: e.message }));
    if (r?.success) refetch();
    return r;
  }, [refetch]);

  const skip = useCallback(async (proposalId, reason) => {
    const r = await fetch('/api/normalize/skip-proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId, reason }),
    }).then((x) => x.json()).catch((e) => ({ success: false, error: e.message }));
    if (r?.success) refetch();
    return r;
  }, [refetch]);

  return { proposals, loading, error, refetch, approve, skip };
}
