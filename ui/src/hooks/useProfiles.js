import { useState, useEffect, useRef } from 'react';
import { fetchProfilesChunked, PROFILE_LOOKUP_FAILED } from '../utils/profileBatch';

// Client-side cache (survives across component mounts within the same page session)
const clientCache = new Map();

/**
 * Hook: fetch nostr kind:0 profiles for a list of pubkeys.
 * Returns a plain object keyed by pubkey: { [pubkey]: { name, picture, display_name, ... } | null }.
 * NOT a Map — read it with `profiles?.[pubkey]`, never `.get()` (ADR graph-curation-ui/0002).
 * Loads asynchronously — returns an empty object initially, then updates.
 *
 * A pubkey whose lookup FAILED reads as `PROFILE_LOOKUP_FAILED`, which is distinct from the
 * `null` of a pubkey that simply has no profile published. `<AuthorCell>` renders the
 * difference; consumers that ignore it fall through to their existing unnamed handling.
 * The request is chunked at the endpoint's cap (ADR profile-lookup-bounds/0001).
 */
export default function useProfiles(pubkeys = []) {
  const [profiles, setProfiles] = useState({});
  const prevKeysRef = useRef('');

  useEffect(() => {
    // Dedupe and sort for stable comparison
    const unique = [...new Set(pubkeys)].sort();
    const key = unique.join(',');
    if (!key || key === prevKeysRef.current) return;
    prevKeysRef.current = key;

    // Check client cache first
    const result = {};
    const needed = [];
    for (const pk of unique) {
      if (clientCache.has(pk)) {
        result[pk] = clientCache.get(pk);
      } else {
        needed.push(pk);
      }
    }

    // If everything is cached, just set and return
    if (needed.length === 0) {
      setProfiles({ ...result });
      return;
    }

    // Set cached results immediately, then fetch the rest
    if (Object.keys(result).length > 0) {
      setProfiles({ ...result });
    }

    let cancelled = false;

    async function fetchMissing() {
      await fetchProfilesChunked(needed, {
        isCancelled: () => cancelled,
        onBatch: (batch) => {
          if (cancelled) return;
          for (const [pk, profile] of Object.entries(batch)) {
            // A failed lookup is transient — caching it would make it permanent, and the
            // pubkey would never be retried for the life of the page session.
            if (profile !== PROFILE_LOOKUP_FAILED) clientCache.set(pk, profile);
            result[pk] = profile;
          }
          setProfiles({ ...result });
        },
      });
    }

    fetchMissing();
    return () => { cancelled = true; };
  }, [pubkeys.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return profiles;
}
