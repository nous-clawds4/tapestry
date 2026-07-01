import { useState, useEffect, useCallback } from 'react';
import { curateNotes } from '@tapestry/event-tagging';
import { computeNoteBookmarkDTag } from '../utils/publishTagPin';

/**
 * Story 12 item #3 — read back the viewer's OWN published note bookmark set
 * (kind-30003, `notes-pin-…` d-tag) for the Pinned tab, and compute its DRIFT
 * against the live curated set — the note analog of the profile export's
 * `diffVsTL` status.
 *
 * One `for-tag` call serves both: the live enriched notes render the snapshot
 * (best-effort: a snapshot note that's since dropped out of the tag's returned
 * set — e.g. beyond NOTES_CAP or deleted — won't render but is counted as
 * `removed`), and `curateNotes(live, noteMethod)` gives the current curated ids
 * for the diff.
 *
 * @returns {{ pinned, notes, drift, loading, error, refetch }}
 *   pinned = { eventId, createdAt, ids:[] } | null   (null → not pinned-with-notes)
 *   notes  = enriched snapshot notes still resolvable (NoteCard-ready)
 *   drift  = { added, removed } | null               (null when not pinned)
 */
const HEX64 = /^[0-9a-f]{64}$/;

export default function usePinnedNotes(tag, viewerPubkey, noteMethod = 'notes:net-endorsed') {
  const [pinned, setPinned] = useState(null);
  const [notes, setNotes] = useState([]);
  const [drift, setDrift] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!tag?.authorPubkey || !tag?.slug || !HEX64.test(viewerPubkey || '')) {
      setPinned(null); setNotes([]); setDrift(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const dTag = computeNoteBookmarkDTag({ viewerPubkey, tagAuthorPubkey: tag.authorPubkey, tagSlug: tag.slug });

        // 1. The published kind-30003 snapshot (the viewer's own). This is FAST
        //    (a strfry scan) and determines whether the Notes sub-tab exists — so
        //    surface `pinned` immediately, before the slow for-tag step, so the
        //    Profiles|Notes switch doesn't pop in seconds later.
        const filter = JSON.stringify({ kinds: [30003], authors: [viewerPubkey], '#d': [dTag] });
        const r = await fetch(`/api/strfry/scan?filter=${encodeURIComponent(filter)}`);
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        const ev = (j?.events || []).sort((a, b) => b.created_at - a.created_at)[0] || null;
        const snapshotIds = ev ? (ev.tags || []).filter((t) => t[0] === 'e' && t[1]).map((t) => t[1]) : [];
        setPinned(ev ? { eventId: ev.id, createdAt: ev.created_at, ids: snapshotIds } : null);
        if (!ev) { setNotes([]); setDrift(null); setLoading(false); return; }

        // 2. Live curated set (one for-tag call) — enriches the snapshot + drives
        //    the diff. `nocache=1`: drift must reflect the CURRENT taggings, not a
        //    stale 30s-cached set, or a just-tagged note reads as "up to date".
        const params = new URLSearchParams({ tagAuthor: tag.authorPubkey, slug: tag.slug, viewerPubkey, nocache: '1' });
        const fr = await fetch(`/api/event-tags/for-tag?${params}`);
        const fj = await fr.json().catch(() => ({}));
        if (cancelled) return;
        // Drift uses the DETERMINISTIC membership (ids + counts, resolution-
        // independent) so the count doesn't jump around with flaky note fetches.
        // Rendering the snapshot still uses the resolved `notes`.
        const members = Array.isArray(fj.members) ? fj.members : [];
        const live = Array.isArray(fj.notes) ? fj.notes : [];
        const byId = new Map(live.map((n) => [n.id, n]));
        const liveCuratedIds = curateNotes(members, noteMethod).map((n) => n.id);

        const snapSet = new Set(snapshotIds);
        const liveSet = new Set(liveCuratedIds);
        const added = liveCuratedIds.filter((id) => !snapSet.has(id)).length;
        const removed = snapshotIds.filter((id) => !liveSet.has(id)).length;
        const snapshotNotes = snapshotIds.map((id) => byId.get(id)).filter(Boolean);

        if (cancelled) return;
        setNotes(snapshotNotes);
        setDrift({ added, removed });
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tag?.authorPubkey, tag?.slug, viewerPubkey, noteMethod, reloadKey]);

  return { pinned, notes, drift, loading, error, refetch };
}
