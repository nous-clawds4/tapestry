import { useState } from 'react';
import useCommunitySharedConcepts from '../hooks/useCommunitySharedConcepts';
import { classifyBValue } from '../utils/bDisposition';
import { publishToRelays } from '../utils/nostrPublish';

// Same community target as the self-declare button (ConceptDetail.jsx).
const CONCEPT_PUBLISH_RELAYS = ['wss://dcosl.brainstorm.world'];

/**
 * The guided-disposition panel (ADR shared-concepts-adoption/0001): three
 * symmetric actions on one of the instance's own concept headers — wire to an
 * external shared concept (pointer-b), submit as a shared concept
 * (self-declare), or keep private (the reserved sentinel). Wire and declare
 * broadcast the re-signed header to the community relay; keep-private never
 * broadcasts. No route of its own — rendered inline by ConceptList.
 */
export default function DispositionPanel({ handle, name, disposition, onActed, onNext, hasNext, onClose }) {
  const { rows: communityRows } = useCommunitySharedConcepts();
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [acted, setActed] = useState(false);

  const post = async (action, body) => {
    const resp = await fetch(`/api/concept/${encodeURIComponent(handle)}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    });
    return resp.json();
  };

  const finish = (text) => { setMessage(text); setActed(true); setBusy(false); onActed?.(); };

  const doWire = async () => {
    const t = target.trim();
    if (classifyBValue(t) !== 'a-tag') {
      setMessage('The target must be an a-tag coordinate (kind:pubkey:d-tag).');
      return;
    }
    setBusy(true); setMessage(null);
    try {
      const data = await post('b-append', { target: t });
      if (!data.success) { setMessage(data.error || 'Wiring failed.'); setBusy(false); return; }
      try {
        await publishToRelays(data.event, CONCEPT_PUBLISH_RELAYS);
        finish(data.result === 'already-wired' ? 'Already wired — re-broadcast to the community relay.' : 'Wired — broadcast to the community relay.');
      } catch {
        finish('Wired locally — community broadcast failed (retry from the concept page).');
      }
    } catch (err) { setMessage(err.message); setBusy(false); }
  };

  const doDeclare = async () => {
    setBusy(true); setMessage(null);
    try {
      const data = await post('self-declare');
      if (!data.success) { setMessage(data.error || 'Self-declare failed.'); setBusy(false); return; }
      try {
        await publishToRelays(data.event, CONCEPT_PUBLISH_RELAYS);
        finish(data.result === 'already-declared' ? 'Already self-declared — re-broadcast to the community relay.' : 'Submitted as a shared concept.');
      } catch {
        finish('Self-declared locally — community broadcast failed (retry from the concept page).');
      }
    } catch (err) { setMessage(err.message); setBusy(false); }
  };

  const doDefer = async () => {
    setBusy(true); setMessage(null);
    try {
      const data = await post('b-defer');
      if (!data.success) { setMessage(data.error || 'Keep-private failed.'); setBusy(false); return; }
      // Deliberately NO broadcast: deferral is a stance, not an announcement.
      finish('Kept private — this header is marked as deliberately unaffiliated.');
    } catch (err) { setMessage(err.message); setBusy(false); }
  };

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
