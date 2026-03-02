import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import { queryRelay } from '../../api/relay';
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

function shortPubkey(pk) {
  if (!pk) return '—';
  return pk.slice(0, 8) + '…';
}

export default function DListItemsList() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchItems() {
      try {
        setLoading(true);
        setError(null);
        const events = await queryRelay({ kinds: [9999, 39999] });
        if (!cancelled) setItems(events);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchItems();
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => {
    return items.map(ev => {
      const name = getTag(ev, 'name') || '(unnamed)';
      const parentRef = getTag(ev, 'z') || getTag(ev, 'e') || '—';
      const dTag = getTag(ev, 'd');

      // Route ID: for kind 39999 use a-tag, for kind 9999 use event id
      const routeId = ev.kind === 39999
        ? `${ev.kind}:${ev.pubkey}:${dTag}`
        : ev.id;

      return {
        id: ev.id,
        routeId,
        name,
        kind: ev.kind,
        author: ev.pubkey,
        authorShort: shortPubkey(ev.pubkey),
        parentRef: parentRef.length > 40 ? parentRef.slice(0, 20) + '…' + parentRef.slice(-12) : parentRef,
        parentRefFull: parentRef,
        created_at: ev.created_at,
        age: formatAge(ev.created_at),
      };
    });
  }, [items]);

  const authorPubkeys = useMemo(
    () => [...new Set(rows.map(r => r.author).filter(Boolean))],
    [rows]
  );
  const profiles = useProfiles(authorPubkeys);

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'kind', label: 'Kind' },
    {
      key: 'authorShort',
      label: 'Author',
      render: (_val, row) => <AuthorCell pubkey={row.author} profiles={profiles} />,
    },
    {
      key: 'parentRef',
      label: 'Parent List',
      render: (val, row) => <span title={row.parentRefFull}>{val}</span>,
    },
    {
      key: 'created_at',
      label: 'Age',
      render: (_val, row) => row.age,
    },
  ];

  if (loading) {
    return (
      <div className="page">
        <h1>📋 DList Items</h1>
        <p>Loading from strfry relay…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <h1>📋 DList Items</h1>
        <p className="error">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>📋 DList Items</h1>
      <p className="subtitle">{items.length} items (kind 9999 &amp; 39999) from local strfry relay</p>
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(row) => navigate(`/kg/events/dlist-items/${encodeURIComponent(row.routeId)}`)}
        emptyMessage="No DList items found in strfry"
      />
    </div>
  );
}
