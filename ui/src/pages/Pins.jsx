import React from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import TLShareButton from '../components/TLShareButton';
import { useAuth } from '../context/AuthContext';
import usePins from '../hooks/usePins';
import useRefreshPin from '../hooks/useRefreshPin';

/**
 * Story 10 / ADR 0009 — viewer's pinned-tag list page.
 * Story 11 / ADR 0010 — per-row tlStatus + Refresh now button; top-of-list
 * Refresh all button.
 */
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

function PinsIntro() {
  return (
    <div className="bs-pins-intro">
      <p>
        Pinning a tag tells this instance to periodically publish a{' '}
        <strong>Trusted List</strong> (NIP-85 kind-30392) under your point-of-view,
        listing the profiles that the tag applies to. Other Nostr apps can
        read those lists for content discovery, list curation, and
        trust-weighted ranking.
      </p>
    </div>
  );
}

function PinsMemberCountHint() {
  return (
    <p className="bs-pins-member-hint">
      A profile becomes a list member when its endorsements from your
      Web of Trust meet the <code>cutoff</code> (default 2)
      <em> and</em> outnumber any disputes.
    </p>
  );
}

function renderStatusLine(tlStatus) {
  if (!tlStatus) return null;
  switch (tlStatus.status) {
    case 'ok':
      return (
        <span className="bs-pins-row-status is-ok">
          Refreshed {timeAgoShort(tlStatus.lastRefreshAt)}
          {tlStatus.memberCount != null && ` · ${tlStatus.memberCount} members`}
        </span>
      );
    case 'never':
      return <span className="bs-pins-row-status is-never">No TL yet</span>;
    case 'retracted':
      return <span className="bs-pins-row-status is-retracted">Retracted</span>;
    case 'unsupported':
      return (
        <span className="bs-pins-row-status is-unsupported">
          Unsupported curation method (v1 supports nip85:rank only)
        </span>
      );
    default:
      return null;
  }
}

export default function Pins() {
  const { user, login } = useAuth();
  const { pins, loading, error, refetch } = usePins(user?.pubkey);
  const { refreshing, refreshOne, refreshAll, error: refreshError } = useRefreshPin(user?.pubkey);

  if (!user) {
    return (
      <div className="bsp-page">
        <TopBar />
        <div className="bsp-content bs-pins-page">
          <h1 className="bs-pins-heading">Your pinned tags</h1>
          <PinsIntro />
          <p className="bs-pins-empty">
            Sign in with a NIP-07 extension to manage your pinned tags.
          </p>
          <button
            type="button"
            className="bs-pins-signin-btn"
            onClick={() => { login().catch(() => { }); }}
          >
            Sign in
          </button>
        </div>
      </div>
    );
  }

  const handleRefreshOne = async (pinEventId) => {
    try {
      await refreshOne(pinEventId);
      await refetch();
    } catch { /* useRefreshPin captures the error */ }
  };
  const handleRefreshAll = async () => {
    try {
      await refreshAll();
      await refetch();
    } catch { /* useRefreshPin captures the error */ }
  };

  const refreshableCount = pins.filter((p) => p.tlStatus?.status !== 'unsupported').length;

  return (
    <div className="bsp-page">
      <TopBar />
      <div className="bsp-content bs-pins-page">
        <h1 className="bs-pins-heading">Your pinned tags</h1>
        <PinsIntro />
        {loading && <p className="bs-pins-loading">Loading your pins…</p>}
        {error && <p className="bs-pins-error" role="alert">⚠️ {error}</p>}
        {!loading && !error && pins.length === 0 && (
          <p className="bs-pins-empty">
            You haven't pinned any tags yet.{' '}
            <Link to="/tags" className="bs-pins-browse-link">Browse tags →</Link>
          </p>
        )}
        {!loading && !error && pins.length > 0 && (
          <>
            {refreshableCount > 0 && (
              <div className="bs-pins-refresh-all-row">
                <button
                  type="button"
                  className="bs-pins-refresh-all"
                  onClick={handleRefreshAll}
                  disabled={refreshing === 'all'}
                >
                  {refreshing === 'all' ? 'Refreshing all…' : '🔄 Refresh all'}
                </button>
                {refreshError && (
                  <span className="bs-pins-row-error" role="alert">⚠️ {refreshError}</span>
                )}
              </div>
            )}
            <ul className="bs-pins-list">
              {pins.map((row) => {
                const isUnsupported = row.tlStatus?.status === 'unsupported';
                const isRefreshingThis = refreshing === `one:${row.pinEventId}`;
                // Compute the TL's d-tag for /pin/:dTag link + share button.
                const observer = row.curationMethod?.observer;
                const tlDTag = (!isUnsupported && observer)
                  ? `tl-pin-${observer.slice(0, 8)}-${row.tag.authorPubkey.slice(0, 8)}-${row.tag.slug}`
                  : null;
                const hasTl = row.tlStatus?.status === 'ok' || row.tlStatus?.status === 'retracted';
                return (
                  <li key={row.pinEventId} className="bs-pins-row">
                    {hasTl && tlDTag ? (
                      <Link
                        to={`/pin/${encodeURIComponent(tlDTag)}`}
                        className="bs-pins-row-link"
                        title="Open Trusted List detail"
                      >
                        <span className="bs-pins-row-name">{row.tag.name}</span>
                        {row.tag.description && (
                          <span className="bs-pins-row-desc">{row.tag.description}</span>
                        )}
                        {renderStatusLine(row.tlStatus)}
                      </Link>
                    ) : (
                      <Link
                        to={`/tag/${encodeURIComponent(row.tag.slug)}/${row.tag.eventId}`}
                        className="bs-pins-row-link"
                      >
                        <span className="bs-pins-row-name">{row.tag.name}</span>
                        {row.tag.description && (
                          <span className="bs-pins-row-desc">{row.tag.description}</span>
                        )}
                        {renderStatusLine(row.tlStatus)}
                      </Link>
                    )}
                    <div className="bs-pins-row-actions">
                      {tlDTag && hasTl && (
                        <TLShareButton dTag={tlDTag} variant="compact" />
                      )}
                      <button
                        type="button"
                        className="bs-pins-row-refresh"
                        onClick={() => handleRefreshOne(row.pinEventId)}
                        disabled={isUnsupported || isRefreshingThis || refreshing === 'all'}
                      >
                        {isRefreshingThis ? 'Refreshing…' : 'Refresh now'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <PinsMemberCountHint />
          </>
        )}
      </div>
    </div>
  );
}
