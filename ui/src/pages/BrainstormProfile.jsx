import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';
import { useProfileActions } from '../hooks/useProfileActions';
import ConfirmDialog from '../components/ConfirmDialog';
import ReportModal from '../components/ReportModal';
import PublishRelayForm from './relay-discovery/PublishRelayForm';
import RelayTagPanel from './relay-discovery/RelayTagPanel';

/* ── Helpers ──────────────────────────────────────────── */

function timeAgo(unixSeconds) {
  if (!unixSeconds) return null;
  const now = Date.now() / 1000;
  const diff = now - unixSeconds;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

function shortPubkey(pk) {
  if (!pk) return '—';
  return pk.slice(0, 12) + '…' + pk.slice(-8);
}

/* ── Trust Score Tags ────────────────────────────────── */

const TRUST_METRICS = [
  { tag: 'rank',                         label: 'WoT Rank',          icon: '🏅', description: 'Composite trust rank (0–100)' },
  { tag: 'followers',                    label: 'Followers',          icon: '👥', description: 'Verified follower count' },
  { tag: 'hops',                         label: 'Hops',              icon: '🔗', description: 'Degrees of separation' },
  { tag: 'personalizedGrapeRank_influence', label: 'Influence',      icon: '📊', description: 'GrapeRank influence score' },
  { tag: 'personalizedGrapeRank_average',   label: 'Average',        icon: '📈', description: 'GrapeRank average rating' },
  { tag: 'personalizedGrapeRank_confidence', label: 'Confidence',    icon: '🎯', description: 'GrapeRank confidence level' },
  { tag: 'personalizedGrapeRank_input',     label: 'Input',          icon: '📥', description: 'GrapeRank input score' },
  { tag: 'personalizedPageRank',            label: 'PageRank',       icon: '📄', description: 'Personalized PageRank' },
  { tag: 'verifiedFollowerCount',           label: 'Verified Followers', icon: '✅', description: 'Count of verified followers' },
  { tag: 'verifiedMuterCount',             label: 'Muters',          icon: '🔇', description: 'Users who muted this profile' },
  { tag: 'verifiedReporterCount',          label: 'Reporters',       icon: '🚩', description: 'Users who reported this profile' },
];

/* ── Copy Button ─────────────────────────────────────── */

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="bsp-copy-btn"
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      title="Copy to clipboard"
    >
      {copied ? '✓' : '📋'}
    </button>
  );
}

/* ── Main Component ──────────────────────────────────── */

export default function BrainstormProfile() {
  const { pubkey } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();

  // POV suffix can be passed as ?pov=<8char> from the search page
  const povParam = searchParams.get('pov');

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [trustScores, setTrustScores] = useState(null);
  const [trustLoading, setTrustLoading] = useState(true);
  const [trustError, setTrustError] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const [relays, setRelays] = useState(null);
  const [relaysLoading, setRelaysLoading] = useState(true);
  const [relaysError, setRelaysError] = useState(null);
  const [relaysOpen, setRelaysOpen] = useState(true);
  const [publishOpen, setPublishOpen] = useState(false);
  const [relaysReloadKey, setRelaysReloadKey] = useState(0);
  const [expandedRelay, setExpandedRelay] = useState(null);

  const {
    isFollowing, isMuted, hasReported,
    actionLoading, error: actionError,
    follow, unfollow, mute, unmute, report,
    needsConfirmation, confirmAction, cancelAction,
  } = useProfileActions(pubkey, user?.pubkey);

  const showActions = user && user.pubkey !== pubkey;

  const npub = useMemo(() => {
    try { return nip19.npubEncode(pubkey); } catch { return null; }
  }, [pubkey]);
  const displayName = profile?.display_name || profile?.name || shortPubkey(pubkey);
  const profileAge = timeAgo(profile?.created_at);

  // Fetch profile from API
  useEffect(() => {
    if (!pubkey) return;
    setProfileLoading(true);
    fetch(`/api/profiles?pubkeys=${pubkey}`)
      .then(r => r.json())
      .then(data => {
        if (data.profiles?.[pubkey]) {
          setProfile(data.profiles[pubkey]);
        }
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [pubkey]);

  // Fetch trust scores from Meilisearch (where bulk-loaded scores live)
  useEffect(() => {
    if (!pubkey) return;
    setTrustLoading(true);
    setTrustError(null);
    setTrustScores(null);

    (async () => {
      try {
        // Use POV from URL param, or fall back to house delegated pubkey
        let povSuffix = povParam || null;
        if (!povSuffix) {
          try {
            const prefsResp = await fetch('/api/grapevine/preferences');
            const prefsData = await prefsResp.json();
            if (prefsData?.preferences?.delegatedPubkey) {
              povSuffix = prefsData.preferences.delegatedPubkey.slice(0, 8);
            }
          } catch { /* ignore */ }
        }

        const resp = await fetch(`/api/search/profiles/meili/document/${pubkey}`);
        const data = await resp.json();

        if (!data.success || !data.document) {
          setTrustError('No trust scores available for this user.');
          return;
        }

        // Extract wot_* fields from the Meilisearch document
        // Try namespaced fields first (wot_rank_<suffix>), fall back to legacy (wot_rank)
        const doc = data.document;
        const scores = {};
        const skipSuffixes = ['pov', 'updated_at'];

        for (const [key, value] of Object.entries(doc)) {
          if (!key.startsWith('wot_')) continue;
          const rest = key.slice(4); // strip "wot_"

          // Check if it's a namespaced field matching our POV suffix
          if (povSuffix && rest.endsWith(`_${povSuffix}`)) {
            const metric = rest.slice(0, -(povSuffix.length + 1));
            if (!skipSuffixes.includes(metric)) {
              scores[metric] = value;
            }
          }
        }

        // If no namespaced fields found, fall back to legacy un-namespaced fields
        if (Object.keys(scores).length === 0) {
          for (const [key, value] of Object.entries(doc)) {
            if (key.startsWith('wot_') && key !== 'wot_pov' && key !== 'wot_updated_at') {
              scores[key.replace('wot_', '')] = value;
            }
          }
        }

        if (Object.keys(scores).length === 0) {
          setTrustError('No trust scores available for this user.');
          return;
        }

        setTrustScores(scores);
      } catch (err) {
        setTrustError(`Failed to load trust data: ${err.message}`);
      } finally {
        setTrustLoading(false);
      }
    })();
  }, [pubkey, povParam]);

  // Fetch relays (NIP-65 + DCoSL) for this profile
  useEffect(() => {
    if (!pubkey) return;
    let cancelled = false;
    setRelaysLoading(true);
    setRelaysError(null);
    setRelays(null);

    (async () => {
      try {
        const resp = await fetch(`/api/relay-discovery/by-pubkey?pubkey=${pubkey}`);
        const data = await resp.json();
        if (cancelled) return;
        if (!data.success) {
          setRelaysError(data.error || 'Failed to load relays');
          setRelays([]);
        } else {
          setRelays(data.relays || []);
        }
      } catch (err) {
        if (!cancelled) {
          setRelaysError(err.message);
          setRelays([]);
        }
      } finally {
        if (!cancelled) setRelaysLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pubkey, relaysReloadKey]);

  return (
    <div className="bsp-page">
      {/* Top bar */}
      <div className="bsp-top-bar">
        <button
          className="bsp-back-btn"
          onClick={() => navigate(-1)}
        >
          ← Back to search
        </button>
        <a href="/" className="bsp-logo">
          <img src="/brainstorm.svg" alt="" className="bsp-logo-img" />
          Brainstorm
        </a>
        <div className="bsp-auth">
          <BrainstormUserMenu user={user} login={login} logout={logout} />
        </div>
      </div>

      {/* Profile content */}
      <div className="bsp-content">
        {profileLoading ? (
          <div className="bsp-loading">Loading profile…</div>
        ) : (
          <>
            {/* Banner */}
            {profile?.banner && (
              <div className="bsp-banner" style={{ backgroundImage: `url(${profile.banner})` }} />
            )}

            {/* Header row: avatar + name */}
            <div className="bsp-header">
              {profile?.picture ? (
                <img
                  src={profile.picture}
                  alt=""
                  className="bsp-avatar"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              ) : (
                <div className="bsp-avatar bsp-avatar-placeholder">
                  {(displayName || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="bsp-header-info">
                <h1 className="bsp-name">{displayName}</h1>
                {profile?.nip05 && <div className="bsp-nip05">✅ {profile.nip05}</div>}
                {profileAge && <span className="bsp-age">Updated {profileAge}</span>}
              </div>
            </div>

            {/* Action buttons */}
            {showActions && (
              <div className="bsp-actions">
                <button
                  className={`bsp-action-btn ${isFollowing ? 'bsp-action-active' : ''}`}
                  onClick={isFollowing ? unfollow : follow}
                  disabled={actionLoading !== null || isFollowing === null}
                >
                  {actionLoading === 'follow' || actionLoading === 'unfollow'
                    ? 'Working\u2026'
                    : isFollowing ? 'Unfollow' : 'Follow'}
                </button>

                <button
                  className={`bsp-action-btn bsp-action-mute ${isMuted ? 'bsp-action-active' : ''}`}
                  onClick={isMuted ? unmute : mute}
                  disabled={actionLoading !== null || isMuted === null}
                >
                  {actionLoading === 'mute' || actionLoading === 'unmute'
                    ? 'Working\u2026'
                    : isMuted ? 'Unmute' : 'Mute'}
                </button>

                <button
                  className={`bsp-action-btn bsp-action-report ${hasReported ? 'bsp-action-reported' : ''}`}
                  onClick={() => setReportModalOpen(true)}
                  disabled={actionLoading !== null || hasReported === true}
                >
                  {hasReported ? 'Reported' : 'Report'}
                </button>

                {actionError && <div className="bsp-action-error">{actionError}</div>}
              </div>
            )}

            {/* About */}
            {profile?.about && (
              <div className="bsp-section">
                <h3>About</h3>
                <p className="bsp-about">{profile.about}</p>
              </div>
            )}

            {/* Identity */}
            <div className="bsp-section">
              <h3>Identity</h3>
              <div className="bsp-id-grid">
                <div className="bsp-id-row">
                  <span className="bsp-id-label">Pubkey (hex)</span>
                  <code className="bsp-id-value">{shortPubkey(pubkey)}</code>
                  <CopyButton value={pubkey} />
                </div>
                {npub && (
                  <div className="bsp-id-row">
                    <span className="bsp-id-label">npub</span>
                    <code className="bsp-id-value">{npub.slice(0, 20)}…{npub.slice(-8)}</code>
                    <CopyButton value={npub} />
                  </div>
                )}
                {profile?.website && (
                  <div className="bsp-id-row">
                    <span className="bsp-id-label">Website</span>
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="bsp-id-link">
                      {profile.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  </div>
                )}
                {profile?.lud16 && (
                  <div className="bsp-id-row">
                    <span className="bsp-id-label">Lightning</span>
                    <span className="bsp-id-value">⚡ {profile.lud16}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Reputation */}
            <div className="bsp-section">
              <h3>Reputation</h3>

              {trustLoading && (
                <div className="bsp-trust-loading">Loading reputation data…</div>
              )}

              {trustError && (
                <div className="bsp-trust-unavailable">
                  <span className="bsp-trust-icon">🔒</span>
                  <span>{trustError}</span>
                </div>
              )}

              {trustScores && !trustLoading && (
                <div className="bsp-trust-grid">
                  {TRUST_METRICS.map(metric => {
                    const value = trustScores[metric.tag];
                    if (value == null) return null;
                    return (
                      <div key={metric.tag} className="bsp-trust-card" title={metric.description}>
                        <div className="bsp-trust-card-icon">{metric.icon}</div>
                        <div className="bsp-trust-card-body">
                          <div className="bsp-trust-card-value">{value}</div>
                          <div className="bsp-trust-card-label">{metric.label}</div>
                        </div>
                      </div>
                    );
                  }).filter(Boolean)}
                </div>
              )}

              {trustScores && Object.keys(trustScores).length === 0 && (
                <div className="bsp-trust-unavailable">
                  <span className="bsp-trust-icon">📭</span>
                  <span>No reputation scores available for this user.</span>
                </div>
              )}
            </div>

            {/* Relays */}
            <div className="bsp-section">
              <div className="bsp-section-header">
                <h3
                  className="bsp-section-toggle"
                  onClick={() => setRelaysOpen(o => !o)}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  {relaysOpen ? '▾' : '▸'} Relays
                  {relays && <span className="bsp-badge"> {relays.length}</span>}
                </h3>
                {user && (
                  <button
                    className="bsp-action-btn"
                    onClick={() => setPublishOpen(true)}
                    title="Publish a new relay entry to the nostr-relay concept"
                  >
                    + Publish relay
                  </button>
                )}
              </div>

              {relaysOpen && (
                <>
                  {relaysLoading && (
                    <div className="bsp-trust-loading">Fetching relays from the network…</div>
                  )}

                  {!relaysLoading && relaysError && (
                    <div className="bsp-trust-unavailable">
                      <span className="bsp-trust-icon">⚠️</span>
                      <span>{relaysError}</span>
                    </div>
                  )}

                  {!relaysLoading && !relaysError && relays && relays.length === 0 && (
                    <div className="bsp-trust-unavailable">
                      <span className="bsp-trust-icon">📭</span>
                      <span>
                        No NIP-65 (kind 10002) or DCoSL (kind 39999) relay entries published by this account.
                      </span>
                    </div>
                  )}

                  {!relaysLoading && relays && relays.length > 0 && (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '1.5rem' }}></th>
                          <th>Relay URL</th>
                          <th>Source</th>
                          <th>Read</th>
                          <th>Write</th>
                        </tr>
                      </thead>
                      <tbody>
                        {relays.map((r) => {
                          // Only rows with a DCoSL relay event can have tag applications
                          // (tag apps reference a kind 39999 relay event id).
                          const taggable = r.source === 'dcsl' || r.source === 'both';
                          const isExpanded = expandedRelay === r.websocketUrl;
                          return (
                            <React.Fragment key={r.websocketUrl}>
                              <tr
                                className={taggable ? 'clickable' : ''}
                                onClick={() => {
                                  if (!taggable) return;
                                  setExpandedRelay(isExpanded ? null : r.websocketUrl);
                                }}
                              >
                                <td style={{ textAlign: 'center', opacity: 0.6 }}>
                                  {taggable ? (isExpanded ? '▾' : '▸') : ''}
                                </td>
                                <td>
                                  <code>{r.websocketUrl}</code>
                                  {r.httpUrl && (
                                    <>
                                      {' '}
                                      <a
                                        href={r.httpUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="bsp-id-link"
                                        onClick={(e) => e.stopPropagation()}
                                      >↗</a>
                                    </>
                                  )}
                                </td>
                                <td>
                                  {r.source === 'both'
                                    ? 'NIP-65 + DCoSL'
                                    : r.source === 'nip65'
                                    ? 'NIP-65'
                                    : 'DCoSL'}
                                </td>
                                <td>{r.read ? '✓' : ''}</td>
                                <td>{r.write ? '✓' : ''}</td>
                              </tr>
                              {isExpanded && taggable && (
                                <tr className="rtp-row">
                                  <td colSpan={5}>
                                    <RelayTagPanel
                                      relayEventId={r.eventId}
                                      relaySlug={r.slug}
                                      user={user}
                                    />
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {!profileLoading && !profile && (
          <div className="bsp-not-found">
            <p>Profile not found. This user may not have published a kind 0 event.</p>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ConfirmDialog
        open={!!needsConfirmation}
        title={needsConfirmation?.title || ''}
        message={needsConfirmation?.message || ''}
        onConfirm={confirmAction}
        onCancel={cancelAction}
      />

      <ReportModal
        open={reportModalOpen}
        loading={actionLoading === 'report'}
        onSubmit={async (type, note) => {
          await report(type, note);
          setReportModalOpen(false);
        }}
        onCancel={() => setReportModalOpen(false)}
      />

      <PublishRelayForm
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        onPublished={() => setRelaysReloadKey(k => k + 1)}
      />
    </div>
  );
}
