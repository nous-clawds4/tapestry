import { useState, useEffect, useCallback } from 'react';
import { curateNotes } from '@tapestry/event-tagging';
import { computeNoteTLDTag } from '../utils/publishTagPin';
import { useConfig } from '../context/ConfigContext';
import { usePov } from '../context/PovContext';

/**
 * contextual-pins Story 2 — read back the pin's TA-signed NOTE Trusted List
 * (kind-30393, `tl-pin-notes-…` d-tag) for the Pinned tab, and compute its
 * DRIFT against the live curated set. This is the note analog of the profile
 * side, which already displays the TA-signed kind-30392 (`useTLDetail`).
 *
 * Previously this read the viewer's client-signed kind-30003 bookmark export —
 * which only existed after an explicit Export, gating the Notes toggle on that
 * export. The kind-30003 is now purely the cross-client export artifact; the
 * DISPLAY source is the instance-computed kind-30393 (materialized by
 * `runOneNotePin` on every pin refresh; context-aware).
 *
 * @param tag        — { authorPubkey, slug, name }
 * @param observer   — the pin's curation observer (its POV; == viewer for own pins)
 * @param noteMethod — 'notes:net-endorsed' | 'notes:most-applied'
 * @param contextSlug— the pin's community context, or undefined for a neutral pin
 *
 * @returns {{ pinned, notes, drift, loading, error, refetch }}
 *   pinned = { eventId, createdAt, ids:[] } | null   (null → no note TL / retracted)
 *   notes  = enriched TL members still resolvable (NoteCard-ready)
 *   drift  = { added, removed } | null               (null when no note TL)
 */
const HEX64 = /^[0-9a-f]{64}$/;

export default function usePinnedNotes(tag, observer, noteMethod = 'notes:net-endorsed', contextSlug = undefined, cutoff = 1) {
  const { taPubkey } = useConfig();
  const { povParams } = usePov();
  const [pinned, setPinned] = useState(null);
  const [notes, setNotes] = useState([]);
  const [drift, setDrift] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!tag?.authorPubkey || !tag?.slug || !HEX64.test(observer || '') || !HEX64.test(taPubkey || '')) {
      setPinned(null); setNotes([]); setDrift(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const dTag = computeNoteTLDTag({ observer, tagAuthorPubkey: tag.authorPubkey, tagSlug: tag.slug, contextSlug });

        // 1. The TA-signed kind-30393 note TL. FAST (a strfry scan) and
        //    determines whether the Notes sub-tab exists — so surface `pinned`
        //    immediately, before the slow for-tag step. A retracted TL
        //    (empty-membership + status=retracted) means the pin no longer
        //    covers notes → treat as absent.
        const filter = JSON.stringify({ kinds: [30393], authors: [taPubkey], '#d': [dTag] });
        const r = await fetch(`/api/strfry/scan?filter=${encodeURIComponent(filter)}`);
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        const ev = (j?.events || []).sort((a, b) => b.created_at - a.created_at)[0] || null;
        const retracted = ev ? (ev.tags || []).some((t) => t[0] === 'status' && t[1] === 'retracted') : false;
        const tlIds = ev && !retracted ? (ev.tags || []).filter((t) => t[0] === 'e' && t[1]).map((t) => t[1]) : [];
        setPinned(ev && !retracted ? { eventId: ev.id, createdAt: ev.created_at, ids: tlIds } : null);
        if (!ev || retracted) { setNotes([]); setDrift(null); setLoading(false); return; }

        // 2. Live curated set (one for-tag call) — enriches the TL members +
        //    drives the drift. `nocache=1`: drift must reflect the CURRENT
        //    taggings, not a stale 30s-cached set.
        const params = new URLSearchParams({ tagAuthor: tag.authorPubkey, slug: tag.slug, viewerPubkey: observer, nocache: '1' });
        // Read the live set under the selected POV, in step with the tag page's profiles.
        Object.entries(povParams).forEach(([k, v]) => params.set(k, v));
        const fr = await fetch(`/api/event-tags/for-tag?${params}`);
        const fj = await fr.json().catch(() => ({}));
        if (cancelled) return;
        // Drift uses the DETERMINISTIC membership (ids + counts) so the count
        // doesn't jump with flaky note fetches. Rendering uses resolved `notes`.
        const members = Array.isArray(fj.members) ? fj.members : [];
        const live = Array.isArray(fj.notes) ? fj.notes : [];
        const byId = new Map(live.map((n) => [n.id, n]));
        const liveCuratedIds = curateNotes(members, noteMethod, cutoff).map((n) => n.id);

        const tlSet = new Set(tlIds);
        const liveSet = new Set(liveCuratedIds);
        const added = liveCuratedIds.filter((id) => !tlSet.has(id)).length;
        const removed = tlIds.filter((id) => !liveSet.has(id)).length;
        const tlNotes = tlIds.map((id) => byId.get(id)).filter(Boolean);

        if (cancelled) return;
        setNotes(tlNotes);
        setDrift({ added, removed });
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tag?.authorPubkey, tag?.slug, observer, taPubkey, noteMethod, contextSlug, cutoff, reloadKey, povParams.wotPov, povParams.userPubkey]);

  return { pinned, notes, drift, loading, error, refetch };
}
