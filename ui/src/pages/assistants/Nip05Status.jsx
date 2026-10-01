import { useEffect, useState } from 'react';
import { COPY, nip05StatusOf } from './myAssistants';

/**
 * A NIP-05's status beside it on the My Assistants page (my-assistants #4, ADR my-assistants/0004 sub-decision 4):
 * Verified, Not valid or Couldn't check, from GET /api/nip05/verify; "Checking…" until the answer comes; nothing when
 * the profile has no NIP-05. A failed request, or an answer that isn't one of the three, reads Couldn't check, never
 * Not valid (story AC-1; nip05StatusOf).
 *
 * The states are told apart by their words (and the check mark), not by colour alone, and each carries its
 * explanation as a title (AC-3). It is text, not a control, so it may sit inside a row's toggle button.
 *
 * A definite answer (verified or invalid) is kept for the page's lifetime, keyed by pubkey and NIP-05, so a refresh
 * after a press or a tab round trip doesn't ask again. An unchecked answer is not kept: the next time the status is
 * drawn, it asks again. Requests in flight for the same key are shared.
 */

const known = new Map(); // `${pubkey}|${nip05Id}` → 'verified' | 'invalid'
const inFlight = new Map(); // `${pubkey}|${nip05Id}` → Promise<status>

function checkNip05(pubkey, nip05Id) {
  const key = `${pubkey}|${nip05Id}`;
  if (known.has(key)) return Promise.resolve(known.get(key));
  if (inFlight.has(key)) return inFlight.get(key);
  const asked = fetch(`/api/nip05/verify?nip05=${encodeURIComponent(nip05Id)}&pubkey=${encodeURIComponent(pubkey)}`)
    .then((res) => (res.ok ? res.json() : null))
    .then((answer) => nip05StatusOf(answer))
    .catch(() => 'unchecked')
    .then((status) => {
      inFlight.delete(key);
      if (status !== 'unchecked') known.set(key, status);
      return status;
    });
  inFlight.set(key, asked);
  return asked;
}

/**
 * null with no NIP-05; 'checking' until the answer; then 'verified', 'invalid' or 'unchecked'. An answer is kept with
 * the (pubkey, NIP-05) it was asked for, and drawn only for that pair: when a drawn row's NIP-05 changes, its old
 * verdict is never shown beside the new one, not even for one render (ADR my-assistants/0004 Amendment 1).
 */
export function useNip05Status(pubkey, nip05Id) {
  const key = nip05Id ? `${pubkey}|${nip05Id}` : null;
  const [answered, setAnswered] = useState(null); // { key, status } of the last answer this status received
  useEffect(() => {
    if (!key) return undefined;
    let cancelled = false;
    checkNip05(pubkey, nip05Id).then((status) => { if (!cancelled) setAnswered({ key, status }); });
    return () => { cancelled = true; };
  }, [key, pubkey, nip05Id]);
  if (!key) return null;
  if (answered && answered.key === key) return answered.status;
  return known.get(key) || 'checking';
}

const SHOWN = {
  verified: { word: COPY.nip05Verified, title: COPY.nip05VerifiedTitle },
  invalid: { word: COPY.nip05Invalid, title: COPY.nip05InvalidTitle },
  unchecked: { word: COPY.nip05Unchecked, title: COPY.nip05UncheckedTitle },
};

export default function Nip05Status({ pubkey, nip05Id }) {
  const status = useNip05Status(pubkey, nip05Id);
  if (!status) return null;
  if (status === 'checking') return <span className="bsd-ma-nip05 is-checking">{COPY.nip05Checking}</span>;
  const { word, title } = SHOWN[status];
  return (
    <span className={`bsd-ma-nip05 is-${status}`} title={title}>
      {status === 'verified' && <span aria-hidden="true">✓ </span>}
      {word}
    </span>
  );
}
