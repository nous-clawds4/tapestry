import { useState, useEffect } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs';

/**
 * Strfry overview page.
 * Loads the total event count on mount, then lets the user load
 * individual kind counts on demand (each scan takes a while on large DBs).
 */

const KIND_PANELS = [
  { kind: 0,     label: 'Profiles' },
  { kind: 3,     label: 'Follows' },
  { kind: 7,     label: 'Reactions' },
  { kind: 1984,  label: 'Reports' },
  { kind: 10000, label: 'Mutes' },
  { kind: 9998,  label: 'DList Headers (legacy)' },
  { kind: 9999,  label: 'DList Items (legacy)' },
  { kind: 39998, label: 'DList Headers' },
  { kind: 39999, label: 'DList Items' },
];

/** Fetch a single count from `/api/strfry/scan/count`. */
async function fetchCount(filter = '{}') {
  const url = '/api/strfry/scan/count?filter=' + encodeURIComponent(filter);
  const resp = await fetch(url);
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || 'Count failed');
  return data.count;
}

export default function StrfryOverview() {
  // Total event count (loaded on mount)
  const [total, setTotal] = useState(null);          // null = loading, number = loaded
  const [totalLoading, setTotalLoading] = useState(true);
  const [totalError, setTotalError] = useState(null);

  // Per-kind counts: { [kind]: { count, loading, error } }
  const [kindCounts, setKindCounts] = useState({});

  // Load total on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const count = await fetchCount('{}');
        if (!cancelled) setTotal(count);
      } catch (err) {
        if (!cancelled) setTotalError(err.message);
      } finally {
        if (!cancelled) setTotalLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function loadKindCount(kind) {
    setKindCounts(prev => ({
      ...prev,
      [kind]: { ...prev[kind], loading: true, error: null },
    }));
    try {
      const count = await fetchCount(JSON.stringify({ kinds: [kind] }));
      setKindCounts(prev => ({
        ...prev,
        [kind]: { count, loading: false, error: null },
      }));
    } catch (err) {
      setKindCounts(prev => ({
        ...prev,
        [kind]: { ...prev[kind], loading: false, error: err.message },
      }));
    }
  }

  async function refreshTotal() {
    setTotalLoading(true);
    setTotalError(null);
    try {
      const count = await fetchCount('{}');
      setTotal(count);
    } catch (err) {
      setTotalError(err.message);
    } finally {
      setTotalLoading(false);
    }
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>📡 Strfry</h1>
          <p className="subtitle">Overview of nostr events stored in the local strfry relay.</p>
        </div>
      </div>

      {/* ── Total count card ── */}
      <div style={{
        padding: '1.25rem',
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}>
        <div style={{ fontSize: '1.75rem' }}>📨</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', marginBottom: '0.25rem' }}>
            Total Events
          </div>
          {totalLoading ? (
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-muted, #888)' }}>
              Counting…
            </div>
          ) : totalError ? (
            <div style={{ fontSize: '0.9rem', color: '#ef4444' }}>Error: {totalError}</div>
          ) : (
            <div style={{ fontSize: '1.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {(total ?? 0).toLocaleString()}
            </div>
          )}
        </div>
        <button
          className="btn-small"
          onClick={refreshTotal}
          disabled={totalLoading}
          title="Refresh total count"
        >
          {totalLoading ? '…' : '🔄'}
        </button>
      </div>

      {/* ── Kind panels ── */}
      <h3 style={{ marginBottom: '0.75rem' }}>Events by Kind</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginBottom: '1rem' }}>
        Each count scans the database independently. Click a button to load the count for that kind.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '0.75rem',
      }}>
        {KIND_PANELS.map(({ kind, label }) => {
          const state = kindCounts[kind] || {};
          const hasCount = state.count != null;
          const pct = hasCount && total > 0
            ? ((state.count / total) * 100).toFixed(1) + '%'
            : null;

          return (
            <div
              key={kind}
              style={{
                padding: '1rem',
                border: '1px solid var(--border, #444)',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-secondary, #1a1a2e)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
              }}
            >
              {/* Header: kind + label */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <code style={{ fontSize: '0.85rem', fontWeight: 600 }}>{kind}</code>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginLeft: '0.5rem' }}>
                    {label}
                  </span>
                </div>
              </div>

              {/* Count display or load button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {state.loading ? (
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted, #888)' }}>Counting…</span>
                ) : state.error ? (
                  <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>Error</span>
                ) : hasCount ? (
                  <div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {state.count.toLocaleString()}
                    </span>
                    {pct && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', marginLeft: '0.5rem' }}>
                        ({pct})
                      </span>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted, #888)' }}>—</span>
                )}

                <button
                  className="btn-small"
                  onClick={() => loadKindCount(kind)}
                  disabled={state.loading}
                  title={hasCount ? 'Refresh count' : 'Load count'}
                  style={{ minWidth: '5.5rem' }}
                >
                  {state.loading ? '…' : hasCount ? '🔄 Refresh' : '📊 Count'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
