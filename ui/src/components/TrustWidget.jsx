import { useState, useRef, useEffect } from 'react';
import { nip19 } from 'nostr-tools';
import { useTrust, SCORING_METHODS } from '../context/TrustContext';
import { useAuth } from '../context/AuthContext';
import { OWNER_PUBKEY } from '../config/pubkeys';

/**
 * TrustWidget — floating bottom-right control for POV + scoring method.
 *
 * Writes through the shared TrustContext, so any component using
 * `useTrust()` or `useTrustWeights()` re-renders automatically on change
 * (the useTrustWeights effect re-runs on povPubkey / scoringMethod delta
 * and re-fetches weights from strfry / external relays).
 */

function decodePubkey(input) {
  if (!input) return null;
  const t = input.trim();
  if (/^[0-9a-f]{64}$/i.test(t)) return t.toLowerCase();
  try {
    const d = nip19.decode(t);
    if (d.type === 'npub') return d.data;
    if (d.type === 'nprofile') return d.data.pubkey;
  } catch {}
  return null;
}

function shortPk(pk) {
  if (!pk) return '(none)';
  return `${pk.slice(0, 8)}…${pk.slice(-4)}`;
}

export default function TrustWidget() {
  const { povPubkey, scoringMethod, setPovPubkey, setScoringMethod, resetToOwner } = useTrust();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [draftPov, setDraftPov] = useState('');
  const [error, setError] = useState(null);
  const rootRef = useRef(null);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function applyDraftPov() {
    setError(null);
    if (!draftPov.trim()) {
      setError('Enter an npub, nprofile, or 64-char hex pubkey.');
      return;
    }
    const hex = decodePubkey(draftPov);
    if (!hex) {
      setError("Couldn't decode — expected npub / nprofile / hex.");
      return;
    }
    setPovPubkey(hex);
    setDraftPov('');
  }

  const methodLabel = SCORING_METHODS.find(m => m.id === scoringMethod)?.label || scoringMethod;
  const povIsMe = user?.pubkey && user.pubkey === povPubkey;
  const povIsOwner = povPubkey === OWNER_PUBKEY;

  return (
    <div className="trust-widget" ref={rootRef}>
      {!open && (
        <button
          type="button"
          className="trust-widget-pill"
          onClick={() => setOpen(true)}
          title="Trust Determination — click to change POV / scoring method"
        >
          <span className="trust-widget-pill-label">🔑 {methodLabel}</span>
          <span className="trust-widget-pill-pov">{shortPk(povPubkey)}</span>
        </button>
      )}

      {open && (
        <div className="trust-widget-panel">
          <div className="trust-widget-header">
            <span className="trust-widget-title">Trust Determination</span>
            <button
              type="button"
              className="trust-widget-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >×</button>
          </div>

          <div className="trust-widget-section">
            <div className="trust-widget-label">Scoring method</div>
            <div className="trust-widget-methods">
              {SCORING_METHODS.map(m => (
                <label key={m.id} className={`trust-widget-method ${scoringMethod === m.id ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="trust-method"
                    checked={scoringMethod === m.id}
                    onChange={() => setScoringMethod(m.id)}
                  />
                  <span>{m.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="trust-widget-section">
            <div className="trust-widget-label">Point of view</div>
            <div className="trust-widget-pov-current">
              <code title={povPubkey || ''}>{shortPk(povPubkey)}</code>
              {povIsMe && <span className="trust-widget-badge">me</span>}
              {povIsOwner && <span className="trust-widget-badge">owner</span>}
            </div>
            <div className="trust-widget-pov-actions">
              {user?.pubkey && (
                <button
                  type="button"
                  className="trust-widget-btn"
                  disabled={povIsMe}
                  onClick={() => setPovPubkey(user.pubkey)}
                >
                  Use my pubkey
                </button>
              )}
              <button
                type="button"
                className="trust-widget-btn"
                disabled={povIsOwner}
                onClick={resetToOwner}
              >
                Reset to owner
              </button>
            </div>
            <div className="trust-widget-pov-input">
              <input
                type="text"
                placeholder="npub1… / nprofile1… / hex pubkey"
                value={draftPov}
                onChange={e => { setDraftPov(e.target.value); setError(null); }}
                onKeyDown={e => { if (e.key === 'Enter') applyDraftPov(); }}
              />
              <button
                type="button"
                className="trust-widget-btn trust-widget-btn-primary"
                onClick={applyDraftPov}
              >Set</button>
            </div>
            {error && <div className="trust-widget-error">{error}</div>}
          </div>

          <div className="trust-widget-footer">
            Changes apply live across the app via TrustContext.{' '}
            <a href="/kg/grapevine/trust-determination" className="bsp-id-link">Full settings →</a>
          </div>
        </div>
      )}
    </div>
  );
}
