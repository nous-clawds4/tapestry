import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { useHouseProfile } from '../components/BrainstormUserMenu';
import TopBar from '../components/TopBar';
import SearchInput from '../components/SearchInput';
import { nip19 } from 'nostr-tools';

/* ── Nostr identity detection ──────────────────────────── */

/**
 * Attempt to decode a nostr identity string (npub, hex pubkey, or nprofile)
 * into a 64-character hex pubkey. Returns null if the input is not a valid
 * nostr identity, allowing normal text search to proceed.
 */
function tryDecodeNostrIdentity(input) {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();

  // 64-char hex string = raw pubkey
  if (/^[0-9a-f]{64}$/.test(trimmed)) {
    return trimmed;
  }

  // npub1... (Bech32-encoded pubkey)
  if (trimmed.startsWith('npub1')) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'npub') return decoded.data;
    } catch {
      return null;
    }
  }

  // nprofile1... (Bech32-encoded profile with optional relay hints)
  if (trimmed.startsWith('nprofile1')) {
    try {
      const decoded = nip19.decode(trimmed);
      if (decoded.type === 'nprofile') return decoded.data.pubkey;
    } catch {
      return null;
    }
  }

  return null;
}

/* ── NIP-05 detection ──────────────────────────────────── */

const NIP05_REGEX = /^(?:([\w.+-]+)@)?([\w_-]+(\.[\w_-]+)+)$/;

/* ── House POV Label (shared inline component) ───────── */

function HousePovLabel() {
  const house = useHouseProfile();
  if (!house) return <strong>House</strong>;
  return (
    <a href={`/user/${house.pubkey}`} className="bs-usermenu-pov-link">
      {house.picture && (
        <img src={house.picture} alt="" className="bs-usermenu-pov-avatar" onError={e => { e.target.style.display = 'none'; }} />
      )}
      <strong>{house.name}</strong>
    </a>
  );
}

/* ── My POV Label (the logged-in user's own profile, mirrors HousePovLabel) ─ */

function MyPovLabel({ user }) {
  if (!user) return <strong>My WoT</strong>;
  const name = user.profile?.display_name || user.profile?.name || user.pubkey.slice(0, 8) + '…';
  const picture = user.profile?.picture;
  return (
    <a href={`/user/${user.pubkey}`} className="bs-usermenu-pov-link">
      {picture && (
        <img src={picture} alt="" className="bs-usermenu-pov-avatar" onError={e => { e.target.style.display = 'none'; }} />
      )}
      <strong>{name}</strong>
    </a>
  );
}

/* ── User Menu (avatar + dropdown panel) ─────────────── */

const POV_STORAGE_PREFIX = 'bs_pov_';

function UserMenu({ user, login, logout, pov, setPov, filters, setFilters, sortConfig, setSortConfig, onWotReady }) {
  const { aRelays } = useConfig();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // WoT readiness checks (steps 1–3)
  const [wotStatus, setWotStatus] = useState({
    loading: true,
    has10040: false,
    hasRankTag: false,
    hasTAs: false,
    taAge: null,
    rankAuthor: null,
    rankRelay: null,
    localCount: null,      // count of TAs in local strfry
    allMetrics: [],        // all 30382:* tags from 10040
  });

  // Pipeline steps 4 & 5
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);       // null | string
  const [loadingScores, setLoadingScores] = useState(false);
  const [loadStatus, setLoadStatus] = useState(null);        // null | string
  const [scoresReady, setScoresReady] = useState(false);     // Meilisearch has user's WoT scores

  // Metrics selection (local to UserMenu) + dirty flag
  const [selectedMetrics, setSelectedMetrics] = useState(new Set());
  const [filterSortDirty, setFilterSortDirty] = useState(false);

  // Close on click outside
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Restore user prefs from server (with localStorage as fast fallback)
  useEffect(() => {
    if (!user) return;
    // Fast: localStorage first
    const cached = localStorage.getItem(POV_STORAGE_PREFIX + user.pubkey);
    if (cached === 'user' || cached === 'nosfabrica') setPov(cached);
    // Then load from server (source of truth)
    (async () => {
      try {
        const resp = await fetch('/api/user-prefs');
        const data = await resp.json();
        if (data.success && data.preferences) {
          const p = data.preferences;
          if (p.pov === 'user' || p.pov === 'nosfabrica') setPov(p.pov);
          if (p.selectedMetrics) setSelectedMetrics(new Set(p.selectedMetrics));
          if (p.filters) setFilters(p.filters);
          if (p.sortConfig) setSortConfig(p.sortConfig);
        }
      } catch {}
    })();
  }, [user]);

  // Persist POV to both localStorage and server
  useEffect(() => {
    if (!user || !pov) return;
    localStorage.setItem(POV_STORAGE_PREFIX + user.pubkey, pov);
    // Save to server — include rankAuthor so the search proxy can resolve
    // the user's delegated pubkey instead of falling back to house POV.
    const prefs = { pov };
    if (wotStatus.rankAuthor) prefs.rankAuthor = wotStatus.rankAuthor;
    if (wotStatus.rankRelay) prefs.rankRelay = wotStatus.rankRelay;
    fetch('/api/user-prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prefs),
    }).catch(() => {});
  }, [user, pov, wotStatus.rankAuthor]);

  // ── Helper: count local TAs ──
  async function countLocalTAs(delegatedPubkey) {
    const filter = encodeURIComponent(JSON.stringify({ kinds: [30382], authors: [delegatedPubkey] }));
    const resp = await fetch(`/api/strfry/scan/count?filter=${filter}`);
    const data = await resp.json();
    return data.success ? (data.count ?? 0) : 0;
  }

  // ── Helper: check Meilisearch for WoT scores ──
  async function checkMeiliScores() {
    try {
      const resp = await fetch('/api/search/profiles/meili/stats');
      const data = await resp.json();
      if (!data.success) return false;
      const fields = data.fieldDistribution || {};
      const wotFields = Object.entries(fields).filter(([k]) => k.startsWith('wot_') && k !== 'wot_pov' && k !== 'wot_updated_at');
      return wotFields.length > 0 && wotFields.some(([, v]) => v > 0);
    } catch { return false; }
  }

  // ── Step 4: Negentropy sync ──
  async function triggerSync(rankAuthor, rankRelay) {
    setSyncing(true);
    setSyncStatus('Syncing TAs from relay…');
    try {
      const resp = await fetch('/api/strfry/negentropy-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relay: rankRelay,
          dir: 'down',
          filter: { kinds: [30382], authors: [rankAuthor] },
        }),
      });
      const data = await resp.json();
      if (data.success) {
        const newCount = await countLocalTAs(rankAuthor);
        setWotStatus(s => ({ ...s, localCount: newCount, hasTAs: newCount > 0 }));
        setSyncStatus(`✅ Synced — ${newCount.toLocaleString()} TAs in local relay`);
        return newCount;
      } else if (data.active) {
        setSyncStatus('⏳ Sync already in progress…');
        return 0;
      } else {
        setSyncStatus(`❌ Sync failed: ${data.error || 'unknown'}`);
        return 0;
      }
    } catch (err) {
      setSyncStatus(`❌ ${err.message}`);
      return 0;
    } finally {
      setSyncing(false);
    }
  }

  // ── Step 5: Load scores into Meilisearch ──
  // Scores are namespaced by delegated pubkey: wot_rank_<pubkey8> so multiple POVs coexist.
  async function triggerLoadScores(rankAuthor, metricNames, userPubkey) {
    setLoadingScores(true);
    setLoadStatus('Streaming scores from local relay…');
    try {
      const povSuffix = rankAuthor.slice(0, 8);
      const filter = encodeURIComponent(JSON.stringify({ kinds: [30382], authors: [rankAuthor] }));
      const resp = await fetch(`/api/strfry/scan/stream?filter=${filter}`);
      if (!resp.ok) throw new Error(`Stream failed: ${resp.status}`);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const scores = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          let event;
          try { event = JSON.parse(line); } catch { continue; }
          const dTag = event.tags?.find(t => t[0] === 'd')?.[1];
          if (!dTag) continue;
          const scoreObj = { pubkey: dTag };
          for (const tag of event.tags) {
            if (metricNames.includes(tag[0])) {
              scoreObj[`wot_${tag[0]}_${povSuffix}`] = parseFloat(tag[1]) || 0;
            }
          }
          scores.push(scoreObj);
        }
        if (scores.length % 10000 === 0 && scores.length > 0) {
          setLoadStatus(`Parsed ${scores.length.toLocaleString()} scores…`);
        }
      }

      setLoadStatus(`Sending ${scores.length.toLocaleString()} scores to search index…`);

      // Pass delegatedPubkey so the server can register the namespaced fields
      const meiliResp = await fetch('/api/search/profiles/meili/load-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ povPubkey: userPubkey, delegatedPubkey: rankAuthor, metrics: metricNames, scores }),
      });
      const result = await meiliResp.json();
      if (result.success) {
        setLoadStatus(`✅ Loaded ${scores.length.toLocaleString()} scores`);
        setScoresReady(true);
        return true;
      } else {
        setLoadStatus(`❌ ${result.error || 'Failed to load scores'}`);
        return false;
      }
    } catch (err) {
      setLoadStatus(`❌ ${err.message}`);
      return false;
    } finally {
      setLoadingScores(false);
    }
  }

  // ── Main pipeline: runs when user signs in ──
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setWotStatus(s => ({ ...s, loading: true }));
      setSyncStatus(null);
      setLoadStatus(null);
      setScoresReady(false);

      try {
        // Step 1: Find kind 10040
        let event10040 = null;

        const localFilter = JSON.stringify({ kinds: [10040], authors: [user.pubkey], limit: 1 });
        try {
          const localResp = await fetch(`/api/strfry/scan?filter=${encodeURIComponent(localFilter)}`);
          const localData = await localResp.json();
          if (localData.success && localData.events?.length) event10040 = localData.events[0];
        } catch {}

        if (!event10040) {
          const relays = (aRelays?.aPopularGeneralPurposeRelays || []).join(',');
          try {
            const extResp = await fetch(`/api/relay/external?filter=${encodeURIComponent(localFilter)}&relays=${encodeURIComponent(relays)}`);
            const extData = await extResp.json();
            if (extData.success && extData.events?.length) event10040 = extData.events[0];
          } catch {}
        }

        if (cancelled) return;
        if (!event10040) {
          setWotStatus({ loading: false, has10040: false, hasRankTag: false, hasTAs: false, taAge: null, rankAuthor: null, rankRelay: null, localCount: null, allMetrics: [] });
          return;
        }

        // Step 2: Parse rank tag
        const allMetrics = (event10040.tags || [])
          .filter(t => t[0]?.startsWith('30382:'))
          .map(t => ({ metric: t[0].split(':')[1], delegatedPubkey: t[1], relayUrl: t[2] }));

        const rankTag = (event10040.tags || []).find(t => t[0] === '30382:rank');
        if (!rankTag || !rankTag[1] || !rankTag[2]) {
          if (!cancelled) setWotStatus({ loading: false, has10040: true, hasRankTag: false, hasTAs: false, taAge: null, rankAuthor: null, rankRelay: null, localCount: null, allMetrics });
          return;
        }

        const rankAuthor = rankTag[1];
        const rankRelay = rankTag[2];

        // Report delegated pubkey to parent
        // rankAuthor is the delegated pubkey from the user's kind 10040

        // Step 3: Count local TAs
        let localCount = await countLocalTAs(rankAuthor);
        if (cancelled) return;

        const baseStatus = { loading: false, has10040: true, hasRankTag: true, rankAuthor, rankRelay, allMetrics };

        // Initialize metric selection, filters & sort from allMetrics
        const metricNames = allMetrics.map(m => m.metric);
        setSelectedMetrics(new Set(metricNames));

        // Load saved preferences: user-specific first, then house fallback
        let loadedFilters = null;
        let loadedSort = null;
        let loadedMetrics = null;

        // Try user-specific prefs first
        try {
          const userPrefsResp = await fetch('/api/user-prefs');
          const userPrefsData = await userPrefsResp.json();
          if (userPrefsData.success && userPrefsData.preferences) {
            const up = userPrefsData.preferences;
            if (up.filters && Object.keys(up.filters).length > 0) loadedFilters = up.filters;
            if (up.sortConfig?.metric) loadedSort = up.sortConfig;
            if (up.selectedMetrics?.length) loadedMetrics = up.selectedMetrics;
          }
        } catch {}

        // Fall back to house prefs if user has none
        if (!loadedFilters && !loadedSort) {
          try {
            const prefsResp = await fetch('/api/grapevine/preferences');
            const prefsData = await prefsResp.json();
            if (prefsData.success && prefsData.preferences) {
              if (prefsData.preferences.filters) loadedFilters = prefsData.preferences.filters;
              if (prefsData.preferences.sort) loadedSort = prefsData.preferences.sort;
            }
          } catch {}
        }

        if (loadedFilters) setFilters(loadedFilters);
        if (loadedSort) setSortConfig(loadedSort);
        if (loadedMetrics) setSelectedMetrics(new Set(loadedMetrics));

        // Set default filters if nothing was loaded
        if (!loadedFilters) {
          const defaults = {};
          const hasRank = metricNames.includes('rank');
          if (hasRank) defaults.rank = { enabled: true, cutoff: 2 };
          for (const m of metricNames) {
            if (!(m in defaults)) defaults[m] = { enabled: false, cutoff: 0 };
          }
          setFilters(defaults);
        }
        if (!loadedSort) {
          const hasFollowers = metricNames.includes('followers');
          const hasRank = metricNames.includes('rank');
          setSortConfig({
            metric: hasFollowers ? 'followers' : (hasRank ? 'rank' : metricNames[0] || null),
            direction: 'desc',
          });
        }

        if (localCount > 0) {
          // Get age of most recent TA
          const taFilter = JSON.stringify({ kinds: [30382], authors: [rankAuthor], limit: 1 });
          let taAge = null;
          try {
            const taResp = await fetch(`/api/strfry/scan?filter=${encodeURIComponent(taFilter)}`);
            const taData = await taResp.json();
            if (taData.success && taData.events?.length) {
              taAge = timeAgoShort(taData.events[0].created_at);
            }
          } catch {}
          setWotStatus({ ...baseStatus, hasTAs: true, taAge, localCount });
        } else {
          setWotStatus({ ...baseStatus, hasTAs: false, taAge: null, localCount: 0 });
        }

        // Step 4: Auto-sync if local count is 0
        if (localCount === 0 && !cancelled) {
          localCount = await triggerSync(rankAuthor, rankRelay);
          if (cancelled) return;
          if (localCount > 0) {
            const taFilter = JSON.stringify({ kinds: [30382], authors: [rankAuthor], limit: 1 });
            let taAge = null;
            try {
              const taResp = await fetch(`/api/strfry/scan?filter=${encodeURIComponent(taFilter)}`);
              const taData = await taResp.json();
              if (taData.success && taData.events?.length) taAge = timeAgoShort(taData.events[0].created_at);
            } catch {}
            setWotStatus(s => ({ ...s, hasTAs: true, taAge, localCount }));
          }
        }

        if (cancelled || localCount === 0) return;

        // Step 5: Check Meilisearch, auto-load if no scores
        const hasScores = await checkMeiliScores();
        if (cancelled) return;

        if (hasScores) {
          setScoresReady(true);
          setLoadStatus('✅ Scores already in search index');
          // Auto-select My WoT if no saved preference
          const saved = localStorage.getItem(POV_STORAGE_PREFIX + user.pubkey);
          if (!saved) setPov('user');
        } else {
          // Auto-load scores
          const metricNames = allMetrics.map(m => m.metric);
          const ok = await triggerLoadScores(rankAuthor, metricNames, user.pubkey);
          if (ok && !cancelled) {
            const saved = localStorage.getItem(POV_STORAGE_PREFIX + user.pubkey);
            if (!saved) setPov('user');
          }
        }
      } catch {
        if (!cancelled) setWotStatus(s => ({ ...s, loading: false }));
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Save filter/sort preferences to server (per-user)
  async function saveFilterSort() {
    const prefs = {
      selectedMetrics: [...selectedMetrics],
      filters,
      sortConfig,
      rankAuthor: wotStatus.rankAuthor,
      rankRelay: wotStatus.rankRelay,
    };
    try {
      await fetch('/api/user-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      setFilterSortDirty(false);
    } catch {}
  }

  const myWotReady = wotStatus.has10040 && wotStatus.hasRankTag && wotStatus.hasTAs && scoresReady;

  // Report wotReady status to parent
  useEffect(() => {
    if (onWotReady) onWotReady(myWotReady);
  }, [myWotReady, onWotReady]);

  if (!user) {
    return <button className="bs-link-btn" onClick={login}>Sign in with nostr</button>;
  }

  const displayName = user.profile?.name || user.pubkey.slice(0, 8) + '…';
  const picture = user.profile?.picture;

  const isOwnerOrAdmin = user.classification === 'owner' || user.classification === 'admin';

  return (
    <div className="bs-usermenu" ref={menuRef}>
      <button
        className="bs-usermenu-avatar-btn"
        onClick={() => setOpen(!open)}
        title={displayName}
      >
        {picture ? (
          <img src={picture} alt="" className="bs-usermenu-avatar" onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
        ) : null}
        <div className="bs-usermenu-avatar bs-usermenu-avatar-placeholder" style={picture ? { display: 'none' } : {}}>
          {(displayName || '?')[0].toUpperCase()}
        </div>
      </button>

      {open && (
        <div className="bs-usermenu-dropdown">
          {/* Welcome */}
          <div className="bs-usermenu-welcome">
            {picture && <img src={picture} alt="" className="bs-usermenu-dropdown-pic" onError={e => { e.target.style.display = 'none'; }} />}
            <div>
              <div className="bs-usermenu-dropdown-name">{displayName}</div>
              <div className="bs-usermenu-dropdown-pubkey">{user.pubkey.slice(0, 12)}…{user.pubkey.slice(-6)}</div>
            </div>
          </div>

          {/* Compact POV indicator */}
          <div className="bs-usermenu-section">
            <div className="bs-usermenu-pov-indicator">
              Searching as:{' '}
              {pov === 'user' && myWotReady ? (
                <MyPovLabel user={user} />
              ) : (
                <HousePovLabel />
              )}
            </div>
          </div>

          {/* Settings + Sign out */}
          <div className="bs-usermenu-footer">
            <a
              href="/settings"
              className="bs-usermenu-settings-btn"
              onClick={() => setOpen(false)}
            >
              ⚙️ Settings
            </a>
            <button className="bs-usermenu-signout" onClick={() => { setOpen(false); logout(); }}>
              Sign out
            </button>
          </div>

          {isOwnerOrAdmin && (
            <div className="bs-usermenu-admin-panel">
              <div className="bs-usermenu-admin-label">
                <span className="bs-usermenu-admin-dot" />
                {user.classification === 'owner' ? 'Owner' : 'Admin'}
              </div>
              <a
                href="/tapestry/"
                className="bs-usermenu-admin-btn"
                onClick={() => setOpen(false)}
              >
                Tapestry Dashboard
              </a>
              <a
                href="/legacy/"
                className="bs-usermenu-admin-btn"
                onClick={() => setOpen(false)}
              >
                Legacy Dashboard
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function timeAgoShort(unixSeconds) {
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

const RESULTS_PER_PAGE = 40;

/* ── POV-aware score helper ───────────────────────────── */

/** Extract a wot score from a hit, trying namespaced field first, then legacy */
function getWotScore(hit, metric, povSuffix) {
  if (povSuffix) {
    const val = hit[`wot_${metric}_${povSuffix}`];
    if (val != null) return val;
  }
  // Legacy fallback
  return hit[`wot_${metric}`] ?? null;
}

/* ── Result Card ──────────────────────────────────────── */

/**
 * Render a small set of "matched tag" chips when this hit was surfaced
 * because someone in the active PoV's WoT tagged the profile with a tag
 * whose name matched the search query. Chips that contain the query
 * substring are highlighted; others appear in a muted style.
 */
function MatchedTagChips({ matchedTags, query, className }) {
  if (!matchedTags || matchedTags.length === 0) return null;
  const q = (query || '').trim().toLowerCase();
  return (
    <span className={`bs-matched-tags ${className || ''}`}>
      {matchedTags.map((t) => {
        const hits = q && t.name.toLowerCase().includes(q);
        return (
          <span
            key={t.eventId}
            className={`bs-matched-tag ${hits ? 'bs-matched-tag-hit' : ''}`}
            title={t.description || ''}
          >
            🏷 {t.name}
          </span>
        );
      })}
    </span>
  );
}

function ResultCard({ hit, povSuffix, query }) {
  const name = hit.name || hit.display_name || 'Unknown';
  const picture = hit.picture;
  const banner = hit.banner;
  const nip05 = hit.nip05;
  const about = hit.about;
  const npub = hit.npub;
  const website = hit.website;
  const lud16 = hit.lud16;
  const createdAt = hit.created_at;
  const profileAge = timeAgo(createdAt);
  const sixMonthsAgo = (Date.now() / 1000) - (180 * 86400);
  const isStale = createdAt && createdAt < sixMonthsAgo;

  return (
    <a
      href={`/user/${hit.pubkey || hit.id}${povSuffix ? `?pov=${povSuffix}` : ''}`}
      className="bs-result-card"
    >
      <div className="bs-result-body">
        <div className="bs-result-row">
          {picture ? (
            <img
              src={picture}
              alt=""
              className="bs-result-avatar"
              onError={e => { e.target.outerHTML = '<div class="bs-result-avatar bs-result-avatar-placeholder">👤</div>'; }}
            />
          ) : (
            <div className="bs-result-avatar bs-result-avatar-placeholder">👤</div>
          )}
          <div className="bs-result-info">
            <div className="bs-result-name-row">
              <span className="bs-result-name">{name}</span>
              {profileAge && (
                <span className={`bs-result-age ${isStale ? 'stale' : ''}`}>
                  {isStale ? '⚠ ' : ''}updated {profileAge}
                </span>
              )}
            </div>
            <MatchedTagChips matchedTags={hit._matchedTags} query={query} className="bs-result-matched-tags" />
            {nip05 && <div className="bs-result-nip05">{nip05}</div>}
            <div className="bs-result-pubkey">
              {npub ? `${npub.slice(0, 20)}…${npub.slice(-8)}` : `${(hit.pubkey || '').slice(0, 16)}…${(hit.pubkey || '').slice(-8)}`}
            </div>
            {about && (
              <div className="bs-result-about">
                {about.length > 200 ? about.slice(0, 200) + '…' : about}
              </div>
            )}
            {(website || lud16) && (
              <div className="bs-result-links">
                {website && <span>🌐 {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>}
                {lud16 && <span>⚡ {lud16}</span>}
              </div>
            )}
            {(getWotScore(hit, 'rank', povSuffix) != null || getWotScore(hit, 'followers', povSuffix) != null) && (
              <div className="bs-result-wot">
                {getWotScore(hit, 'rank', povSuffix) != null && (
                  <span className="bs-wot-badge bs-wot-rank">🏅 Verification Score: {getWotScore(hit, 'rank', povSuffix)}</span>
                )}
                {getWotScore(hit, 'followers', povSuffix) != null && (
                  <span className="bs-wot-badge bs-wot-followers">👥 Verified Followers: {getWotScore(hit, 'followers', povSuffix)}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </a>
  );
}

/* ── Main Page ────────────────────────────────────────── */

const SUGGEST_LIMIT = 6;

export default function BrainstormSearch() {
  const { user, login, logout } = useAuth();
  const houseProfile = useHouseProfile();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [meta, setMeta] = useState(null);
  const [searchNotice, setSearchNotice] = useState(null); // friendly message in place of "No results found" (e.g. when Meilisearch panics on too-broad queries — see nostr-search/src/search.js)
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [nip05Result, setNip05Result] = useState(null);
  const [pov, setPov] = useState('nosfabrica');
  const [myWotReady, setMyWotReady] = useState(false);
  const [showPovPicker, setShowPovPicker] = useState(false);
  const [activePovSuffix, setActivePovSuffix] = useState(null); // returned by server after search
  // Filter/sort state (used by UserMenu Settings panel — no longer sent in search queries)
  const [filters, setFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ metric: null, direction: 'desc' });
  // Autocomplete suggestions (landing page only)
  const [suggestions, setSuggestions] = useState(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestRef = useRef(null); // ref for click-outside detection
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const hasResults = results !== null;

  // Build the search URL — single function used by both doSearch and fetchSuggestions.
  // The server proxy is the single authority on filters, sort, and field naming.
  // Client only sends: q, limit, offset, wotPov, userPubkey.
  function buildSearchUrl(queryStr, limit, offset) {
    let url = `/api/search/profiles/meili?q=${encodeURIComponent(queryStr)}&limit=${limit}&offset=${offset}`;

    // Direct lookup: if query is a nostr identity (npub, hex pubkey, nprofile),
    // bypass WoT filtering/sorting and search by pubkey only.
    const identityPubkey = tryDecodeNostrIdentity(queryStr);
    if (identityPubkey) {
      url += `&pubkeyLookup=${identityPubkey}`;
      return url;
    }

    // NIP-05 lookup: if query looks like a NIP-05 identifier, request
    // parallel verification. Normal search still runs alongside.
    if (NIP05_REGEX.test(queryStr.trim())) {
      url += `&nip05Lookup=${encodeURIComponent(queryStr.trim())}`;
    }

    url += `&wotPov=${pov === 'user' ? 'user' : 'house'}`;
    if (pov === 'user' && user?.pubkey) {
      url += `&userPubkey=${user.pubkey}`;
    }
    return url;
  }

  // Full search (transitions to results view)
  const doSearch = useCallback(async (q, offset = 0) => {
    const trimmed = (q ?? query).trim();
    if (!trimmed) return;

    // Close suggestions when doing full search
    setSuggestions(null);
    setShowSuggestions(false);

    if (offset === 0) {
      setLoading(true);
      setResults(null);
      setMeta(null);
      setError(null);
      setSearchNotice(null);
    } else {
      setLoadingMore(true);
    }

    try {
      const url = buildSearchUrl(trimmed, RESULTS_PER_PAGE, offset);
      const resp = await fetch(url);
      const data = await resp.json();

      if (!resp.ok || data.success === false) {
        const errMsg = typeof data.error === 'string' ? data.error
          : data.error ? JSON.stringify(data.error)
          : data.detail || 'Search service unavailable.';
        setError(errMsg);
        return;
      }

      // Store the POV suffix returned by the server for display purposes
      if (data.povSuffix) setActivePovSuffix(data.povSuffix);

      // Store NIP-05 verified result (if any)
      setNip05Result(data.nip05Result || null);

      // Friendly notice in place of "No results found" — surfaced when the
      // server side gracefully degrades (e.g. Meilisearch interner panic).
      setSearchNotice(data._searchTooBroad ? data._notice : null);

      if (offset === 0) {
        setResults(data.hits || []);
      } else {
        setResults(prev => [...(prev || []), ...(data.hits || [])]);
      }
      setMeta({
        estimatedTotalHits: data.estimatedTotalHits || 0,
        processingTimeMs: data.processingTimeMs || 0,
        query: data.query || trimmed,
      });
    } catch (err) {
      setError(`Search failed: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [query, pov, user]);

  // Autocomplete fetch (landing page — populates dropdown, NOT results)
  const fetchSuggestions = useCallback(async (q) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setSuggestions(null);
      setShowSuggestions(false);
      return;
    }
    setSuggestLoading(true);
    try {
      // Same URL structure as doSearch — server handles all POV/filter/sort logic
      const url = buildSearchUrl(trimmed, SUGGEST_LIMIT, 0);
      const resp = await fetch(url);
      const data = await resp.json();
      if (resp.ok && data.hits) {
        // If NIP-05 result, prepend it to suggestions for visibility
        const nip05 = data.nip05Result || null;
        const filtered = nip05
          ? data.hits.filter(h => (h.pubkey || h.id) !== (nip05.pubkey || nip05.id))
          : data.hits;
        setSuggestions(nip05 ? [{ ...nip05, _nip05Verified: true }, ...filtered] : filtered);
        setShowSuggestions(true);
        if (data.povSuffix) setActivePovSuffix(data.povSuffix);
      }
    } catch {
      // silently fail suggestions
    } finally {
      setSuggestLoading(false);
    }
  }, [pov, user]);

  // Landing page: debounced autocomplete; Results page: debounced full search
  const handleInputChange = useCallback((value, isResultsView) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (isResultsView) {
      // Results view: search-as-you-type with full results
      if (value.trim().length >= 2) {
        debounceRef.current = setTimeout(() => doSearch(value), 300);
      } else if (value.trim().length === 0) {
        setResults(null);
        setMeta(null);
        setError(null);
      }
    } else {
      // Landing view: autocomplete suggestions only
      if (value.trim().length >= 2) {
        debounceRef.current = setTimeout(() => fetchSuggestions(value), 200);
      } else {
        setSuggestions(null);
        setShowSuggestions(false);
      }
    }
  }, [doSearch, fetchSuggestions]);

  // Close suggestions on click outside
  useEffect(() => {
    function handleClick(e) {
      if (suggestRef.current && !suggestRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Re-run search when POV changes while results are showing
  const prevPovRef = useRef(pov);
  useEffect(() => {
    if (prevPovRef.current !== pov && results && meta?.query) {
      doSearch(meta.query);
    }
    prevPovRef.current = pov;
  }, [pov]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasMore = results && meta && results.length < meta.estimatedTotalHits;

  // Landing view (no full results yet — suggestions may be showing)
  if (!hasResults && !loading && !error) {
    return (
      <div className="bs-page">
        <TopBar
          authMenu={
            <UserMenu user={user} login={login} logout={logout} pov={pov} setPov={setPov} filters={filters} setFilters={setFilters} sortConfig={sortConfig} setSortConfig={setSortConfig} onWotReady={setMyWotReady} />
          }
        />

        {/* Centered landing */}
        <div className="bs-landing">
          <h1 className="bs-logo">
            <img src="/brainstorm.svg" alt="" className="bs-logo-icon-img" />
            Brainstorm
          </h1>
          <p className="bs-tagline">Search across millions of nostr profiles</p>

          <SearchInput
            variant="landing"
            boxRef={suggestRef}
            inputRef={inputRef}
            value={query}
            onChange={(v) => handleInputChange(v, false)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                setShowSuggestions(false);
                doSearch();
              }
              if (e.key === 'Escape') setShowSuggestions(false);
            }}
            onFocus={() => { if (suggestions?.length) setShowSuggestions(true); }}
            placeholder="Search by name, bio, tag, NIP-05, website…"
            autoFocus
          >
            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions && suggestions.length > 0 && (
              <div className="bs-suggest-dropdown">
                {suggestions.map(hit => {
                  const name = hit.name || hit.display_name || 'Unknown';
                  const nip05 = hit.nip05;
                  return (
                    <a
                      key={hit.pubkey || hit.id}
                      href={`/user/${hit.pubkey || hit.id}${activePovSuffix ? `?pov=${activePovSuffix}` : ''}`}
                      className="bs-suggest-item"
                      onMouseDown={e => {
                        e.preventDefault(); // prevent input blur from removing the link
                        setShowSuggestions(false);
                        const povQ = activePovSuffix ? `?pov=${activePovSuffix}` : '';
                        window.location.href = `/user/${hit.pubkey || hit.id}${povQ}`;
                      }}
                    >
                      {hit.picture ? (
                        <img
                          src={hit.picture}
                          alt=""
                          className="bs-suggest-avatar"
                          onError={e => { e.target.outerHTML = '<div class="bs-suggest-avatar bs-suggest-avatar-placeholder">👤</div>'; }}
                        />
                      ) : (
                        <div className="bs-suggest-avatar bs-suggest-avatar-placeholder">👤</div>
                      )}
                      <div className="bs-suggest-info">
                        <span className="bs-suggest-name">{name}</span>
                        {nip05 && <span className="bs-suggest-nip05">{nip05}</span>}
                        <MatchedTagChips matchedTags={hit._matchedTags} query={query} />
                      </div>
                      {getWotScore(hit, 'rank', activePovSuffix) != null && (
                        <span className="bs-suggest-rank">🏅 {getWotScore(hit, 'rank', activePovSuffix)}</span>
                      )}
                    </a>
                  );
                })}
                <div className="bs-suggest-footer">
                  Press <kbd>Enter</kbd> for full results
                </div>
              </div>
            )}
            {showSuggestions && suggestLoading && (
              <div className="bs-suggest-dropdown">
                <div className="bs-suggest-loading">Searching…</div>
              </div>
            )}
          </SearchInput>

          {/* Personalization indicator */}
          <div className="bs-personalization">
            <span
              className="bs-personalization-status"
              onClick={() => setShowPovPicker(prev => !prev)}
              role="button"
              tabIndex={0}
            >
              {pov === 'user' && myWotReady ? (
                <span className="bs-personalized">✓ Personalized</span>
              ) : (
                <span className="bs-not-personalized">Not Personalized</span>
              )}
            </span>
            <span className="bs-personalization-sep">·</span>
            <a href="/personalization" className="bs-personalization-link">
              What is this?
            </a>

            {showPovPicker && (
              <div className="bs-pov-picker">
                {/* House POV option */}
                <button
                  className={`bs-pov-option ${pov !== 'user' || !myWotReady ? 'active' : ''}`}
                  onClick={() => { setPov('nosfabrica'); setShowPovPicker(false); }}
                >
                  {houseProfile?.picture && (
                    <img src={houseProfile.picture} alt="" className="bs-pov-option-avatar" onError={e => { e.target.style.display = 'none'; }} />
                  )}
                  <span>House Point of View</span>
                  {houseProfile?.name && <span className="bs-pov-option-name">{houseProfile.name}</span>}
                </button>

                {/* My WoT option */}
                {!user ? (
                  <div className="bs-pov-option disabled">
                    You must be logged in to personalize your search experience.
                  </div>
                ) : !myWotReady ? (
                  <div className="bs-pov-option disabled">
                    Your personalized perspective is being calculated.{' '}
                    <a href="/settings" className="bs-pov-option-link">Settings</a>
                  </div>
                ) : (
                  <button
                    className={`bs-pov-option ${pov === 'user' && myWotReady ? 'active' : ''}`}
                    onClick={() => { setPov('user'); setShowPovPicker(false); }}
                  >
                    {user.profile?.picture && (
                      <img src={user.profile.picture} alt="" className="bs-pov-option-avatar" onError={e => { e.target.style.display = 'none'; }} />
                    )}
                    <span>My Point of View</span>
                    <span className="bs-pov-option-name">{user.profile?.display_name || user.profile?.name || 'You'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bs-footer">
          <a href="/developers" className="bs-footer-link">Developers</a>
          <a href="/how-search-works" className="bs-footer-link">How search works</a>
          <a href="/settings" className="bs-footer-link">Settings</a>
        </div>
      </div>
    );
  }

  // Results view
  return (
    <div className="bs-page bs-page-results">
      {/* Top bar with search + auth */}
      <div className="bs-results-header">
        <div className="bs-results-header-left">
          <a
            href="/"
            className="bs-results-logo"
            onClick={e => {
              e.preventDefault();
              setQuery('');
              setResults(null);
              setMeta(null);
              setError(null);
            }}
          >
            <img src="/brainstorm.svg" alt="Brainstorm" className="bs-results-logo-img" />
          </a>
          <SearchInput
            variant="results"
            inputRef={inputRef}
            value={query}
            onChange={(v) => handleInputChange(v, true)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Search profiles…"
          />
        </div>
        <div className="bs-results-header-right">
          {/* Compact personalization indicator */}
          <div className="bs-personalization bs-personalization-compact">
            <span
              className="bs-personalization-status"
              onClick={() => setShowPovPicker(prev => !prev)}
              role="button"
              tabIndex={0}
            >
              {pov === 'user' && myWotReady ? (
                <span className="bs-personalized">✓ Personalized</span>
              ) : (
                <span className="bs-not-personalized">Not Personalized</span>
              )}
            </span>

            {showPovPicker && (
              <div className="bs-pov-picker bs-pov-picker-right">
                <button
                  className={`bs-pov-option ${pov !== 'user' || !myWotReady ? 'active' : ''}`}
                  onClick={() => { setPov('nosfabrica'); setShowPovPicker(false); }}
                >
                  {houseProfile?.picture && (
                    <img src={houseProfile.picture} alt="" className="bs-pov-option-avatar" onError={e => { e.target.style.display = 'none'; }} />
                  )}
                  <span>House Point of View</span>
                  {houseProfile?.name && <span className="bs-pov-option-name">{houseProfile.name}</span>}
                </button>

                {!user ? (
                  <div className="bs-pov-option disabled">
                    You must be logged in to personalize your search experience.
                  </div>
                ) : !myWotReady ? (
                  <div className="bs-pov-option disabled">
                    Your personalized perspective is being calculated.{' '}
                    <a href="/settings" className="bs-pov-option-link">Settings</a>
                  </div>
                ) : (
                  <button
                    className={`bs-pov-option ${pov === 'user' && myWotReady ? 'active' : ''}`}
                    onClick={() => { setPov('user'); setShowPovPicker(false); }}
                  >
                    {user.profile?.picture && (
                      <img src={user.profile.picture} alt="" className="bs-pov-option-avatar" onError={e => { e.target.style.display = 'none'; }} />
                    )}
                    <span>My Point of View</span>
                    <span className="bs-pov-option-name">{user.profile?.display_name || user.profile?.name || 'You'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
          <UserMenu user={user} login={login} logout={logout} pov={pov} setPov={setPov} filters={filters} setFilters={setFilters} sortConfig={sortConfig} setSortConfig={setSortConfig} onWotReady={setMyWotReady} />
        </div>
      </div>

      {/* Results area */}
      <div className="bs-results-body">
        {loading && (
          <div className="bs-loading">Searching…</div>
        )}

        {error && (
          <div className="bs-error">{typeof error === 'string' ? error : JSON.stringify(error)}</div>
        )}

        {results && !loading && (
          <>
            <div className="bs-results-meta">
              <span>
                {results.length === 0
                  ? (searchNotice || 'No results found')
                  : `About ${meta?.estimatedTotalHits?.toLocaleString() || '?'} results`}
              </span>
              {meta?.processingTimeMs != null && (
                <span className="bs-results-time">({meta.processingTimeMs}ms)</span>
              )}
            </div>

            {/* Pinned NIP-05 verified result (above normal results) */}
            {nip05Result && (
              <div className="bs-nip05-pinned">
                <div className="bs-nip05-badge">✅ NIP-05 Verified</div>
                <ResultCard hit={nip05Result} povSuffix={activePovSuffix} query={query} />
              </div>
            )}

            <div className="bs-results-list">
              {results
                .filter(hit => !nip05Result || (hit.pubkey || hit.id) !== (nip05Result.pubkey || nip05Result.id))
                .map(hit => (
                  <ResultCard key={hit.pubkey || hit.id} hit={hit} povSuffix={activePovSuffix} query={query} />
                ))}
            </div>

            {hasMore && (
              <div className="bs-load-more">
                <button
                  className="bs-load-more-btn"
                  onClick={() => doSearch(meta.query, results.length)}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? 'Loading…'
                    : `Show more results`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
