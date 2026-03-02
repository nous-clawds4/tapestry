import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';

function getTag(event, name, index = 1) {
  const tag = event.tags?.find(t => t[0] === name);
  return tag ? tag[index] : null;
}

function formatAge(ts) {
  if (!ts) return '—';
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

function Neo4jStatus({ uuid }) {
  const [status, setStatus] = useState(null); // API response
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/neo4j/event-check?uuid=${encodeURIComponent(uuid)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setStatus(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [uuid]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  async function handleImportOrUpdate() {
    try {
      setActing(true);
      setError(null);
      const res = await fetch('/api/neo4j/event-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      // Refresh status
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div className="neo4j-status">
        <span className="neo4j-badge neo4j-checking">Checking Neo4j…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="neo4j-status">
        <span className="neo4j-badge neo4j-error">⚠️ {error}</span>
        <button className="btn-small" onClick={fetchStatus}>Retry</button>
      </div>
    );
  }

  if (!status) return null;

  switch (status.status) {
    case 'in_sync':
      return (
        <div className="neo4j-status">
          <span className="neo4j-badge neo4j-synced">✅ In Neo4j</span>
          <span className="neo4j-detail">Synced — id matches strfry</span>
        </div>
      );

    case 'missing_from_neo4j':
      return (
        <div className="neo4j-status">
          <span className="neo4j-badge neo4j-missing">⬜ Not in Neo4j</span>
          <button
            className="btn-small btn-import"
            onClick={handleImportOrUpdate}
            disabled={acting}
          >
            {acting ? 'Importing…' : '📥 Import to Neo4j'}
          </button>
        </div>
      );

    case 'neo4j_outdated':
      return (
        <div className="neo4j-status">
          <span className="neo4j-badge neo4j-outdated">🔶 Outdated in Neo4j</span>
          <span className="neo4j-detail">
            Neo4j: {formatDate(status.neo4j?.created_at)} · Strfry: {formatDate(status.strfry?.created_at)}
          </span>
          <button
            className="btn-small btn-update"
            onClick={handleImportOrUpdate}
            disabled={acting}
          >
            {acting ? 'Updating…' : '🔄 Update in Neo4j'}
          </button>
        </div>
      );

    case 'missing_from_strfry':
      return (
        <div className="neo4j-status">
          <span className="neo4j-badge neo4j-warning">⚠️ In Neo4j but not in strfry</span>
          <span className="neo4j-detail">Orphaned node</span>
        </div>
      );

    case 'neo4j_newer_or_conflict':
      return (
        <div className="neo4j-status">
          <span className="neo4j-badge neo4j-warning">⚠️ Conflict</span>
          <span className="neo4j-detail">
            Neo4j has a different version (same or newer timestamp)
          </span>
        </div>
      );

    default:
      return (
        <div className="neo4j-status">
          <span className="neo4j-badge neo4j-error">Unknown status: {status.status}</span>
        </div>
      );
  }
}

export default function DListOverview() {
  const { event } = useOutletContext();
  const authorPubkeys = useMemo(() => event?.pubkey ? [event.pubkey] : [], [event?.pubkey]);
  const profiles = useProfiles(authorPubkeys);

  const singular = getTag(event, 'names', 1) || getTag(event, 'name', 1) || '(unnamed)';
  const plural = getTag(event, 'names', 2) || singular;
  const description = getTag(event, 'description') || event.content || '(none)';
  const dTag = getTag(event, 'd');

  // Build uuid for Neo4j check
  const uuid = event.kind === 39998
    ? `${event.kind}:${event.pubkey}:${dTag}`
    : event.id;

  const aTag = event.kind === 39998 ? uuid : null;

  return (
    <div className="dlist-overview">
      <h2>Overview</h2>

      <Neo4jStatus uuid={uuid} />

      <table className="detail-table">
        <tbody>
          <tr>
            <th>Name (singular)</th>
            <td>{singular}</td>
          </tr>
          <tr>
            <th>Name (plural)</th>
            <td>{plural}</td>
          </tr>
          <tr>
            <th>Description</th>
            <td>{description}</td>
          </tr>
          <tr>
            <th>Author</th>
            <td><AuthorCell pubkey={event.pubkey} profiles={profiles} /></td>
          </tr>
          <tr>
            <th>Event Kind</th>
            <td>{event.kind}</td>
          </tr>
          <tr>
            <th>Event ID</th>
            <td><code style={{ fontSize: '0.85em', wordBreak: 'break-all' }}>{event.id}</code></td>
          </tr>
          {aTag && (
            <tr>
              <th>a-tag</th>
              <td><code style={{ fontSize: '0.85em', wordBreak: 'break-all' }}>{aTag}</code></td>
            </tr>
          )}
          {dTag && (
            <tr>
              <th>d-tag</th>
              <td><code>{dTag}</code></td>
            </tr>
          )}
          <tr>
            <th>Created</th>
            <td>{formatDate(event.created_at)} ({formatAge(event.created_at)})</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
