import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';
import useFollowsHopsPaths from '../hooks/useFollowsHopsPaths';

/* ── Helpers ──────────────────────────────────────────── */

function safeNpub(pubkey) {
  try { return nip19.npubEncode(pubkey); } catch { return pubkey; }
}
function shortNpub(npub) {
  if (!npub) return '—';
  return npub.length > 20 ? `${npub.slice(0, 12)}…${npub.slice(-6)}` : npub;
}

const PROFILE_CHUNK = 50;

/* ── Main component ──────────────────────────────────── */

export default function BrainstormFollowsHops() {
  const { pubkey } = useParams();
  const { user, login, logout } = useAuth();
  const { ownerPubkey } = useConfig();

  // Source = the logged-in viewer, else the instance Owner (same rule as #38).
  const source = user?.pubkey || ownerPubkey;

  const { hops, paths, truncated, noPath, loading, error } = useFollowsHopsPaths(source, pubkey);

  // Which of the equally-short paths is shown. Reset whenever the path set changes.
  const [selectedIndex, setSelectedIndex] = useState(0);
  useEffect(() => { setSelectedIndex(0); }, [paths]);

  const reroll = () => {
    if (paths.length <= 1) return;
    let i = selectedIndex;
    while (i === selectedIndex) i = Math.floor(Math.random() * paths.length);
    setSelectedIndex(i);
  };

  // Batch-load names/pics for every pubkey across all paths (so re-roll is instant),
  // plus source + target for the count-line copy. /api/profiles caps at 50/request.
  const allPubkeys = useMemo(() => {
    const s = new Set();
    paths.forEach(p => p.forEach(n => s.add(n.pubkey)));
    if (pubkey) s.add(pubkey);
    if (source) s.add(source);
    return [...s];
  }, [paths, pubkey, source]);

  const [profiles, setProfiles] = useState({});
  useEffect(() => {
    if (allPubkeys.length === 0) { setProfiles({}); return; }
    let cancelled = false;
    (async () => {
      for (let i = 0; i < allPubkeys.length && !cancelled; i += PROFILE_CHUNK) {
        const batch = allPubkeys.slice(i, i + PROFILE_CHUNK);
        try {
          const r = await fetch(`/api/profiles?pubkeys=${batch.join(',')}`);
          const j = await r.json();
          if (!cancelled && j?.profiles) setProfiles(prev => ({ ...prev, ...j.profiles }));
        } catch { /* tolerate partial profile failures */ }
      }
    })();
    return () => { cancelled = true; };
  }, [allPubkeys]);

  const nameFor = (pk) => {
    const p = profiles[pk] || {};
    return p.display_name || p.name || shortNpub(safeNpub(pk));
  };
  const targetName = nameFor(pubkey);
  const sourceName = source ? nameFor(source) : 'the source';

  const countLine = noPath
    ? `There is no follow path from ${sourceName} to ${targetName}.`
    : (hops != null
        ? `${targetName} is ${hops} hop${hops === 1 ? '' : 's'} away from ${sourceName} by follows.`
        : null);

  const selectedPath = paths[selectedIndex] || [];

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

      <div className="bsp-content">
        {/* Header + back link */}
        <div className="bsp-follows-header">
          <Link to={`/user/${pubkey}`} className="bsp-back-link">← Back to profile</Link>
          <h1 className="bsp-follows-title">Follow hops</h1>
        </div>
        <p className="bsp-follows-pov">Ranks are relative to the owner's web of trust.</p>

        {/* Count line */}
        {!loading && !error && countLine && (
          <p className="bsp-follows-summary">{countLine}</p>
        )}

        {/* Body */}
        {loading && (
          <div className="bsp-reporters-skeleton" aria-label="Loading path">
            <div className="bsp-skeleton-row" />
            <div className="bsp-skeleton-row" />
            <div className="bsp-skeleton-row" />
          </div>
        )}
        {error && !loading && (
          <div className="bsp-trust-unavailable">
            <span className="bsp-trust-icon">🔒</span>
            <span>Couldn't compute the follow path right now. Try again in a moment.</span>
          </div>
        )}
        {!loading && !error && noPath && (
          <div className="bsp-empty">No follow path within reach. This account isn't connected by follows from {sourceName}.</div>
        )}
        {!loading && !error && !noPath && selectedPath.length > 0 && (
          <>
            <div className="bsp-hops-path">
              {selectedPath.map((node, i) => {
                const p = profiles[node.pubkey] || {};
                const name = nameFor(node.pubkey);
                const rank = node.influence == null ? '—' : Math.round(node.influence * 100);
                return (
                  <Link key={`${node.pubkey}-${i}`} to={`/user/${node.pubkey}`} className="bsp-hops-card">
                    {p.picture
                      ? <img src={p.picture} alt="" className="bsp-follows-avatar" onError={e => { e.target.style.display = 'none'; }} />
                      : <div className="bsp-follows-avatar bsp-follows-avatar-ph">{(name || '?')[0].toUpperCase()}</div>}
                    <span className="bsp-hops-card-name">{name}</span>
                    <span className="bsp-hops-card-rank" title="Verification Score (owner PoV)">{rank}</span>
                  </Link>
                );
              })}
            </div>
            {paths.length > 1 && (
              <button type="button" className="bsp-follows-colbtn bsp-hops-reroll" onClick={reroll}>
                ↻ Show a different path{truncated ? ' (of 25+)' : ` (of ${paths.length})`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
