import { useState, useMemo, useEffect } from 'react';

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
 *
 * `pageSize` and `showFilter` are additive/optional; callers that omit them get
 * the original behavior (no pagination, filter shown). Sorting always applies to
 * the full (filtered) set before pagination, so the default order and any
 * header re-sort are correct across all pages, not just the visible one.
 */
export default function DataTable({ columns, data, onRowClick, emptyMessage = 'No data', pageSize, showFilter = true }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!filter) return data;
    const lower = filter.toLowerCase();
    return data.filter(row =>
      columns.some(col => {
        const val = row[col.key];
        return val && String(val).toLowerCase().includes(lower);
      })
    );
  }, [data, filter, columns]);

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
          </tr>
        </thead>
        <tbody>
          {visibleRows.length === 0 ? (
            <tr><td colSpan={columns.length} className="empty-row">{emptyMessage}</td></tr>
          ) : (
            visibleRows.map((row, i) => (
              <tr
                key={row.uuid || row.id || row.pubkey || i}
                onClick={() => onRowClick?.(row)}
                className={onRowClick ? 'clickable' : ''}
              >
                {columns.map(col => (
                  <td key={col.key}>
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
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
