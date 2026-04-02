import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

/* ── User Menu (avatar + dropdown panel) ─────────────── */

const EXTERNAL_RELAYS = ['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://nos.lol'];
const POV_STORAGE_PREFIX = 'bs_pov_';

function UserMenu({ user, login, logout, pov, setPov, filters, setFilters, sortConfig, setSortConfig }) {
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
    // Save to server (best effort, non-blocking)
    fetch('/api/user-prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pov }),
    }).catch(() => {});
  }, [user, pov]);

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
  async function triggerLoadScores(rankAuthor, metricNames, userPubkey) {
    setLoadingScores(true);
    setLoadStatus('Streaming scores from local relay…');
    try {
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
              scoreObj[`wot_${tag[0]}`] = parseFloat(tag[1]) || 0;
            }
          }
          scores.push(scoreObj);
        }
        if (scores.length % 10000 === 0 && scores.length > 0) {
          setLoadStatus(`Parsed ${scores.length.toLocaleString()} scores…`);
        }
      }

      setLoadStatus(`Sending ${scores.length.toLocaleString()} scores to search index…`);

      const meiliResp = await fetch('/api/search/profiles/meili/load-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ povPubkey: userPubkey, metrics: metricNames, scores }),
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
          const relays = EXTERNAL_RELAYS.join(',');
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

  if (!user) {
    return <button className="bs-link-btn" onClick={login}>Sign in with nostr</button>;
  }

  const displayName = user.profile?.name || user.pubkey.slice(0, 8) + '…';
  const picture = user.profile?.picture;

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

          {/* WoT Status */}
          <div className="bs-usermenu-section">
            <div className="bs-usermenu-section-title">Web of Trust Status</div>
            {wotStatus.loading ? (
              <div className="bs-usermenu-status-loading">Checking…</div>
            ) : (
              <div className="bs-usermenu-status-list">
                {/* Check 1: 10040 */}
                <div className="bs-usermenu-status-row">
                  <span>{wotStatus.has10040 ? '✅' : '❌'}</span>
                  <span>Treasure Map (kind 10040)</span>
                </div>
                {/* Check 2: Rank tag */}
                <div className="bs-usermenu-status-row">
                  <span>{wotStatus.hasRankTag ? '✅' : '❌'}</span>
                  <span>Rank tag in Treasure Map</span>
                </div>

                {/* Only show steps 3–5 if checks 1–2 pass */}
                {wotStatus.has10040 && wotStatus.hasRankTag && (<>
                  {/* Check 3: TAs exist */}
                  <div className="bs-usermenu-status-row">
                    <span>{wotStatus.hasTAs ? '✅' : '❌'}</span>
                    <span>
                      Trusted Assertions
                      {wotStatus.hasTAs && wotStatus.taAge && (
                        <span className="bs-usermenu-ta-age"> (latest: {wotStatus.taAge})</span>
                      )}
                    </span>
                  </div>

                  {/* Step 4: Sync */}
                  <div className="bs-usermenu-status-row">
                    <span>{wotStatus.localCount > 0 ? '✅' : (syncing ? '⏳' : '❌')}</span>
                    <span>
                      Local TAs{wotStatus.localCount != null ? `: ${wotStatus.localCount.toLocaleString()}` : ''}
                    </span>
                    <button
                      className="bs-usermenu-action-btn"
                      onClick={() => triggerSync(wotStatus.rankAuthor, wotStatus.rankRelay)}
                      disabled={syncing}
                      title="Re-sync TAs from relay"
                    >
                      {syncing ? '⏳' : '🔄'}
                    </button>
                  </div>
                  {syncStatus && (
                    <div className="bs-usermenu-substatus">{syncStatus}</div>
                  )}

                  {/* Step 5: Load scores */}
                  {wotStatus.localCount > 0 && (
                    <>
                      <div className="bs-usermenu-status-row">
                        <span>{scoresReady ? '✅' : (loadingScores ? '⏳' : '❌')}</span>
                        <span>Scores in search index</span>
                        <button
                          className="bs-usermenu-action-btn"
                          onClick={() => {
                            const metricNames = wotStatus.allMetrics.map(m => m.metric);
                            triggerLoadScores(wotStatus.rankAuthor, metricNames, user.pubkey);
                          }}
                          disabled={loadingScores}
                          title="Re-load scores into Meilisearch"
                        >
                          {loadingScores ? '⏳' : '🔄'}
                        </button>
                      </div>
                      {loadStatus && (
                        <div className="bs-usermenu-substatus">{loadStatus}</div>
                      )}
                    </>
                  )}
                </>)}
              </div>
            )}
          </div>

          {/* Available Metrics (compact) — only show when pipeline is ready */}
          {wotStatus.allMetrics.length > 0 && scoresReady && (
            <div className="bs-usermenu-section">
              <div className="bs-usermenu-section-title">Trust Metrics</div>
              <div className="bs-usermenu-metrics-list">
                {wotStatus.allMetrics.map(m => (
                  <label key={m.metric} className={`bs-usermenu-metric ${selectedMetrics.has(m.metric) ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedMetrics.has(m.metric)}
                      onChange={() => {
                        setSelectedMetrics(prev => {
                          const next = new Set(prev);
                          if (next.has(m.metric)) next.delete(m.metric);
                          else next.add(m.metric);
                          return next;
                        });
                        setFilterSortDirty(true);
                      }}
                    />
                    <span>{m.metric}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Filter & Sort (compact) — only show when pipeline is ready */}
          {wotStatus.allMetrics.length > 0 && scoresReady && (
            <div className="bs-usermenu-section">
              <div className="bs-usermenu-section-title">Filter &amp; Sort</div>

              {/* Compact filters */}
              <div className="bs-usermenu-filters">
                {wotStatus.allMetrics.filter(m => selectedMetrics.has(m.metric)).map(m => {
                  const f = filters[m.metric] || { enabled: false, cutoff: 0 };
                  return (
                    <div key={m.metric} className="bs-usermenu-filter-row">
                      <input
                        type="checkbox"
                        checked={f.enabled}
                        onChange={() => {
                          setFilters(prev => ({ ...prev, [m.metric]: { ...f, enabled: !f.enabled } }));
                          setFilterSortDirty(true);
                        }}
                      />
                      <span className="bs-usermenu-filter-name">{m.metric}</span>
                      <span className="bs-usermenu-filter-op">≥</span>
                      <input
                        type="number"
                        step="any"
                        value={f.cutoff}
                        onChange={e => {
                          setFilters(prev => ({ ...prev, [m.metric]: { ...f, cutoff: parseFloat(e.target.value) || 0 } }));
                          setFilterSortDirty(true);
                        }}
                        disabled={!f.enabled}
                        className="bs-usermenu-filter-input"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Sort */}
              <div className="bs-usermenu-sort-row">
                <span className="bs-usermenu-filter-name">Sort by</span>
                <select
                  value={sortConfig.metric || ''}
                  onChange={e => {
                    setSortConfig(prev => ({ ...prev, metric: e.target.value || null }));
                    setFilterSortDirty(true);
                  }}
                  className="bs-usermenu-select"
                >
                  <option value="">relevance</option>
                  {wotStatus.allMetrics.filter(m => selectedMetrics.has(m.metric)).map(m => (
                    <option key={m.metric} value={m.metric}>{m.metric}</option>
                  ))}
                </select>
                <select
                  value={sortConfig.direction}
                  onChange={e => {
                    setSortConfig(prev => ({ ...prev, direction: e.target.value }));
                    setFilterSortDirty(true);
                  }}
                  className="bs-usermenu-select"
                >
                  <option value="desc">desc</option>
                  <option value="asc">asc</option>
                </select>
              </div>

              {/* Save button */}
              {filterSortDirty && (
                <button className="bs-usermenu-save-btn" onClick={saveFilterSort}>
                  💾 Save Preferences
                </button>
              )}
              {!filterSortDirty && Object.keys(filters).length > 0 && (
                <div className="bs-usermenu-substatus">✓ Saved</div>
              )}
            </div>
          )}

          {/* POV Toggle */}
          <div className="bs-usermenu-section">
            <div className="bs-usermenu-section-title">Point of View</div>
            <div className="bs-usermenu-pov-toggle">
              <button
                className={`bs-usermenu-pov-btn ${pov === 'nosfabrica' ? 'active' : ''}`}
                onClick={() => setPov('nosfabrica')}
              >
                House (NosFabrica)
              </button>
              <button
                className={`bs-usermenu-pov-btn ${pov === 'user' ? 'active' : ''} ${!myWotReady ? 'disabled' : ''}`}
                onClick={() => { if (myWotReady) setPov('user'); }}
                disabled={!myWotReady}
                title={!myWotReady ? 'Complete all WoT steps above to enable My WoT' : ''}
              >
                My WoT
              </button>
            </div>
          </div>

          {/* Sign out */}
          <div className="bs-usermenu-footer">
            <button className="bs-usermenu-signout" onClick={() => { setOpen(false); logout(); }}>
              Sign out
            </button>
          </div>
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

/* ── Result Card ──────────────────────────────────────── */

function ResultCard({ hit }) {
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
      href={`/kg/brainstorm-search/user/${hit.pubkey || hit.id}`}
      className="bs-result-card"
    >
      <div className="bs-result-body">
        <div className="bs-result-row">
          {picture ? (
            <img
              src={picture}
              alt=""
              className="bs-result-avatar"
              onError={e => { e.target.style.display = 'none'; }}
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
            {(hit.wot_rank != null || hit.wot_followers != null) && (
              <div className="bs-result-wot">
                {hit.wot_rank != null && (
                  <span className="bs-wot-badge bs-wot-rank">🏅 rank: {hit.wot_rank}</span>
                )}
                {hit.wot_followers != null && (
                  <span className="bs-wot-badge bs-wot-followers">👥 followers: {hit.wot_followers}</span>
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
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [pov, setPov] = useState('nosfabrica');
  // Filter/sort state (lifted from UserMenu so doSearch can access them)
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
    } else {
      setLoadingMore(true);
    }

    try {
      // Build search URL with optional user-specific filter/sort
      let url = `/api/search/profiles/meili?q=${encodeURIComponent(trimmed)}&limit=${RESULTS_PER_PAGE}&offset=${offset}`;

      // When POV is 'user', send user's personal filter/sort to override house defaults
      if (pov === 'user' && Object.keys(filters).length > 0) {
        url += `&wotFilters=${encodeURIComponent(JSON.stringify(filters))}`;
      }
      if (pov === 'user' && sortConfig.metric) {
        url += `&wotSort=${encodeURIComponent(JSON.stringify(sortConfig))}`;
      }

      const resp = await fetch(url);
      const data = await resp.json();

      if (!resp.ok || data.success === false) {
        setError(data.error || 'Search service unavailable.');
        return;
      }

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
  }, [query, pov, filters, sortConfig]);

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
      const resp = await fetch(
        `/api/search/profiles/meili?q=${encodeURIComponent(trimmed)}&limit=${SUGGEST_LIMIT}&offset=0`
      );
      const data = await resp.json();
      if (resp.ok && data.hits) {
        setSuggestions(data.hits);
        setShowSuggestions(true);
      }
    } catch {
      // silently fail suggestions
    } finally {
      setSuggestLoading(false);
    }
  }, []);

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
        {/* Top-right auth area */}
        <div className="bs-top-bar">
          <UserMenu user={user} login={login} logout={logout} pov={pov} setPov={setPov} filters={filters} setFilters={setFilters} sortConfig={sortConfig} setSortConfig={setSortConfig} />
        </div>

        {/* Centered landing */}
        <div className="bs-landing">
          <h1 className="bs-logo">
            <img src="/kg/brainstorm.svg" alt="" className="bs-logo-icon-img" />
            Brainstorm Search
          </h1>
          <p className="bs-tagline">Search across millions of nostr profiles</p>

          <div className="bs-search-box-landing" ref={suggestRef}>
            <span className="bs-search-icon">🔍</span>
            <input
              ref={inputRef}
              type="text"
              className="bs-search-input-landing"
              value={query}
              onChange={e => handleInputChange(e.target.value, false)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setShowSuggestions(false);
                  doSearch();
                }
                if (e.key === 'Escape') setShowSuggestions(false);
              }}
              onFocus={() => { if (suggestions?.length) setShowSuggestions(true); }}
              placeholder="Search by name, bio, NIP-05, website…"
              autoFocus
            />

            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions && suggestions.length > 0 && (
              <div className="bs-suggest-dropdown">
                {suggestions.map(hit => {
                  const name = hit.name || hit.display_name || 'Unknown';
                  const nip05 = hit.nip05;
                  return (
                    <a
                      key={hit.pubkey || hit.id}
                      href={`/kg/brainstorm-search/user/${hit.pubkey || hit.id}`}
                      className="bs-suggest-item"
                      onMouseDown={e => {
                        e.preventDefault(); // prevent input blur from removing the link
                        setShowSuggestions(false);
                        window.location.href = `/kg/brainstorm-search/user/${hit.pubkey || hit.id}`;
                      }}
                    >
                      {hit.picture ? (
                        <img
                          src={hit.picture}
                          alt=""
                          className="bs-suggest-avatar"
                          onError={e => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="bs-suggest-avatar bs-suggest-avatar-placeholder">👤</div>
                      )}
                      <div className="bs-suggest-info">
                        <span className="bs-suggest-name">{name}</span>
                        {nip05 && <span className="bs-suggest-nip05">{nip05}</span>}
                      </div>
                      {hit.wot_rank != null && (
                        <span className="bs-suggest-rank">🏅 {hit.wot_rank}</span>
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
          </div>

          <div className="bs-hints">
            <span>Try:</span>
            {['straycat', 'bitcoin', 'developer', 'nostr'].map(term => (
              <button
                key={term}
                className="bs-hint-chip"
                onClick={() => { setQuery(term); doSearch(term); }}
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        <div className="bs-footer">
          Powered by <a href="https://brainstorm.nosfabrica.com/" className="bs-footer-link">NosFabrica</a>
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
            href="/kg/brainstorm-search"
            className="bs-results-logo"
            onClick={e => {
              e.preventDefault();
              setQuery('');
              setResults(null);
              setMeta(null);
              setError(null);
            }}
          >
            <img src="/kg/brainstorm.svg" alt="Brainstorm" className="bs-results-logo-img" />
          </a>
          <div className="bs-search-box-results">
            <input
              ref={inputRef}
              type="text"
              className="bs-search-input-results"
              value={query}
              onChange={e => handleInputChange(e.target.value, true)}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search profiles…"
            />
          </div>
        </div>
        <div className="bs-results-header-right">
          <UserMenu user={user} login={login} logout={logout} pov={pov} setPov={setPov} filters={filters} setFilters={setFilters} sortConfig={sortConfig} setSortConfig={setSortConfig} />
        </div>
      </div>

      {/* Results area */}
      <div className="bs-results-body">
        {loading && (
          <div className="bs-loading">Searching…</div>
        )}

        {error && (
          <div className="bs-error">{error}</div>
        )}

        {results && !loading && (
          <>
            <div className="bs-results-meta">
              <span>
                {results.length === 0
                  ? 'No results found'
                  : `About ${meta?.estimatedTotalHits?.toLocaleString() || '?'} results`}
              </span>
              {meta?.processingTimeMs != null && (
                <span className="bs-results-time">({meta.processingTimeMs}ms)</span>
              )}
            </div>

            <div className="bs-results-list">
              {results.map(hit => (
                <ResultCard key={hit.pubkey || hit.id} hit={hit} />
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
