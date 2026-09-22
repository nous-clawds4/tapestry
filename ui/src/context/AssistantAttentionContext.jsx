import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { summarizeAttention } from '../utils/assistantAttention';
import { onEventPublished } from '../utils/nostrPublish';

/**
 * Which of the signed-in viewer's Assistant Management actions need attention (ADR assistant-identification-tags/0001).
 *
 * One answer for the whole app, so the /assistant hub, the Assistant Alert and the action pages cannot disagree.
 * Mounted in App.jsx inside SetupStatusProvider, outside the router, so a page change does not ask again.
 *
 * It asks /api/assistant/attention only once something wants the answer (useAssistantAttention mounts), only for a
 * signed-in viewer who has an assistant on this instance (user.assistantPubkey — with none there is nothing to
 * check), again when the signed-in account or its assistant changes, on refresh(), and after the app publishes a
 * tagging by the viewer or their assistant (heard through onEventPublished: a kind 39999 whose d starts with
 * `profile-tag-`), so the hub and the alert catch up on their own after the Identification Tags page publishes.
 * The server answers for the session itself, so the request carries no parameters. There is no polling: a tagging
 * published in another app or tab shows on the next full page load, or after refresh().
 *
 * phase: 'idle' (nothing asked, signed out, or no assistant) · 'checking' · 'answered' · 'failed' (a network error,
 * a failure answer, or the server saying the session has expired).
 */
const AssistantAttentionContext = createContext(null);

const TAGGING_D_PREFIX = 'profile-tag-';
const dTagOf = (ev) => {
  const t = ev && Array.isArray(ev.tags) ? ev.tags.find((x) => Array.isArray(x) && x[0] === 'd') : null;
  return t ? t[1] : null;
};

export function AssistantAttentionProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const pubkey = user?.pubkey || null;
  const assistantPubkey = user?.assistantPubkey || null;
  const [wanted, setWanted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  // Each answer carries the request it answers, so an answer for a previous account or attempt is never shown: the
  // phase below is derived, not stored (the SetupStatusProvider pattern).
  const [result, setResult] = useState({ request: null, phase: 'idle', answer: null });
  const request = wanted && !authLoading && pubkey && assistantPubkey ? `${pubkey}#${assistantPubkey}#${attempt}` : null;

  // When the request goes away — a sign-out, sign-in re-resolving, or the assistant going away — the held answer
  // goes too, so the next read starts from 'checking' even for the same account.
  if (!request && result.request !== null) {
    setResult({ request: null, phase: 'idle', answer: null });
  }

  useEffect(() => {
    if (!request) return undefined;
    let cancelled = false;
    fetch('/api/assistant/attention')
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

  // Ask again after each announcement of a tagging by the viewer or their assistant reaching a relay. Every one
  // counts, even for an event heard before: a later import of it can change what the check reads.
  useEffect(() => onEventPublished((ev) => {
    if (!ev || ev.kind !== 39999) return;
    if (!pubkey || (ev.pubkey !== pubkey && ev.pubkey !== assistantPubkey)) return;
    const d = dTagOf(ev);
    if (typeof d !== 'string' || !d.startsWith(TAGGING_D_PREFIX)) return;
    refresh();
  }), [pubkey, assistantPubkey, refresh]);

  const value = useMemo(() => ({ phase, answer, want, refresh }), [phase, answer, want, refresh]);

  return (
    <AssistantAttentionContext.Provider value={value}>
      {children}
    </AssistantAttentionContext.Provider>
  );
}

/**
 * The shared answer, summarized: { phase, refresh, answered, hasAssistant, actions }. Mounting it is what asks for
 * the answer. Until it is in, no action has an answer.
 */
export function useAssistantAttention() {
  const ctx = useContext(AssistantAttentionContext);
  const want = ctx ? ctx.want : null;
  useEffect(() => { if (want) want(); }, [want]);
  const phase = ctx ? ctx.phase : 'idle';
  return {
    phase,
    refresh: ctx ? ctx.refresh : () => {},
    ...summarizeAttention(phase === 'answered' ? ctx.answer : null),
  };
}
