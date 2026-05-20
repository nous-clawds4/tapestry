import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import TopBar from '../components/TopBar';
import TLShareButton from '../components/TLShareButton';
import { useAuth } from '../context/AuthContext';
import useTLDetail from '../hooks/useTLDetail';
import { TA_PUBKEY } from '../utils/publishTagPin';

/**
 * Story 11 follow-up — Brainstorm-side detail page for one pinned-tag
 * Trusted List. URL: /pin/:dTag.
 *
 * Renders the TL's metadata header (title, observer, source-tag, cutoff,
 * min-rank, last refresh), a Refresh now button (when the viewer owns the
 * pin), a Share button (naddr to clipboard), and a member list with
 * avatars, NIP-05 / display name, endorsement / dispute counts, and links
 * to each member's profile.
 */
function shortNpub(pk) {
  if (!pk) return '—';
  try {
    const npub = nip19.npubEncode(pk);
    return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
  } catch {
    return `${pk.slice(0, 12)}…${pk.slice(-8)}`;
  }
}

function timeAgoShort(unixSeconds) {
  if (!unixSeconds) return null;
  const now = Date.now() / 1000;
  const diff = now - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

export default function PinDetail() {
  const { dTag } = useParams();
  const { user } = useAuth();
  const { tl, members, loading, error, refetch } = useTLDetail(dTag);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);

  // Pre-encode the NIP-19 naddr so users without clipboard-API access
  // can still copy it manually from the metadata table.
  const naddr = useMemo(() => {
    if (!dTag) return null;
    try {
      return nip19.naddrEncode({
        kind: 30392, pubkey: TA_PUBKEY, identifier: dTag, relays: [],
      });
    } catch { return null; }
  }, [dTag]);

  // The TL's observer is the rightful owner for refresh-now. The endpoint
  // does its own auth check; we just enable/disable the affordance based
  // on the session.
  const canRefresh = user && tl && user.pubkey === tl.observer;

  const handleRefresh = async () => {
    if (!canRefresh) return;
    setRefreshing(true); setRefreshError(null);
    try {
      // The refresh endpoint takes a pinEventId, not a d-tag. We need to
      // find the corresponding pin event — look it up from the viewer's
      // /api/profile-tags/pins response. Cheap because the response is
      // already paginated to one viewer's pins.
      const r = await fetch(`/api/profile-tags/pins?viewerPubkey=${encodeURIComponent(user.pubkey)}`);
      const j = await r.json();
      const pin = (j?.pins || []).find((p) =>
        p.tag?.eventId === tl.sourceTag?.eventId
        && p.tag?.slug === tl.sourceTag?.slug
      );
      if (!pin) throw new Error('Pin event not found for this TL');
      const rr = await fetch('/api/trusted-list/refresh-pinned-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinEventId: pin.pinEventId }),
      });
      const data = await rr.json().catch(() => null);
      if (!rr.ok || !data?.success) throw new Error(data?.error || `status ${rr.status}`);
      await refetch();
    } catch (e) {
      setRefreshError(e.message || 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="bsp-page">
      <TopBar />
      <div className="bsp-content bs-pindetail-page">
        <Link to="/pins" className="bs-pindetail-breadcrumb">← Your pinned tags</Link>

        {loading && <p className="bs-pindetail-loading">Loading Trusted List…</p>}
        {error && <p className="bs-pindetail-error" role="alert">⚠️ {error}</p>}

        {tl && (
          <>
            <header className="bs-pindetail-header">
              <h1 className="bs-pindetail-title">
                {tl.title || tl.dTag}
              </h1>
              <div className="bs-pindetail-actions">
                {canRefresh && (
                  <button
                    type="button"
                    className="bs-pindetail-refresh"
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    {refreshing ? 'Refreshing…' : '🔄 Refresh now'}
                  </button>
                )}
                <TLShareButton dTag={tl.dTag} variant="full" />
              </div>
              {refreshError && (
                <p className="bs-pindetail-error" role="alert">⚠️ {refreshError}</p>
              )}
              {tl.retracted && (
                <p className="bs-pindetail-retracted">
                  This Trusted List has been retracted (the underlying tag was unpinned).
                </p>
              )}
            </header>

            <dl className="bs-pindetail-meta">
              {tl.sourceTag && (
                <>
                  <dt>Tag</dt>
                  <dd>
                    <Link
                      to={`/tag/${encodeURIComponent(tl.sourceTag.slug)}/${tl.sourceTag.eventId}`}
                      className="bs-pindetail-tag-link"
                    >
                      {tl.title || tl.sourceTag.slug}
                    </Link>
                  </dd>
                </>
              )}
              <dt>Observer</dt>
              <dd>
                <a href={`/user/${tl.observer}`} className="bs-pindetail-observer">
                  {tl.observer === user?.pubkey ? 'You' : shortNpub(tl.observer)}
                </a>
              </dd>
              <dt>Cutoff</dt>
              <dd>{tl.cutoff} (members need ≥ {tl.cutoff} WoT-trusted endorsements)</dd>
              {tl.minRank > 0 && (
                <>
                  <dt>Min rank</dt>
                  <dd>{tl.minRank} (endorsement authors must have <code>wot_rank ≥ {tl.minRank}</code>)</dd>
                </>
              )}
              <dt>Last refreshed</dt>
              <dd>{timeAgoShort(tl.createdAt)}</dd>
              <dt>d-tag</dt>
              <dd className="bs-pindetail-id">
                <code>{tl.dTag}</code>
              </dd>
              {naddr && (
                <>
                  <dt>Share ID (naddr)</dt>
                  <dd className="bs-pindetail-id">
                    <code>{naddr}</code>
                  </dd>
                </>
              )}
            </dl>

            <h2 className="bs-pindetail-members-heading">
              Members ({members.length})
            </h2>
            {members.length === 0 ? (
              <p className="bs-pindetail-empty">
                No profiles qualified under the current cutoff and disputes function.
              </p>
            ) : (
              <ul className="bs-pindetail-members">
                {members.map((m) => (
                  <li key={m.pubkey} className="bs-pindetail-member">
                    <a href={`/user/${m.pubkey}`} className="bs-pindetail-member-link">
                      {m.picture ? (
                        <img
                          src={m.picture}
                          alt=""
                          className="bs-pindetail-member-avatar"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="bs-pindetail-member-avatar bs-pindetail-member-avatar-placeholder">👤</div>
                      )}
                      <div className="bs-pindetail-member-info">
                        <span className="bs-pindetail-member-name">
                          {m.displayName || shortNpub(m.pubkey)}
                        </span>
                        {m.nip05 && (
                          <span className="bs-pindetail-member-nip05">{m.nip05}</span>
                        )}
                      </div>
                      <span className="bs-pindetail-member-counts">
                        {m.endorsements != null
                          ? <>+{m.endorsements}{m.disputes ? ` · −${m.disputes}` : ''}</>
                          : null}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
