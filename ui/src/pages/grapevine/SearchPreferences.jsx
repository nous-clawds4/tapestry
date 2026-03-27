import { useState, useCallback, useEffect } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs';

/**
 * Search Preferences — configure WoT scoring for profile search.
 *
 * Flow:
 * 1. Enter a POV (Point of View) pubkey or npub
 * 2. Fetch their kind 10040 event to discover available metrics
 * 3. Sync Trusted Assertions (kind 30382) from the NIP-85 relay into local strfry via negentropy
 * 4. Load scores from local strfry into Meilisearch
 */

const RELAY_SEARCH_LIST = [
  'wss://relay.damus.io',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://purplepag.es',
];

function npubToHex(npub) {
  try {
    if (!npub.startsWith('npub1')) return null;
    const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const data = [];
    for (let i = 5; i < npub.length; i++) {
      const idx = CHARSET.indexOf(npub[i]);
      if (idx === -1) return null;
      data.push(idx);
    }
    const values = data.slice(0, data.length - 6);
    let acc = 0, bits = 0;
    const bytes = [];
    for (const v of values) {
      acc = (acc << 5) | v;
      bits += 5;
      while (bits >= 8) { bits -= 8; bytes.push((acc >> bits) & 0xff); }
    }
    if (bytes.length !== 32) return null;
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

function isValidPubkey(str) {
  return /^[0-9a-f]{64}$/.test(str);
}

async function fetchKind10040(pubkey) {
  for (const relayUrl of RELAY_SEARCH_LIST) {
    try {
      const event = await new Promise((resolve, reject) => {
        const ws = new WebSocket(relayUrl);
        let found = null;
        const timeout = setTimeout(() => { ws.close(); resolve(null); }, 8000);
        ws.onopen = () => {
          ws.send(JSON.stringify(['REQ', 'ta', { kinds: [10040], authors: [pubkey], limit: 1 }]));
        };
        ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            if (data[0] === 'EVENT' && data[2]) found = data[2];
            else if (data[0] === 'EOSE') { clearTimeout(timeout); ws.close(); resolve(found); }
          } catch {}
        };
        ws.onerror = () => { clearTimeout(timeout); ws.close(); resolve(null); };
      });
      if (event) return event;
    } catch { continue; }
  }
  return null;
}

function parseMetrics(event) {
  if (!event?.tags) return [];
  const metrics = [];
  for (const tag of event.tags) {
    if (tag[0]?.startsWith('30382:')) {
      metrics.push({
        metric: tag[0].split(':')[1],
        delegatedPubkey: tag[1],
        relayUrl: tag[2],
      });
    }
  }
  return metrics;
}

export default function SearchPreferences() {
  const [povInput, setPovInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // 10040 result
  const [povPubkey, setPovPubkey] = useState(null);
  const [event10040, setEvent10040] = useState(null);
  const [availableMetrics, setAvailableMetrics] = useState([]);
  const [selectedMetrics, setSelectedMetrics] = useState(new Set());

  // Local strfry count
  const [localCount, setLocalCount] = useState(null);
  const [countLoading, setCountLoading] = useState(false);

  // Negentropy sync
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);

  // Score loading
  const [loadingScores, setLoadingScores] = useState(false);
  const [loadProgress, setLoadProgress] = useState(null);
  const [loadResult, setLoadResult] = useState(null);

  // Meilisearch score status
  const [meiliScoreStatus, setMeiliScoreStatus] = useState(null);

  // Filter & Sort settings
  // filters: { rank: { enabled: true, cutoff: 2 }, followers: { enabled: false, cutoff: 0 } }
  // sort: { metric: 'followers', direction: 'desc' }
  const [filters, setFilters] = useState({});
  const [sortConfig, setSortConfig] = useState({ metric: null, direction: 'desc' });
  const [filterSortDirty, setFilterSortDirty] = useState(false);

  // Check Meilisearch for WoT score fields
  const checkMeiliScores = useCallback(async () => {
    try {
      const resp = await fetch('/api/search/profiles/meili/stats');
      const data = await resp.json();
      if (!data.success) return;

      const fields = data.fieldDistribution || {};
      const wotFields = Object.entries(fields)
        .filter(([k]) => k.startsWith('wot_') && k !== 'wot_pov' && k !== 'wot_updated_at')
        .map(([k, v]) => ({ field: k, count: v }));

      setMeiliScoreStatus({
        totalProfiles: data.numberOfDocuments || 0,
        wotFields,
        hasScores: wotFields.length > 0,
      });
    } catch { /* ignore */ }
  }, []);

  // Check on mount and after score loads
  useEffect(() => { checkMeiliScores(); }, [checkMeiliScores]);

  // Save preferences to server
  const savePreferences = useCallback(async (prefs) => {
    try {
      await fetch('/api/grapevine/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
    } catch { /* best effort */ }
  }, []);

  // Load saved preferences on mount
  useEffect(() => {
    async function loadSaved() {
      try {
        const resp = await fetch('/api/grapevine/preferences');
        const data = await resp.json();
        if (data.success && data.preferences?.povPubkey) {
          const prefs = data.preferences;
          setPovInput(prefs.povPubkey);
          setPovPubkey(prefs.povPubkey);

          // Restore filters and sort
          if (prefs.filters) setFilters(prefs.filters);
          if (prefs.sort) setSortConfig(prefs.sort);

          // Auto-lookup the 10040 to restore full state
          const event = await fetchKind10040(prefs.povPubkey);
          if (event) {
            setEvent10040(event);
            const metrics = parseMetrics(event);
            setAvailableMetrics(metrics);
            setSelectedMetrics(new Set(prefs.metrics?.length ? prefs.metrics : metrics.map(m => m.metric)));

            if (metrics.length > 0) {
              // Count local events using count endpoint
              try {
                const filter = encodeURIComponent(JSON.stringify({ kinds: [30382], authors: [metrics[0].delegatedPubkey] }));
                const countResp = await fetch(`/api/strfry/scan/count?filter=${filter}`);
                const countData = await countResp.json();
                setLocalCount(countData.success ? (countData.count ?? 0) : 0);
              } catch { setLocalCount(null); }
            }
          }
        }
      } catch { /* ignore */ }
      finally { setInitialLoading(false); }
    }
    loadSaved();
  }, []);

  // Count local 30382 events for the delegated signer (uses scan --count, no memory issues)
  const countLocal = useCallback(async (delegatedPubkey) => {
    if (!delegatedPubkey) return;
    setCountLoading(true);
    try {
      const filter = encodeURIComponent(JSON.stringify({ kinds: [30382], authors: [delegatedPubkey] }));
      const resp = await fetch(`/api/strfry/scan/count?filter=${filter}`);
      const data = await resp.json();
      setLocalCount(data.success ? (data.count ?? 0) : 0);
    } catch {
      setLocalCount(null);
    } finally {
      setCountLoading(false);
    }
  }, []);

  // Step 1: Lookup POV
  const lookupPov = useCallback(async () => {
    setError(null);
    setEvent10040(null);
    setAvailableMetrics([]);
    setSelectedMetrics(new Set());
    setLoadResult(null);
    setLocalCount(null);
    setSyncStatus(null);

    const trimmed = povInput.trim();
    let hex = null;
    if (isValidPubkey(trimmed.toLowerCase())) hex = trimmed.toLowerCase();
    else if (trimmed.startsWith('npub1')) hex = npubToHex(trimmed);
    if (!hex) { setError('Invalid pubkey or npub.'); return; }

    setPovPubkey(hex);
    setLoading(true);

    try {
      const event = await fetchKind10040(hex);
      if (!event) {
        setError(`No kind 10040 event found for this pubkey on ${RELAY_SEARCH_LIST.length} relays.`);
        return;
      }

      setEvent10040(event);
      const metrics = parseMetrics(event);
      setAvailableMetrics(metrics);
      setSelectedMetrics(new Set(metrics.map(m => m.metric)));

      // Set default filters/sort based on available metrics (only if not already configured)
      if (metrics.length > 0 && Object.keys(filters).length === 0) {
        const metricNames = metrics.map(m => m.metric);
        const hasRank = metricNames.includes('rank');
        const hasFollowers = metricNames.includes('followers');

        const defaultFilters = {};
        if (hasRank) {
          defaultFilters.rank = { enabled: true, cutoff: 2 };
        }
        // Other metrics default to disabled
        for (const m of metricNames) {
          if (!(m in defaultFilters)) {
            defaultFilters[m] = { enabled: false, cutoff: 0 };
          }
        }
        setFilters(defaultFilters);

        const defaultSort = {
          metric: hasFollowers ? 'followers' : (hasRank ? 'rank' : metricNames[0]),
          direction: 'desc',
        };
        setSortConfig(defaultSort);
      }

      // Save POV preference
      if (metrics.length > 0) {
        savePreferences({
          povPubkey: hex,
          metrics: metrics.map(m => m.metric),
          delegatedPubkey: metrics[0].delegatedPubkey,
          nip85Relay: metrics[0].relayUrl,
          filters,
          sort: sortConfig,
        });
        countLocal(metrics[0].delegatedPubkey);
      }
    } catch (err) {
      setError(`Lookup failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [povInput, countLocal, savePreferences]);

  // Step 2: Negentropy sync from NIP-85 relay into local strfry
  const triggerSync = useCallback(async () => {
    const relayUrl = availableMetrics[0]?.relayUrl;
    const delegatedPubkey = availableMetrics[0]?.delegatedPubkey;
    if (!relayUrl || !delegatedPubkey) return;

    setSyncing(true);
    setSyncStatus('Starting negentropy sync...');
    setError(null);

    try {
      const resp = await fetch('/api/strfry/negentropy-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          relay: relayUrl,
          dir: 'down',
          filter: { kinds: [30382], authors: [delegatedPubkey] },
        }),
      });

      const data = await resp.json();
      if (data.success) {
        setSyncStatus(`✅ Sync complete. ${data.stdout || ''}`);
        // Re-count local events
        countLocal(delegatedPubkey);
      } else if (data.active) {
        setSyncStatus('⏳ A sync is already in progress. Please wait and try again.');
      } else {
        setSyncStatus(`❌ Sync failed: ${data.error || 'unknown error'}`);
      }
    } catch (err) {
      setSyncStatus(`❌ Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }, [availableMetrics, countLocal]);

  // Step 3: Load scores from LOCAL strfry into Meilisearch
  const loadScores = useCallback(async () => {
    if (selectedMetrics.size === 0) { setError('Select at least one metric.'); return; }

    const delegatedPubkey = availableMetrics[0]?.delegatedPubkey;
    const metricNames = availableMetrics.filter(m => selectedMetrics.has(m.metric)).map(m => m.metric);

    if (!delegatedPubkey) { setError('Missing delegated pubkey.'); return; }

    setLoadingScores(true);
    setLoadResult(null);
    setLoadProgress('Fetching scores from local strfry...');
    setError(null);

    try {
      // Stream from local strfry using the JSONL streaming endpoint (no buffer limit)
      const filter = encodeURIComponent(JSON.stringify({ kinds: [30382], authors: [delegatedPubkey] }));
      const resp = await fetch(`/api/strfry/scan/stream?filter=${filter}`);
      if (!resp.ok) throw new Error(`Stream failed: ${resp.status}`);

      setLoadProgress('Streaming scores from local strfry...');

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

          if (scores.length % 10000 === 0) {
            setLoadProgress(`Parsed ${scores.length.toLocaleString()} scores...`);
          }
        }
      }

      setLoadProgress(`Parsed ${scores.length.toLocaleString()} scores. Sending to Meilisearch...`);

      // Send to Meilisearch
      const meiliResp = await fetch('/api/search/profiles/meili/load-scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ povPubkey, metrics: metricNames, scores }),
      });

      const result = await meiliResp.json();
      if (result.success) {
        setLoadResult({
          success: true,
          message: `✅ Loaded ${scores.length.toLocaleString()} scores (${metricNames.join(', ')}) into search index.`,
          count: scores.length,
        });
        // Refresh score status and save selected metrics
        checkMeiliScores();
        savePreferences({
          povPubkey,
          metrics: metricNames,
          delegatedPubkey,
          nip85Relay: availableMetrics[0]?.relayUrl,
        });
      } else {
        setError(result.error || 'Failed to load scores into Meilisearch.');
      }
    } catch (err) {
      setError(`Score loading failed: ${err.message}`);
    } finally {
      setLoadingScores(false);
      setLoadProgress(null);
    }
  }, [availableMetrics, selectedMetrics, povPubkey]);

  const toggleMetric = (metric) => {
    setSelectedMetrics(prev => {
      const next = new Set(prev);
      if (next.has(metric)) next.delete(metric);
      else next.add(metric);
      return next;
    });
  };

  const inputStyle = {
    flex: 1,
    padding: '0.5rem 0.75rem',
    fontSize: '0.9rem',
    fontFamily: 'monospace',
    backgroundColor: 'var(--bg-primary, #0f0f23)',
    color: 'var(--text-primary, #e0e0e0)',
    border: '1px solid var(--border, #444)',
    borderRadius: '4px',
  };

  const sectionStyle = {
    padding: '1rem',
    border: '1px solid var(--border, #444)',
    borderRadius: '8px',
    backgroundColor: 'var(--bg-secondary, #1a1a2e)',
    marginBottom: '1rem',
  };

  const delegatedPubkey = availableMetrics[0]?.delegatedPubkey;
  const nip85Relay = availableMetrics[0]?.relayUrl;

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>⚙️ Search Preferences</h1>
      {initialLoading && <p style={{ opacity: 0.5 }}>Loading saved preferences...</p>}
      <p className="subtitle">
        Configure Web of Trust scoring for profile search. Select a Point of View
        (observer) and choose which trust metrics to use for filtering and ranking
        search results.
      </p>

      {/* Step 1: POV Selection */}
      <div style={sectionStyle}>
        <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
          1. Select Point of View
        </label>
        <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: '0 0 0.75rem' }}>
          Enter the pubkey or npub of the observer whose WoT scores you want to use.
          This person must have published a kind 10040 (Trusted Assertions) event.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={povInput}
            onChange={e => setPovInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && lookupPov()}
            placeholder="npub1... or hex pubkey"
            style={inputStyle}
          />
          <button className="btn btn-primary" onClick={lookupPov} disabled={loading}>
            {loading ? '⏳' : '🔍'} Lookup
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '0.75rem 1rem', border: '1px solid #f85149', borderRadius: '8px',
          backgroundColor: 'rgba(248, 81, 73, 0.08)', color: '#f85149', fontSize: '0.9rem', marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {/* Step 2: Metrics + Sync */}
      {availableMetrics.length > 0 && (
        <div style={sectionStyle}>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
            2. Available Trust Metrics
          </label>

          <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.75rem', fontFamily: 'monospace' }}>
            POV: {povPubkey?.slice(0, 16)}…{povPubkey?.slice(-8)}
            <br />
            Delegated signer: {delegatedPubkey?.slice(0, 16)}…{delegatedPubkey?.slice(-8)}
            <br />
            NIP-85 relay: {nip85Relay}
          </div>

          {/* Metric checkboxes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {availableMetrics.map(m => (
              <label
                key={m.metric}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.5rem 0.75rem', borderRadius: '6px',
                  backgroundColor: selectedMetrics.has(m.metric) ? 'rgba(88, 166, 255, 0.1)' : 'transparent',
                  border: `1px solid ${selectedMetrics.has(m.metric) ? '#58a6ff' : 'var(--border, #444)'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedMetrics.has(m.metric)}
                  onChange={() => toggleMetric(m.metric)}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.metric}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                    → wot_{m.metric} field in search index
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Filter & Sort */}
      {availableMetrics.length > 0 && (
        <div style={sectionStyle}>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
            3. Filter &amp; Sort
          </label>
          <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: '0 0 0.75rem' }}>
            Configure how search results are filtered and sorted by WoT scores.
            Profiles with no score are treated as having a score of 0.
          </p>

          {/* Filters */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.5rem' }}>Filters</div>
            {availableMetrics.map(m => {
              const f = filters[m.metric] || { enabled: false, cutoff: 0 };
              return (
                <div key={m.metric} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.5rem 0.75rem', marginBottom: '0.35rem', borderRadius: '6px',
                  border: `1px solid ${f.enabled ? '#58a6ff' : 'var(--border, #444)'}`,
                  backgroundColor: f.enabled ? 'rgba(88, 166, 255, 0.06)' : 'transparent',
                }}>
                  <input
                    type="checkbox"
                    checked={f.enabled}
                    onChange={() => {
                      setFilters(prev => ({
                        ...prev,
                        [m.metric]: { ...f, enabled: !f.enabled },
                      }));
                      setFilterSortDirty(true);
                    }}
                  />
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', minWidth: '80px' }}>{m.metric}</span>
                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>≥</span>
                  <input
                    type="number"
                    step="any"
                    value={f.cutoff}
                    onChange={e => {
                      setFilters(prev => ({
                        ...prev,
                        [m.metric]: { ...f, cutoff: parseFloat(e.target.value) || 0 },
                      }));
                      setFilterSortDirty(true);
                    }}
                    disabled={!f.enabled}
                    style={{
                      width: '80px', padding: '0.25rem 0.5rem', fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      backgroundColor: f.enabled ? 'var(--bg-primary, #0f0f23)' : 'transparent',
                      color: 'var(--text-primary, #e0e0e0)',
                      border: `1px solid ${f.enabled ? 'var(--border, #444)' : 'transparent'}`,
                      borderRadius: '4px',
                      opacity: f.enabled ? 1 : 0.3,
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', opacity: 0.4 }}>
                    (hide profiles below this score)
                  </span>
                </div>
              );
            })}
          </div>

          {/* Sort */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.5rem' }}>Sort by</div>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select
                value={sortConfig.metric || ''}
                onChange={e => {
                  setSortConfig(prev => ({ ...prev, metric: e.target.value || null }));
                  setFilterSortDirty(true);
                }}
                style={{
                  padding: '0.35rem 0.5rem', fontSize: '0.85rem', borderRadius: '4px',
                  backgroundColor: 'var(--bg-primary, #0f0f23)',
                  color: 'var(--text-primary, #e0e0e0)',
                  border: '1px solid var(--border, #444)',
                }}
              >
                <option value="">None (text relevance only)</option>
                {availableMetrics.map(m => (
                  <option key={m.metric} value={m.metric}>{m.metric}</option>
                ))}
              </select>
              <select
                value={sortConfig.direction}
                onChange={e => {
                  setSortConfig(prev => ({ ...prev, direction: e.target.value }));
                  setFilterSortDirty(true);
                }}
                style={{
                  padding: '0.35rem 0.5rem', fontSize: '0.85rem', borderRadius: '4px',
                  backgroundColor: 'var(--bg-primary, #0f0f23)',
                  color: 'var(--text-primary, #e0e0e0)',
                  border: '1px solid var(--border, #444)',
                }}
              >
                <option value="desc">Descending (highest first)</option>
                <option value="asc">Ascending (lowest first)</option>
              </select>
            </div>
          </div>

          {/* Save button */}
          <button
            className="btn btn-primary"
            disabled={!filterSortDirty}
            onClick={async () => {
              await savePreferences({
                povPubkey, metrics: availableMetrics.map(m => m.metric),
                delegatedPubkey: availableMetrics[0]?.delegatedPubkey,
                nip85Relay: availableMetrics[0]?.relayUrl,
                filters, sort: sortConfig,
              });
              setFilterSortDirty(false);
            }}
            style={{ fontSize: '0.85rem' }}
          >
            💾 Save Filter &amp; Sort Preferences
          </button>
          {!filterSortDirty && Object.keys(filters).length > 0 && (
            <span style={{ fontSize: '0.8rem', opacity: 0.5, marginLeft: '0.75rem' }}>✓ Saved</span>
          )}
        </div>
      )}

      {/* Step 4: Sync Trusted Assertions */}
      {availableMetrics.length > 0 && (
        <div style={sectionStyle}>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
            4. Sync Trusted Assertions to Local Relay
          </label>
          <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: '0 0 0.75rem' }}>
            Use negentropy to sync all kind 30382 events from the NIP-85 relay into
            your local strfry. This ensures all scores are available locally before
            loading into the search index.
          </p>

          {/* Local count indicator */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '0.5rem 0.75rem', borderRadius: '6px',
            backgroundColor: 'var(--bg-primary, #0f0f23)',
            marginBottom: '0.75rem', fontSize: '0.85rem',
          }}>
            <span>📊 Local strfry:</span>
            {countLoading ? (
              <span style={{ opacity: 0.5 }}>counting...</span>
            ) : localCount !== null ? (
              <strong>{localCount.toLocaleString()}</strong>
            ) : (
              <span style={{ opacity: 0.5 }}>unknown</span>
            )}
            <span style={{ opacity: 0.5 }}>kind 30382 events from this signer</span>
            <button
              className="btn"
              onClick={() => countLocal(delegatedPubkey)}
              disabled={countLoading}
              style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', marginLeft: 'auto' }}
            >
              🔄 Refresh
            </button>
          </div>

          <button
            className="btn btn-primary"
            onClick={triggerSync}
            disabled={syncing}
            style={{ marginBottom: '0.5rem' }}
          >
            {syncing ? '⏳ Syncing...' : '🔄 Sync Trusted Assertions from NIP-85 Relay'}
          </button>

          {syncStatus && (
            <div style={{ fontSize: '0.8rem', marginTop: '0.5rem', opacity: 0.8 }}>
              {syncStatus}
            </div>
          )}
        </div>
      )}

      {/* Step 4: Load scores into Meilisearch */}
      {availableMetrics.length > 0 && (
        <div style={sectionStyle}>
          <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
            5. Load Scores into Search Index
          </label>
          <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: '0 0 0.75rem' }}>
            Read scores from local strfry and load them into Meilisearch for filtering
            and ranking search results.
          </p>

          {/* Current score status in Meilisearch */}
          <div style={{
            padding: '0.5rem 0.75rem', borderRadius: '6px',
            backgroundColor: 'var(--bg-primary, #0f0f23)',
            marginBottom: '0.75rem', fontSize: '0.85rem',
          }}>
            {meiliScoreStatus?.hasScores ? (
              <div>
                <span style={{ color: '#3fb950' }}>✅ Scores loaded in search index:</span>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                  {meiliScoreStatus.wotFields.map(f => (
                    <span key={f.field} style={{ fontSize: '0.8rem' }}>
                      <strong>{f.field}</strong>: {f.count.toLocaleString()} profiles
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <span style={{ color: '#d29922' }}>
                ⚠️ No WoT scores in search index yet — load scores to enable WoT-filtered search.
              </span>
            )}
          </div>

          <button
            className="btn btn-primary"
            onClick={loadScores}
            disabled={loadingScores || selectedMetrics.size === 0 || localCount === 0}
            style={{ marginBottom: '0.5rem' }}
          >
            {loadingScores ? '⏳ Loading...' : '📥 Load Scores into Meilisearch'}
          </button>

          {localCount === 0 && (
            <div style={{ fontSize: '0.8rem', opacity: 0.5, marginTop: '0.25rem' }}>
              No scores in local strfry yet — sync first (step 3).
            </div>
          )}

          {loadProgress && (
            <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>
              {loadProgress}
            </div>
          )}

          {loadResult?.success && (
            <div style={{
              padding: '0.75rem 1rem', border: '1px solid #3fb950', borderRadius: '8px',
              backgroundColor: 'rgba(63, 185, 80, 0.08)', color: '#3fb950', fontSize: '0.9rem', marginTop: '0.75rem',
            }}>
              {loadResult.message}
            </div>
          )}
        </div>
      )}

      {/* Raw 10040 event (collapsible) */}
      {event10040 && (
        <details style={{ ...sectionStyle, cursor: 'pointer' }}>
          <summary style={{ fontWeight: 600, fontSize: '0.85rem' }}>
            Raw kind 10040 event
          </summary>
          <pre style={{
            marginTop: '0.75rem', padding: '0.75rem',
            backgroundColor: 'var(--bg-primary, #0f0f23)', borderRadius: '4px',
            fontSize: '0.75rem', overflow: 'auto', maxHeight: '300px',
          }}>
            {JSON.stringify(event10040, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
