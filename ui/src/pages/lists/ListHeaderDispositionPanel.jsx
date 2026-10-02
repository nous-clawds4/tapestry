import { useState } from 'react';
import { MARKS } from '../../utils/listHeaderDisposition';
import { submitAndBroadcast, keepPrivate } from '../../utils/myAssistantDisposition';

const REAL_B_REASON = 'this header already carries a real b — deferral applies only to unaffiliated headers';

/**
 * The List Headers disposition panel for one of the signed-in person's own Assistant's headers
 * (ADR list-headers-disposition/0003). Modelled on components/DispositionPanel.jsx, which stays
 * Concept Headers'. Submit as a Shared Concept and Keep private here; Wire arrives with story 4.
 * The server signs with the person's own Assistant only; `onActed(event)` hands the signed version
 * back so the row shows its new state without a reload.
 */
export default function ListHeaderDispositionPanel({ row, onActed, hasNext, onNext, onClose }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [acted, setActed] = useState(false);

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

  return (
    <div style={{
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
