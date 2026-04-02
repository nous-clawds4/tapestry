import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useAuth } from '../context/AuthContext';

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
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [trustScores, setTrustScores] = useState(null);
  const [trustLoading, setTrustLoading] = useState(true);
  const [trustError, setTrustError] = useState(null);
  const [taEvent, setTaEvent] = useState(null);

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

  // Fetch trust scores: get house POV delegated pubkey, then query strfry for TA
  useEffect(() => {
    if (!pubkey) return;
    setTrustLoading(true);
    setTrustError(null);
    setTrustScores(null);
    setTaEvent(null);

    (async () => {
      try {
        // Step 1: Get search preferences to find delegated pubkey
        const prefsResp = await fetch('/api/grapevine/preferences');
        const prefsData = await prefsResp.json();
        const delegatedPubkey = prefsData?.preferences?.delegatedPubkey;

        if (!delegatedPubkey) {
          setTrustError('No house POV configured. Set a Point of View in Search Preferences.');
          return;
        }

        // Step 2: Query local strfry for the TA
        const filter = JSON.stringify({
          kinds: [30382],
          authors: [delegatedPubkey],
          '#d': [pubkey],
        });
        const scanResp = await fetch(`/api/strfry/scan?filter=${encodeURIComponent(filter)}`);
        const scanData = await scanResp.json();

        if (!scanData.success || !scanData.events?.length) {
          setTrustError('No trust assertion available for this user from the house POV.');
          return;
        }

        // Use the most recent event
        const event = scanData.events.sort((a, b) => b.created_at - a.created_at)[0];
        setTaEvent(event);

        // Step 3: Parse tags into scores
        const scores = {};
        for (const tag of event.tags || []) {
          const [key, value] = tag;
          if (key && value && key !== 'd' && key !== 'p') {
            scores[key] = value;
          }
        }
        setTrustScores(scores);
      } catch (err) {
        setTrustError(`Failed to load trust data: ${err.message}`);
      } finally {
        setTrustLoading(false);
      }
    })();
  }, [pubkey]);

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
        <a href="/kg/brainstorm-search" className="bsp-logo">
          <img src="/kg/brainstorm.svg" alt="" className="bsp-logo-img" />
          Brainstorm Search
        </a>
        <div className="bsp-auth">
          {user ? (
            <>
              <span className="bsp-user-name">{user.profile?.name || user.pubkey.slice(0, 8) + '…'}</span>
              <button className="bsp-link-btn" onClick={logout}>Sign out</button>
            </>
          ) : (
            <button className="bsp-link-btn" onClick={login}>Sign in with nostr</button>
          )}
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

            {/* Trust Scores */}
            <div className="bsp-section">
              <h3>Trust Metrics <span className="bsp-pov-tag">House POV</span></h3>

              {trustLoading && (
                <div className="bsp-trust-loading">Loading trust data…</div>
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
                  <span>Trust assertion exists but contains no scored metrics.</span>
                </div>
              )}

              {taEvent && (
                <details className="bsp-ta-raw">
                  <summary>Raw Trusted Assertion event</summary>
                  <pre>{JSON.stringify(taEvent, null, 2)}</pre>
                </details>
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
    </div>
  );
}
