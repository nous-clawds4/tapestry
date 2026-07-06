import { useState, useEffect } from 'react';

/**
 * Hook: the live type-aware applicability list for the tag picker (tag-applicability #2 /
 * ADR tag-applicability/0002). Fetches `GET /api/tags/applicability?type=&viewerPubkey=`, which
 * computes HINT ∪ USAGE live and viewer-inclusive, and returns the ordered `applicableKeys`
 * (`authorPubkey:slug`) the picker hard-filters its BROWSE view to. (Search still spans all tags —
 * that stays in AddTagDialog; this hook only supplies the browse ordering/filter set.)
 *
 * @param {'pubkey'|'event'} type
 * @param {string} [viewerPubkey] the signed-in user, so tags they just applied graduate immediately.
 * @returns {{ applicableKeys: string[], loading: boolean }}
 */
export default function useTagApplicability(type, viewerPubkey) {
  const [applicableKeys, setApplicableKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!type) { setLoading(false); return undefined; }
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ type });
    if (viewerPubkey) params.set('viewerPubkey', viewerPubkey);

    fetch(`/api/tags/applicability?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((json) => {
        if (json?.success && Array.isArray(json.members)) {
          setApplicableKeys(json.members.map((m) => `${m.authorPubkey}:${m.slug}`));
        } else {
          setApplicableKeys([]);
        }
      })
      .catch((err) => { if (err.name !== 'AbortError') setApplicableKeys([]); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [type, viewerPubkey]);

  return { applicableKeys, loading };
}
