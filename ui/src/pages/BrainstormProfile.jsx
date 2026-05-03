import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';
import { useProfileActions } from '../hooks/useProfileActions';
import useUserData from '../hooks/useUserData';
import ConfirmDialog from '../components/ConfirmDialog';
import ReportModal from '../components/ReportModal';

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
  { tag: 'rank',                         label: 'Verification Score',          icon: '🏅', description: 'Community-mediated Verification Score (a.k.a. rank) (0–100 percent).' },
  { tag: 'followers',                    label: 'Verified Followers',          icon: '👥', description: 'Verified Follower count, based on the Verification Score being above a threshold (2 by default).' },
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
  const { user, login, logout } = useAuth();

  // POV suffix can be passed as ?pov=<8char> from the search page
  const povParam = searchParams.get('pov');

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [trustScores, setTrustScores] = useState(null);
  const [trustLoading, setTrustLoading] = useState(true);
  const [trustError, setTrustError] = useState(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);

  const {
    isFollowing, isMuted, hasReported,
    actionLoading, error: actionError,
    follow, unfollow, mute, unmute, report,
    needsConfirmation, confirmAction, cancelAction,
  } = useProfileActions(pubkey, user?.pubkey);

  const showActions = user && user.pubkey !== pubkey;

  const { data: userData, loading: userDataLoading } = useUserData(pubkey);
  const followingCount = userData?.followingCount ?? null;
  const fmtCount = (n) => (n == null ? '—' : new Intl.NumberFormat().format(n));

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


  return (
    <div className="bsp-page">
      {/* Top bar */}
      <div className="bsp-top-bar">
        <a href="/" className="bsp-logo">
          <img src="/brainstorm.svg" alt="" className="bsp-logo-img" />
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

            {/* Following count */}
            <div className={`bsp-counts ${userDataLoading ? 'bsp-counts-loading' : ''}`}>
              <span className="bsp-count">
                <span className="bsp-count-value">{fmtCount(followingCount)}</span>
                <span className="bsp-count-label">Following</span>
              </span>
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
    </div>
  );
}
