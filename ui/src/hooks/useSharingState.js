import { useState, useEffect, useCallback } from 'react';

/**
 * A concept header's sharing state — declared here, and SHARED (published to
 * the public relay)? ADR shared-concepts-legibility/0001.
 *
 * The whole answer is resolved server-side by
 * GET /api/concept/:handle/sharing-state. Deliberately NOT built on
 * fetchFromRelays: that helper returns [] both when the relay says "nothing"
 * and when the fetch fails, and this page must tell those apart.
 *
 * `state.published` is tri-state — true | false | null, where null means the
 * relay could not be reached. Never render null as "not shared".
 *
 * Returns { state, loading, refresh } — refresh() re-resolves after a submit
 * so the page updates without a reload.
 */
export default function useSharingState(handle) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!handle) return undefined;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const resp = await fetch(`/api/concept/${encodeURIComponent(handle)}/sharing-state`);
        const json = await resp.json();
        if (cancelled) return;
        setState(json && json.success ? json : null);
      } catch {
        if (!cancelled) setState(null); // unreachable server — the page shows nothing rather than a wrong claim
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [handle, nonce]);

  return { state, loading, refresh };
}
