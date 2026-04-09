import { useState, useEffect, useCallback } from 'react';

export default function MeilisearchAdmin() {
  const [stats, setStats] = useState(null);
  const [strfryCount, setStrfryCount] = useState(null);
  const [settings, setSettings] = useState(null);
  const [bulkStatus, setBulkStatus] = useState(null);
  const [randomProfile, setRandomProfile] = useState(null);
  const [taskQueue, setTaskQueue] = useState(null);
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmPrune, setConfirmPrune] = useState(false);
  const [pruneResult, setPruneResult] = useState(null);
  const [missingProfiles, setMissingProfiles] = useState(null);
  const [backfillResult, setBackfillResult] = useState(null);

  // ── Fetch functions ──

  const fetchStats = useCallback(async () => {
    setLoading(prev => ({ ...prev, stats: true }));
    try {
      const resp = await fetch('/api/search/profiles/meili/stats');
      const data = await resp.json();
      if (data.success) setStats(data);
    } catch (err) {
      setError(`Stats: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, stats: false }));
    }
  }, []);

  const fetchStrfryCount = useCallback(async () => {
    setLoading(prev => ({ ...prev, strfry: true }));
    try {
      const filter = encodeURIComponent(JSON.stringify({ kinds: [0] }));
      const resp = await fetch(`/api/strfry/scan/count?filter=${filter}`);
      const data = await resp.json();
      if (data.success) setStrfryCount(data.count);
    } catch (err) {
      setError(`Strfry count: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, strfry: false }));
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    setLoading(prev => ({ ...prev, settings: true }));
    try {
      const resp = await fetch('/api/search/profiles/meili/settings');
      const data = await resp.json();
      if (data.success) setSettings(data.settings);
    } catch (err) {
      setError(`Settings: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, settings: false }));
    }
  }, []);

  const fetchBulkStatus = useCallback(async () => {
    try {
      const resp = await fetch('/api/search/profiles/meili/bulk-status');
      const data = await resp.json();
      if (data.success) setBulkStatus(data);
    } catch { /* ignore */ }
  }, []);

  const fetchRandomProfile = useCallback(async () => {
    setLoading(prev => ({ ...prev, random: true }));
    setRandomProfile(null);
    try {
      const resp = await fetch('/api/search/profiles/meili/random-scored');
      const data = await resp.json();
      if (data.success) setRandomProfile(data);
    } catch (err) {
      setError(`Random: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, random: false }));
    }
  }, []);

  const fetchTaskQueue = useCallback(async () => {
    setLoading(prev => ({ ...prev, tasks: true }));
    try {
      const resp = await fetch('/api/search/profiles/meili/tasks');
      const data = await resp.json();
      if (data.success) setTaskQueue(data);
    } catch (err) {
      setError(`Tasks: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, tasks: false }));
    }
  }, []);

  // ── Actions ──

  const triggerWipe = useCallback(async () => {
    setConfirmWipe(false);
    setLoading(prev => ({ ...prev, wipe: true }));
    try {
      const resp = await fetch('/api/search/profiles/meili/wipe', { method: 'DELETE' });
      const data = await resp.json();
      if (data.success) {
        setStats(null);
        setSettings(null);
        setRandomProfile(null);
        setTimeout(fetchStats, 3000);
      } else {
        setError(`Wipe failed: ${data.error}`);
      }
    } catch (err) {
      setError(`Wipe: ${err.message}`);
    } finally {
      setLoading(prev => ({ ...prev, wipe: false }));
    }
  }, [fetchStats]);

  const triggerResync = useCallback(async () => {
    setLoading(prev => ({ ...prev, resync: true }));
    try {
      await fetch('/api/search/profiles/meili/resync', { method: 'POST' });
      // Poll for status
      const pollInterval = setInterval(async () => {
        const resp = await fetch('/api/search/profiles/meili/bulk-status');
        const data = await resp.json();
        if (data.success) {
          setBulkStatus(data);
          if (data.status === 'complete' || data.status === 'error') {
            clearInterval(pollInterval);
            setLoading(prev => ({ ...prev, resync: false }));
            fetchStats();
          }
        }
      }, 3000);
    } catch (err) {
      setError(`Resync: ${err.message}`);
      setLoading(prev => ({ ...prev, resync: false }));
    }
  }, [fetchStats]);

  // ── Load on mount ──

  useEffect(() => {
    fetchStats();
    fetchStrfryCount();
    fetchSettings();
    fetchBulkStatus();
    fetchTaskQueue();
  }, [fetchStats, fetchStrfryCount, fetchSettings, fetchBulkStatus, fetchTaskQueue]);

  // ── Derived data ──

  const fieldDist = stats?.fieldDistribution || {};
  const wotFields = Object.entries(fieldDist)
    .filter(([k]) => k.startsWith('wot_'))
    .sort(([a], [b]) => a.localeCompare(b));
  const totalProfiles = stats?.numberOfDocuments || 0;
  const profilesWithScores = wotFields.length > 0
    ? Math.max(...wotFields.map(([, v]) => v))
    : 0;

  const filterableAttrs = settings?.filterableAttributes || [];
  const sortableAttrs = settings?.sortableAttributes || [];
  const wotFilterable = filterableAttrs.filter(f => f.startsWith('wot_'));
  const wotSortable = sortableAttrs.filter(f => f.startsWith('wot_'));

  const isBulkRunning = bulkStatus?.status === 'fetching' || bulkStatus?.status === 'indexing';

  return (
    <div>
      <h2>Meilisearch Admin</h2>
      <p style={{ opacity: 0.6, marginBottom: '1.5rem' }}>
        Monitor and manage the Meilisearch search index for nostr profiles.
      </p>

      {error && (
        <div className="alert" style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '6px', padding: '0.75rem', marginBottom: '1rem', color: '#f85149' }}>
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#f85149', cursor: 'pointer' }}>✕</button>
        </div>
      )}

      {/* ── Panel 1: Overview Stats ── */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>1. Index Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.25rem' }}>Total Profiles in Meilisearch</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {loading.stats ? '…' : totalProfiles.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.25rem' }}>Profiles with WoT Scores</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {loading.stats ? '…' : profilesWithScores.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.25rem' }}>Kind 0 Events in Local Strfry</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {loading.strfry ? '…' : (strfryCount != null ? strfryCount.toLocaleString() : '—')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.25rem' }}>Indexing Status</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {stats?.isIndexing ? '⏳ Indexing…' : '✅ Idle'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.25rem' }}>Task Queue</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>
              {loading.tasks ? '…' : taskQueue ? (
                taskQueue.pending > 0
                  ? <span style={{ color: '#f59e0b' }}>⏳ {taskQueue.pending.toLocaleString()} pending</span>
                  : <span>✅ Clear</span>
              ) : '—'}
            </div>
          </div>
        </div>
        <button onClick={() => { fetchStats(); fetchStrfryCount(); fetchTaskQueue(); }} disabled={loading.stats} style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.3rem 0.75rem', cursor: 'pointer' }}>
          🔄 Refresh
        </button>
      </div>

      {/* ── Panel 2: WoT Fields in Index ── */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>2. WoT Score Fields in Index</h3>
        {wotFields.length === 0 ? (
          <div style={{ opacity: 0.5 }}>No WoT score fields found in index.</div>
        ) : (
          <table className="data-table" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th>Field</th>
                <th>Profiles</th>
                <th>Filterable</th>
                <th>Sortable</th>
              </tr>
            </thead>
            <tbody>
              {wotFields.map(([field, count]) => (
                <tr key={field}>
                  <td><code>{field}</code></td>
                  <td>{count.toLocaleString()}</td>
                  <td>{filterableAttrs.includes(field) ? '✅' : '—'}</td>
                  <td>{sortableAttrs.includes(field) ? '✅' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Panel 3: Filterable & Sortable Attributes ── */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>3. Filterable & Sortable Attributes</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.5rem' }}>Filterable ({filterableAttrs.length})</div>
            {filterableAttrs.length === 0 ? (
              <div style={{ opacity: 0.4, fontSize: '0.82rem' }}>None</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {filterableAttrs.map(f => (
                  <code key={f} style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                    {f}
                  </code>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', opacity: 0.5, marginBottom: '0.5rem' }}>Sortable ({sortableAttrs.length})</div>
            {sortableAttrs.length === 0 ? (
              <div style={{ opacity: 0.4, fontSize: '0.82rem' }}>None</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                {sortableAttrs.map(f => (
                  <code key={f} style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', background: 'rgba(255,255,255,0.05)', borderRadius: '3px' }}>
                    {f}
                  </code>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={fetchSettings} disabled={loading.settings} style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.3rem 0.75rem', cursor: 'pointer' }}>
          🔄 Refresh
        </button>
      </div>

      {/* ── Panel 3b: Task Queue ── */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Task Queue</h3>
        {!taskQueue ? (
          <div style={{ opacity: 0.5 }}>{loading.tasks ? 'Loading…' : 'No task data available.'}</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
              {['enqueued', 'processing', 'succeeded', 'failed', 'canceled'].map(status => (
                <div key={status}>
                  <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'capitalize' }}>{status}</div>
                  <div style={{
                    fontSize: '1.25rem',
                    fontWeight: 600,
                    color: status === 'failed' && taskQueue.queue[status] > 0 ? '#f85149'
                         : status === 'processing' && taskQueue.queue[status] > 0 ? '#f59e0b'
                         : undefined,
                  }}>
                    {(taskQueue.queue[status] || 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            {taskQueue.recentFailed?.length > 0 && (
              <details style={{ marginTop: '0.5rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.82rem', opacity: 0.7 }}>
                  Recent failed tasks ({taskQueue.recentFailed.length})
                </summary>
                <div style={{ marginTop: '0.5rem', maxHeight: '200px', overflow: 'auto' }}>
                  {taskQueue.recentFailed.map(t => (
                    <div key={t.uid} style={{ fontSize: '0.75rem', padding: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ opacity: 0.5 }}>#{t.uid}</span>{' '}
                      <code style={{ fontSize: '0.7rem' }}>{t.type}</code>{' '}
                      <span style={{ color: '#f85149' }}>{t.error}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </>
        )}
        <button onClick={fetchTaskQueue} disabled={loading.tasks} style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.3rem 0.75rem', cursor: 'pointer' }}>
          🔄 Refresh
        </button>
      </div>

      {/* ── Panel 4: Wipe Meilisearch ── */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(248,81,73,0.08)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>4. Clear Meilisearch Index</h3>
        <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.75rem' }}>
          Deletes the entire profiles index. You will need to reload kind 0 profiles and WoT scores afterward.
        </p>
        {!confirmWipe ? (
          <button
            onClick={() => setConfirmWipe(true)}
            disabled={loading.wipe}
            style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', cursor: 'pointer', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: '5px', color: '#f85149' }}
          >
            🗑️ Clear Index
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#f85149' }}>Are you sure? This cannot be undone.</span>
            <button
              onClick={triggerWipe}
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', cursor: 'pointer', background: '#f85149', border: 'none', borderRadius: '5px', color: '#fff' }}
            >
              Yes, wipe it
            </button>
            <button
              onClick={() => setConfirmWipe(false)}
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ── Panel 4b: Prune Unscored Profiles ── */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.08)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Prune Unscored Profiles</h3>
        <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.75rem' }}>
          Remove all profiles from Meilisearch that have no WoT scores. This keeps only scored profiles,
          dramatically reducing index size and improving search relevance.
        </p>
        {pruneResult && (
          <div style={{
            fontSize: '0.85rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '5px',
            background: pruneResult.success ? 'rgba(74,222,128,0.1)' : 'rgba(248,81,73,0.1)',
            border: `1px solid ${pruneResult.success ? 'rgba(74,222,128,0.3)' : 'rgba(248,81,73,0.3)'}`,
            color: pruneResult.success ? '#4ade80' : '#f85149',
          }}>
            {pruneResult.success
              ? `✅ ${pruneResult.message}`
              : `❌ ${pruneResult.error}`}
          </div>
        )}
        {!confirmPrune ? (
          <button
            onClick={() => { setConfirmPrune(true); setPruneResult(null); }}
            disabled={loading.prune}
            style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', cursor: 'pointer', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '5px', color: '#f59e0b' }}
          >
            {loading.prune ? '⏳ Pruning…' : '✂️ Prune Unscored Profiles'}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', color: '#f59e0b' }}>
              This will delete all profiles without WoT scores. Continue?
            </span>
            <button
              onClick={async () => {
                setConfirmPrune(false);
                setLoading(prev => ({ ...prev, prune: true }));
                setPruneResult(null);
                try {
                  const resp = await fetch('/api/search/profiles/meili/prune-unscored', { method: 'POST' });
                  const data = await resp.json();
                  setPruneResult(data);
                  if (data.success) {
                    setTimeout(() => { fetchStats(); fetchTaskQueue(); }, 3000);
                  }
                } catch (err) {
                  setPruneResult({ success: false, error: err.message });
                } finally {
                  setLoading(prev => ({ ...prev, prune: false }));
                }
              }}
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', cursor: 'pointer', background: '#f59e0b', border: 'none', borderRadius: '5px', color: '#000' }}
            >
              Yes, prune
            </button>
            <button
              onClick={() => setConfirmPrune(false)}
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ── Panel 4c: Scored Profiles Missing Kind 0 Data ── */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Backfill Missing Profile Data</h3>
        <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.75rem' }}>
          Find scored profiles that are missing kind 0 profile data (name, picture, etc.) and look them up in local strfry.
        </p>

        {missingProfiles && (
          <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '5px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <strong>{missingProfiles.totalScored?.toLocaleString()}</strong> scored profiles total ·{' '}
            <strong style={{ color: missingProfiles.missingCount > 0 ? '#f59e0b' : '#4ade80' }}>
              {missingProfiles.missingCount?.toLocaleString()}
            </strong> missing profile data
            {missingProfiles.samplePubkeys?.length > 0 && (
              <details style={{ marginTop: '0.4rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.78rem', opacity: 0.6 }}>
                  Sample pubkeys ({missingProfiles.samplePubkeys.length})
                </summary>
                <div style={{ marginTop: '0.3rem', maxHeight: '120px', overflow: 'auto' }}>
                  {missingProfiles.samplePubkeys.map(pk => (
                    <div key={pk} style={{ fontSize: '0.72rem', fontFamily: 'monospace', opacity: 0.6, padding: '0.1rem 0' }}>
                      {pk}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {backfillResult && (
          <div style={{
            fontSize: '0.85rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '5px',
            background: backfillResult.success ? 'rgba(74,222,128,0.1)' : 'rgba(248,81,73,0.1)',
            border: `1px solid ${backfillResult.success ? 'rgba(74,222,128,0.3)' : 'rgba(248,81,73,0.3)'}`,
            color: backfillResult.success ? '#4ade80' : '#f85149',
          }}>
            {backfillResult.success
              ? `✅ ${backfillResult.message}`
              : `❌ ${backfillResult.error}`}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={async () => {
              setLoading(prev => ({ ...prev, missing: true }));
              setMissingProfiles(null);
              try {
                const resp = await fetch('/api/search/profiles/meili/scored-missing-profile');
                const data = await resp.json();
                if (data.success) setMissingProfiles(data);
                else setError(data.error);
              } catch (err) {
                setError(`Check: ${err.message}`);
              } finally {
                setLoading(prev => ({ ...prev, missing: false }));
              }
            }}
            disabled={loading.missing}
            style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', cursor: 'pointer' }}
          >
            {loading.missing ? '⏳ Checking…' : '🔍 Check for Missing Profiles'}
          </button>

          {missingProfiles?.missingCount > 0 && (
            <button
              onClick={async () => {
                setLoading(prev => ({ ...prev, backfill: true }));
                setBackfillResult(null);
                try {
                  const resp = await fetch('/api/search/profiles/meili/backfill-profiles', { method: 'POST' });
                  const data = await resp.json();
                  setBackfillResult(data);
                  if (data.success) {
                    setTimeout(() => { fetchStats(); fetchTaskQueue(); }, 3000);
                  }
                } catch (err) {
                  setBackfillResult({ success: false, error: err.message });
                } finally {
                  setLoading(prev => ({ ...prev, backfill: false }));
                }
              }}
              disabled={loading.backfill}
              style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', cursor: 'pointer', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '5px', color: '#a5b4fc' }}
            >
              {loading.backfill ? '⏳ Backfilling…' : `📥 Backfill ${missingProfiles.missingCount.toLocaleString()} Profiles`}
            </button>
          )}
        </div>
      </div>

      {/* ── Panel 5: Reload Kind 0 Profile Events ── */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>5. Reload Kind 0 Profile Events</h3>
        <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.75rem' }}>
          Stream all kind 0 events from local strfry and index them into Meilisearch.
        </p>
        {isBulkRunning && (
          <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem', color: '#58a6ff' }}>
            ⏳ Bulk ingest in progress: {(bulkStatus?.indexed || 0).toLocaleString()} indexed
            {bulkStatus?.processed ? ` / ${bulkStatus.processed.toLocaleString()} processed` : ''}
          </div>
        )}
        {bulkStatus?.status === 'complete' && (
          <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
            <div style={{ color: '#3fb950', marginBottom: '0.3rem' }}>
              ✅ Last ingest complete: {(bulkStatus?.indexed || 0).toLocaleString()} profiles indexed
              {bulkStatus?.processed ? ` from ${bulkStatus.processed.toLocaleString()} events` : ''}
              {bulkStatus?.elapsed ? ` in ${bulkStatus.elapsed}s` : ''}
            </div>
            {bulkStatus?.errors && (
              <div style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.3rem' }}>
                <div>Duplicates skipped: {(bulkStatus.errors.duplicatesSkipped || 0).toLocaleString()}</div>
                {(bulkStatus.errors.jsonParse > 0 || bulkStatus.errors.missingFields > 0 ||
                  bulkStatus.errors.contentParse > 0 || bulkStatus.errors.npubEncode > 0) && (
                  <div style={{ color: '#d29922' }}>
                    Parse errors: {(bulkStatus.errors.jsonParse + bulkStatus.errors.missingFields +
                      bulkStatus.errors.contentParse + bulkStatus.errors.npubEncode).toLocaleString()}
                    {' '}(JSON: {bulkStatus.errors.jsonParse}, missing fields: {bulkStatus.errors.missingFields},
                    content: {bulkStatus.errors.contentParse}, npub: {bulkStatus.errors.npubEncode})
                  </div>
                )}
                {bulkStatus.errors.batchFailures > 0 && (
                  <div style={{ color: '#f85149' }}>
                    ⚠ Batch failures: {bulkStatus.errors.batchFailures}
                    ({(bulkStatus.errors.batchesDropped || 0).toLocaleString()} profiles dropped,
                    {bulkStatus.errors.batchRetries} retries)
                  </div>
                )}
              </div>
            )}
            {bulkStatus?.sampleErrors?.length > 0 && (
              <details style={{ fontSize: '0.75rem', marginTop: '0.4rem', opacity: 0.6 }}>
                <summary style={{ cursor: 'pointer' }}>Sample errors ({bulkStatus.sampleErrors.length})</summary>
                <pre style={{ margin: '0.3rem 0', whiteSpace: 'pre-wrap', fontSize: '0.7rem' }}>
                  {JSON.stringify(bulkStatus.sampleErrors, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
        <button
          onClick={triggerResync}
          disabled={loading.resync || isBulkRunning}
          style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', cursor: 'pointer' }}
        >
          {loading.resync || isBulkRunning ? '⏳ Indexing…' : '📥 Reload Profiles'}
        </button>
      </div>

      {/* ── Panel 6: Random Scored Profile ── */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>6. Random Scored Profile</h3>
        <p style={{ fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.75rem' }}>
          Fetch a random profile with WoT scores to inspect the document structure.
        </p>
        <button
          onClick={fetchRandomProfile}
          disabled={loading.random}
          style={{ fontSize: '0.8rem', padding: '0.4rem 1rem', cursor: 'pointer', marginBottom: '0.75rem' }}
        >
          {loading.random ? '⏳ Loading…' : '🎲 Fetch Random Profile'}
        </button>
        {randomProfile?.document ? (
          <div>
            <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              <strong>{randomProfile.document.display_name || randomProfile.document.name || 'Unknown'}</strong>
              {randomProfile.document.nip05 && <span style={{ marginLeft: '0.5rem', opacity: 0.5 }}>{randomProfile.document.nip05}</span>}
            </div>
            <pre style={{ fontSize: '0.72rem', background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px', overflow: 'auto', maxHeight: '400px' }}>
              {JSON.stringify(randomProfile.document, null, 2)}
            </pre>
          </div>
        ) : randomProfile?.message ? (
          <div style={{ opacity: 0.5, fontSize: '0.85rem' }}>{randomProfile.message}</div>
        ) : null}
      </div>
    </div>
  );
}
