import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotesForTag } from '../hooks/useNotesForTag';
import { useAuth } from '../context/AuthContext';
import TagViewControls from './TagViewControls';
import DListItemsTable from './dlist/DListItemsTable';
import DListItemTags from './dlist/DListItemTags';
import { queryRelay } from '../api/relay';
import { headerNames, parseFieldDecls } from '../utils/dlistFields';
import { fetchListHeaders, groupItemsByList, toTableItem } from '../utils/dlistHeaders';

/**
 * dlist-item-tagging #4 — the "Items" view of a tag's detail page: the
 * Decentralized-List items tagged with this tag, read from the SAME
 * `/api/event-tags/for-tag` call the Notes view uses (its `items` group), grouped
 * by the list each item belongs to and rendered by that list's own field
 * declarations.
 *
 * Header field declarations resolve HERE, client-side, per group — the story-1
 * parsers (`parseFieldDecls` / `headerNames` / `parseListRef`) are the single
 * implementation, so the server never forks field-decl semantics. A group whose
 * header query comes back empty degrades to "list not on this relay" with empty
 * fieldDecls (AC-4), and `DListItemsTable` falls back to its Added-by / Age /
 * Other-fields / Votes columns.
 *
 * Controls are the shared `TagViewControls` with the Notes view's sort keys and
 * curated/expanded/filter semantics — including the `mine` durability exemption
 * (AC-5). Votes are not read here (kind-7 scanning is /list/:ref's job).
 */
const ITEM_SORT_OPTIONS = [
  { key: 'recent', label: 'Most recent' },
  { key: 'applied', label: 'Most applied' },
  { key: 'disputed', label: 'Most disputed' },
  { key: 'divisive', label: 'Most divisive' },
];

const NOT_HERE = 'list not on this relay';

function itemMatchesFilter(item, text) {
  const needle = (text || '').trim().toLowerCase();
  if (!needle) return true;
  if ((item.address || '').toLowerCase().includes(needle)) return true;
  return (item.tags || []).some((t) => t.length > 1 && String(t[1]).toLowerCase().includes(needle));
}

export default function TagItemsView({ tag, viewerPubkey, onCount }) {
  const { user } = useAuth();
  const [sort, setSort] = useState('recent');
  const [expanded, setExpanded] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [headers, setHeaders] = useState(new Map());
  const { items, itemTotal, itemTruncated, loading, error } = useNotesForTag(
    tag?.authorPubkey, tag?.slug, viewerPubkey, sort,
  );

  // AC-2 — the count must exist BEFORE the Items switch is clicked, so this view
  // is mounted eagerly (merely hidden) and reports its total up to the page.
  useEffect(() => { if (onCount) onCount(itemTotal); }, [itemTotal, onCount]);

  const listCoords = useMemo(
    () => Array.from(new Set(items.map((i) => i.listCoord).filter(Boolean))),
    [items],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = listCoords.length ? await fetchListHeaders(listCoords, queryRelay) : new Map();
      if (!cancelled) setHeaders(found);
    })();
    return () => { cancelled = true; };
  }, [listCoords.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Text filter → curated filter (when collapsed) → groups. Curated keeps
  // net-endorsed items plus the viewer's own (`mine` durability), exactly as the
  // Notes view does. Ordering is the server's; no client-side re-sort.
  const groups = useMemo(() => {
    const byText = filterText ? items.filter((i) => itemMatchesFilter(i, filterText)) : items;
    const shown = expanded
      ? byText
      : byText.filter((i) => ((i.applications || 0) - (i.disputes || 0)) >= 1 || !!i.mine);
    return groupItemsByList(shown);
  }, [items, filterText, expanded]);

  return (
    <>
      <TagViewControls
        sort={sort}
        onSortChange={setSort}
        expanded={expanded}
        onToggleExpand={setExpanded}
        filterText={filterText}
        onFilterChange={setFilterText}
        signedIn={!!user}
        hidePrimary
        sortOptions={ITEM_SORT_OPTIONS}
        sortAriaLabel="Sort tagged items"
        filterPlaceholder="Filter these items…"
        filterAriaLabel="Filter the list of tagged items"
      />

      {loading ? (
        <p className="bs-tag-loading">Loading items…</p>
      ) : error ? (
        <p className="bs-tag-error">⚠️ {error}</p>
      ) : (
        <>
          {itemTruncated && (
            <p className="bs-tag-notes-truncation">
              Showing the top {items.length} of {itemTotal} tagged items.
            </p>
          )}

          {items.length === 0 ? (
            <p className="bs-tag-empty">
              No list items have been tagged with <strong>{tag?.name || tag?.slug}</strong> yet.
            </p>
          ) : groups.length === 0 ? (
            <p className="bs-tag-empty">
              {filterText
                ? `No tagged items match "${filterText}".`
                : 'No items meet the Curated threshold yet. Open View options to see all tagged items.'}
            </p>
          ) : (
            groups.map((group) => {
              // search-index-selection #1 (AC-3, AC-6) — tagged LIST HEADERS get their own
              // leading group, rendered as link cards. A header has no item fields to
              // tabulate, so it never goes through DListItemsTable.
              if (group.headers) {
                return (
                  <section className="bs-tag-items-group" key="list-headers">
                    <h3 className="bs-tag-items-group-heading"><span>Lists</span></h3>
                    <div className="bs-tag-header-cards">
                      {group.items.map((h) => {
                        const resolved = (h.tags || []).length > 0;
                        const hn = headerNames(h);
                        return (
                          <article className="bs-tag-header-card" key={h.address}>
                            <Link to={`/list/${h.address}`} className="bs-tag-header-card-name">
                              {resolved ? (hn.plural || h.address) : h.address}
                            </Link>
                            {resolved && hn.description && (
                              <p className="bs-tag-header-card-desc">{hn.description}</p>
                            )}
                            <code className="bs-dlist-coord">{h.address}</code>
                            {!resolved && (
                              <span className="bs-tag-items-group-missing"> — list not on this relay</span>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              }
              const header = group.listCoord ? headers.get(group.listCoord) : null;
              const fieldDecls = header ? parseFieldDecls(header) : [];
              const { plural } = header ? headerNames(header) : { plural: '' };
              return (
                <section className="bs-tag-items-group" key={group.listCoord || 'no-list'}>
                  <h3 className="bs-tag-items-group-heading">
                    {group.listCoord ? (
                      <Link to={`/list/${group.listCoord}`}>{plural || group.listCoord}</Link>
                    ) : (
                      <span>Items with no list</span>
                    )}
                    {group.listCoord && !header && (
                      <span className="bs-tag-items-group-missing"> — {NOT_HERE}</span>
                    )}
                  </h3>
                  <DListItemsTable
                    items={group.items.map(toTableItem)}
                    fieldDecls={fieldDecls}
                    renderExtra={(item) => <DListItemTags item={item} showScores={expanded} />}
                  />
                </section>
              );
            })
          )}
        </>
      )}
    </>
  );
}
