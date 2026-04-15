import { useState, useEffect, useCallback } from 'react';
import { publishEverywhere, importAddressableToNeo4j } from '../../utils/nostrPublish';

const NOSTR_RELAY_TAG_Z_TAG =
  '39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-relay-tag';

/**
 * RelayTagPanel — shows tag applications attached to a relay, lets a logged-in
 * user add new ones via NIP-07.
 *
 * @param {object} props
 * @param {string} props.relayEventId  the kind 39999 relay event being tagged
 * @param {string} props.relaySlug     used for the human-readable d-tag/name on the applied event
 * @param {object|null} props.user     from AuthContext; null when not logged in
 */
export default function RelayTagPanel({ relayEventId, relaySlug, user }) {
  const [availableTags, setAvailableTags] = useState(null);
  const [applications, setApplications] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publishing, setPublishing] = useState(null); // tag slug currently being published
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey(k => k + 1), []);

  useEffect(() => {
    if (!relayEventId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [tagsResp, appsResp] = await Promise.all([
          fetch('/api/relay-discovery/available-tags').then(r => r.json()),
          fetch(`/api/relay-discovery/tags-for-relay?relayEventId=${relayEventId}`).then(r => r.json()),
        ]);
        if (cancelled) return;
        if (!tagsResp.success) throw new Error(tagsResp.error || 'Failed to load tags');
        if (!appsResp.success) throw new Error(appsResp.error || 'Failed to load applications');
        setAvailableTags(tagsResp.tags || []);
        setApplications(appsResp.applications || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [relayEventId, reloadKey]);

  const applyTag = useCallback(async (tag) => {
    if (!window.nostr) {
      setError('No NIP-07 extension detected.');
      return;
    }
    setError(null);
    setPublishing(tag.slug);
    try {
      const pubkey = await window.nostr.getPublicKey();
      const dTag = `tag-app-${tag.slug}-${relayEventId.slice(0, 8)}-${pubkey.slice(0, 8)}`;
      const payload = {
        nostrRelayTag: {
          relayEventId,
          tagEventId: tag.eventId,
        },
      };
      const unsigned = {
        kind: 39999,
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', dTag],
          ['name', `${relaySlug || 'relay'} is ${tag.slug}`],
          ['z', NOSTR_RELAY_TAG_Z_TAG],
          ['json', JSON.stringify(payload)],
        ],
        content: '',
      };
      const signed = await window.nostr.signEvent(unsigned);
      const result = await publishEverywhere(signed);
      const localOk = result?.local?.success;
      const externalOk = (result?.external?.successes?.length || 0) > 0;
      if (!localOk && !externalOk) {
        throw new Error(result?.local?.error || 'Publish failed on every relay.');
      }
      importAddressableToNeo4j(signed).catch(() => {});
      refetch();
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setPublishing(null);
    }
  }, [relayEventId, relaySlug, refetch]);

  if (loading) {
    return <div className="rtp-loading">Loading tags…</div>;
  }
  if (error) {
    return <div className="rtp-error">⚠️ {error}</div>;
  }

  const appsByTagEventId = new Map();
  for (const app of applications || []) {
    const arr = appsByTagEventId.get(app.tagEventId) || [];
    arr.push(app);
    appsByTagEventId.set(app.tagEventId, arr);
  }

  const myPubkey = user?.pubkey;
  const mySet = new Set(
    (applications || []).filter(a => a.authorPubkey === myPubkey).map(a => a.tagEventId)
  );

  return (
    <div className="rtp">
      <div className="rtp-section">
        <div className="rtp-label">Applied tags</div>
        {(applications || []).length === 0 ? (
          <div className="rtp-empty">No tag applications yet.</div>
        ) : (
          <div className="rtp-badges">
            {(availableTags || []).map(tag => {
              const apps = appsByTagEventId.get(tag.eventId) || [];
              if (apps.length === 0) return null;
              const mine = apps.some(a => a.authorPubkey === myPubkey);
              return (
                <span
                  key={tag.eventId}
                  className={`rtp-badge ${mine ? 'rtp-badge-mine' : ''}`}
                  title={`${apps.length} endorsement${apps.length === 1 ? '' : 's'}${mine ? ' (including you)' : ''}`}
                >
                  {tag.name}
                  <span className="rtp-badge-count">{apps.length}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      <div className="rtp-section">
        <div className="rtp-label">Apply a tag</div>
        {!user && (
          <div className="rtp-hint">Log in via NIP-07 to tag this relay.</div>
        )}
        <div className="rtp-picker">
          {(availableTags || []).map(tag => {
            const alreadyApplied = mySet.has(tag.eventId);
            const isPublishing = publishing === tag.slug;
            return (
              <button
                key={tag.eventId}
                className={`rtp-tag-btn ${alreadyApplied ? 'rtp-tag-btn-applied' : ''}`}
                title={tag.description || tag.name}
                disabled={!user || alreadyApplied || isPublishing || publishing !== null}
                onClick={() => applyTag(tag)}
              >
                {isPublishing ? '…' : alreadyApplied ? '✓ ' : '+ '}
                {tag.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
