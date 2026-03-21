import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCypher } from '../../hooks/useCypher';
import useProfiles from '../../hooks/useProfiles';
import useNeo4jLabels from '../../hooks/useNeo4jLabels';
import AuthorCell from '../../components/AuthorCell';
import Breadcrumbs from '../../components/Breadcrumbs';

import { OWNER_PUBKEY, TA_PUBKEY, DAVE_PUBKEY } from '../../config/pubkeys';

const PAGE_SIZE = 50;

function formatAge(createdAt) {
  if (!createdAt) return '—';
  const now = Math.floor(Date.now() / 1000);
  const diff = now - createdAt;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

export default function NodesIndex() {
  const navigate = useNavigate();

  // Filters
  const [nameFilter, setNameFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [uuidFilter, setUuidFilter] = useState('');

  const { labels: nodeLabels } = useNeo4jLabels();

  // Fetch distinct authors for dropdown
  const { data: authorRows } = useCypher(`
    MATCH (n:NostrEvent)
    WHERE n.pubkey IS NOT NULL
    WITH DISTINCT n.pubkey AS pk
    RETURN pk ORDER BY pk
  `);
  const authorOptions = useMemo(() => {
    if (!authorRows) return [];
    const allPks = new Set(authorRows.map(r => r.pk));
    const pinned = [];
    if (allPks.has(OWNER_PUBKEY)) pinned.push(OWNER_PUBKEY);
    if (allPks.has(DAVE_PUBKEY)) pinned.push(DAVE_PUBKEY);
    if (allPks.has(TA_PUBKEY)) pinned.push(TA_PUBKEY);
    const others = authorRows.map(r => r.pk).filter(pk => pk !== OWNER_PUBKEY && pk !== TA_PUBKEY && pk !== DAVE_PUBKEY);
    return [...pinned, ...others];
  }, [authorRows]);
  const authorDropdownProfiles = useProfiles(authorOptions);

  function authorDisplayName(pk) {
    const p = authorDropdownProfiles?.[pk];
    const name = p?.name || p?.display_name;
    const short = pk.slice(0, 8) + '…';
    if (pk === OWNER_PUBKEY) return name ? `👑 ${name}` : `👑 Owner (${short})`;
    if (pk === DAVE_PUBKEY) return name ? `🧑‍💻 ${name}` : `🧑‍💻 Dave (${short})`;
    if (pk === TA_PUBKEY) return name ? `🤖 ${name}` : `🤖 Assistant (${short})`;
    return name ? `${name} (${short})` : short;
  }

  // Sorting
  const [sortCol, setSortCol] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  // Pagination
  const [page, setPage] = useState(0);

  // Reset page when filters change
  function updateFilter(setter) {
    return (val) => { setter(val); setPage(0); };
  }

  // Build cypher
  const cypher = useMemo(() => {
    const conditions = [];
    if (labelFilter) conditions.push(`n:${labelFilter}`);
    if (nameFilter.trim()) {
      const escaped = nameFilter.trim().replace(/'/g, "\\'");
      conditions.push(`toLower(n.name) CONTAINS toLower('${escaped}')`);
    }
    if (authorFilter) {
      const escaped = authorFilter.replace(/'/g, "\\'");
      conditions.push(`n.pubkey = '${escaped}'`);
    }
    if (uuidFilter.trim()) {
      const escaped = uuidFilter.trim().replace(/'/g, "\\'");
      conditions.push(`(n.uuid CONTAINS '${escaped}')`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return `
      MATCH (n:NostrEvent)
      ${where}
      WITH n, labels(n) AS lbls
      WHERE NONE(l IN lbls WHERE l = 'NostrEventTag')
      RETURN n.uuid AS uuid, n.name AS name, n.pubkey AS author, n.created_at AS createdAt, lbls
      ORDER BY n.name
      LIMIT 1000
    `;
  }, [nameFilter, labelFilter, authorFilter, uuidFilter]);

  const { data: rawNodes, loading, error } = useCypher(cypher);

  // Collect author pubkeys
  const authorPubkeys = useMemo(() => {
    if (!rawNodes) return [];
    const set = new Set();
    for (const row of rawNodes) {
      if (row.author) set.add(row.author);
    }
    return [...set];
  }, [rawNodes]);
  const profiles = useProfiles(authorPubkeys);

  // Sort
  const sortedNodes = useMemo(() => {
    if (!rawNodes) return [];
    const arr = [...rawNodes];
    arr.sort((a, b) => {
      let av, bv;
      switch (sortCol) {
        case 'name':
          av = (a.name || '').toLowerCase();
          bv = (b.name || '').toLowerCase();
          break;
        case 'labels':
          av = formatLabels(a.lbls);
          bv = formatLabels(b.lbls);
          break;
        case 'author': {
          const pa = profiles?.[a.author];
          const pb = profiles?.[b.author];
          av = (pa?.display_name || pa?.name || a.author || '').toLowerCase();
          bv = (pb?.display_name || pb?.name || b.author || '').toLowerCase();
          break;
        }
        case 'age':
          av = a.createdAt || 0;
          bv = b.createdAt || 0;
          // Newer first when "asc" for age means most recent
          return sortDir === 'asc' ? bv - av : av - bv;
        case 'uuid':
          av = a.uuid || '';
          bv = b.uuid || '';
          break;
        default:
          av = '';
          bv = '';
      }
      if (typeof av === 'string') {
        const cmp = av.localeCompare(bv);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      return 0;
    });
    return arr;
  }, [rawNodes, sortCol, sortDir, profiles]);

  // Paginate
  const totalPages = Math.ceil((sortedNodes?.length || 0) / PAGE_SIZE);
  const pageNodes = useMemo(() => {
    return sortedNodes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [sortedNodes, page]);

  function formatLabels(lbls) {
    if (!lbls) return '';
    return (Array.isArray(lbls) ? lbls : [])
      .filter(l => l !== 'NostrEvent')
      .sort()
      .join(', ');
  }

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(0);
  }

  function SortHeader({ col, children }) {
    const active = sortCol === col;
    const arrow = active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return (
      <th
        onClick={() => handleSort(col)}
        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      >
        {children}{arrow}
      </th>
    );
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>Nodes</h1>
      <p style={{ opacity: 0.7, marginBottom: '1rem' }}>
        All nodes in the knowledge graph.
      </p>

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
            🔍 Name
          </label>
          <input
            type="text"
            value={nameFilter}
            onChange={e => updateFilter(setNameFilter)(e.target.value)}
            placeholder="Search by name…"
            style={{
              width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
              border: '1px solid var(--border, #444)', borderRadius: '4px',
            }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            🏷️ Label
          </label>
          <select
            value={labelFilter}
            onChange={e => updateFilter(setLabelFilter)(e.target.value)}
            style={{
              width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
              border: '1px solid var(--border, #444)', borderRadius: '4px', cursor: 'pointer',
            }}
          >
            <option value="">All labels</option>
            {nodeLabels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            👤 Author
          </label>
          <select
            value={authorFilter}
            onChange={e => updateFilter(setAuthorFilter)(e.target.value)}
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
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', marginBottom: '0.25rem' }}>
            🔑 UUID
          </label>
          <input
            type="text"
            value={uuidFilter}
            onChange={e => updateFilter(setUuidFilter)(e.target.value)}
            placeholder="UUID (partial)…"
            style={{
              width: '100%', padding: '0.4rem 0.6rem', fontSize: '0.85rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)', color: 'var(--text-primary, #e0e0e0)',
              border: '1px solid var(--border, #444)', borderRadius: '4px',
            }}
          />
        </div>
      </div>

      {/* Status + pagination controls */}
      {loading && <div className="loading">Loading nodes…</div>}
      {error && <div className="error">Error: {error.message}</div>}

      {!loading && !error && sortedNodes && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted, #888)',
          }}>
            <span>
              {sortedNodes.length >= 1000
                ? '1000+ results (showing first 1000) — refine your filters'
                : `${sortedNodes.length} nodes found`}
              {sortedNodes.length > PAGE_SIZE && (
                <> · Page {page + 1} of {totalPages}</>
              )}
            </span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  className="btn btn-sm"
                  disabled={page === 0}
                  onClick={() => setPage(0)}
                  title="First page"
                >«</button>
                <button
                  className="btn btn-sm"
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >‹ Prev</button>
                <button
                  className="btn btn-sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >Next ›</button>
                <button
                  className="btn btn-sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(totalPages - 1)}
                  title="Last page"
                >»</button>
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <SortHeader col="name">Name</SortHeader>
                  <SortHeader col="labels">Labels</SortHeader>
                  <SortHeader col="author">Author</SortHeader>
                  <SortHeader col="age">Age</SortHeader>
                  <SortHeader col="uuid">UUID</SortHeader>
                </tr>
              </thead>
              <tbody>
                {pageNodes.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                      No nodes match your filters.
                    </td>
                  </tr>
                )}
                {pageNodes.map(row => (
                  <tr
                    key={row.uuid}
                    onClick={() => navigate(`/kg/databases/neo4j/nodes/${encodeURIComponent(row.uuid)}`)}
                    style={{ cursor: 'pointer' }}
                    className="clickable-row"
                  >
                    <td>
                      <span style={{ fontWeight: 500 }}>
                        {row.name || <em style={{ opacity: 0.5 }}>unnamed</em>}
                      </span>
                    </td>
                    <td>
                      {formatLabels(row.lbls).split(', ').filter(Boolean).map(label => (
                        <span
                          key={label}
                          className="label-badge"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLabelFilter(label);
                            setPage(0);
                          }}
                          title={`Filter by ${label}`}
                          style={{
                            display: 'inline-block',
                            fontSize: '0.72rem',
                            padding: '0.1rem 0.4rem',
                            marginRight: '0.25rem',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(99, 102, 241, 0.15)',
                            color: '#818cf8',
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </td>
                    <td>
                      <AuthorCell pubkey={row.author} profiles={profiles} />
                    </td>
                    <td style={{ fontSize: '0.8rem', opacity: 0.8, whiteSpace: 'nowrap' }}>
                      {formatAge(row.createdAt)}
                    </td>
                    <td>
                      <code style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                        {row.uuid?.length > 40 ? row.uuid.slice(0, 20) + '…' + row.uuid.slice(-12) : row.uuid}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Bottom pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'center', gap: '0.5rem',
              marginTop: '1rem', paddingBottom: '1rem',
            }}>
              <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(0)}>«</button>
              <button className="btn btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ Prev</button>
              <span style={{ fontSize: '0.85rem', padding: '0.3rem 0.5rem', color: 'var(--text-muted, #888)' }}>
                {page + 1} / {totalPages}
              </span>
              <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next ›</button>
              <button className="btn btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
