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
 *
 * Story 15 — the Notes tab reuses THIS SAME control (not a bespoke one). It
 * passes its own `sortOptions` (recent/applied/disputed/divisive) and
 * `hidePrimary` (the "+ Tag someone" button is Profiles-only; the Notes tab's
 * "+ Tag a Note" arrives in Story 16). Profiles' defaults are unchanged.
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
  signedIn = true,
  sortOptions = SORT_OPTIONS,
  sortAriaLabel = 'Sort tagged profiles',
  filterPlaceholder = 'Filter this list…',
  filterAriaLabel = 'Filter the list of tagged profiles',
  hidePrimary = false,
  // Story 16 — the primary (left) button is configurable so the Notes tab can
  // show "+ Tag a Note" in the SAME slot Profiles uses for "+ Tag someone".
  // Defaults preserve the Profiles behavior + its onTagSomeoneClick handler.
  onPrimaryClick,
  primaryLabel = '➕ Tag someone',
  primaryLabelSignedOut = '🔒 Sign in to tag someone',
  primaryAriaLabel = 'Tag someone',
  primaryAriaLabelSignedOut = 'Sign in to tag someone',
}) {
  const handleDetailsToggle = (e) => {
    if (onToggleExpand) onToggleExpand(e.currentTarget.open);
  };
  const primaryClick = onPrimaryClick || onTagSomeoneClick;

  return (
    <div className="bs-tag-view-controls">
      <div className={`bs-tag-view-controls-row${hidePrimary ? ' is-no-primary' : ''}`}>
        {!hidePrimary && (
          <button
            type="button"
            className={`bs-tag-view-tagsomeone${signedIn ? '' : ' is-disabled'}`}
            onClick={signedIn ? primaryClick : undefined}
            disabled={!signedIn}
            data-bs-tooltip={signedIn ? undefined : primaryAriaLabelSignedOut}
            aria-label={signedIn ? primaryAriaLabel : primaryAriaLabelSignedOut}
          >
            {signedIn ? primaryLabel : primaryLabelSignedOut}
          </button>
        )}

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
            options={sortOptions}
            value={sort}
            onChange={onSortChange}
            ariaLabel={sortAriaLabel}
            className="bs-tag-sort"
          />
          <input
            type="text"
            className="bs-tag-view-filter"
            placeholder={filterPlaceholder}
            value={filterText || ''}
            onChange={(e) => onFilterChange(e.target.value)}
            aria-label={filterAriaLabel}
          />
        </div>
      )}
    </div>
  );
}
