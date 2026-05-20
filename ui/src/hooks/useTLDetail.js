import { useState, useEffect } from 'react';
import { TA_PUBKEY } from '../utils/publishTagPin';

/**
 * Story 11 follow-up — fetches a single kind-30392 Trusted List event by
 * d-tag, parses tags + content body for membership metadata, and enriches
 * the member pubkey list with Meili profile docs (displayName, picture,
 * nip05).
 *
 * Returns { tl, members, loading, error, refetch } where:
 *   tl = { eventId, createdAt, dTag, title, observer, sourceTag, cutoff, minRank, retracted }
 *   members = [{ pubkey, displayName, picture, nip05, endorsements, disputes }]
 */
export default function useTLDetail(dTag) {
  const [tl, setTl] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dTag) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const filter = JSON.stringify({
          kinds: [30392],
          authors: [TA_PUBKEY],
          '#d': [dTag],
        });
        const resp = await fetch(`/api/strfry/scan?filter=${encodeURIComponent(filter)}`);
        const data = await resp.json();
        if (cancelled) return;
        if (!data?.success || !data.events?.length) {
          setError('Trusted List not found');
          setLoading(false);
          return;
        }
        // Latest by created_at.
        const evs = [...data.events].sort((a, b) => b.created_at - a.created_at);
        const ev = evs[0];

        const findTag = (k) => (ev.tags || []).find((t) => t[0] === k);
        const sourceTag = findTag('source-tag');
        const observer = findTag('observer')?.[1] || null;
        const cutoff = findTag('cutoff')?.[1] || null;
        const minRank = findTag('min-rank')?.[1] || null;
        const retracted = (ev.tags || []).some(
          (t) => t[0] === 'status' && t[1] === 'retracted'
        );
        const memberPubkeys = (ev.tags || [])
          .filter((t) => t[0] === 'p' && /^[0-9a-f]{64}$/.test(t[1] || ''))
          .map((t) => t[1]);

        // Per-member endorsement/dispute counts from content body.
        let countsByPubkey = new Map();
        try {
          const body = JSON.parse(ev.content || '{}');
          if (Array.isArray(body.members)) {
            for (const m of body.members) {
              if (m.pubkey) countsByPubkey.set(m.pubkey, {
                endorsements: m.endorsements ?? 0,
                disputes: m.disputes ?? 0,
              });
            }
          }
        } catch { /* content body optional / older versions */ }

        setTl({
          eventId: ev.id,
          createdAt: ev.created_at,
          dTag,
          title: findTag('title')?.[1] || null,
          observer,
          sourceTag: sourceTag
            ? { eventId: sourceTag[1], authorPubkey: sourceTag[2], slug: sourceTag[3] }
            : null,
          cutoff: cutoff != null ? parseInt(cutoff, 10) : null,
          minRank: minRank != null ? parseInt(minRank, 10) : null,
          retracted,
        });

        // Enrich members via /api/profiles bulk lookup.
        let profiles = {};
        if (memberPubkeys.length > 0) {
          try {
            const r = await fetch(`/api/profiles?pubkeys=${memberPubkeys.join(',')}`);
            const j = await r.json();
            if (j?.success && j.profiles) profiles = j.profiles;
          } catch { /* enrichment best-effort */ }
        }

        const enriched = memberPubkeys.map((pk) => {
          const p = profiles[pk] || {};
          const counts = countsByPubkey.get(pk) || { endorsements: null, disputes: null };
          return {
            pubkey: pk,
            displayName: p.display_name || p.name || null,
            picture: p.picture || null,
            nip05: p.nip05 || null,
            endorsements: counts.endorsements,
            disputes: counts.disputes,
          };
        });
        // Order: by endorsements desc (already that way from the publisher,
        // but defensive).
        enriched.sort((a, b) =>
          (b.endorsements ?? 0) - (a.endorsements ?? 0)
          || a.pubkey.localeCompare(b.pubkey)
        );

        setMembers(enriched);
        setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [dTag, reloadKey]);

  return { tl, members, loading, error, refetch: () => setReloadKey((k) => k + 1) };
}
