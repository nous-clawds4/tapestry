import { useState, useEffect, useRef } from 'react';

// Client-side cache (survives across component mounts within the same page session)
const clientCache = new Map();

/**
 * Hook: fetch nostr kind:0 profiles for a list of pubkeys.
 * Returns Map<pubkey, { name, picture, display_name, ... } | null>.
 * Loads asynchronously — returns empty map initially, then updates.
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
      try {
        const res = await fetch(`/api/profiles?pubkeys=${needed.join(',')}`);
        const data = await res.json();
        if (cancelled || !data.success) return;

        for (const [pk, profile] of Object.entries(data.profiles)) {
          clientCache.set(pk, profile);
          result[pk] = profile;
        }
        // Cache nulls for pubkeys with no profile found
        for (const pk of needed) {
          if (!(pk in result)) {
            clientCache.set(pk, null);
            result[pk] = null;
          }
        }

        setProfiles({ ...result });
      } catch (err) {
        console.warn('useProfiles fetch error:', err);
      }
    }

    fetchMissing();
    return () => { cancelled = true; };
  }, [pubkeys.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return profiles;
}
