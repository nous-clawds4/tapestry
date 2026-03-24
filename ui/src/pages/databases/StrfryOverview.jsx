import { useState, useEffect, useMemo } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs';
import { queryRelay } from '../../api/relay';
import useProfiles from '../../hooks/useProfiles';
import { OWNER_PUBKEY, TA_PUBKEY, DAVE_PUBKEY } from '../../config/pubkeys';

function shortPubkey(pk) {
  if (!pk) return '—';
  return pk.slice(0, 8) + '…';
}

export default function StrfryOverview() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchEvents() {
      try {
        setLoading(true);
        // Fetch all events (no kind filter)
        const evts = await queryRelay({});
        if (!cancelled) setEvents(evts);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchEvents();
    return () => { cancelled = true; };
  }, []);

  // Aggregate stats
  const byKind = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      map.set(ev.kind, (map.get(ev.kind) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([kind, count]) => ({ kind, count }));
  }, [events]);

  const byAuthor = useMemo(() => {
    const map = new Map();
    for (const ev of events) {
      if (ev.pubkey) {
        map.set(ev.pubkey, (map.get(ev.pubkey) || 0) + 1);
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([pubkey, count]) => ({ pubkey, count }));
  }, [events]);

  const authorPubkeys = useMemo(() => byAuthor.map(a => a.pubkey), [byAuthor]);
  const profiles = useProfiles(authorPubkeys);

  function authorDisplayName(pk) {
    const p = profiles?.[pk];
    const name = p?.name || p?.display_name;
    const short = shortPubkey(pk);
    if (pk === OWNER_PUBKEY) return name ? `👑 ${name}` : `👑 Owner (${short})`;
    if (pk === DAVE_PUBKEY) return name ? `🧑‍💻 ${name}` : `🧑‍💻 Dave (${short})`;
    if (pk === TA_PUBKEY) return name ? `🤖 ${name}` : `🤖 Assistant (${short})`;
    return name ? `${name} (${short})` : short;
  }

  // Age range
  const ageRange = useMemo(() => {
    if (events.length === 0) return null;
    let oldest = Infinity, newest = 0;
    for (const ev of events) {
      if (ev.created_at < oldest) oldest = ev.created_at;
      if (ev.created_at > newest) newest = ev.created_at;
    }
    return {
      oldest: new Date(oldest * 1000).toLocaleDateString(),
      newest: new Date(newest * 1000).toLocaleDateString(),
    };
  }, [events]);

  if (loading) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>📡 Strfry</h1>
        <p>Loading events from strfry relay…</p>
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
        <a
          href="http://localhost:8080/relay"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.5rem 1rem',
            borderRadius: '6px',
            backgroundColor: 'var(--accent, #6366f1)',
            color: '#fff',
            textDecoration: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            marginTop: '0.5rem',
          }}
        >
          🔗 Open Strfry Relay
        </a>
      </div>

      {/* Summary cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <SummaryCard label="Total Events" value={events.length.toLocaleString()} icon="📨" />
        <SummaryCard label="Event Kinds" value={byKind.length} icon="📦" />
        <SummaryCard label="Unique Authors" value={byAuthor.length} icon="👤" />
        {ageRange && (
          <SummaryCard label="Date Range" value={`${ageRange.oldest} – ${ageRange.newest}`} icon="📅" />
        )}
      </div>

      {/* Events by Kind */}
      <Section title="Events by Kind">
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Kind</th>
              <th style={{ textAlign: 'right' }}>Count</th>
              <th style={{ textAlign: 'right' }}>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {byKind.map(row => (
              <tr key={row.kind}>
                <td><code style={{ fontSize: '0.85rem' }}>{row.kind}</code></td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.count.toLocaleString()}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {events.length > 0 ? `${((row.count / events.length) * 100).toFixed(1)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Events by Author */}
      <Section title="Events by Author">
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Author</th>
              <th style={{ textAlign: 'right' }}>Events</th>
              <th style={{ textAlign: 'right' }}>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {byAuthor.map(row => (
              <tr key={row.pubkey}>
                <td>{authorDisplayName(row.pubkey)}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.count.toLocaleString()}</td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {events.length > 0 ? `${((row.count / events.length) * 100).toFixed(1)}%` : '—'}
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
