import { useState, useMemo, useEffect, Fragment } from 'react';

/**
 * Reusable sortable data table.
 * @param {Object} props
 * @param {Array<{key: string, label: string, render?: Function, sortValue?: Function}>} props.columns
 *   A column may declare an optional `sortValue(row)` accessor: when present, that
 *   column sorts by the returned raw value (numerically), decoupled from what `render`
 *   displays, with missing values (null/undefined) always sorted last in both
 *   directions. Columns without it keep the default string/localeCompare sort.
 * @param {Array<Object>} props.data
 * @param {Function} props.onRowClick - Optional row click handler
 * @param {string} props.emptyMessage
 * @param {number} [props.pageSize] - If set, paginate to this many rows per page.
 * @param {boolean} [props.showFilter=true] - Show the built-in text filter input.
 * @param {string[]} [props.filterKeys=[]] - Extra row fields the text filter matches,
 *   for values that have no column. Use it when a value is deliberately kept out of
 *   the table but must stay findable (ADR shared-concepts-row-detail/0001).
 * @param {Function} [props.renderExpanded] - `(row) => ReactNode`. When supplied, each
 *   row gains a trailing disclosure control and the returned node renders in a panel
 *   row beneath it, closed by default.
 *
 * `pageSize`, `showFilter`, `filterKeys` and `renderExpanded` are additive/optional;
 * callers that omit them get the original behavior (no pagination, filter shown, no
 * disclosure column, no panel row). Sorting always applies to the full (filtered) set
 * before pagination, so the default order and any header re-sort are correct across all
 * pages, not just the visible one.
 *
 * `renderExpanded` keys panel state by `rowKey` below, which falls back to the row's
 * index when a row carries no `uuid`/`id`/`pubkey`. Callers using it should supply a
 * stable `uuid`, or an open panel will follow a *position* across a re-sort rather than
 * its row.
 */
export default function DataTable({ columns, data, onRowClick, emptyMessage = 'No data', pageSize, showFilter = true, filterKeys = [], renderExpanded }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  // Open panels, by rowKey. Deliberately NOT cleared on sort/filter/page change: a row
  // scrolled out of view and back keeps the state the user left it in.
  const [expanded, setExpanded] = useState(() => new Set());

  const filtered = useMemo(() => {
    if (!filter) return data;
    const lower = filter.toLowerCase();
    const matches = val => val && String(val).toLowerCase().includes(lower);
    return data.filter(row =>
      columns.some(col => matches(row[col.key])) || filterKeys.some(key => matches(row[key]))
    );
  }, [data, filter, columns, filterKeys]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const col = columns.find(c => c.key === sortKey);
    const accessor = col && typeof col.sortValue === 'function' ? col.sortValue : null;
    if (accessor) {
      // Opt-in: sort by a raw value (e.g. a unix timestamp) decoupled from what the
      // cell renders, with missing values always last regardless of direction.
      return [...filtered].sort((a, b) => {
        const av = accessor(a);
        const bv = accessor(b);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortDir === 'asc' ? av - bv : bv - av;
      });
    }
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir, columns]);

  // Pagination (opt-in via pageSize). Reset to the first page whenever the
  // underlying set changes so we never strand the user on a now-empty page.
  const pageCount = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  useEffect(() => { setPage(0); }, [filter, sortKey, sortDir, data, pageSize]);
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = pageSize
    ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize)
    : sorted;

  // One derivation of a row's identity, used for BOTH the React key and the panel state,
  // so a row and its panel can never disagree. `||` (not `??`) preserves the original
  // fallback exactly for the callers that do not use renderExpanded.
  const rowKey = (row, i) => row.uuid || row.id || row.pubkey || i;

  function toggleExpanded(key) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <div className="data-table-wrapper">
      <div className="table-controls">
        {showFilter && (
          <input
            type="text"
            placeholder="Filter..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="table-filter"
          />
        )}
        <span className="table-count">{sorted.length} items</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} onClick={() => handleSort(col.key)} className="sortable">
                {col.label}
                {sortKey === col.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
              </th>
            ))}
            {renderExpanded && <th aria-label="details" />}
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr><td colSpan={columns.length + (renderExpanded ? 1 : 0)} className="empty-row">{emptyMessage}</td></tr>
          ) : (
            visibleRows.map((row, i) => {
              const isExpanded = renderExpanded && expanded.has(rowKey(row, i));
              return (
                <Fragment key={rowKey(row, i)}>
                  <tr
                    onClick={() => onRowClick?.(row)}
                    className={onRowClick ? 'clickable' : ''}
                  >
                    {columns.map(col => (
                      <td key={col.key}>
                        {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                      </td>
                    ))}
                    {renderExpanded && (
                      <td style={{ textAlign: 'center', width: '1%', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          aria-expanded={!!isExpanded}
                          title={isExpanded ? 'Hide details' : 'Show details'}
                          // stopPropagation, or expanding a row also fires onRowClick and
                          // navigates away (cf. ui/src/pages/lists/DListItems.jsx:550).
                          onClick={e => { e.stopPropagation(); toggleExpanded(rowKey(row, i)); }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text)', fontSize: '0.85rem',
                            padding: '0.2rem 0.4rem', borderRadius: '4px',
                            opacity: isExpanded ? 1 : 0.4,
                          }}
                        >{isExpanded ? '▾' : '▸'}</button>
                      </td>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={columns.length + 1} style={{ padding: 0, border: 'none' }}>
                        {renderExpanded(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
      {pageSize && pageCount > 1 && (
        <div className="table-pagination">
          <button
            className="table-page-btn"
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={safePage === 0}
          >‹ Prev</button>
          <span className="table-page-info">Page {safePage + 1} of {pageCount}</span>
          <button
            className="table-page-btn"
            onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
          >Next ›</button>
        </div>
      )}
    </div>
  );
}
