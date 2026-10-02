import { useEffect, useRef, useState } from 'react';
import { MARKS } from '../../utils/listHeaderDisposition';
import { submitAndBroadcast, keepPrivate, wireAndBroadcast } from '../../utils/myAssistantDisposition';
import { classifyBValue } from '../../utils/bDisposition';
import useCommunitySharedConcepts from '../../hooks/useCommunitySharedConcepts';

const REAL_B_REASON = 'this header already carries a real b — deferral applies only to unaffiliated headers';
// The server's two step-4b refusals (ADR list-headers-disposition/0004), shown here without asking it.
const NOT_AN_ADDRESS = 'The target must be a header address (kind:pubkey:d-tag)';
const OWN_ADDRESS = "That's this header's own address — use Submit as a Shared Concept instead";

/**
 * Holds the Wire pick-list for a whole panel session (ADR list-headers-disposition/0004): the panel
 * itself is keyed by row, so Next remounts it, and a hook inside it would read the community relay once
 * per row. The host stays mounted across Next and is unmounted when the panel closes.
 */
export function ListHeaderDispositionHost(props) {
  const { rows } = useCommunitySharedConcepts();
  return <ListHeaderDispositionPanel key={props.row.routeId} {...props} communityRows={rows} />;
}

/**
 * The List Headers disposition panel for one of the signed-in person's own Assistant's headers
 * (ADR list-headers-disposition/0003). Modelled on components/DispositionPanel.jsx, which stays
 * Concept Headers'. Submit as a Shared Concept, Keep private, and Wire (story 4, ADR 0004).
 * The server signs with the person's own Assistant only; `onActed(event)` hands the signed version
 * back so the row shows its new state without a reload.
 */
export default function ListHeaderDispositionPanel({ row, onActed, hasNext, onNext, onClose, communityRows }) {
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
      setMessage(err.message); setBusy(false);
    }
  };

  // The panel checks the two things the server would refuse before the relay is read, without asking it.
  const doWire = () => {
    const t = target.trim();
    if (classifyBValue(t) !== 'a-tag') { setMessage(NOT_AN_ADDRESS); return; }
    if (t === row.routeId) { setMessage(OWN_ADDRESS); return; }
    run((handle) => wireAndBroadcast(handle, t));
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
          <button className="btn btn-primary" disabled={busy} onClick={() => run(submitAndBroadcast)}>
            🤝 Submit as a Shared Concept
          </button>
          <button
            className="btn" disabled={busy || hasRealB} onClick={() => run(keepPrivate)}
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
