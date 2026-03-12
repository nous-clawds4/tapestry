/**
 * useTrustWeights — resolves trust weight for a set of pubkeys
 * based on the current TrustContext (PoV + scoring method).
 *
 * Returns { weights: { [pubkey]: number }, loading: boolean, error: string|null }
 *
 * For "follow-list":  weight = 1 if pubkey is in PoV's kind 3 contact list, else 0
 * For "trusted-assertions-rank": weight = rank/100 from kind 30382 events
 * For "trusted-list": weight = 1 if pubkey is in selected kind 30392 Trusted List, else 0
 * For "trust-everyone": weight = 1 for all pubkeys
 */
import { useState, useEffect, useRef } from 'react';
import { useTrust } from '../context/TrustContext';
import { queryRelay } from '../api/relay';

const FETCH_TIMEOUT_MS = 8000;

export default function useTrustWeights(pubkeys) {
  const { povPubkey, scoringMethod, trustedListId } = useTrust();
  const [weights, setWeights] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Track the last resolved key to avoid stale updates
  const genRef = useRef(0);

  useEffect(() => {
    if (!pubkeys || pubkeys.length === 0 || !povPubkey) {
      setWeights({});
      return;
    }

    const gen = ++genRef.current;
    let cancelled = false;

    async function resolve() {
      setLoading(true);
      setError(null);

      try {
        if (scoringMethod === 'follow-list') {
          // Fetch PoV's kind 3 contact list from local strfry
          const events = await queryRelay({ kinds: [3], authors: [povPubkey], limit: 1 });
          if (cancelled) return;

          const followSet = new Set();
          if (events.length > 0) {
            for (const tag of events[0].tags || []) {
              if (tag[0] === 'p') followSet.add(tag[1]);
            }
          }

          const w = {};
          for (const pk of pubkeys) {
            w[pk] = followSet.has(pk) ? 1 : 0;
          }
          if (gen === genRef.current) setWeights(w);

        } else if (scoringMethod === 'trusted-assertions-rank') {
          // 1. Get PoV's Treasure Map (kind 10040) from local strfry
          const tmEvents = await queryRelay({ kinds: [10040], authors: [povPubkey], limit: 1 });
          console.log('[useTrustWeights] TM query for', povPubkey.slice(0, 12), '→', tmEvents.length, 'events');
          if (cancelled) return;

          if (tmEvents.length === 0) {
            // No treasure map — all weights unknown
            const w = {};
            for (const pk of pubkeys) w[pk] = null;
            if (gen === genRef.current) {
              setWeights(w);
              setError('No TA Treasure Map found for PoV. Import it from the user\'s profile page.');
            }
            return;
          }

          const tm = tmEvents[0];
          // Find the 30382:rank tag → [kind:type, author_pubkey, relay_url]
          const rankTag = tm.tags?.find(t => t[0] === '30382:rank');
          if (!rankTag || !rankTag[1] || !rankTag[2]) {
            const w = {};
            for (const pk of pubkeys) w[pk] = null;
            if (gen === genRef.current) {
              setWeights(w);
              setError('Treasure Map has no 30382:rank tag');
            }
            return;
          }

          const taAuthor = rankTag[1];
          const taRelay = rankTag[2];
          console.log('[useTrustWeights] TM 30382:rank tag →', { taAuthor: taAuthor.slice(0, 12), taRelay });

          // 2. Fetch only the specific kind 30382 events we need (one per author pubkey)
          //    d-tag = target pubkey, so use #d filter
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

          try {
            const filter = JSON.stringify({
              kinds: [30382],
              authors: [taAuthor],
              '#d': pubkeys,  // only fetch assertions for the pubkeys we care about
            });
            console.log('[useTrustWeights] Querying', pubkeys.length, 'assertions from', taRelay);
            const res = await fetch(
              `/api/relay/external?filter=${encodeURIComponent(filter)}&relays=${encodeURIComponent(taRelay)}`,
              { signal: controller.signal }
            );
            clearTimeout(timeout);
            if (cancelled) return;

            const data = await res.json();
            const assertions = data.success ? (data.events || []) : [];
            console.log('[useTrustWeights] Got', assertions.length, 'assertions');

            // Build a map: pubkey → rank score
            // Score is in the "rank" tag: ["rank", "<value>"]
            const rankMap = {};
            for (const ev of assertions) {
              const dTag = ev.tags?.find(t => t[0] === 'd')?.[1];
              if (!dTag) continue;
              const rt = ev.tags?.find(t => t[0] === 'rank');
              if (rt && rt[1] != null) {
                rankMap[dTag] = parseFloat(rt[1]);
              }
            }

            console.log('[useTrustWeights] rankMap:', rankMap);

            const w = {};
            for (const pk of pubkeys) {
              const rank = rankMap[pk];
              w[pk] = rank != null ? rank / 100 : null;
            }
            console.log('[useTrustWeights] Final weights:', w);
            if (gen === genRef.current) setWeights(w);

          } catch (err) {
            clearTimeout(timeout);
            if (!cancelled && gen === genRef.current) {
              setError(`Failed to fetch assertions from ${taRelay}: ${err.message}`);
              const w = {};
              for (const pk of pubkeys) w[pk] = null;
              setWeights(w);
            }
          }

        } else if (scoringMethod === 'trust-everyone') {
          // Everyone gets weight 1
          const w = {};
          for (const pk of pubkeys) w[pk] = 1;
          if (gen === genRef.current) setWeights(w);

        } else if (scoringMethod === 'trusted-list') {
          if (!trustedListId) {
            const w = {};
            for (const pk of pubkeys) w[pk] = null;
            if (gen === genRef.current) {
              setWeights(w);
              setError('No Trusted List selected. Choose one on the Trust Determination page.');
            }
            return;
          }

          // Fetch all kind 30392 events with this d-tag from local strfry
          const events = await queryRelay({ kinds: [30392], '#d': [trustedListId], limit: 10 });
          if (cancelled) return;

          if (events.length === 0) {
            const w = {};
            for (const pk of pubkeys) w[pk] = null;
            if (gen === genRef.current) {
              setWeights(w);
              setError(`Trusted List "${trustedListId}" not found in local strfry.`);
            }
            return;
          }

          // Use the most recent event
          const tlEvent = events.sort((a, b) => b.created_at - a.created_at)[0];

          // Extract all p-tags as the trusted set
          const trustedSet = new Set();
          for (const tag of tlEvent.tags || []) {
            if (tag[0] === 'p' && tag[1]) trustedSet.add(tag[1]);
          }

          console.log('[useTrustWeights] Trusted List:', trustedListId, '→', trustedSet.size, 'pubkeys');

          const w = {};
          for (const pk of pubkeys) {
            w[pk] = trustedSet.has(pk) ? 1 : 0;
          }
          if (gen === genRef.current) setWeights(w);

        } else {
          // Unknown method
          const w = {};
          for (const pk of pubkeys) w[pk] = null;
          if (gen === genRef.current) setWeights(w);
        }
      } catch (err) {
        if (!cancelled && gen === genRef.current) {
          setError(err.message);
        }
      } finally {
        if (!cancelled && gen === genRef.current) setLoading(false);
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [pubkeys, povPubkey, scoringMethod, trustedListId]);

  return { weights, loading, error, povPubkey, scoringMethod };
}
