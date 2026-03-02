import { useOutletContext, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
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

export default function DListItems() {
  const { event } = useOutletContext();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Compute the parent reference that items use in their z-tag
  const parentRef = useMemo(() => {
    if (event.kind === 39998) {
      const dTag = getTag(event, 'd');
      return `${event.kind}:${event.pubkey}:${dTag}`;
    }
    // kind 9998: items reference via e-tag = event id
    return event.id;
  }, [event]);

  useEffect(() => {
    let cancelled = false;

    async function fetchItems() {
      try {
        setLoading(true);
        setError(null);

        // For kind 39998 headers, items use z-tag pointing to the a-tag
        // For kind 9998 headers, items use e-tag pointing to event id
        let allItems;
        if (event.kind === 39998) {
          // Query for items with z-tag matching the a-tag
          allItems = await queryRelay({ kinds: [9999, 39999], '#z': [parentRef] });
        } else {
          // Query for items with e-tag matching the event id
          allItems = await queryRelay({ kinds: [9999, 39999], '#e': [event.id] });
        }

        if (!cancelled) setItems(allItems);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchItems();
    return () => { cancelled = true; };
  }, [event, parentRef]);

  const rows = useMemo(() => {
    return items.map(item => {
      const dTag = getTag(item, 'd');
      const routeId = item.kind === 39999
        ? `${item.kind}:${item.pubkey}:${dTag}`
        : item.id;

      return {
        id: item.id,
        routeId,
        name: getTag(item, 'name') || '(unnamed)',
        kind: item.kind,
        author: item.pubkey,
        authorShort: shortPubkey(item.pubkey),
        created_at: item.created_at,
        age: formatAge(item.created_at),
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
      key: 'created_at',
      label: 'Age',
      render: (_val, row) => row.age,
    },
  ];

  if (loading) return <p>Loading items…</p>;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <div className="dlist-items">
      <div className="page-header-row">
        <h2>Items ({items.length})</h2>
        <button className="btn-primary" onClick={() => navigate('new')}>
          + Add Item
        </button>
      </div>
      <DataTable
        columns={columns}
        data={rows}
        onRowClick={(row) => navigate(`/kg/events/dlist-items/${encodeURIComponent(row.routeId)}`)}
        emptyMessage="No items found for this list"
      />
    </div>
  );
}
