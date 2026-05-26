import React from 'react';
import SortToggle from './SortToggle';

/**
 * Story 17 / ADR 0014 Decision 1 + 5.
 *
 * Toolbar row above the tag-detail page's row list:
 *   - Left:  "Tag someone" button (opens TagSomeoneModal)
 *   - Right: "View options" disclosure (<details>/<summary>) — chevron
 *            collapses/expands a panel containing the sort chips
 *            (SortToggle) and the client-side filter input.
 *
 * The disclosure's open state and the filter text are owned by the parent
 * (Tag.jsx) so the parent can derive Curated vs Expanded view + apply the
 * filter on the row list.
 *
 * Anonymous users still see the "Tag someone" button per AC-13; the parent
 * gates the click → login() flow.
 */
const SORT_OPTIONS = [
  { key: 'applied', label: 'Most applied' },
  { key: 'disputed', label: 'Most disputed' },
  { key: 'divisive', label: 'Most divisive' },
];

export default function TagViewControls({
  sort,
  onSortChange,
  expanded,
  onToggleExpand,
  filterText,
  onFilterChange,
  onTagSomeoneClick,
}) {
  const handleDetailsToggle = (e) => {
    if (onToggleExpand) onToggleExpand(e.currentTarget.open);
  };

  return (
    <div className="bs-tag-view-controls">
      <div className="bs-tag-view-controls-row">
        <button
          type="button"
          className="bs-tag-view-tagsomeone"
          onClick={onTagSomeoneClick}
        >
          ➕ Tag someone
        </button>

        <details
          className="bs-tag-view-options"
          open={!!expanded}
          onToggle={handleDetailsToggle}
        >
          <summary className="bs-tag-view-options-summary">
            <span>View options</span>
            <span className="bs-tag-view-options-chevron" aria-hidden="true">▾</span>
          </summary>
        </details>
      </div>

      {expanded && (
        <div className="bs-tag-view-options-panel">
          <SortToggle
            options={SORT_OPTIONS}
            value={sort}
            onChange={onSortChange}
            ariaLabel="Sort tagged profiles"
            className="bs-tag-sort"
          />
          <input
            type="text"
            className="bs-tag-view-filter"
            placeholder="Filter this list…"
            value={filterText || ''}
            onChange={(e) => onFilterChange(e.target.value)}
            aria-label="Filter the list of tagged profiles"
          />
        </div>
      )}
    </div>
  );
}
