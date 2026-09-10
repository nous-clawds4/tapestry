import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';
import { findGenericTlDelegation, upsertGenericTlTag, describeTlDelegation } from '../../utils/treasureMap';
import { getActiveSignerOrThrow } from '../../utils/signerGuard';
import { publishOrThrow } from '../../utils/publishProfileTag';

const KIND_PUBKEY_TL = 30392;

// Colours for the collapsed line's status label, keyed by describeTlDelegation's `tone`
// (dlist-curation #1, ADR 0001 §1). The label text itself lives in the helper, not here.
const TONE_COLOR = { ok: '#3fb950', warn: '#f59e0b', none: '#8b949e' };

/**
 * The salient question of the TA Treasure Map page (tl-treasure-map #3): does
 * this Map delegate pubkey Trusted Lists, and to this instance's Assistant?
 * Three states — absent / external / local — with the opt-in prompt, a live
 * preview of the exact updated unsigned kind-10040, and the NIP-07 sign +
 * publish flow (drift-guarded; local strfry + external relays via
 * publishOrThrow, which inherits the deployment's local-only publish gate).
 *
 * Folded by default (dlist-curation #1): the header line is the disclosure
 * control AND the status line — title on the left, the three-state verdict on
 * the right — so the page scans as a list of status lines. The body underneath
 * is the pre-fold card, unchanged.
 */
export default function TlOptInCard({ event, onPublished }) {
  // The delegate is the SIGNED-IN USER'S assistant (per-user, minted at
  // signup; getAssistantKeys). The ConfigContext TA value is the instance
  // OWNER's assistant and must not be used here — on a dev box the two
  // coincide (operator == owner), which is how the escaped defect hid
  // (OPEN.md 188; the suite bars that token from this file).
  const { user } = useAuth();
  const assistantPubkey = user?.assistantPubkey || null;
  const { aRelays } = useConfig();
  const [open, setOpen] = useState(false); // folded on every load, in every state
  const [showPreview, setShowPreview] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);

  const delegation = useMemo(() => findGenericTlDelegation(event?.tags, KIND_PUBKEY_TL), [event]);
  const relayHint = aRelays?.aTrustedListRelays?.[0] || '';

  // Representative preview; the publish handler recomposes fresh so created_at
  // is stamped at publish time.
  const preview = useMemo(
    () => (assistantPubkey ? upsertGenericTlTag(event, KIND_PUBKEY_TL, assistantPubkey, relayHint) : null),
    [event, assistantPubkey, relayHint]
  );

  // No judgment until the user's assistant resolves — and a user with no
  // provisioned assistant (guest) gets no card at all: there is nothing
  // valid to compose.
  if (!event || !assistantPubkey) return null;

  const desc = describeTlDelegation(delegation, assistantPubkey);
  const status = desc.status;

  async function handlePublish() {
    setPublishing(true);
    setError(null);
    try {
      // Refuse to sign as an extension account drifted from the session.
      const authorPk = await getActiveSignerOrThrow();
      const unsigned = { ...upsertGenericTlTag(event, KIND_PUBKEY_TL, assistantPubkey, relayHint), pubkey: authorPk };
      const signed = await window.nostr.signEvent(unsigned);
      await publishOrThrow(signed);
      if (onPublished) onPublished();
    } catch (err) {
      setError(err?.message || 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  }

  const toggle = () => setOpen((v) => !v);
  const titleStyle = { margin: 0, fontSize: '0.85rem', opacity: 0.7 };

  return (
    <div style={{
      padding: status === 'local' ? '0.75rem 1rem' : '1rem', marginBottom: '1rem',
      border: `1px solid ${status === 'local' ? '#3fb950' : '#f59e0b'}`, borderRadius: '6px',
      backgroundColor: status === 'local' ? 'rgba(63, 185, 80, 0.08)' : 'rgba(245, 158, 11, 0.06)',
    }}>
      {/* Header = the disclosure control AND the status line (the page's settled idiom —
          TreasureMapRelayPresence, ADR treasure-map-relay-presence/0003). A real control, not a
          clickable div: the fold puts the opt-in prompt and the publish button behind it, so it
          must be reachable and announce its state without a mouse. */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={`Trusted Lists for Pubkeys (${KIND_PUBKEY_TL}) — ${desc.label}`}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault(); // Space would otherwise scroll the page
            toggle();
          }
        }}
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem',
          cursor: 'pointer', marginBottom: open ? '0.5rem' : 0,
        }}
      >
        <h4 style={titleStyle}>{open ? '▾' : '▸'} Trusted Lists for Pubkeys ({KIND_PUBKEY_TL})</h4>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: TONE_COLOR[desc.tone], whiteSpace: 'nowrap' }}>
          {desc.label}
        </span>
      </div>

      {open && (status === 'local' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem' }}>
          <span style={{ fontSize: '1.25rem' }}>✅</span>
          <div>
            Published by your Tapestry Assistant.
            {delegation.relay && (
              <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', opacity: 0.6, marginLeft: '0.5rem' }}>
                {delegation.relay}
              </span>
            )}
          </div>
        </div>
      ) : (
        <>
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
            Tags of pubkeys greatly enrich Vespa search on brainstorm.world. For this to work, a kind 30392 Trusted List should be published for each Tag. Would you like the local Tapestry instance to publish your Trusted Lists for pubkeys on your behalf? If so, you will need to update your Treasure Map so external clients can find your Trusted Lists.
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
        </>
      ))}
    </div>
  );
}
