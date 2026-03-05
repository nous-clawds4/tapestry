import { useState, useEffect } from 'react';

function useDatabaseStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    Promise.all([
      fetch('/api/neo4j/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cypher: `
          MATCH (n) WITH count(n) AS nodes
          OPTIONAL MATCH ()-[r]->() WITH nodes, count(r) AS rels
          RETURN nodes, rels
        ` }),
      }).then(r => r.json()),
      fetch('/api/strfry-status').then(r => r.json()),
    ])
      .then(([neo4j, strfry]) => {
        setStats({
          neo4j: {
            nodes: neo4j.data?.[0]?.nodes ?? '—',
            relationships: neo4j.data?.[0]?.rels ?? '—',
          },
          strfry: {
            events: strfry.events?.total ?? '—',
          },
        });
      })
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }

  useEffect(() => { refresh(); }, []);

  return { stats, loading, refresh };
}

export default function DatabaseSettings() {
  const { stats, loading: statsLoading, refresh } = useDatabaseStats();
  const [wipingNeo4j, setWipingNeo4j] = useState(false);
  const [wipingStrfry, setWipingStrfry] = useState(false);
  const [confirmNeo4j, setConfirmNeo4j] = useState(false);
  const [confirmStrfry, setConfirmStrfry] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  function flash(msg) {
    setMessage(msg);
    setTimeout(() => setMessage(null), 5000);
  }

  async function handleWipeNeo4j() {
    if (!confirmNeo4j) {
      setConfirmNeo4j(true);
      return;
    }
    setWipingNeo4j(true);
    setError(null);
    try {
      // Delete all nodes and relationships
      const res = await fetch('/api/neo4j/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cypher: 'MATCH (n) DETACH DELETE n' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to wipe Neo4j');
      flash('Neo4j database wiped successfully.');
      setConfirmNeo4j(false);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setWipingNeo4j(false);
    }
  }

  async function handleWipeStrfry() {
    if (!confirmStrfry) {
      setConfirmStrfry(true);
      return;
    }
    setWipingStrfry(true);
    setError(null);
    try {
      // Use strfry delete via API — delete all events matching empty filter
      const res = await fetch('/api/strfry/wipe', { method: 'POST' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to wipe strfry');
      flash(`Strfry database wiped. ${data.deleted ?? ''} events removed.`);
      setConfirmStrfry(false);
      refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setWipingStrfry(false);
    }
  }

  return (
    <div className="settings-section">
      <h2>🗄️ Database Management</h2>
      <p className="settings-hint">
        View database statistics and manage data. Wipe operations are irreversible.
      </p>

      {message && (
        <div style={{
          padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '6px',
          backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#22c55e', fontSize: '0.85rem',
        }}>
          ✅ {message}
        </div>
      )}
      {error && (
        <div style={{
          padding: '0.5rem 0.75rem', marginBottom: '0.75rem', borderRadius: '6px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444', fontSize: '0.85rem',
        }}>
          ❌ {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>dismiss</button>
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem',
      }}>
        {/* Neo4j stats */}
        <div className="settings-group" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>🔵 Neo4j</h3>
            <button className="btn-small" onClick={refresh} disabled={statsLoading}>
              {statsLoading ? '…' : '🔄'}
            </button>
          </div>
          {statsLoading ? (
            <p className="text-muted">Loading…</p>
          ) : stats?.neo4j ? (
            <div style={{ display: 'flex', gap: '2rem' }}>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {typeof stats.neo4j.nodes === 'number' ? stats.neo4j.nodes.toLocaleString() : stats.neo4j.nodes}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>nodes</div>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                  {typeof stats.neo4j.relationships === 'number' ? stats.neo4j.relationships.toLocaleString() : stats.neo4j.relationships}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>relationships</div>
              </div>
            </div>
          ) : (
            <p className="text-muted">Unable to load stats</p>
          )}
        </div>

        {/* Strfry stats */}
        <div className="settings-group" style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>📡 Strfry</h3>
            <button className="btn-small" onClick={refresh} disabled={statsLoading}>
              {statsLoading ? '…' : '🔄'}
            </button>
          </div>
          {statsLoading ? (
            <p className="text-muted">Loading…</p>
          ) : stats?.strfry ? (
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                {typeof stats.strfry.events === 'number' ? stats.strfry.events.toLocaleString() : stats.strfry.events}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>events</div>
            </div>
          ) : (
            <p className="text-muted">Unable to load stats</p>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div style={{
        border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px',
        padding: '1rem',
      }}>
        <h3 style={{ margin: '0 0 0.5rem', color: '#ef4444', fontSize: '0.95rem' }}>⚠️ Danger Zone</h3>
        <p className="settings-hint" style={{ marginBottom: '1rem' }}>
          These actions are <strong>irreversible</strong>. All data will be permanently deleted.
        </p>

        {/* Wipe Neo4j */}
        <div className="settings-group" style={{ padding: '0.75rem 1rem', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <strong>Wipe Neo4j</strong>
              <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: '0.2rem 0 0' }}>
                Delete all nodes and relationships from the graph database.
                Strfry events are preserved — you can re-import from strfry afterward.
              </p>
            </div>
            {!confirmNeo4j ? (
              <button
                className="btn-small"
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', whiteSpace: 'nowrap' }}
                onClick={handleWipeNeo4j}
                disabled={wipingNeo4j}
              >
                🗑️ Wipe Neo4j
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>Are you sure?</span>
                <button
                  className="btn-small"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderColor: '#ef4444', whiteSpace: 'nowrap' }}
                  onClick={handleWipeNeo4j}
                  disabled={wipingNeo4j}
                >
                  {wipingNeo4j ? 'Wiping…' : '⚠️ Yes, wipe it'}
                </button>
                <button className="btn-small" onClick={() => setConfirmNeo4j(false)} disabled={wipingNeo4j}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Wipe Strfry */}
        <div className="settings-group" style={{ padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <strong>Wipe Strfry</strong>
              <p style={{ fontSize: '0.8rem', opacity: 0.7, margin: '0.2rem 0 0' }}>
                Delete all events from the local nostr relay.
                This also removes all data needed for Neo4j import. Use with extreme caution.
              </p>
            </div>
            {!confirmStrfry ? (
              <button
                className="btn-small"
                style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)', whiteSpace: 'nowrap' }}
                onClick={handleWipeStrfry}
                disabled={wipingStrfry}
              >
                🗑️ Wipe Strfry
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>Are you sure?</span>
                <button
                  className="btn-small"
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderColor: '#ef4444', whiteSpace: 'nowrap' }}
                  onClick={handleWipeStrfry}
                  disabled={wipingStrfry}
                >
                  {wipingStrfry ? 'Wiping…' : '⚠️ Yes, wipe it'}
                </button>
                <button className="btn-small" onClick={() => setConfirmStrfry(false)} disabled={wipingStrfry}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
