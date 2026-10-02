import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import { queryRelay } from '../../api/relay';
import useProfiles from '../../hooks/useProfiles';
import AuthorCell from '../../components/AuthorCell';
import { DAVE_PUBKEY } from '../../config/pubkeys';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { ME, MY_ASSISTANT, viewerAuthorOptions, resolveAuthorFilter, authorRole } from '../../utils/viewerAuthorScope';
import { ListHeaderDispositionHost } from './ListHeaderDispositionPanel';
import { listHeaderDisposition, MARKS, COLUMN_TITLE } from '../../utils/listHeaderDisposition';

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
  const { taPubkey: TA_PUBKEY, ownerPubkey } = useConfig();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [headers, setHeaders] = useState([]);
  const [itemCounts, setItemCounts] = useState({ counts: {}, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [neo4jUuids, setNeo4jUuids] = useState(new Set());

  // Filters
  const [kindFilter, setKindFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');

  // The open Disposition panel, by row routeId (ADR list-headers-disposition/0003).
  const [panelId, setPanelId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Headers, per-list item counts, and Neo4j uuids in parallel.
        // The counts come from the server: this page needs one number per row
        // and a total, not the items themselves — fetching them all is what
        // used to fail once a relay held more than the scan buffer.
        const [hdrs, countsRes, neo4jRes] = await Promise.all([
          queryRelay({ kinds: [9998, 39998] }),
          fetch('/api/dlists/item-counts').then(r => r.json()).catch(() => ({})),
          fetch('/api/neo4j/event-uuids').then(r => r.json()).catch(() => ({ uuids: [] })),
        ]);

        if (!cancelled) {
          setHeaders(hdrs);
          setItemCounts({
            counts: countsRes.counts || {},
            totalItems: countsRes.totalItems || 0,
          });
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

      const itemCount = itemCounts.counts[parentRef] || 0;

      // Route ID: use a-tag for 39998, event id for 9998
      const routeId = ev.kind === 39998 ? parentRef : ev.id;

      // Neo4j uuid: replaceable events use a-tag, non-replaceable use event id
      const uuid = ev.kind >= 30000 ? parentRef : ev.id;

      // 🧭 b-disposition, from the event's own b-tags (ADR list-headers-disposition/0002)
      const disp = listHeaderDisposition(ev);

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
        disposition: disp.state,
        _dispositionMarks: disp.marks,
      };
    });
  }, [headers, itemCounts, neo4jUuids]);

  // Derive filter options from all rows (before filtering)
  const kindOptions = useMemo(() => {
    const kinds = [...new Set(rows.map(r => r.kind))].sort((a, b) => a - b);
    return kinds;
  }, [rows]);

  const authorOptions = useMemo(() => {
    const allPks = [...new Set(rows.map(r => r.author))];
    const pinned = [];
    const pksSet = new Set(allPks);
    if (pksSet.has(ownerPubkey)) pinned.push(ownerPubkey);
    if (pksSet.has(DAVE_PUBKEY)) pinned.push(DAVE_PUBKEY);
    if (pksSet.has(TA_PUBKEY)) pinned.push(TA_PUBKEY);
    const others = allPks.filter(pk => pk !== ownerPubkey && pk !== TA_PUBKEY && pk !== DAVE_PUBKEY);
    return [...pinned, ...others];
  }, [rows]);

  // Fetch profiles for all unique authors (async, non-blocking)
  const authorPubkeys = useMemo(() => [...new Set(rows.map(r => r.author))], [rows]);
  const profiles = useProfiles(authorPubkeys);

  function authorDisplayName(pk) {
    const p = profiles?.[pk];
    const name = p?.name || p?.display_name;
    const short = pk.slice(0, 8) + '…';
    if (pk === ownerPubkey) return name ? `👑 ${name}` : `👑 Owner (${short})`;
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
    // Me / My Local Tapestry Assistant resolve from the signed-in user (ADR list-headers-disposition/0001).
    const authorPk = resolveAuthorFilter(authorFilter, user);
    if (authorPk) {
      result = result.filter(r => r.author === authorPk);
    }
    return result;
  }, [rows, kindFilter, authorFilter, user]);

  // A Me / My Local Tapestry Assistant choice the current user can't resolve (signed out, no
  // Assistant) goes back to All authors, so it can't silently re-apply at the next in-page sign-in
  // (ADR list-headers-disposition/0001, Amendment 1).
  useEffect(() => {
    if ((authorFilter === ME || authorFilter === MY_ASSISTANT) && resolveAuthorFilter(authorFilter, user) === '') {
      setAuthorFilter('');
    }
  }, [authorFilter, user]);

  // Disposition on the signed-in person's own Assistant's rows (ADR list-headers-disposition/0003).
  const isMyAssistantHeader = (row) => row.kind === 39998 && authorRole(row.author, user) === 'my-assistant';
  const addressOf = (ev) => `${ev.kind}:${ev.pubkey}:${getTag(ev, 'd')}`;
  // The signed version replaces the header it re-signs, so the 🧭 cell updates without a reload.
  const onActed = (event) => {
    if (!event) return;
    setHeaders(prev => prev.map(h => (
      addressOf(h) === addressOf(event) && event.created_at > h.created_at ? event : h
    )));
  };
  const nextUndecided = (afterId) => filteredRows.find(r =>
    isMyAssistantHeader(r) && r.disposition === MARKS.undecided.state && r.routeId !== afterId) || null;
  const panelRow = panelId ? rows.find(r => r.routeId === panelId) || null : null;

  const columns = [
    { key: 'singular', label: 'Name (singular)' },
    { key: 'plural', label: 'Name (plural)' },
    {
      // The marks are read-only. Only the person's own Assistant's rows add a Disposition… button,
      // which stops its click so it doesn't also open the list.
      key: 'disposition',
      label: <span title={COLUMN_TITLE} style={{ cursor: 'help' }}>🧭</span>,
      render: (_val, row) => (
        <span style={{ display: 'inline-flex', gap: '0.2rem', alignItems: 'center' }}>
          {row._dispositionMarks.map(m => (
            <span key={m.state} title={m.title} className={m === MARKS.undecided ? 'text-muted' : undefined}>
              {m.glyph}
            </span>
          ))}
          {isMyAssistantHeader(row) && (
            <button
              className="btn" style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}
              onClick={(e) => { e.stopPropagation(); setPanelId(row.routeId); }}
            >
              Disposition…
            </button>
          )}
        </span>
      ),
    },
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
            {headers.length} list headers · {itemCounts.totalItems} items · from local strfry
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/tapestry/lists/new')}>
          + New DList
        </button>
      </div>
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
            {viewerAuthorOptions(user).map(o => (
              <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
            ))}
            {authorOptions.map(pk => (
              <option key={pk} value={pk}>{authorDisplayName(pk)}</option>
            ))}
          </select>
        </div>
      </div>

      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted, #888)', marginBottom: '0.5rem' }}>
        {filteredRows.length === rows.length
          ? `${rows.length} lists`
          : `${filteredRows.length} of ${rows.length} lists`}
      </p>

      {panelRow && (
        <ListHeaderDispositionHost
          row={panelRow}
          onActed={onActed}
          hasNext={!!nextUndecided(panelRow.routeId)}
          onNext={() => {
            const next = nextUndecided(panelRow.routeId);
            setPanelId(next ? next.routeId : null);
          }}
          onClose={() => setPanelId(null)}
        />
      )}

      <DataTable
        columns={columns}
        data={filteredRows}
        onRowClick={(row) => navigate(`/tapestry/lists/${encodeURIComponent(row.routeId)}`)}
        emptyMessage="No DLists match your filters"
      />
    </div>
  );
}
