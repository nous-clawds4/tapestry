import { useState, useEffect } from 'react';
import { TA_PUBKEY } from '../utils/publishTagPin';

/**
 * Story 11 follow-up — for each of the viewer's pinned tags, fetch its
 * Trusted List (kind-30392) and extract the member-pubkey set. The
 * result powers the Brainstorm Search filter-chip row.
 *
 * Returns:
 *   {
 *     sets: [{
 *       pinEventId, tagName, tagSlug, tagEventId, dTag,
 *       memberPubkeys: Set<hex>,
 *       memberCount,
 *       status,           // 'ok' | 'never' | 'unsupported' | 'retracted'
 *     }],
 *     loading,
 *     error,
 *   }
 *
 * Only pins with status='ok' carry a non-empty memberPubkeys set —
 * but every pin is returned so the UI can render a chip per pinned tag
 * (disabled when the TL hasn't been generated yet).
 */
export default function useTagMemberSets(viewerPubkey) {
  const [sets, setSets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!viewerPubkey) {
      setSets([]); setError(null); setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true); setError(null);

    (async () => {
      try {
        const r = await fetch(`/api/profile-tags/pins?viewerPubkey=${encodeURIComponent(viewerPubkey)}`);
        const j = await r.json();
        if (cancelled) return;
        if (!j?.success) throw new Error(j?.error || 'pins lookup failed');
        const pins = j.pins || [];

        // Build the set of d-tags we want to fetch members for (only the
        // 'ok' rows — 'retracted' will have an empty member list which
        // we don't need; 'never'/'unsupported' have no TL).
        const dTagsToFetch = [];
        for (const p of pins) {
          if (p.tlStatus?.status !== 'ok') continue;
          const observer = p.curationMethod?.observer;
          if (!observer) continue;
          const dTag = `tl-pin-${observer.slice(0, 8)}-${p.tag.authorPubkey.slice(0, 8)}-${p.tag.slug}`;
          dTagsToFetch.push(dTag);
        }

        const membersByDTag = new Map();
        if (dTagsToFetch.length > 0) {
          const filter = JSON.stringify({
            kinds: [30392],
            authors: [TA_PUBKEY],
            '#d': dTagsToFetch,
          });
          const resp = await fetch(`/api/strfry/scan?filter=${encodeURIComponent(filter)}`);
          const data = await resp.json();
          if (data?.success && Array.isArray(data.events)) {
            // Latest per d-tag wins.
            const latest = new Map();
            for (const ev of data.events) {
              const d = (ev.tags || []).find((t) => t[0] === 'd')?.[1];
              if (!d) continue;
              const cur = latest.get(d);
              if (!cur || ev.created_at > cur.created_at) latest.set(d, ev);
            }
            for (const [d, ev] of latest) {
              const pubkeys = new Set(
                (ev.tags || [])
                  .filter((t) => t[0] === 'p' && /^[0-9a-f]{64}$/.test(t[1] || ''))
                  .map((t) => t[1])
              );
              membersByDTag.set(d, pubkeys);
            }
          }
        }

        const result = [];
        for (const p of pins) {
          const observer = p.curationMethod?.observer;
          const dTag = observer
            ? `tl-pin-${observer.slice(0, 8)}-${p.tag.authorPubkey.slice(0, 8)}-${p.tag.slug}`
            : null;
          const memberPubkeys = dTag ? (membersByDTag.get(dTag) || new Set()) : new Set();
          result.push({
            pinEventId: p.pinEventId,
            tagName: p.tag.name,
            tagSlug: p.tag.slug,
            tagEventId: p.tag.eventId,
            dTag,
            memberPubkeys,
            memberCount: memberPubkeys.size,
            status: p.tlStatus?.status || 'never',
          });
        }
        setSets(result);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [viewerPubkey]);

  return { sets, loading, error };
}
