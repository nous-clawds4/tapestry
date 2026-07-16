import { useState, useEffect } from 'react';

/**
 * Story 14 — the notes a person has tagged. Reads /api/event-tags/notes-by-author
 * (Story 11 / ADR 0010): the kind-1 notes this author's event-taggings target,
 * enriched for NoteCard, each with `taggedWith` (the tag(s) they applied).
 */
const HEX64 = /^[0-9a-f]{64}$/;
export function useNotesByAuthor(authorPubkey, viewerPubkey) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!HEX64.test(authorPubkey || '')) { setNotes([]); return undefined; }
    let cancelled = false;
    setLoading(true); setError(null);
    (async () => {
      try {
        const params = new URLSearchParams({ authorPubkey });
        if (HEX64.test(viewerPubkey || '')) params.set('viewerPubkey', viewerPubkey);
        const r = await fetch(`/api/event-tags/notes-by-author?${params}`);
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!j.success) throw new Error(j.error || 'Failed to load tagged notes.');
        setNotes(Array.isArray(j.notes) ? j.notes : []);
      } catch (e) { if (!cancelled) setError(e?.message || String(e)); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [authorPubkey, viewerPubkey]);
  return { notes, loading, error };
}
export default useNotesByAuthor;
