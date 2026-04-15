import { useState, useMemo } from 'react';
import { publishEverywhere, importAddressableToNeo4j } from '../../utils/nostrPublish';

const NOSTR_RELAY_Z_TAG =
  '39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-relay';

function deriveSlug(wsUrl) {
  return (wsUrl || '')
    .trim()
    .replace(/^wss?:\/\//, '')
    .replace(/\/+$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function isValidWs(url) {
  return /^wss?:\/\/.+/i.test((url || '').trim());
}

function isValidHttp(url) {
  if (!url) return true;
  return /^https?:\/\/.+/i.test(url.trim());
}

export default function PublishRelayForm({ open, onClose, onPublished }) {
  const [wsUrl, setWsUrl] = useState('');
  const [httpUrl, setHttpUrl] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const autoSlug = useMemo(() => deriveSlug(wsUrl), [wsUrl]);
  const effectiveSlug = slugTouched ? slug : autoSlug;

  const canSubmit =
    isValidWs(wsUrl) && isValidHttp(httpUrl) && effectiveSlug && !submitting;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!window.nostr) {
      setError('No NIP-07 extension detected. Install nos2x, Alby, or similar and reload.');
      return;
    }

    const normalizedWs = wsUrl.trim().replace(/\/+$/, '');
    const normalizedHttp = httpUrl.trim() ? httpUrl.trim().replace(/\/+$/, '') : undefined;

    setSubmitting(true);
    try {
      const pubkey = await window.nostr.getPublicKey();
      const dTag = `${effectiveSlug}-${pubkey.slice(0, 8)}`;
      const payload = {
        nostrRelay: {
          slug: effectiveSlug,
          websocketUrl: normalizedWs,
          ...(normalizedHttp ? { httpUrl: normalizedHttp } : {}),
        },
      };
      const unsigned = {
        kind: 39999,
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', dTag],
          ['name', effectiveSlug],
          ['z', NOSTR_RELAY_Z_TAG],
          ['json', JSON.stringify(payload)],
        ],
        content: '',
      };
      const signed = await window.nostr.signEvent(unsigned);
      const result = await publishEverywhere(signed);

      const localOk = result?.local?.success;
      const externalOk = (result?.external?.successes?.length || 0) > 0;
      if (!localOk && !externalOk) {
        throw new Error(
          result?.local?.error || 'Publish failed on every relay (local + external).',
        );
      }

      // Pull the event into Neo4j so it becomes queryable as a ListItem.
      // Best-effort: we don't block UI success on this.
      importAddressableToNeo4j(signed).catch(() => {});

      onPublished?.({ signed, result });
      setWsUrl('');
      setHttpUrl('');
      setSlug('');
      setSlugTouched(false);
      onClose?.();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="bsp-modal-backdrop" onClick={onClose}>
      <div className="bsp-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Publish a relay entry</h3>
        <p className="bsp-modal-help">
          Publishes a DCoSL kind 39999 event authored by you, asserting that this relay
          exists in the <code>nostr-relay</code> concept. Signed via your NIP-07 extension
          and fanned out to local strfry + the default public relays.
        </p>

        <form onSubmit={handleSubmit} className="bsp-form">
          <label className="bsp-form-row">
            <span>Websocket URL *</span>
            <input
              type="text"
              placeholder="wss://relay.example.com"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
              autoFocus
              required
            />
          </label>

          <label className="bsp-form-row">
            <span>HTTP URL (optional)</span>
            <input
              type="text"
              placeholder="https://relay.example.com"
              value={httpUrl}
              onChange={(e) => setHttpUrl(e.target.value)}
            />
          </label>

          <label className="bsp-form-row">
            <span>Slug</span>
            <input
              type="text"
              placeholder="auto-derived from URL"
              value={effectiveSlug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
            />
          </label>

          {error && <div className="bsp-form-error">{error}</div>}

          <div className="bsp-form-actions">
            <button type="button" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" disabled={!canSubmit}>
              {submitting ? 'Signing & publishing…' : 'Sign & publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
