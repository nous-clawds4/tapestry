import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useAuth } from '../context/AuthContext';
import TopBar from '../components/TopBar';
import { useConfig } from '../context/ConfigContext';
import { useProfileActions } from '../hooks/useProfileActions';
import useUserCounts from '../hooks/useUserCounts';
import useFollowsHops from '../hooks/useFollowsHops';
import useNip05Verification from '../hooks/useNip05Verification';
import ConfirmDialog from '../components/ConfirmDialog';
import ReportModal from '../components/ReportModal';
import ProfileTagsSection from '../components/ProfileTagsSection';
import AuthoredTaggingSection from '../components/AuthoredTaggingSection';
import { timeAgo } from '../utils/timeAgo';
import { toExternalUrl } from '../utils/url';
import VerificationInfo from '../components/VerificationInfo';
import ReputationInfo from '../components/ReputationInfo';
import IdentityDetails from '../components/IdentityDetails';
import ProfileContentSection from '../components/ProfileContentSection';

/* ── Verified Reporters alarm thresholds (ADR 0032) ──────
   Alarm (red + icon) only when verifiedReporterCount >= BASE + one "freebie" per
   FREEBIE_PER verified followers — so popular accounts aren't red-flagged for the
   handful of verified reporters they naturally accrue. */
const REPORTER_ALARM_BASE = 3;
const REPORTER_ALARM_FREEBIE_PER = 750;

/* ── Helpers ──────────────────────────────────────────── */

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

/* ── Main Component ──────────────────────────────────── */

export default function BrainstormProfile() {
  const { pubkey } = useParams();
  const [searchParams] = useSearchParams();
  const { user, login, logout } = useAuth();
  const { ownerPubkey } = useConfig();

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

  const { data: userCounts, loading: userCountsLoading } = useUserCounts(pubkey);
  const nip05Verified = useNip05Verification(pubkey, profile?.nip05);
  // Follows-hops: live shortestPath from the viewer (or the Owner when logged out)
  // to this profile (story #38, ADR 0034). Its own hook — loads independently of
  // the page and the other counts, so it never blocks render.
  const hopsSource = user?.pubkey || ownerPubkey;
  const { hops: followsHops, noPath: followsNoPath, loading: followsHopsLoading, error: followsHopsError } = useFollowsHops(hopsSource, pubkey);
  const followingCount = userCounts?.followingCount ?? null;
  const fmtCount = (n) => (n == null ? '—' : new Intl.NumberFormat().format(n));
  // Verified Followers + Verified Reporters counts come from the Owner-PoV source
  // (Neo4j via get-user-counts → useUserCounts) — same definition as the /followers and
  // /reporters tables, NOT Meili (ADR 0031). `?? null` keeps a genuine 0 distinct from
  // "not loaded" → "—"; never a raw-follower substitution.
  const verifiedFollowerCount = userCounts?.verifiedFollowerCount ?? null;
  const verifiedMuterCount = userCounts?.verifiedMuterCount ?? null;
  const verifiedReporterCount = userCounts?.verifiedReporterCount ?? null;
  // Dynamic alarm: red + icon only past a popularity-adjusted threshold (ADR 0032).
  // No alarm when either count is unavailable (no crying wolf on incomplete data).
  const reporterAlarm =
    verifiedReporterCount != null && verifiedFollowerCount != null &&
    verifiedReporterCount >= REPORTER_ALARM_BASE + Math.floor(verifiedFollowerCount / REPORTER_ALARM_FREEBIE_PER);

  const npub = useMemo(() => {
    try { return nip19.npubEncode(pubkey); } catch { return null; }
  }, [pubkey]);
  const displayName = profile?.display_name || profile?.name || shortPubkey(pubkey);
  const profileAge = timeAgo(profile?.created_at);

  // Follows-hops display (story #38, ADR 0034): number | ∞ (confirmed no path) |
  // "—" (lookup error / loading). ∞ is keyed on the hook's `noPath`, NOT on an
  // error, so a failed/timed-out lookup never shows a false ∞.
  const hopsSourceName = (() => {
    if (user && hopsSource === user.pubkey) {
      const n = user.profile?.display_name || user.profile?.name;
      if (n) return n;
    }
    try { return nip19.npubEncode(hopsSource).slice(0, 12) + '…'; } catch { return 'the source'; }
  })();
  let hopsDisplay = '—';
  let hopsTitle = 'Hop distance…';
  if (followsHopsError) {
    hopsDisplay = '—';
    hopsTitle = 'Hop distance unavailable.';
  } else if (followsNoPath) {
    hopsDisplay = '∞';
    hopsTitle = `There is no follow path from ${hopsSourceName} to ${displayName}.`;
  } else if (followsHops != null) {
    hopsDisplay = fmtCount(followsHops);
    hopsTitle = `${displayName} is ${followsHops} hop${followsHops === 1 ? '' : 's'} away from ${hopsSourceName} by follows.`;
  }

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
      <TopBar />

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
                <div className="bsp-name-row">
                  <h1 className="bsp-name">{displayName}</h1>
                  <IdentityDetails pubkey={pubkey} npub={npub} />
                </div>
                {profile?.nip05 && <div className="bsp-nip05">{nip05Verified && '✅ '}{profile.nip05}</div>}
                {profileAge && <span className="bsp-age">Updated {profileAge}</span>}
              </div>
            </div>

            {/* Following + Verified Followers + Verified Reporters counts */}
            <div className={`bsp-counts ${userCountsLoading ? 'bsp-counts-loading' : ''}`}>
              <Link to={`/user/${pubkey}/follows`} className="bsp-count bsp-count-link">
                <span className="bsp-count-value">{fmtCount(followingCount)}</span>
                <span className="bsp-count-label">Following</span>
              </Link>
              {/* Verified Followers → followers table (story #34, ADR 0030). Value is the
                  Owner-PoV count from useUserCounts (ADR 0031), same source as the table. */}
              <Link to={`/user/${pubkey}/followers`} className="bsp-count bsp-count-link">
                <span className="bsp-count-value">{fmtCount(verifiedFollowerCount)}</span>
                <span className="bsp-count-label">Verified Followers</span>
              </Link>
              {/* Follows-hops (story #38, ADR 0034; link activated #39, ADR 0035): live
                  shortestPath source→profile, cap 20. Links to the path page in ALL states.
                  ∞ = no path within cap; "—" = unavailable (error/timeout) or loading. */}
              <Link to={`/user/${pubkey}/follows-hops`} className={`bsp-count bsp-count-link${followsHopsLoading ? ' bsp-count-loading' : ''}`} title={hopsTitle}>
                <span className="bsp-count-value">{hopsDisplay}</span>
                <span className="bsp-count-label">Hops</span>
              </Link>
              {/* Line break (verified-muters #2, ADR 0002): forces the "bad" indicators
                  below onto the next flex line, away from the good ones above. */}
              <span className="bsp-count-break" aria-hidden="true" />
              {/* Verified Muters → /user/:pubkey/muters. Neutral, like Verified Followers:
                  always a plain <Link>, no alarm icon and no negative styling — "bad" is
                  conveyed only via the line break (ADR 0002). Owner-PoV count from
                  useUserCounts, same source as the /muters table. */}
              <Link to={`/user/${pubkey}/muters`} className="bsp-count bsp-count-link">
                <span className="bsp-count-value">{fmtCount(verifiedMuterCount)}</span>
                <span className="bsp-count-label">Verified Muters</span>
              </Link>
              {/* Verified Reporters → /user/:pubkey/reporters. Always a <Link> when >0; a
                  genuine 0 is neutral and not a link; "—" when unavailable; dimmed "—" while
                  loading. The red + 🚩 alarm shows ONLY past the dynamic threshold
                  (reporterAlarm, ADR 0032) — a benign count looks neutral. */}
              {verifiedReporterCount > 0 ? (
                <Link
                  to={`/user/${pubkey}/reporters`}
                  className="bsp-count bsp-count-link"
                  aria-label={`${verifiedReporterCount} verified reporters. View list.`}
                >
                  <span className={`bsp-count-value${reporterAlarm ? ' bsp-count-value-negative' : ''}`}>{fmtCount(verifiedReporterCount)}</span>
                  {reporterAlarm && <span className="bsp-count-alarm-icon" aria-hidden="true">🚩</span>}
                  <span className="bsp-count-label">Verified Reporters</span>
                </Link>
              ) : (
                <span className={`bsp-count${userCountsLoading ? ' bsp-count-loading' : ''}`}>
                  <span className="bsp-count-value">{fmtCount(verifiedReporterCount)}</span>
                  <span className="bsp-count-label">Verified Reporters</span>
                </span>
              )}
              <VerificationInfo />
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

            <ProfileTagsSection targetPubkey={pubkey} viewerPubkey={user?.pubkey} />

            {/* Story 14 — "Tagging Activity" now spans profiles AND notes,
                intermixed in one collapsed section (AuthoredNotesSection retired). */}
            <AuthoredTaggingSection profilePubkey={pubkey} viewerPubkey={user?.pubkey} />

            {/* About */}
            {profile?.about && (
              <div className="bsp-section">
                <h3>About</h3>
                <p className="bsp-about">{profile.about}</p>
              </div>
            )}

            {/* Identity — Website + Lightning. Pubkey/npub live in the IdentityDetails drawer
                by the name (ADR profile/0033); the section renders only when it has content. */}
            {(profile?.website || profile?.lud16) && (
              <div className="bsp-section">
                <h3>Identity</h3>
                <div className="bsp-id-grid">
                  {profile?.website && (
                    <div className="bsp-id-row">
                      <span className="bsp-id-label">Website</span>
                      <a href={toExternalUrl(profile.website)} target="_blank" rel="noopener noreferrer" className="bsp-id-link">
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
            )}

            {/* Reputation */}
            <div className="bsp-section">
              <h3>Reputation<ReputationInfo /></h3>

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

            {/* Content — the user's latest kind-1 note + link to all (note-surfaces #2) */}
            <ProfileContentSection pubkey={pubkey} />

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
