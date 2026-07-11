import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for the /pins page (Story 10 / ADR 0009). Fetches the viewer's
 * pinned-tag list from `/api/profile-tags/pins` when a viewer pubkey is
 * present; stays idle (empty pins) otherwise.
 */
export default function usePins(viewerPubkey) {
  const [pins, setPins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!viewerPubkey) {
      setPins([]);
      setError(null);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/profile-tags/pins?viewerPubkey=${encodeURIComponent(viewerPubkey)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (cancelled) return;
        if (r.ok && data?.success) {
          setPins(Array.isArray(data.pins) ? data.pins : []);
        } else {
          setError(data?.error || `status ${r.status}`);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [viewerPubkey, reloadKey]);

  return { pins, loading, error, refetch };
}
