import { useOutletContext, Link } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import { useMemo, useState, useEffect, useCallback } from 'react';
import { queryRelay } from '../../api/relay';
import { useAuth } from '../../context/AuthContext';

export default function NodeOverview() {
  const { node, uuid } = useOutletContext();

  const { data: tagRows } = useCypher(`
    MATCH (n {uuid: '${uuid}'})-[:HAS_TAG]->(t:NostrEventTag)
    RETURN t.type AS type, t.value AS value
    ORDER BY t.type
  `);

  const tagMap = useMemo(() => {
    const m = {};
    for (const t of (tagRows || [])) {
      if (!m[t.type]) m[t.type] = [];
      m[t.type].push(t.value);
    }
    return m;
  }, [tagRows]);

  // Check if event exists in strfry
  const [strfryStatus, setStrfryStatus] = useState('loading'); // 'loading' | 'found' | 'missing'
  useEffect(() => {
    if (!node.id) { setStrfryStatus('missing'); return; }
    let cancelled = false;
    queryRelay({ ids: [node.id], limit: 1 })
      .then(events => { if (!cancelled) setStrfryStatus(events.length > 0 ? 'found' : 'missing'); })
      .catch(() => { if (!cancelled) setStrfryStatus('missing'); });
    return () => { cancelled = true; };
  }, [node.id]);

  // Find the json tag and its offload status
  const jsonTag = useMemo(() => {
    if (!tagRows) return null;
    const t = tagRows.find(r => r.type === 'json');
    if (!t) return null;
    const isOffloaded = typeof t.value === 'string' && t.value.startsWith('lmdb:');
    return { value: t.value, isOffloaded };
  }, [tagRows]);

  // Get the elementId for the json tag (needed for offload)
  const { data: jsonTagDetail } = useCypher(
    jsonTag && !jsonTag.isOffloaded
      ? `MATCH (n {uuid: '${uuid}'})-[:HAS_TAG]->(t:NostrEventTag {type: 'json'}) RETURN elementId(t) AS tagId LIMIT 1`
      : null
  );

  const { user } = useAuth();
  const isOwner = user?.classification === 'owner';
  const [offloading, setOffloading] = useState(false);
  const [offloadResult, setOffloadResult] = useState(null);

  async function handleOffload() {
    const tagId = jsonTagDetail?.[0]?.tagId;
    if (!tagId) return;
    setOffloading(true);
    try {
      const res = await fetch('/api/tapestry-key/offload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ elementId: tagId }),
      });
      const data = await res.json();
      if (data.success) {
        setOffloadResult(data.data);
      } else {
        alert('Offload failed: ' + data.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setOffloading(false);
    }
  }

  const overviewFields = [
    'name', 'names', 'title', 'titles', 'description', 'slug',
    'alias', 'type', 'd', 'z',
  ];

  return (
    <div>
      <h2>Overview</h2>
      <div className="detail-grid">
        <div className="detail-row">
          <span className="detail-label">UUID</span>
          <code className="detail-value">{node.uuid}</code>
        </div>
        <div className="detail-row">
          <span className="detail-label">Event ID</span>
          <code className="detail-value">{node.id}</code>
        </div>
        <div className="detail-row">
          <span className="detail-label">Nostr Event</span>
          <span className="detail-value">
            {strfryStatus === 'loading' ? (
              <span style={{ opacity: 0.5 }}>Checking…</span>
            ) : strfryStatus === 'found' ? (
              <Link to={`/kg/lists/items/${node.id}`}>
                📜 View Nostr Event
              </Link>
            ) : (
              <span style={{ opacity: 0.5 }}>Not found in strfry</span>
            )}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Author</span>
          <code className="detail-value">{node.pubkey}</code>
        </div>
        <div className="detail-row">
          <span className="detail-label">Kind</span>
          <span className="detail-value">{node.kind}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Created</span>
          <span className="detail-value">
            {node.created_at ? new Date(parseInt(node.created_at) * 1000).toLocaleString() : '—'}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Labels</span>
          <span className="detail-value">
            {(Array.isArray(node.nodeLabels) ? node.nodeLabels : []).map(l => (
              <span key={l} className="label-badge">{l}</span>
            ))}
          </span>
        </div>
        {node.tapestryKey && (
          <div className="detail-row">
            <span className="detail-label">Tapestry Key</span>
            <code className="detail-value" style={{ fontSize: '0.8rem' }}>{node.tapestryKey}</code>
          </div>
        )}
        {jsonTag && (
          <div className="detail-row">
            <span className="detail-label">JSON Storage</span>
            <span className="detail-value">
              {jsonTag.isOffloaded || offloadResult ? (
                <span style={{ color: '#22c55e', fontWeight: 600 }}>
                  ✅ Offloaded to LMDB
                  {(offloadResult?.tapestryKey || (jsonTag.isOffloaded && jsonTag.value?.slice(5))) && (
                    <code style={{ marginLeft: '0.5rem', fontSize: '0.75rem', opacity: 0.7 }}>
                      {offloadResult?.tapestryKey || jsonTag.value?.slice(5)}
                    </code>
                  )}
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: '#f59e0b' }}>📦 Inline in Neo4j ({jsonTag.value?.length?.toLocaleString()} chars)</span>
                  {isOwner && jsonTagDetail?.[0]?.tagId && (
                    <button
                      className="btn"
                      onClick={handleOffload}
                      disabled={offloading}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    >
                      {offloading ? '…' : 'Offload'}
                    </button>
                  )}
                </span>
              )}
            </span>
          </div>
        )}
        {overviewFields.map(field => {
          const values = tagMap[field];
          if (!values || values.length === 0) return null;
          return (
            <div className="detail-row" key={field}>
              <span className="detail-label">{field}</span>
              <span className="detail-value">{values.join(', ')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
