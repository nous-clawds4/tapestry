import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePov } from '../context/PovContext';

/**
 * Hook for the authored-tagging section on profile pages
 * (Story 5 / ADR-0005). Fetches /api/profile-tags/authored-by gated on the
 * auth-bootstrap (mirrors useTagDetail / useTagIndex). Read-only — Story 5
 * has no publish path on this surface, so no refetch is exposed.
 */
export default function useAuthoredTagging(profilePubkey) {
  const { user, loading: authLoading } = useAuth();
  const { povParams } = usePov();

  const [sort, setSort] = useState('recent');
  const [rows, setRows] = useState([]);
  const [povSuffix, setPovSuffix] = useState(null);
  const [povResolution, setPovResolution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading || !profilePubkey) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ authorPubkey: profilePubkey, sort });
    // Selected-POV read params (ADR pov-selectable-tag-surfaces/0001).
    Object.entries(povParams).forEach(([k, v]) => params.set(k, v));

    fetch(`/api/profile-tags/authored-by?${params}`)
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (cancelled) return;
        if (r.ok && data?.success) {
          setRows(data.rows || []);
          setPovSuffix(data.povSuffix || null);
          setPovResolution(data.povResolution || null);
        } else {
          setError(data?.error || `status ${r.status}`);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [profilePubkey, sort, authLoading, user?.pubkey, povParams.wotPov, povParams.userPubkey]);

  return { rows, sort, setSort, povSuffix, povResolution, loading, error };
}
