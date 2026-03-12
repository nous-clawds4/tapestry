import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import { queryRelay } from '../../api/relay';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';
import { OWNER_PUBKEY, TA_PUBKEY, DAVE_PUBKEY } from '../../config/pubkeys';

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

  // Filters
  const [kindFilter, setKindFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');

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

  // Derive filter options from all rows
  const kindOptions = useMemo(() => {
    return [...new Set(rows.map(r => r.kind))].sort((a, b) => a - b);
  }, [rows]);

  const authorOptions = useMemo(() => {
    const allPks = [...new Set(rows.map(r => r.author))];
    const pinned = [];
    const pksSet = new Set(allPks);
    if (pksSet.has(OWNER_PUBKEY)) pinned.push(OWNER_PUBKEY);
    if (pksSet.has(DAVE_PUBKEY)) pinned.push(DAVE_PUBKEY);
    if (pksSet.has(TA_PUBKEY)) pinned.push(TA_PUBKEY);
    const others = allPks.filter(pk => pk !== OWNER_PUBKEY && pk !== TA_PUBKEY && pk !== DAVE_PUBKEY);
    return [...pinned, ...others];
  }, [rows]);

  const authorPubkeys = useMemo(
    () => [...new Set(rows.map(r => r.author).filter(Boolean))],
    [rows]
  );
  const profiles = useProfiles(authorPubkeys);

  function authorDisplayName(pk) {
    const p = profiles?.[pk];
    const name = p?.name || p?.display_name;
    const short = pk.slice(0, 8) + '…';
    if (pk === OWNER_PUBKEY) return name ? `👑 ${name}` : `👑 Owner (${short})`;
    if (pk === DAVE_PUBKEY) return name ? `🧑‍💻 ${name}` : `🧑‍💻 Dave (${short})`;
    if (pk === TA_PUBKEY) return name ? `🤖 ${name}` : `🤖 Assistant (${short})`;
    return name ? `${name} (${short})` : short;
  }

  // Apply filters
  const filteredRows = useMemo(() => {
    let result = rows;
    if (kindFilter !== '') {
      const k = Number(kindFilter);
      result = result.filter(r => r.kind === k);
    }
    if (authorFilter) {
      result = result.filter(r => r.author === authorFilter);
    }
    return result;
  }, [rows, kindFilter, authorFilter]);

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
        <Breadcrumbs />
        <h1>📋 DList Items</h1>
        <p>Loading from strfry relay…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>📋 DList Items</h1>
        <p className="error">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>📋 DList Items</h1>
      <p className="subtitle">{items.length} items (kind 9999 &amp; 39999) from local strfry</p>

      {/* Filters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '0.75rem',
        marginBottom: '1rem',
        padding: '1rem',
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
      }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            📦 Kind
          </label>
          <select
            value={kindFilter}
            onChange={e => setKindFilter(e.target.value)}
            style={{
              width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
              border: '1px solid var(--border, #444)', borderRadius: '4px', cursor: 'pointer',
            }}
          >
            <option value="">All kinds</option>
            {kindOptions.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            👤 Author
          </label>
          <select
            value={authorFilter}
            onChange={e => setAuthorFilter(e.target.value)}
            style={{
              width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
              border: '1px solid var(--border, #444)', borderRadius: '4px', cursor: 'pointer',
            }}
          >
            <option value="">All authors</option>
            {authorOptions.map(pk => (
              <option key={pk} value={pk}>{authorDisplayName(pk)}</option>
            ))}
          </select>
        </div>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginBottom: '0.5rem' }}>
        {filteredRows.length === rows.length
          ? `${rows.length} items`
          : `${filteredRows.length} of ${rows.length} items`}
      </p>

      <DataTable
        columns={columns}
        data={filteredRows}
        onRowClick={(row) => navigate(`/kg/lists/items/${encodeURIComponent(row.routeId)}`)}
        emptyMessage="No DList items match your filters"
      />
    </div>
  );
}
