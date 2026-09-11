import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotesForTag } from '../hooks/useNotesForTag';
import { useAuth } from '../context/AuthContext';
import TagViewControls from './TagViewControls';
import DListItemsTable from './dlist/DListItemsTable';
import DListItemTags from './dlist/DListItemTags';
import { queryRelay } from '../api/relay';
import { headerNames, parseFieldDecls, parseListRef } from '../utils/dlistFields';

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

/**
 * A server item row as DListItemsTable/DListItemTags want it. An item whose event
 * is on no reachable relay (E3) arrives with empty tags; re-deriving its `d` from
 * the coordinate keeps `itemTarget` pointing at the same `a` address the row is
 * keyed by, so the row's tag affordance still aims at the right target.
 */
function toTableItem(item) {
  const hasD = (item.tags || []).some((t) => t[0] === 'd');
  const d = !hasD && item.address ? item.address.split(':').slice(2).join(':') : null;
  return {
    ...item,
    id: item.id || item.address,
    tags: d ? [['d', d], ...(item.tags || [])] : (item.tags || []),
  };
}

function itemMatchesFilter(item, text) {
  const needle = (text || '').trim().toLowerCase();
  if (!needle) return true;
  if ((item.address || '').toLowerCase().includes(needle)) return true;
  return (item.tags || []).some((t) => t.length > 1 && String(t[1]).toLowerCase().includes(needle));
}

/**
 * Batch-fetch the headers for the distinct `listCoord`s the server handed back.
 * Both parent forms are covered: a kind-39998 coordinate (one filter per author,
 * matched back on the exact coordinate) and a kind-9998 header EVENT ID.
 */
async function fetchHeaders(listCoords) {
  const byCoord = new Map();
  const ids = [];
  const byAuthor = new Map(); // `${kind}|${pubkey}` -> [d, …]
  for (const coord of listCoords) {
    const parsed = parseListRef(coord);
    if (!parsed) continue;
    if (parsed.id) { ids.push(parsed.id); continue; }
    const key = `${parsed.kind}|${parsed.pubkey}`;
    if (!byAuthor.has(key)) byAuthor.set(key, []);
    byAuthor.get(key).push(parsed.d);
  }
  const found = [];
  if (ids.length) {
    try { found.push(...await queryRelay({ ids })); } catch { /* degrade to NOT_HERE */ }
  }
  for (const [key, ds] of byAuthor) {
    const [kind, pubkey] = key.split('|');
    try {
      found.push(...await queryRelay({ kinds: [Number(kind)], authors: [pubkey], '#d': Array.from(new Set(ds)) }));
    } catch { /* degrade to NOT_HERE */ }
  }
  for (const coord of listCoords) {
    const parsed = parseListRef(coord);
    if (!parsed) continue;
    const header = parsed.id
      ? found.find((h) => h.id === parsed.id)
      : found.find((h) => h.kind === parsed.kind && h.pubkey === parsed.pubkey
        && (h.tags || []).some((t) => t[0] === 'd' && t[1] === parsed.d));
    if (header) byCoord.set(coord, header);
  }
  return byCoord;
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
      const found = listCoords.length ? await fetchHeaders(listCoords) : new Map();
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
    const out = [];
    const index = new Map();
    for (const item of shown) {
      const key = item.listCoord || '';
      if (!index.has(key)) { index.set(key, out.length); out.push({ listCoord: item.listCoord || null, items: [] }); }
      out[index.get(key)].items.push(item);
    }
    return out;
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
