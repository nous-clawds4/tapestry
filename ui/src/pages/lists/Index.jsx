import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import { queryRelay } from '../../api/relay';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';

/**
 * Helper: extract a tag value from an event's tags array.
 * Returns the element at `index` (default 1 = value) of the first tag matching `name`.
 */
function getTag(event, name, index = 1) {
  const tag = event.tags?.find(t => t[0] === name);
  return tag ? tag[index] : null;
}

/**
 * Format a unix timestamp as a relative age string.
 */
function formatAge(ts) {
  if (!ts) return '—';
  const now = Date.now() / 1000;
  const diff = now - ts;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Shorten a hex pubkey for display.
 */
function shortPubkey(pk) {
  if (!pk) return '—';
  return pk.slice(0, 8) + '…';
}

export default function DListsIndex() {
  const navigate = useNavigate();
  const [headers, setHeaders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [neo4jUuids, setNeo4jUuids] = useState(new Set());

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch headers, items, and Neo4j uuids in parallel
        const [hdrs, itms, neo4jRes] = await Promise.all([
          queryRelay({ kinds: [9998, 39998] }),
          queryRelay({ kinds: [9999, 39999] }),
          fetch('/api/neo4j/event-uuids').then(r => r.json()).catch(() => ({ uuids: [] })),
        ]);

        if (!cancelled) {
          setHeaders(hdrs);
          setItems(itms);
          setNeo4jUuids(new Set(neo4jRes.uuids || []));
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Build item count map: parentRef -> count
  const itemCountMap = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      // Items point to their parent via "z" tag (kind 39999) or "e" tag (kind 9999)
      const zRef = getTag(item, 'z');
      const eRef = getTag(item, 'e');
      const ref = zRef || eRef;
      if (ref) {
        map.set(ref, (map.get(ref) || 0) + 1);
      }
    }
    return map;
  }, [items]);

  // Transform headers into table rows
  const rows = useMemo(() => {
    return headers.map(ev => {
      const singular = getTag(ev, 'names', 1) || getTag(ev, 'name', 1) || '(unnamed)';
      const plural = getTag(ev, 'names', 2) || singular;
      const dTag = getTag(ev, 'd');

      // For kind 39998: items reference via "a" tag value = "39998:<pubkey>:<d-tag>"
      // For kind 9998: items reference via "e" tag value = event id
      let parentRef;
      if (ev.kind === 39998) {
        parentRef = `39998:${ev.pubkey}:${dTag}`;
      } else {
        parentRef = ev.id;
      }

      const itemCount = itemCountMap.get(parentRef) || 0;

      // Route ID: use a-tag for 39998, event id for 9998
      const routeId = ev.kind === 39998 ? parentRef : ev.id;

      // Neo4j uuid: replaceable events use a-tag, non-replaceable use event id
      const uuid = ev.kind >= 30000 ? parentRef : ev.id;

      return {
        id: ev.id,
        routeId,
        kind: ev.kind,
        singular,
        plural,
        author: ev.pubkey,
        authorShort: shortPubkey(ev.pubkey),
        created_at: ev.created_at,
        age: formatAge(ev.created_at),
        itemCount,
        inNeo4j: neo4jUuids.has(uuid),
      };
    });
  }, [headers, itemCountMap, neo4jUuids]);

  // Fetch profiles for all unique authors (async, non-blocking)
  const authorPubkeys = useMemo(() => [...new Set(rows.map(r => r.author))], [rows]);
  const profiles = useProfiles(authorPubkeys);

  const columns = [
    { key: 'singular', label: 'Name (singular)' },
    { key: 'plural', label: 'Name (plural)' },
    { key: 'kind', label: 'Kind' },
    {
      key: 'authorShort',
      label: 'Author',
      render: (_val, row) => <AuthorCell pubkey={row.author} profiles={profiles} />,
    },
    {
      key: 'created_at',
      label: 'Age',
      render: (_val, row) => row.age,
    },
    { key: 'itemCount', label: 'Items' },
    {
      key: 'inNeo4j',
      label: 'Neo4j',
      render: (val) => val
        ? <span style={{ color: '#3fb950' }} title="In Neo4j">●</span>
        : <span style={{ color: '#6e7681' }} title="Not in Neo4j">○</span>,
    },
  ];

  if (loading) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>📋 Simple Lists (DLists)</h1>
        <p>Loading from strfry relay…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>📋 Simple Lists (DLists)</h1>
        <p className="error">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <div className="page-header-row">
        <div>
          <h1>📋 Simple Lists (DLists)</h1>
          <p className="subtitle">
            {headers.length} list headers · {items.length} items · from local strfry relay
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/kg/lists/new')}>
          + New DList
        </button>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(row) => navigate(`/kg/lists/${encodeURIComponent(row.routeId)}`)}
        emptyMessage="No DLists found in strfry"
      />
    </div>
  );
}
