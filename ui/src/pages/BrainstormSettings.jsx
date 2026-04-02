import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu, { useHouseProfile } from '../components/BrainstormUserMenu';

/* ── Helpers ──────────────────────────────────────────── */

const EXTERNAL_RELAYS = ['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://nos.lol'];

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

/* ── Main Component ──────────────────────────────────── */

export default function BrainstormSettings() {
  const { user, login, logout } = useAuth();
  const navigate = useNavigate();

  // WoT pipeline state
  const [wotStatus, setWotStatus] = useState({
    loading: true,
    has10040: false,
    hasRankTag: false,
    hasTAs: false,
    taAge: null,
    rankAuthor: null,
    rankRelay: null,
    localCount: null,
    allMetrics: [],
  });

  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loadingScores, setLoadingScores] = useState(false);
  const [loadStatus, setLoadStatus] = useState(null);
  const [scoresReady, setScoresReady] = useState(false);

  // Preferences
  const [pov, setPov] = useState('nosfabrica');
  const [selectedMetrics, setSelectedMetrics] = useState(new Set());
  const [filters, setFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ metric: null, direction: 'desc' });
  const [filterSortDirty, setFilterSortDirty] = useState(false);

  // ── Helpers ──
  async function countLocalTAs(delegatedPubkey) {
    const filter = encodeURIComponent(JSON.stringify({ kinds: [30382], authors: [delegatedPubkey] }));
    const resp = await fetch(`/api/strfry/scan/count?filter=${filter}`);
    const data = await resp.json();
    return data.success ? (data.count ?? 0) : 0;
  }

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

  // Save preferences
  async function savePrefs() {
    try {
      await fetch('/api/user-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pov,
          selectedMetrics: [...selectedMetrics],
          filters,
          sortConfig,
          rankAuthor: wotStatus.rankAuthor,
          rankRelay: wotStatus.rankRelay,
        }),
      });
      setFilterSortDirty(false);
    } catch {}
  }

  // ── Main pipeline ──
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setWotStatus(s => ({ ...s, loading: true }));

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

        // Step 2: Parse metrics
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

        let localCount = await countLocalTAs(rankAuthor);
        if (cancelled) return;

        const baseStatus = { loading: false, has10040: true, hasRankTag: true, rankAuthor, rankRelay, allMetrics };
        const metricNames = allMetrics.map(m => m.metric);
        setSelectedMetrics(new Set(metricNames));

        // Load user prefs, fall back to house
        let loadedFilters = null, loadedSort = null, loadedPov = null, loadedMetrics = null;
        try {
          const userPrefsResp = await fetch('/api/user-prefs');
          const userPrefsData = await userPrefsResp.json();
          if (userPrefsData.success && userPrefsData.preferences) {
            const up = userPrefsData.preferences;
            if (up.filters && Object.keys(up.filters).length > 0) loadedFilters = up.filters;
            if (up.sortConfig?.metric) loadedSort = up.sortConfig;
            if (up.selectedMetrics?.length) loadedMetrics = up.selectedMetrics;
            if (up.pov) loadedPov = up.pov;
          }
        } catch {}

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
        if (loadedPov) setPov(loadedPov);

        if (!loadedFilters) {
          const defaults = {};
          if (metricNames.includes('rank')) defaults.rank = { enabled: true, cutoff: 2 };
          for (const m of metricNames) { if (!(m in defaults)) defaults[m] = { enabled: false, cutoff: 0 }; }
          setFilters(defaults);
        }
        if (!loadedSort) {
          setSortConfig({
            metric: metricNames.includes('followers') ? 'followers' : (metricNames.includes('rank') ? 'rank' : metricNames[0] || null),
            direction: 'desc',
          });
        }

        if (localCount > 0) {
          const taFilter = JSON.stringify({ kinds: [30382], authors: [rankAuthor], limit: 1 });
          let taAge = null;
          try {
            const taResp = await fetch(`/api/strfry/scan?filter=${encodeURIComponent(taFilter)}`);
            const taData = await taResp.json();
            if (taData.success && taData.events?.length) taAge = timeAgoShort(taData.events[0].created_at);
          } catch {}
          setWotStatus({ ...baseStatus, hasTAs: true, taAge, localCount });
        } else {
          setWotStatus({ ...baseStatus, hasTAs: false, taAge: null, localCount: 0 });
        }

        // Auto-sync if local count is 0
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

        // Auto-load scores
        const hasScores = await checkMeiliScores();
        if (cancelled) return;
        if (hasScores) {
          setScoresReady(true);
          setLoadStatus('✅ Scores already in search index');
          if (!loadedPov) setPov('user');
        } else {
          const ok = await triggerLoadScores(rankAuthor, metricNames, user.pubkey);
          if (ok && !cancelled && !loadedPov) setPov('user');
        }
      } catch {
        if (!cancelled) setWotStatus(s => ({ ...s, loading: false }));
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  // Persist POV changes
  useEffect(() => {
    if (!user || !pov) return;
    fetch('/api/user-prefs', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pov }),
    }).catch(() => {});
  }, [user, pov]);

  const myWotReady = wotStatus.has10040 && wotStatus.hasRankTag && wotStatus.hasTAs && scoresReady;
  const houseProfile = useHouseProfile();
  const displayName = user?.profile?.name || user?.pubkey?.slice(0, 12) + '…';
  const picture = user?.profile?.picture;

  // Not signed in
  if (!user) {
    return (
      <div className="bss-page">
        <div className="bss-top-bar">
          <a href="/kg/brainstorm-search" className="bss-back">← Back to Search</a>
          <a href="/kg/brainstorm-search" className="bsp-logo">
            <img src="/kg/brainstorm.svg" alt="" className="bsp-logo-img" />
            Brainstorm Search
          </a>
          <BrainstormUserMenu user={user} login={login} logout={logout} />
        </div>
        <div className="bss-content">
          <div className="bss-empty">
            <p>Sign in with nostr to personalize your search experience.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bss-page">
      {/* Top bar */}
      <div className="bss-top-bar">
        <a href="/kg/brainstorm-search" className="bss-back">← Back to Search</a>
        <a href="/kg/brainstorm-search" className="bsp-logo">
          <img src="/kg/brainstorm.svg" alt="" className="bsp-logo-img" />
          Brainstorm Search
        </a>
        <div className="bss-auth">
          <BrainstormUserMenu user={user} login={login} logout={logout} />
        </div>
      </div>

      <div className="bss-content">
        <h1 className="bss-title">⚙️ Personalize your Experience</h1>
        <p className="bss-subtitle">
          Configure Web of Trust scoring to personalize how search results are filtered and ranked.
        </p>

        {/* Profile card */}
        <div className="bss-card">
          <div className="bss-card-header">Your Profile</div>
          <div className="bss-profile-row">
            {picture ? (
              <img src={picture} alt="" className="bss-avatar" onError={e => { e.target.style.display = 'none'; }} />
            ) : (
              <div className="bss-avatar bss-avatar-placeholder">{(displayName || '?')[0].toUpperCase()}</div>
            )}
            <div>
              <div className="bss-profile-name">{displayName}</div>
              <div className="bss-profile-pubkey">{user.pubkey.slice(0, 16)}…{user.pubkey.slice(-8)}</div>
            </div>
          </div>
        </div>

        {/* WoT Status */}
        <div className="bss-card">
          <div className="bss-card-header">Web of Trust Pipeline</div>
          {wotStatus.loading ? (
            <div className="bss-loading">Checking WoT status…</div>
          ) : (
            <div className="bss-status-list">
              <StatusRow ok={wotStatus.has10040} label="Treasure Map (kind 10040)" />
              <StatusRow ok={wotStatus.hasRankTag} label="Rank tag in Treasure Map" />

              {wotStatus.has10040 && wotStatus.hasRankTag && (<>
                <StatusRow
                  ok={wotStatus.hasTAs}
                  label={`Trusted Assertions${wotStatus.hasTAs && wotStatus.taAge ? ` (latest: ${wotStatus.taAge})` : ''}`}
                />

                <div className="bss-status-row">
                  <span>{wotStatus.localCount > 0 ? '✅' : (syncing ? '⏳' : '❌')}</span>
                  <span>Local TAs{wotStatus.localCount != null ? `: ${wotStatus.localCount.toLocaleString()}` : ''}</span>
                  <button
                    className="bss-action-btn"
                    onClick={() => triggerSync(wotStatus.rankAuthor, wotStatus.rankRelay)}
                    disabled={syncing}
                  >
                    {syncing ? '⏳ Syncing…' : '🔄 Re-sync'}
                  </button>
                </div>
                {syncStatus && <div className="bss-substatus">{syncStatus}</div>}

                {wotStatus.localCount > 0 && (
                  <>
                    <div className="bss-status-row">
                      <span>{scoresReady ? '✅' : (loadingScores ? '⏳' : '❌')}</span>
                      <span>Scores in search index</span>
                      <button
                        className="bss-action-btn"
                        onClick={() => {
                          const metricNames = wotStatus.allMetrics.map(m => m.metric);
                          triggerLoadScores(wotStatus.rankAuthor, metricNames, user.pubkey);
                        }}
                        disabled={loadingScores}
                      >
                        {loadingScores ? '⏳ Loading…' : '🔄 Re-load'}
                      </button>
                    </div>
                    {loadStatus && <div className="bss-substatus">{loadStatus}</div>}
                  </>
                )}
              </>)}
            </div>
          )}
        </div>

        {/* Trust Metrics */}
        {wotStatus.allMetrics.length > 0 && scoresReady && (
          <div className="bss-card">
            <div className="bss-card-header">Available Trust Metrics</div>
            <p className="bss-card-desc">Select which metrics to use for filtering and sorting search results.</p>
            <div className="bss-metrics-grid">
              {wotStatus.allMetrics.map(m => (
                <label key={m.metric} className={`bss-metric-chip ${selectedMetrics.has(m.metric) ? 'active' : ''}`}>
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
                  <span className="bss-metric-name">{m.metric}</span>
                  <span className="bss-metric-field">→ wot_{m.metric}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Filter & Sort */}
        {wotStatus.allMetrics.length > 0 && scoresReady && (
          <div className="bss-card">
            <div className="bss-card-header">Filter &amp; Sort</div>
            <p className="bss-card-desc">Profiles with no score are treated as having a score of 0.</p>

            <div className="bss-filter-section">
              <h4>Filters</h4>
              {wotStatus.allMetrics.filter(m => selectedMetrics.has(m.metric)).map(m => {
                const f = filters[m.metric] || { enabled: false, cutoff: 0 };
                return (
                  <div key={m.metric} className={`bss-filter-row ${f.enabled ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={f.enabled}
                      onChange={() => {
                        setFilters(prev => ({ ...prev, [m.metric]: { ...f, enabled: !f.enabled } }));
                        setFilterSortDirty(true);
                      }}
                    />
                    <span className="bss-filter-name">{m.metric}</span>
                    <span className="bss-filter-op">≥</span>
                    <input
                      type="number"
                      step="any"
                      value={f.cutoff}
                      onChange={e => {
                        setFilters(prev => ({ ...prev, [m.metric]: { ...f, cutoff: parseFloat(e.target.value) || 0 } }));
                        setFilterSortDirty(true);
                      }}
                      disabled={!f.enabled}
                      className="bss-filter-input"
                    />
                    <span className="bss-filter-hint">hide profiles below this score</span>
                  </div>
                );
              })}
            </div>

            <div className="bss-filter-section">
              <h4>Sort by</h4>
              <div className="bss-sort-row">
                <select
                  value={sortConfig.metric || ''}
                  onChange={e => {
                    setSortConfig(prev => ({ ...prev, metric: e.target.value || null }));
                    setFilterSortDirty(true);
                  }}
                  className="bss-select"
                >
                  <option value="">None (text relevance only)</option>
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
                  className="bss-select"
                >
                  <option value="desc">Descending (highest first)</option>
                  <option value="asc">Ascending (lowest first)</option>
                </select>
              </div>
            </div>

            <button
              className={`bss-save-btn ${filterSortDirty ? '' : 'saved'}`}
              onClick={savePrefs}
              disabled={!filterSortDirty}
            >
              {filterSortDirty ? '💾 Save Preferences' : '✓ Saved'}
            </button>
          </div>
        )}

        {/* POV Toggle */}
        <div className="bss-card">
          <div className="bss-card-header">Point of View</div>
          <p className="bss-card-desc">
            Choose whose Web of Trust scores to use when searching.
          </p>
          <div className="bss-pov-toggle">
            <button
              className={`bss-pov-btn ${pov === 'nosfabrica' ? 'active' : ''}`}
              onClick={() => setPov('nosfabrica')}
            >
              <div className="bss-pov-btn-title">
                {houseProfile ? (
                  <span className="bss-pov-house-label">
                    {houseProfile.picture && (
                      <img src={houseProfile.picture} alt="" className="bss-pov-house-avatar" onError={e => { e.target.style.display = 'none'; }} />
                    )}
                    {houseProfile.name}
                  </span>
                ) : 'House'}
              </div>
              <div className="bss-pov-btn-desc">
                {houseProfile ? (
                  <a href={`/kg/brainstorm-search/user/${houseProfile.pubkey}`} className="bss-pov-profile-link" onClick={e => e.stopPropagation()}>
                    View profile →
                  </a>
                ) : "Use the instance's default WoT scores"}
              </div>
            </button>
            <button
              className={`bss-pov-btn ${pov === 'user' ? 'active' : ''} ${!myWotReady ? 'disabled' : ''}`}
              onClick={() => { if (myWotReady) setPov('user'); }}
              disabled={!myWotReady}
            >
              <div className="bss-pov-btn-title">My WoT</div>
              <div className="bss-pov-btn-desc">
                {myWotReady ? 'Use your personal Web of Trust scores' : 'Complete the pipeline above to enable'}
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Status Row helper ── */

function StatusRow({ ok, label }) {
  return (
    <div className="bss-status-row">
      <span>{ok ? '✅' : '❌'}</span>
      <span>{label}</span>
    </div>
  );
}
