import { useMemo, useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { findGenericTlDelegation, upsertGenericTlTag } from '../../utils/treasureMap';
import { getActiveSignerOrThrow } from '../../utils/signerGuard';
import { publishOrThrow } from '../../utils/publishProfileTag';

const KIND_PUBKEY_TL = 30392;

/**
 * The salient question of the TA Treasure Map page (tl-treasure-map #3): does
 * this Map delegate pubkey Trusted Lists, and to this instance's Assistant?
 * Three states — absent / external / local — with the opt-in prompt, a live
 * preview of the exact updated unsigned kind-10040, and the NIP-07 sign +
 * publish flow (drift-guarded; local strfry + external relays via
 * publishOrThrow, which inherits the deployment's local-only publish gate).
 */
export default function TlOptInCard({ event, onPublished }) {
  const { taPubkey, aRelays } = useConfig();
  const [showPreview, setShowPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);

  const delegation = useMemo(() => findGenericTlDelegation(event?.tags, KIND_PUBKEY_TL), [event]);
  const relayHint = aRelays?.aTrustedListRelays?.[0] || '';

  // Representative preview; the publish handler recomposes fresh so created_at
  // is stamped at publish time.
  const preview = useMemo(
    () => (taPubkey ? upsertGenericTlTag(event, KIND_PUBKEY_TL, taPubkey, relayHint) : null),
    [event, taPubkey, relayHint]
  );

  // No judgment until the runtime TA pubkey resolves — never flash a verdict
  // computed against a missing baseline.
  if (!event || !taPubkey) return null;

  const status = !delegation ? 'absent' : delegation.pubkey === taPubkey ? 'local' : 'external';

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    try {
      // Refuse to sign as an extension account drifted from the session.
      const authorPk = await getActiveSignerOrThrow();
      const unsigned = { ...upsertGenericTlTag(event, KIND_PUBKEY_TL, taPubkey, relayHint), pubkey: authorPk };
      const signed = await window.nostr.signEvent(unsigned);
      await publishOrThrow(signed);
      if (onPublished) onPublished();
    } catch (err) {
      setError(err?.message || 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  }

  const titleStyle = { margin: '0 0 0.5rem', fontSize: '0.85rem', opacity: 0.7 };

  if (status === 'local') {
    return (
      <div style={{
        padding: '0.75rem 1rem', marginBottom: '1rem',
        border: '1px solid #3fb950', borderRadius: '6px',
        backgroundColor: 'rgba(63, 185, 80, 0.08)',
      }}>
        <h4 style={titleStyle}>Trusted Lists for Pubkeys ({KIND_PUBKEY_TL})</h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' }}>
          <span style={{ fontSize: '1.25rem' }}>✅</span>
          <div>
            Published by this instance's Tapestry Assistant.
            {delegation.relay && (
              <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.6, marginLeft: '0.5rem' }}>
                {delegation.relay}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      padding: '1rem', marginBottom: '1rem',
      border: '1px solid #f59e0b', borderRadius: '6px',
      backgroundColor: 'rgba(245, 158, 11, 0.06)',
    }}>
      <h4 style={titleStyle}>Trusted Lists for Pubkeys ({KIND_PUBKEY_TL})</h4>

      <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
        {status === 'absent' ? (
          <>Your Treasure Map does not yet delegate Trusted Lists for pubkeys.</>
        ) : (
          <>
            Currently delegated to an external publisher{' '}
            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
              {delegation.pubkey.slice(0, 8)}…{delegation.pubkey.slice(-4)}
            </span>.
          </>
        )}
      </div>

      <p style={{ fontSize: '0.95rem', margin: '0 0 0.75rem' }}>
        Would you like the local Tapestry instance to publish your Trusted Lists for pubkeys on your behalf? If so, you will need to update your Treasure Map so external clients can find your Trusted Lists.
      </p>

      {/* Preview sits above the publish button (operator request): inspect the
          exact updated event first, then act on it. */}
      <div style={{ marginBottom: '0.75rem' }}>
        <button
          className="btn btn-sm"
          onClick={() => setShowPreview((v) => !v)}
          style={{ fontSize: '0.8rem' }}
        >
          {showPreview ? '▾ Hide preview' : '▸ Preview updated event'}
        </button>
        {showPreview && preview && (
          <pre style={{
            marginTop: '0.75rem', padding: '1rem',
            backgroundColor: 'var(--bg-primary, #0f0f23)',
            border: '1px solid var(--border, #444)',
            borderRadius: '6px', fontSize: '0.75rem',
            overflow: 'auto', maxHeight: '320px',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {JSON.stringify(preview, null, 2)}
          </pre>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          className="btn btn-sm btn-primary"
          onClick={handlePublish}
          disabled={publishing}
        >
          {publishing ? '⏳ Publishing…' : '📤 Yes — update my Treasure Map'}
        </button>
        {status === 'external' && (
          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
            The external entry is replaced; every other tag is preserved.
          </span>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: '0.75rem', padding: '0.5rem 0.75rem',
          border: '1px solid #f85149', borderRadius: '6px',
          backgroundColor: 'rgba(248, 81, 73, 0.08)',
          color: '#f85149', fontSize: '0.85rem',
        }}>
          Error: {error}
        </div>
      )}
    </div>
  );
}
