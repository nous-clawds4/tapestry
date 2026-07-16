import { useState, useEffect, useRef } from 'react';
import { usePov } from '../context/PovContext';

/**
 * Story 8 — the notes tagged with a tag (forward discovery). Reads
 * `/api/event-tags/for-tag` (ADR 0008): POV-counted notes UNION the viewer's own
 * (`mine`, trust-unfiltered, Story-7 analogue), enriched and ready for NoteCard.
 *
 * @param {string} tagAuthorPubkey  the tag-element author (`tag.authorPubkey`).
 * @param {string} slug             the tag slug.
 * @param {string} [viewerPubkey]   the logged-in viewer (so their own tagged notes show).
 * @param {string} [sort]           server-side sort (Story 15): recent|applied|disputed|divisive.
 * @returns {{ notes: object[], total: number, truncated: boolean, loading: boolean, error: string|null }}
 */
const HEX64 = /^[0-9a-f]{64}$/;

export function useNotesForTag(tagAuthorPubkey, slug, viewerPubkey, sort = 'recent') {
  const { povParams } = usePov();
  const [notes, setNotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Story 16 — bump to force a re-fetch (e.g. after "+ Tag a Note" publishes,
  // so the freshly-tagged note appears in the list). refetch() busts the server's
  // 30s for-tag cache on that one fetch so the new tag shows live, not after TTL.
  const [nonce, setNonce] = useState(0);
  const bustNextRef = useRef(false);

  useEffect(() => {
    if (!HEX64.test(tagAuthorPubkey || '') || !slug) { setNotes([]); return undefined; }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const params = new URLSearchParams({ tagAuthor: tagAuthorPubkey, slug });
        // Gate amendment (ADR pov-selectable-tag-surfaces/0002): thread the
        // selected POV into the notes read so the tag page's notes are POV-filtered
        // in step with its profiles (Story-1 completeness), not house-only.
        Object.entries(povParams).forEach(([k, v]) => params.set(k, v));
        if (HEX64.test(viewerPubkey || '')) params.set('viewerPubkey', viewerPubkey);
        if (sort) params.set('sort', sort);
        // Only the refetch-triggered fetch bypasses the cache; normal loads
        // (mount, sort/filter changes) stay cached.
        if (bustNextRef.current) { params.set('nocache', '1'); bustNextRef.current = false; }
        const r = await fetch(`/api/event-tags/for-tag?${params}`);
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!j.success) throw new Error(j.error || 'Failed to load notes for this tag.');
        setNotes(Array.isArray(j.notes) ? j.notes : []);
        setTotal(typeof j.total === 'number' ? j.total : (j.notes || []).length);
        setTruncated(!!j.truncated);
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tagAuthorPubkey, slug, viewerPubkey, sort, nonce, povParams.wotPov, povParams.userPubkey]);

  const refetch = () => { bustNextRef.current = true; setNonce((n) => n + 1); };
  return { notes, total, truncated, loading, error, refetch };
}

export default useNotesForTag;
