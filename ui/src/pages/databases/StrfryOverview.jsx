import { useState, useEffect, useMemo } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs';

/**
 * Strfry overview page.
 * Uses the /api/strfry-status endpoint (scan --count) instead of fetching all events,
 * which is not feasible with millions of events in the database.
 */

export default function StrfryOverview() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchStatus() {
      try {
        setLoading(true);
        const resp = await fetch('/api/strfry-status');
        const data = await resp.json();
        if (!cancelled) {
          if (data.success) {
            setStatus(data);
          } else {
            setError(data.error || 'Failed to load strfry status');
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchStatus();
    return () => { cancelled = true; };
  }, []);

  const byKind = useMemo(() => {
    if (!status?.events?.byKind) return [];
    return Object.entries(status.events.byKind)
      .map(([kind, count]) => ({ kind: parseInt(kind), count }))
      .filter(r => r.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [status]);

  const total = status?.events?.total || 0;

  const kindLabels = {
    0: 'Profiles',
    1: 'Notes',
    3: 'Follows',
    7: 'Reactions',
    1984: 'Reports',
    10000: 'Mutes',
    10040: 'Trusted Assertions (10040)',
    30382: 'Trusted Assertions (30382)',
    30818: 'Wiki Articles',
  };

  if (loading) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>📡 Strfry</h1>
        <p>Loading strfry status…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>📡 Strfry</h1>
        <p className="error">Error: {error}</p>
      </div>
    );
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

      {/* Summary cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <SummaryCard label="Total Events" value={total.toLocaleString()} icon="📨" />
        <SummaryCard label="Event Kinds" value={byKind.length} icon="📦" />
        <SummaryCard
          label="Service"
          value={status?.service?.status === 'running' ? '🟢 Running' : '🔴 Stopped'}
          icon="⚙️"
        />
        <SummaryCard
          label="Recent (1h)"
          value={(status?.events?.recent || 0).toLocaleString()}
          icon="🕐"
        />
      </div>

      {/* Events by Kind */}
      <Section title="Events by Kind">
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Kind</th>
              <th>Description</th>
              <th style={{ textAlign: 'right' }}>Count</th>
              <th style={{ textAlign: 'right' }}>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {byKind.map(row => (
              <tr key={row.kind}>
                <td><code style={{ fontSize: '0.85rem' }}>{row.kind}</code></td>
                <td style={{ fontSize: '0.85rem', opacity: 0.7 }}>{kindLabels[row.kind] || ''}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.count.toLocaleString()}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {total > 0 ? `${((row.count / total) * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function SummaryCard({ label, value, icon }) {
  return (
    <div style={{
      padding: '1rem',
      border: '1px solid var(--border, #444)',
      borderRadius: '8px',
      backgroundColor: 'var(--bg-secondary, #1a1a2e)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{icon}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #888)', marginTop: '0.25rem' }}>{label}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{ marginBottom: '0.5rem' }}>{title}</h3>
      {children}
    </div>
  );
}
