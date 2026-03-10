import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';
import { normalizeSkeleton, normalizeJson } from '../../api/normalize';
import { queryRelay } from '../../api/relay';

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

function Neo4jStatus({ uuid, event }) {
  const [status, setStatus] = useState(null); // API response
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null); // null | 'import' | 'expand' | 'full'
  const [error, setError] = useState(null);
  const [itemCount, setItemCount] = useState(null); // number of DList items available

  // Fetch item count
  useEffect(() => {
    if (!event) return;
    async function fetchItemCount() {
      try {
        const parentRef = event.kind === 39998
          ? `${event.kind}:${event.pubkey}:${getTag(event, 'd')}`
          : event.id;
        let items;
        if (event.kind === 39998) {
          items = await queryRelay({ kinds: [9999, 39999], '#z': [parentRef] });
        } else {
          items = await queryRelay({ kinds: [9999, 39999], '#e': [event.id] });
        }
        setItemCount(items.length);
      } catch {
        setItemCount(0);
      }
    }
    fetchItemCount();
  }, [event]);

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

  const conceptName = event
    ? (getTag(event, 'names', 1) || getTag(event, 'name', 1) || null)
    : null;

  // Import just the header node
  async function handleImport() {
    try {
      setActing('import');
      setError(null);
      const res = await fetch('/api/neo4j/event-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(null);
    }
  }

  // Import header + fix JSON + create all core nodes
  async function handleExpand() {
    try {
      setActing('expand');
      setError(null);
      // Step 1: Import header to Neo4j
      const res = await fetch('/api/neo4j/event-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      // Step 2: Fix JSON on the Concept Header
      await normalizeJson({ concept: conceptName, node: 'header' });
      // Step 3: Create all missing core nodes (skeleton)
      await normalizeSkeleton({ concept: conceptName });
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(null);
    }
  }

  // Import header + expand + import all items as elements
  async function handleFullImport() {
    try {
      setActing('full');
      setError(null);
      // Step 1: Import header
      const res = await fetch('/api/neo4j/event-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      // Step 2: Fix JSON on the Concept Header
      await normalizeJson({ concept: conceptName, node: 'header' });
      // Step 3: Create all missing core nodes
      await normalizeSkeleton({ concept: conceptName });
      // Step 4: Import each item to Neo4j and wire as element
      const parentRef = event.kind === 39998
        ? `${event.kind}:${event.pubkey}:${getTag(event, 'd')}`
        : event.id;
      let items;
      if (event.kind === 39998) {
        items = await queryRelay({ kinds: [9999, 39999], '#z': [parentRef] });
      } else {
        items = await queryRelay({ kinds: [9999, 39999], '#e': [event.id] });
      }
      for (const item of items) {
        const itemDTag = item.tags?.find(t => t[0] === 'd')?.[1];
        const itemUuid = item.kind === 39999
          ? `${item.kind}:${item.pubkey}:${itemDTag}`
          : item.id;
        // Import item event to Neo4j
        const itemRes = await fetch('/api/neo4j/event-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uuid: itemUuid }),
        });
        const itemData = await itemRes.json();
        if (!itemData.success) {
          console.warn(`Failed to import item ${itemUuid}: ${itemData.error}`);
        }
      }
      // Step 5: Run normalize skeleton again to pick up wiring
      // (items are wired via z-tag → superset during import)
      // Actually, we need to explicitly wire them. Use add-node-as-element for each.
      // Find the concept's superset UUID from Neo4j
      const auditRes = await fetch(`/api/audit/concept?concept=${encodeURIComponent(conceptName)}`);
      const auditData = await auditRes.json();
      const supersetUuid = auditData?.skeleton?.nodes?.find(n => n.role === 'Superset')?.uuid;
      if (supersetUuid) {
        for (const item of items) {
          const itemDTag = item.tags?.find(t => t[0] === 'd')?.[1];
          const itemUuid = item.kind === 39999
            ? `${item.kind}:${item.pubkey}:${itemDTag}`
            : item.id;
          try {
            const wireRes = await fetch('/api/normalize/add-node-as-element', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ conceptUuid: uuid, nodeUuid: itemUuid }),
            });
            const wireData = await wireRes.json();
            if (!wireData.success && !wireData.error?.includes('already')) {
              console.warn(`Failed to wire item ${itemUuid}: ${wireData.error}`);
            }
          } catch (wireErr) {
            console.warn(`Failed to wire item ${itemUuid}: ${wireErr.message}`);
          }
        }
      }
      await fetchStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(null);
    }
  }

  // Legacy handler for update/re-import cases
  async function handleImportOrUpdate() {
    await handleImport();
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
        <div className="neo4j-status" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem' }}>
          <span className="neo4j-badge neo4j-missing">⬜ Not in Neo4j</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
            <button
              className="btn-small btn-import"
              onClick={handleImport}
              disabled={acting !== null}
              style={{ textAlign: 'left' }}
            >
              {acting === 'import' ? '⏳ Importing…' : '📥 Import to Neo4j (header only)'}
            </button>
            {conceptName && (
              <button
                className="btn-small btn-import"
                onClick={handleExpand}
                disabled={acting !== null}
                style={{ textAlign: 'left' }}
              >
                {acting === 'expand' ? '⏳ Expanding…' : '📥 Import + expand into full Concept'}
              </button>
            )}
            {conceptName && itemCount > 0 && (
              <button
                className="btn-small btn-import"
                onClick={handleFullImport}
                disabled={acting !== null}
                style={{ textAlign: 'left' }}
              >
                {acting === 'full' ? `⏳ Importing ${itemCount} items…` : `📥 Import + expand + import ${itemCount} item${itemCount !== 1 ? 's' : ''} as elements`}
              </button>
            )}
          </div>
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
            disabled={acting !== null}
          >
            {acting !== null ? 'Updating…' : '🔄 Update in Neo4j'}
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

      <Neo4jStatus uuid={uuid} event={event} />

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
