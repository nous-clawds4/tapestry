import { useEffect, useRef, useState } from 'react';
import { MARKS } from '../../utils/listHeaderDisposition';
import { submitAndBroadcast, keepPrivate, wireAndBroadcast } from '../../utils/myAssistantDisposition';
import { submitAsMe, keepPrivateAsMe, wireAsMe } from '../../utils/meDisposition';
import useCommunitySharedConcepts from '../../hooks/useCommunitySharedConcepts';

const REAL_B_REASON = 'this header already carries a real b — deferral applies only to unaffiliated headers';
// The server's step-4b refusals (ADR list-headers-disposition/0004 and its Amendment 1), checked here in the
// same order with the same sentences, so a bad target never sends a request.
const NOT_A_LIST_HEADER = "The target must be a list header's address (39998:pubkey:d-tag)";
const TOO_LONG = 'The target is too long — the relay keeps tag values of at most 1024 bytes';
const BAD_CHARACTERS = "The target contains characters an address can't have";
const OWN_ADDRESS = "That's this header's own address — use Submit as a Shared Concept instead";
const MAX_TARGET_BYTES = 1024;

/**
 * Holds the Wire pick-list for a whole panel session (ADR list-headers-disposition/0004): the panel
 * itself is keyed by row, so Next remounts it, and a hook inside it would read the community relay once
 * per row. The host stays mounted across Next and is unmounted when the panel closes.
 */
export function ListHeaderDispositionHost(props) {
  const { rows } = useCommunitySharedConcepts();
  return <ListHeaderDispositionPanel key={props.row.routeId} {...props} communityRows={rows} />;
}

// Who signs the new version (ADR list-headers-disposition/0005): the person's own Assistant, on the server,
// for their Assistant's rows; the person's browser signer for rows their own account wrote.
const ACTIONS_BY_SIGNER = {
  'my-assistant': { submit: submitAndBroadcast, keep: keepPrivate, wire: wireAndBroadcast },
  me: { submit: submitAsMe, keep: keepPrivateAsMe, wire: wireAsMe },
};

/**
 * The List Headers disposition panel for one of the signed-in person's own headers: their Assistant's
 * (ADR list-headers-disposition/0003) or their account's (`signer` 'me', ADR 0005). Modelled on
 * components/DispositionPanel.jsx, which stays Concept Headers'. Submit as a Shared Concept, Keep private,
 * and Wire (story 4, ADR 0004). `onActed(event)` hands the signed version back so the row shows its new
 * state without a reload.
 */
export default function ListHeaderDispositionPanel({ row, signer = 'my-assistant', onActed, hasNext, onNext, onClose, communityRows }) {
  const actions = ACTIONS_BY_SIGNER[signer];
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [acted, setActed] = useState(false);
  const [target, setTarget] = useState('');

  // The panel renders above the table, which can be thousands of pixels away from the row that opened it.
  // Centre it on mount (Next remounts it, keyed by row): 'start' would tuck it under the fixed top bar, and
  // sticky positioning has no effect inside .main-content (ADR list-headers-disposition/0003, Amendment 1 §4).
  const panelRef = useRef(null);
  useEffect(() => { panelRef.current?.scrollIntoView?.({ block: 'center' }); }, []);

  const hasRealB = row._dispositionMarks.some(m => m === MARKS.wired || m === MARKS.selfDeclared);

  const run = async (fn) => {
    setBusy(true); setMessage(null);
    try {
      const { message: text, event } = await fn(row.routeId);
      setMessage(text); setActed(true); setBusy(false);
      onActed?.(event);
    } catch (err) {
      // Never left busy, whatever was thrown. The fallback claims nothing about what was saved: run also serves the
      // Assistant actions (ADR list-headers-disposition/0005, Amendment 1 §4).
      setBusy(false);
      setMessage(err && err.message ? err.message : "That didn't work — try again.");
    }
  };

  // The panel checks the two things the server would refuse before the relay is read, without asking it.
  const doWire = () => {
    const t = target.trim();
    if (/[\p{Cc}\p{Cf}]/u.test(t)) { setMessage(BAD_CHARACTERS); return; }
    if (new TextEncoder().encode(t).length > MAX_TARGET_BYTES) { setMessage(TOO_LONG); return; }
    const parts = t.match(/^39998:([0-9a-f]{64}):(.+)$/);
    if (!parts) { setMessage(NOT_A_LIST_HEADER); return; }
    const ownD = row.routeId.split(':').slice(2).join(':');
    if (parts[1] === row.author && parts[2] === ownD) { setMessage(OWN_ADDRESS); return; }
    run((handle) => actions.wire(handle, t));
  };

  return (
    <div ref={panelRef} style={{
      border: '1px solid var(--border, #444)', borderRadius: '8px', padding: '1rem',
      marginBottom: '1rem', backgroundColor: 'var(--bg-secondary, #1a1a2e)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Disposition: {row.singular}</strong>
        <button className="btn" onClick={onClose}>✕</button>
      </div>

      {!acted && (
        <div style={{ display: 'flex', gap: '0.5rem', margin: '0.75rem 0', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={busy} onClick={() => run(actions.submit)}>
            🤝 Submit as a Shared Concept
          </button>
          <button
            className="btn" disabled={busy || hasRealB} onClick={() => run(actions.keep)}
            title={hasRealB ? REAL_B_REASON : 'Mark as deliberately unaffiliated (never broadcast).'}
          >
            🔒 Keep private
          </button>
        </div>
      )}

      {!acted && (
        <div style={{ margin: '0.5rem 0' }}>
          <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            🔗 …or wire to an external shared concept
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text" value={target} onChange={(e) => setTarget(e.target.value)}
              placeholder="kind:pubkey:d-tag — pick below or paste"
              style={{
                flex: 1, padding: '0.4rem 0.6rem', fontSize: '0.85rem',
                backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
                border: '1px solid var(--border, #444)', borderRadius: '4px',
              }}
            />
            <button className="btn" disabled={busy || !target.trim()} onClick={doWire}>Wire</button>
          </div>
          {communityRows === null && <p className="text-muted" style={{ fontSize: '0.8rem' }}>Searching the community relay…</p>}
          {Array.isArray(communityRows) && communityRows.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0', maxHeight: '10rem', overflowY: 'auto' }}>
              {communityRows.map((r) => (
                <li key={r.uuid}>
                  <button
                    className="btn" style={{ fontSize: '0.8rem', margin: '0.1rem 0' }}
                    disabled={busy} onClick={() => setTarget(r.uuid)}
                    title={r.description || r.uuid}
                  >
                    {r.name || r.uuid}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {message && <p style={{ fontSize: '0.85rem' }}>{message}</p>}
      {acted && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {hasNext && <button className="btn btn-primary" onClick={onNext}>Next undecided →</button>}
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      )}
    </div>
  );
}
