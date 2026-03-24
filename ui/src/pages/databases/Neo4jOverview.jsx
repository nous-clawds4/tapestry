import { useState, useEffect, useMemo } from 'react';
import Breadcrumbs from '../../components/Breadcrumbs';
import useProfiles from '../../hooks/useProfiles';
import { OWNER_PUBKEY, TA_PUBKEY, DAVE_PUBKEY } from '../../config/pubkeys';

function shortPubkey(pk) {
  if (!pk) return '—';
  return pk.slice(0, 8) + '…';
}

export default function Neo4jOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      try {
        setLoading(true);
        const res = await fetch('/api/audit/stats');
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Failed to fetch stats');
        if (!cancelled) setStats(data.data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchStats();
    return () => { cancelled = true; };
  }, []);

  // Collect signer pubkeys for profile resolution
  const signerPubkeys = useMemo(() => {
    if (!stats?.signers) return [];
    return stats.signers.map(s => s.signer).filter(Boolean);
  }, [stats]);
  const profiles = useProfiles(signerPubkeys);

  function authorDisplayName(pk) {
    const p = profiles?.[pk];
    const name = p?.name || p?.display_name;
    const short = shortPubkey(pk);
    if (pk === OWNER_PUBKEY) return name ? `👑 ${name}` : `👑 Owner (${short})`;
    if (pk === DAVE_PUBKEY) return name ? `🧑‍💻 ${name}` : `🧑‍💻 Dave (${short})`;
    if (pk === TA_PUBKEY) return name ? `🤖 ${name}` : `🤖 Assistant (${short})`;
    return name ? `${name} (${short})` : short;
  }

  if (loading) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>🗄️ Neo4j</h1>
        <p>Loading Neo4j statistics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>🗄️ Neo4j</h1>
        <p className="error">Error: {error}</p>
      </div>
    );
  }

  const { totals, byLabel, byRelType, concepts, signers, jsonCoverage } = stats;

  return (
    <div className="page">
      <Breadcrumbs />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>🗄️ Neo4j</h1>
          <p className="subtitle">Overview of data stored in the Neo4j knowledge graph.</p>
        </div>
        <a
          href="http://localhost:8080/browser/preview/"
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
          🔗 Open Neo4j Browser
        </a>
      </div>

      {/* Summary cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        <SummaryCard label="Total Nodes" value={totals.nodes.toLocaleString()} icon="🔵" />
        <SummaryCard label="Total Relationships" value={totals.relationships.toLocaleString()} icon="🔗" />
        <SummaryCard label="Concepts" value={concepts?.length || 0} icon="🧩" />
        <SummaryCard label="Signers" value={signers?.length || 0} icon="👤" />
      </div>

      {/* Nodes by Label */}
      <Section title="Nodes by Label">
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Labels</th>
              <th style={{ textAlign: 'right' }}>Count</th>
            </tr>
          </thead>
          <tbody>
            {byLabel.map((row, i) => (
              <tr key={i}>
                <td>
                  {row.labels.map(l => (
                    <span key={l} style={{
                      display: 'inline-block', fontSize: '0.75rem', padding: '0.1rem 0.4rem',
                      marginRight: '0.25rem', borderRadius: '4px',
                      backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', fontWeight: 500,
                    }}>{l}</span>
                  ))}
                </td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Relationships by Type */}
      <Section title="Relationships by Type">
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Count</th>
            </tr>
          </thead>
          <tbody>
            {byRelType.map((row, i) => (
              <tr key={i}>
                <td><code style={{ fontSize: '0.8rem' }}>{row.relType}</code></td>
                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(row.count ?? 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Signers */}
      {signers && signers.length > 0 && (
        <Section title="Signers">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Author</th>
                <th style={{ textAlign: 'right' }}>Events</th>
              </tr>
            </thead>
            <tbody>
              {signers.map((s, i) => (
                <tr key={i}>
                  <td>{authorDisplayName(s.signer)}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(s.events ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* Concepts */}
      {concepts && concepts.length > 0 && (
        <Section title="Concepts">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Name</th>
                <th style={{ textAlign: 'right' }}>Elements</th>
              </tr>
            </thead>
            <tbody>
              {concepts.map((c, i) => (
                <tr key={i}>
                  <td>{c.name || c.concept || '(unnamed)'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.elements ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* JSON Coverage */}
      {jsonCoverage && jsonCoverage.length > 0 && (
        <Section title="JSON Tag Coverage">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Category</th>
                <th style={{ textAlign: 'right' }}>With JSON</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th style={{ textAlign: 'right' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {jsonCoverage.map((row, i) => (
                <tr key={i}>
                  <td>{row.nodeType || row.label || row.category}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.withJson ?? '—'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{row.total ?? '—'}</td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                    {row.total > 0 ? `${Math.round((row.withJson / row.total) * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
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
