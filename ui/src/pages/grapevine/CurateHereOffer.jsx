import { useMemo, useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { upsertDListEntry, replacementSentences } from '../../utils/treasureMap';
import { getActiveSignerOrThrow } from '../../utils/signerGuard';
import { publishOrThrow } from '../../utils/publishProfileTag';

const ENDPOINT = '/api/dlist-curation/header';
const short = (pk) => (typeof pk === 'string' && pk.length > 12 ? `${pk.slice(0, 8)}…${pk.slice(-4)}` : String(pk || ''));
const muted = { fontSize: '0.85rem', opacity: 0.7, margin: '0.5rem 0 0' };
const mono = { fontFamily: 'monospace', fontSize: '0.75rem' };
const box = {
  padding: '0.75rem 1rem', marginTop: '0.75rem', border: '1px solid #f59e0b', borderRadius: '8px',
  backgroundColor: 'rgba(245, 158, 11, 0.06)', fontSize: '0.9rem',
};

// Why there is no offer (curated-dlist-update ADR 0003 §5) — each follows "You can't curate it here".
const REASON_TAILS = {
  'no-assistant': ": you don't have a Tapestry Assistant on this instance.",
  kind: ': this instance curates only kind-39998 lists.',
  failed: " yet: its assistant's header couldn't be checked.",
  missing: ": its assistant's header was not found, so the shared list it curates is unknown.",
  'no-pointer': ": its assistant's header names no shared list.",
  deferred: ": its assistant's header is marked deliberately unaffiliated.",
  // ADR 0003 Amendment 1: the header points at a list that cannot be curated under this entry.
  target: ": its assistant's header doesn't point at a kind-39998 list with the same d-tag.",
  // curated-dlist-update ADR 0006 §8 (R2-2): the header endpoint refuses to curate a shared list by the viewer or their assistant.
  own: ": the shared list it curates is yours, or your assistant's.",
};

/**
 * "Curate it here instead" on a read-only curated DList (curated-dlist-update #3, ADR 0003 §5–§6). The
 * words come first and nothing is sent until Continue; then the DList Curation panel's steps for the
 * shared header this curation follows — the viewer's assistant's header (story 4's endpoint), then the
 * Map update the viewer reviews and signs with their extension. Cancel at any step leaves the Map — and
 * so the curation — unchanged. The page's `onPublished` re-reads the Map, and the list opens as theirs.
 */
export default function CurateHereOffer({ row, assistantPubkey, offer, mapEvent, onPublished }) {
  const { aRelays } = useConfig();
  const relayHint = aRelays?.aDListRelays?.[0] || '';
  const [step, setStep] = useState('idle'); // idle | words | authoring | review | signing
  const [outcome, setOutcome] = useState(null); // the endpoint's answer
  const [error, setError] = useState(null); // { message, b? }
  const [showPreview, setShowPreview] = useState(false);

  // The Map update is composed fresh from the Map on screen (the panel's rule), only once reviewed.
  const unsigned = useMemo(
    () => ((step === 'review' || step === 'signing') && mapEvent && row
      ? upsertDListEntry(mapEvent, 39998, row.d, assistantPubkey, relayHint)
      : null),
    [step, mapEvent, row, assistantPubkey, relayHint]
  );

  if (!offer || offer.status === 'checking') return null;
  if (offer.status !== 'available') {
    return <p style={muted}>You can&apos;t curate it here{REASON_TAILS[offer.reason] || '.'}</p>;
  }

  const curatorShort = short(row.pubkey);
  const reset = () => { setStep('idle'); setOutcome(null); setError(null); setShowPreview(false); };

  async function handleContinue() {
    setStep('authoring'); setError(null);
    try {
      // The assistant's header first, as the panel's Add does: the Map never points at a header that does not exist.
      const res = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: offer.target }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setError({ message: 'Your assistant already has a header for this list with a different link; it was not changed.', b: data.existing?.b || [] });
        setStep('idle');
        return;
      }
      if (!res.ok || !data.success) {
        setError({ message: data.error || `Request failed (${res.status}).` });
        setStep('idle');
        return;
      }
      setOutcome(data);
      setStep('review');
    } catch (err) {
      setError({ message: err?.message || 'Request failed.' });
      setStep('idle');
    }
  }

  async function handleSignAndPublish() {
    if (!unsigned) return;
    setStep('signing'); setError(null);
    try {
      // Refuse to sign as an extension account drifted from the session.
      const authorPk = await getActiveSignerOrThrow();
      const signed = await window.nostr.signEvent({ ...unsigned, pubkey: authorPk });
      await publishOrThrow(signed);
      reset();
      if (onPublished) onPublished();
    } catch (err) {
      setError({ message: err?.message || 'Publish failed.' });
      setStep('review');
    }
  }

  return (
    <section style={box}>
      {step === 'idle' && (
        <button type="button" className="btn btn-sm btn-primary" onClick={() => { setError(null); setStep('words'); }}>
          Curate it here instead
        </button>
      )}
      {step === 'words' && (
        <>
          {replacementSentences(curatorShort).map((t) => <p key={t} style={{ margin: '0 0 0.4rem' }}>{t}</p>)}
          <p style={{ margin: '0 0 0.6rem' }}>Continuing has your assistant here write its own header for this list, if it has none; your Treasure Map changes only when you sign.</p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleContinue}>Continue</button>
            <button type="button" className="btn btn-sm" onClick={reset}>Cancel</button>
          </div>
        </>
      )}
      {step === 'authoring' && <div style={{ opacity: 0.7 }}>⏳ Asking your assistant for its header…</div>}
      {(step === 'review' || step === 'signing') && unsigned && (
        <>
          <div style={{ fontWeight: 600 }}>Header {outcome?.existing ? 'already existed' : 'authored'} for <span style={mono}>{row.d}</span> by your assistant.</div>
          <div style={{ marginTop: '0.5rem' }}>
            Map update: replaces <span style={mono}>{curatorShort}</span>&apos;s entry for <span style={mono}>39998:{row.d}</span> with your assistant{relayHint ? <> @ <span style={mono}>{relayHint}</span></> : ' (no relay hint configured)'}.
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn btn-sm" onClick={() => setShowPreview((v) => !v)} style={{ fontSize: '0.8rem' }}>
              {showPreview ? '▾ Hide preview' : '▸ Preview updated event'}
            </button>
            {showPreview && (
              <pre style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--bg-secondary, #1a1a2e)', border: '1px solid var(--border, #444)', borderRadius: '6px', fontSize: '0.75rem', overflow: 'auto', maxHeight: '320px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(unsigned, null, 2)}
              </pre>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm btn-primary" onClick={handleSignAndPublish} disabled={step === 'signing'}>
              {step === 'signing' ? '⏳ Publishing…' : '📤 Sign & publish'}
            </button>
            <button type="button" className="btn btn-sm" onClick={reset} disabled={step === 'signing'}>Cancel</button>
          </div>
        </>
      )}
      {error && (
        <div style={{ marginTop: '0.6rem', color: '#f85149', fontSize: '0.85rem' }}>
          {error.message}
          {(error.b || []).map((t, i) => <div key={i} style={{ ...mono, marginTop: '0.25rem' }}>{JSON.stringify(t)}</div>)}
        </div>
      )}
    </section>
  );
}
