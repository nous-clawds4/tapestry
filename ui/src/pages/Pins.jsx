import React from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
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

/**
 * Story 19 — render the kind-30000 NIP-51 export-status line below
 * the kind-30392 tlStatus line. Distinguishes three states:
 *   - never-exported → inviting "Not yet exported for other clients" hint
 *   - ok-fresh       → "Exported X ago · in sync"
 *   - stale          → "Exported X ago · N changes since last export"
 */
function renderExportStatusLine(nip51) {
  if (!nip51) return null;
  switch (nip51.status) {
    case 'never-exported':
      return (
        <span className="bs-pins-row-export-status is-never">
          Not yet exported for other clients
        </span>
      );
    case 'ok-fresh':
      return (
        <span className="bs-pins-row-export-status is-fresh">
          Exported {timeAgoShort(nip51.exportedAt)} · in sync
        </span>
      );
    case 'stale': {
      const diff = nip51.diffVsTL || { added: 0, removed: 0 };
      const total = (diff.added || 0) + (diff.removed || 0);
      return (
        <span className="bs-pins-row-export-status is-stale">
          Exported {timeAgoShort(nip51.exportedAt)} · {total} change{total === 1 ? '' : 's'} since last export
          {diff.added > 0 && ` (+${diff.added}`}{diff.removed > 0 && ` ${diff.added > 0 ? '/ ' : '('}−${diff.removed}`}{(diff.added > 0 || diff.removed > 0) && ')'}
        </span>
      );
    }
    default:
      return null;
  }
}

/**
 * Story 20 / ADR 0018 — one pinned-tag row is now a plain link to its
 * tag's detail page with the Pinned tab selected. No per-row actions or
 * overflow menu (per-pin management moved to the Pinned tab). A
 * right-edge chevron signals tappability — important on touch, where
 * there is no hover. Read-only status lines remain informational.
 */
function PinRow({ row }) {
  const isUnsupported = row.tlStatus?.status === 'unsupported';
  return (
    <li className="bs-pins-row">
      <Link
        className="bs-pins-row-link"
        to={`/tag/${encodeURIComponent(row.tag.slug)}/${row.tag.eventId}?tab=pinned`}
      >
        <span className="bs-pins-row-main">
          <span className="bs-pins-row-name">{row.tag.name}</span>
          {row.tag.description && (
            <span className="bs-pins-row-desc">{row.tag.description}</span>
          )}
          {renderStatusLine(row.tlStatus)}
          {!isUnsupported && renderExportStatusLine(row.nip51ExportStatus)}
        </span>
        <span className="bs-pins-row-chevron" aria-hidden="true">›</span>
      </Link>
    </li>
  );
}

export default function Pins() {
  const { user, login } = useAuth();
  const { pins, loading, error, refetch } = usePins(user?.pubkey);
  const { refreshing, refreshAll, error: refreshError } = useRefreshPin(user?.pubkey);

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
              {pins.map((row) => (
                <PinRow key={row.pinEventId} row={row} />
              ))}
            </ul>
            <PinsMemberCountHint />
          </>
        )}
      </div>
    </div>
  );
}
