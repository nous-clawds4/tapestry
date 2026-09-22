import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { summarizeSetup } from '../utils/setupStatus';

/**
 * The signed-in viewer's /setup status (ADR setup-status-and-alert/0001).
 *
 * One answer for the whole app, so the /setup page and the Setup Alert cannot disagree about a
 * step. Mounted in App.jsx beside AssistantRosterProvider: inside AuthProvider, outside the router,
 * so a page change does not ask again.
 *
 * It asks /api/setup/status only once something wants the answer (useSetupStatus mounts), only
 * when someone is signed in, and again when the signed-in account changes or gains an assistant:
 * AuthContext.refreshUser() after creating one on /assistant/profile/edit changes
 * user.assistantPubkey for the same account (ADR setup-status-and-alert/0002 Decision 5). The server
 * answers for the session itself, so the request carries no parameters. There is no polling: a step
 * completed in another app shows on the next full page load, or after refresh().
 *
 * phase: 'idle' (nothing asked, or signed out) · 'checking' · 'answered' · 'failed' (a network
 * error, a failure answer, or the server saying the session has expired).
 */
const SetupStatusContext = createContext(null);

export function SetupStatusProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const pubkey = user?.pubkey || null;
  const [wanted, setWanted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Each answer carries the request it answers, so an answer for a previous account (or a
  // previous attempt) is never shown: the phase below is derived, not stored.
  const [result, setResult] = useState({ request: null, phase: 'idle', answer: null });
  const request = wanted && !authLoading && pubkey ? `${pubkey}#${user?.assistantPubkey || '-'}#${attempt}` : null;

  // When the request goes away — a sign-out, or sign-in re-resolving — the held answer goes too, so
  // the next read starts from 'checking' even for the same account, whose request key would
  // otherwise match the old answer again (ADR § 3: signing out resets to idle).
  if (!request && result.request !== null) {
    setResult({ request: null, phase: 'idle', answer: null });
  }

  useEffect(() => {
    if (!request) return undefined;
    let cancelled = false;
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data && data.success === true && data.signedIn === true) setResult({ request, phase: 'answered', answer: data });
        else setResult({ request, phase: 'failed', answer: null });
      })
      .catch(() => {
        if (!cancelled) setResult({ request, phase: 'failed', answer: null });
      });
    return () => { cancelled = true; };
  }, [request]);

  const phase = !request ? 'idle' : result.request === request ? result.phase : 'checking';
  const answer = phase === 'answered' ? result.answer : null;
  const want = useCallback(() => setWanted(true), []);
  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  const value = useMemo(() => ({ phase, answer, want, refresh }), [phase, answer, want, refresh]);

  return (
    <SetupStatusContext.Provider value={value}>
      {children}
    </SetupStatusContext.Provider>
  );
}

/**
 * The shared answer, summarized: { phase, refresh, answered, steps, doneCount, pendingCount }.
 * Mounting it is what asks for the answer. Until it is in, every step is neither done nor pending.
 */
export function useSetupStatus() {
  const ctx = useContext(SetupStatusContext);
  const want = ctx ? ctx.want : null;
  useEffect(() => { if (want) want(); }, [want]);
  const phase = ctx ? ctx.phase : 'idle';
  return {
    phase,
    refresh: ctx ? ctx.refresh : () => {},
    ...summarizeSetup(phase === 'answered' ? ctx.answer : null),
  };
}
