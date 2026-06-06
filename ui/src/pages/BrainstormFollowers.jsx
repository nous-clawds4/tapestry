import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { nip19 } from 'nostr-tools';
import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';
import DataTable from '../components/DataTable';
import useGrapevineFollowers from '../hooks/useGrapevineFollowers';

/* ── Helpers ──────────────────────────────────────────── */

function safeNpub(pubkey) {
  try { return nip19.npubEncode(pubkey); } catch { return pubkey; }
}
function shortNpub(npub) {
  if (!npub) return '—';
  return npub.length > 20 ? `${npub.slice(0, 12)}…${npub.slice(-6)}` : npub;
}

const PAGE_SIZE = 50;
// Followers-specific localStorage key — distinct from the follows page key so the two
// pages do not clobber each other's column-visibility prefs.
const STORAGE_KEY = 'bsp-followers-columns';

// Column definitions + default visibility (pic/name/rank shown; the rest hidden).
const ALL_COLUMNS = [
  { key: 'picture', label: '', sortable: false, render: (_v, row) => (
    row.picture
      ? <img src={row.picture} alt="" className="bsp-follows-avatar" onError={e => { e.target.style.display = 'none'; }} />
      : <div className="bsp-follows-avatar bsp-follows-avatar-ph">{(row.name || '?')[0].toUpperCase()}</div>
  ) },
  { key: 'name', label: 'Name', render: v => v || '—' },
  { key: 'rank', label: 'Rank', render: v => (v == null ? '—' : v) },
  { key: 'npub', label: 'npub', render: v => <code className="bsp-follows-npub">{shortNpub(v)}</code> },
  { key: 'hops', label: 'Hops', render: v => (v == null ? '—' : v) },
  { key: 'verifiedFollowerCount', label: 'Verified Followers', render: v => (v == null ? '—' : v) },
  { key: 'verifiedMuterCount', label: 'Verified Muters', render: v => (v == null ? '—' : v) },
  { key: 'verifiedReporterCount', label: 'Verified Reporters', render: v => (v == null ? '—' : v) },
];
const DEFAULT_VISIBLE = {
  picture: true, name: true, rank: true,
  npub: false, hops: false,
  verifiedFollowerCount: false, verifiedMuterCount: false, verifiedReporterCount: false,
};

function loadVisible() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') return { ...DEFAULT_VISIBLE, ...saved };
  } catch { /* ignore */ }
  return { ...DEFAULT_VISIBLE };
}

// /api/profiles caps at 50 pubkeys per request (src/api/profiles/fetchProfiles.js:148),
// so profile lookups are batched at PROFILE_CHUNK and merged chunk-by-chunk as they arrive.
const PROFILE_CHUNK = 50;

/* ── Local-data disclosure popover (tap to open; mobile-friendly) ── */

function InfoPopover({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="bsp-confirm-overlay" onClick={onClose}>
      <div className="bsp-confirm-box bsp-follows-info" onClick={e => e.stopPropagation()}>
        <h3 className="bsp-confirm-title">About this data</h3>
        <p className="bsp-confirm-message">
          All data on this page is computed locally by this Tapestry instance and is not imported via NIP-85.
        </p>
        <div className="bsp-confirm-buttons">
          <button className="bsp-confirm-ok" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────── */

export default function BrainstormFollowers() {
  const { pubkey } = useParams();
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();

  const { data: followers, loading, error } = useGrapevineFollowers(pubkey);

  const [profiles, setProfiles] = useState({});
  const [search, setSearch] = useState('');
  const [visible, setVisible] = useState(loadVisible);
  const [showCols, setShowCols] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Persist column show/hide choices across reloads/sessions.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(visible)); } catch { /* ignore */ }
  }, [visible]);

  // Batch-load names/pics for the follower pubkeys. /api/profiles caps at 50 pubkeys/request,
  // so chunk at PROFILE_CHUNK and merge each chunk as it returns (names fill in progressively;
  // one slow/failed chunk no longer blocks the whole list).
  useEffect(() => {
    if (!followers || followers.length === 0) { setProfiles({}); return; }
    let cancelled = false;
    setProfiles({});
    const pubkeys = followers.map(f => f.pubkey);
    (async () => {
      for (let i = 0; i < pubkeys.length && !cancelled; i += PROFILE_CHUNK) {
        const batch = pubkeys.slice(i, i + PROFILE_CHUNK);
        try {
          const r = await fetch(`/api/profiles?pubkeys=${batch.join(',')}`);
          const j = await r.json();
          if (!cancelled && j?.profiles) setProfiles(prev => ({ ...prev, ...j.profiles }));
        } catch { /* tolerate partial profile failures */ }
      }
    })();
    return () => { cancelled = true; };
  }, [followers]);

  // Build rows: merge metrics + profile, derive rank/name/npub.
  const rows = useMemo(() => {
    const list = (followers || []).map(f => {
      const p = profiles[f.pubkey] || {};
      const npub = safeNpub(f.pubkey);
      return {
        pubkey: f.pubkey,
        picture: p.picture || null,
        name: p.display_name || p.name || shortNpub(npub),
        npub,
        rank: f.influence == null ? null : Math.round(f.influence * 100),
        hops: f.hops,
        verifiedFollowerCount: f.verifiedFollowerCount,
        verifiedMuterCount: f.verifiedMuterCount,
        verifiedReporterCount: f.verifiedReporterCount,
      };
    });
    // Default sort: verified followers, descending, across the whole set.
    list.sort((a, b) => (b.verifiedFollowerCount ?? -1) - (a.verifiedFollowerCount ?? -1));
    return list;
  }, [followers, profiles]);

  // Page-level search — matches name / npub / pubkey even when those columns are hidden.
  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.npub && r.npub.toLowerCase().includes(q)) ||
      r.pubkey.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const columns = useMemo(() => ALL_COLUMNS.filter(c => visible[c.key]), [visible]);

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
          <h1 className="bsp-follows-title">Verified Followers</h1>
          <button
            type="button"
            className="bsp-info-btn"
            aria-label="About this data"
            title="About this data"
            onClick={() => setShowInfo(true)}
          >ⓘ</button>
        </div>

        {/* Controls: search + columns toggle */}
        <div className="bsp-follows-controls">
          <input
            type="search"
            className="bsp-follows-search"
            placeholder="Search by name or npub…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="bsp-follows-colmenu">
            <button type="button" className="bsp-follows-colbtn" onClick={() => setShowCols(s => !s)}>
              Columns ▾
            </button>
            {showCols && (
              <div className="bsp-follows-colpanel" onMouseLeave={() => setShowCols(false)}>
                {ALL_COLUMNS.map(c => (
                  <label key={c.key} className="bsp-follows-colopt">
                    <input
                      type="checkbox"
                      checked={!!visible[c.key]}
                      onChange={() => setVisible(v => ({ ...v, [c.key]: !v[c.key] }))}
                    />
                    {c.label || 'Picture'}
                  </label>
                ))}
                <button
                  type="button"
                  className="bsp-follows-colreset"
                  onClick={() => setVisible({ ...DEFAULT_VISIBLE })}
                >Reset to defaults</button>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        {loading && <div className="bsp-loading">Loading followers…</div>}
        {error && !loading && (
          <div className="bsp-trust-unavailable"><span className="bsp-trust-icon">🔒</span><span>{error}</span></div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="bsp-empty">No verified followers found for this account.</div>
        )}
        {!loading && !error && rows.length > 0 && (
          <DataTable
            columns={columns}
            data={searched}
            pageSize={PAGE_SIZE}
            showFilter={false}
            onRowClick={row => navigate(`/user/${row.pubkey}`)}
            emptyMessage="No matching accounts."
          />
        )}
      </div>

      <InfoPopover open={showInfo} onClose={() => setShowInfo(false)} />
    </div>
  );
}
