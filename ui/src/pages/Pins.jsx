import React from 'react';
import { Link } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { useAuth } from '../context/AuthContext';
import usePins from '../hooks/usePins';
import useRefreshPin from '../hooks/useRefreshPin';
import { KNOWN_CONTEXTS } from '@tapestry/event-tagging';

/**
 * Story 10 / ADR 0009 — viewer's pinned-tag list page.
 * Story 11 / ADR 0010 — per-row tlStatus + export-status lines; top-of-list
 * Refresh all button.
 */
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
      Web of Trust meet the <code>cutoff</code> (default 1)
      <em> and</em> outnumber any disputes.
    </p>
  );
}

/**
 * Story 20 / ADR 0018 — one pinned-tag row is a plain link to its tag's detail
 * page with the Pinned tab selected. No per-row actions or overflow menu
 * (per-pin management moved to the Pinned tab). A right-edge chevron signals
 * tappability — important on touch, where there is no hover.
 */
// contextual-pins ADR 0001 — the viewer may hold several coexisting pins of one
// tag (neutral + one per community context). The index shows each TAG once; the
// per-pin management lives on the tag's Pinned tab. A badge line names the pins.
function contextLabel(context) {
  if (!context) return 'Personal';
  return KNOWN_CONTEXTS.find((c) => c.slug === context)?.name || context;
}

function PinRow({ group }) {
  const { tag, pins } = group;
  // Neutral first, then contexts alphabetically — stable regardless of pin order.
  const ordered = [...pins].sort((a, b) => {
    if (!a.context && b.context) return -1;
    if (a.context && !b.context) return 1;
    return contextLabel(a.context).localeCompare(contextLabel(b.context));
  });
  return (
    <li className="bs-pins-row">
      <Link
        className="bs-pins-row-link"
        to={`/tag/${encodeURIComponent(tag.slug)}/${tag.eventId}?tab=pinned`}
      >
        <span className="bs-pins-row-main">
          <span className="bs-pins-row-name">{tag.name}</span>
          {tag.description && (
            <span className="bs-pins-row-desc">{tag.description}</span>
          )}
          <span className="bs-pins-row-contexts">
            {ordered.map((p) => (
              <span key={p.pinEventId} className={`bs-pins-context-badge${p.context ? ' is-community' : ''}`}>
                📌 {contextLabel(p.context)}
              </span>
            ))}
          </span>
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
              {(() => {
                // Group pin rows by tag so each tag appears once.
                const byTag = new Map();
                for (const row of pins) {
                  const key = row.tag.eventId;
                  if (!byTag.has(key)) byTag.set(key, { tag: row.tag, pins: [] });
                  byTag.get(key).pins.push(row);
                }
                return [...byTag.values()].map((group) => (
                  <PinRow key={group.tag.eventId} group={group} />
                ));
              })()}
            </ul>
            <PinsMemberCountHint />
          </>
        )}
      </div>
    </div>
  );
}
