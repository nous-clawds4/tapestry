import { useState, useEffect } from 'react';
import { nip19 } from 'nostr-tools';

/**
 * Hook: instance-level "what does verification mean?" info for the VerificationInfo popover.
 * Fetches /api/owner-info (owner pubkey + verified cutoffs), then the owner's kind-0 via
 * /api/profiles. Returns { ownerName, ownerAvatar, cutoffOutOf100 } (ADR 0032).
 * cutoffOutOf100 = Math.round(cutoff * 100) (0.05 → 5). This is instance-level — independent
 * of any viewed profile — so it takes no arguments. Tolerates a missing owner profile.
 */
export default function useVerificationInfo() {
  const [info, setInfo] = useState({ ownerName: null, ownerAvatar: null, cutoffOutOf100: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const oiResp = await fetch('/api/owner-info');
        const oi = await oiResp.json();
        if (!oi?.success || !oi.ownerPubkey) return;

        const cutoff = oi.verifiedFollowersCutoff ?? oi.verifiedReportersCutoff;
        const cutoffOutOf100 = cutoff == null ? null : Math.round(cutoff * 100);

        // Owner identity from the owner's kind-0 profile.
        let ownerName = null;
        let ownerAvatar = null;
        try {
          const pResp = await fetch(`/api/profiles?pubkeys=${oi.ownerPubkey}`);
          const pData = await pResp.json();
          const prof = (pData?.profiles && pData.profiles[oi.ownerPubkey]) || {};
          ownerName = prof.display_name || prof.name || null;
          ownerAvatar = prof.picture || null;
        } catch { /* tolerate a missing owner profile */ }
        if (!ownerName) {
          try { ownerName = `${nip19.npubEncode(oi.ownerPubkey).slice(0, 12)}…`; } catch { ownerName = 'the owner'; }
        }

        if (!cancelled) setInfo({ ownerName, ownerAvatar, cutoffOutOf100 });
      } catch { /* leave defaults → popover shows graceful fallbacks */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return info;
}
