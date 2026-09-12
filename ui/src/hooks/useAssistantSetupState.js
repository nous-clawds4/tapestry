import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Whether the signed-in user's own assistant has a profile (assistant-profile #1, ADR 0001).
 *
 * It asks /api/assistant/status — the endpoint the profile editor reads — about the signed-in
 * user, so the dashboard and the editor always give the same answer. It waits for sign-in to
 * resolve before asking: asking earlier is how the old dashboard came to ask about `null`.
 *
 * status:
 *   'loading'      sign-in or the check has not resolved yet — render nothing
 *   'no-assistant' not signed in or no assistant provisioned (no request is made), or the check
 *                  found no assistant key behind the user
 *   'set-up'       a kind 0 by the assistant exists
 *   'needs-setup'  there is none on the local relay or on any publish relay
 *   'unknown'      the check failed — render nothing: an error is never "no profile"
 *
 * refresh() asks again, e.g. after a publish from the page.
 */
export default function useAssistantSetupState() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (authLoading) {
      setStatus('loading');
      return undefined;
    }
    if (!user?.pubkey || !user?.assistantPubkey) {
      setStatus('no-assistant');
      return undefined;
    }
    let cancelled = false;
    setStatus('loading');
    fetch(`/api/assistant/status?customerPubkey=${user.pubkey}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data || data.success !== true) {
          setStatus('unknown');
          return;
        }
        // No assistant key behind this user means nothing to set up (ADR 0001 Amendment 1). Sign-in
        // and this check disagree only if the key store failed between them.
        if (data.hasRelayKey === false) {
          setStatus('no-assistant');
          return;
        }
        setStatus(data.hasProfile ? 'set-up' : 'needs-setup');
      })
      .catch(() => {
        if (!cancelled) setStatus('unknown');
      });
    return () => { cancelled = true; };
  }, [authLoading, user?.pubkey, user?.assistantPubkey, attempt]);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  return { status, refresh };
}
