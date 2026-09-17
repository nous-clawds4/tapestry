import { useState } from 'react';
import useCommunitySharedConcepts from '../hooks/useCommunitySharedConcepts';
import { classifyBValue } from '../utils/bDisposition';
import { declareAndBroadcast, defer, wireAndBroadcast } from '../utils/dispositionActions';

/**
 * The guided-disposition panel (ADR shared-concepts-adoption/0001): three
 * symmetric actions on one of the instance's own concept headers — wire to an
 * external shared concept (pointer-b), submit as a shared concept
 * (self-declare), or keep private (the reserved sentinel). The action
 * mechanics + broadcast-fallback strings live in utils/dispositionActions
 * (extracted behavior-preserving, ADR 0003, shared with the Adoption Queue's
 * publish view). No route of its own — rendered inline by ConceptList.
 */
export default function DispositionPanel({ handle, name, disposition, onActed, onNext, hasNext, onClose }) {
  const { rows: communityRows } = useCommunitySharedConcepts();
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [acted, setActed] = useState(false);

  const finish = (text) => { setMessage(text); setActed(true); setBusy(false); onActed?.(); };
  const run = async (fn) => {
    setBusy(true); setMessage(null);
    try { finish(await fn()); }
    catch (err) { setMessage(err.message); setBusy(false); }
  };

  const doWire = () => {
    const t = target.trim();
    if (classifyBValue(t) !== 'a-tag') {
      setMessage('The target must be an a-tag coordinate (kind:pubkey:d-tag).');
      return;
    }
    run(() => wireAndBroadcast(handle, t));
  };
  const doDeclare = () => run(() => declareAndBroadcast(handle));
  const doDefer = () => run(() => defer(handle));

  const deferBlocked = disposition && (disposition.wired || disposition.selfDeclared);

  return (
    <div style={{
      border: '1px solid var(--border, #444)', borderRadius: '8px', padding: '1rem',
      marginBottom: '1rem', backgroundColor: 'var(--bg-secondary, #1a1a2e)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Disposition: {name || handle}</strong>
        <button className="btn" onClick={onClose}>✕</button>
      </div>

      {!acted && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', margin: '0.75rem 0', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={busy} onClick={doDeclare}>
              🤝 Submit as a Shared Concept
            </button>
            <button
              className="btn" disabled={busy || deferBlocked} onClick={doDefer}
              title={deferBlocked ? 'This header already carries a real b — deferral applies only to unaffiliated headers.' : 'Mark as deliberately unaffiliated (never broadcast).'}
            >
              🔒 Keep private
            </button>
          </div>
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
        </>
      )}

      {message && <p style={{ fontSize: '0.85rem' }}>{message}</p>}
      {acted && (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {hasNext && <button className="btn btn-primary" onClick={onNext}>Next undispositioned →</button>}
          <button className="btn" onClick={onClose}>Done</button>
        </div>
      )}
    </div>
  );
}
