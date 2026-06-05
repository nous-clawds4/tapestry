import { useState, useEffect } from 'react';

// Client-side cache keyed by `${pubkey}|${nip05}` (survives across mounts
// within the same page session).
const verificationCache = new Map();

/**
 * Hook: verify a profile's NIP-05 identifier against its domain.
 *
 * Returns a boolean. Fail-closed: starts false and only ever becomes true
 * after the server confirms the identifier's domain attests THIS pubkey.
 * Missing inputs, lookup errors, timeouts, and mismatches all stay false —
 * so the caller can safely gate a "verified" checkmark on the return value.
 */
export default function useNip05Verification(pubkey, nip05) {
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    // Reset first so a previously-verified profile never bleeds onto a new one.
    setVerified(false);

    if (!pubkey || !nip05) return;

    const cacheKey = `${pubkey}|${nip05}`;
    if (verificationCache.has(cacheKey)) {
      setVerified(verificationCache.get(cacheKey));
      return;
    }

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(
          `/api/nip05/verify?nip05=${encodeURIComponent(nip05)}&pubkey=${encodeURIComponent(pubkey)}`
        );
        const data = await res.json();
        const ok = res.ok && data?.verified === true;
        if (cancelled) return;
        verificationCache.set(cacheKey, ok);
        setVerified(ok);
      } catch (err) {
        // Fail-closed: leave it false.
        console.warn('useNip05Verification fetch error:', err);
      }
    }

    check();
    return () => { cancelled = true; };
  }, [pubkey, nip05]);

  return verified;
}
