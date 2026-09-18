import { parseListRef } from './dlistFields.js';

/**
 * Batch-fetch the list headers for a set of item parent references, and index them by
 * the exact reference they answer to.
 *
 * Extracted from `TagItemsView` (dlist-item-tagging #4) so the Pinned tab's item list
 * reads headers the same way the tag page's Items view does — one implementation of the
 * "a parent is either a kind-39998 coordinate or a kind-9998 header event id" rule.
 *
 * `query` is injected (the page passes `queryRelay`) so this stays testable without a
 * relay. A failing fetch degrades to "header not found" for that reference rather than
 * throwing — a list that is not on this relay must not blank the whole view.
 */
export async function fetchListHeaders(listCoords, query) {
  const byCoord = new Map();
  if (!Array.isArray(listCoords) || listCoords.length === 0 || typeof query !== 'function') {
    return byCoord;
  }
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
    try { found.push(...await query({ ids })); } catch { /* degrade to not-found */ }
  }
  for (const [key, ds] of byAuthor) {
    const [kind, pubkey] = key.split('|');
    try {
      found.push(...await query({ kinds: [Number(kind)], authors: [pubkey], '#d': Array.from(new Set(ds)) }));
    } catch { /* degrade to not-found */ }
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

/**
 * The parent list of a DList item event: a kind-39999 item names it with a `z`
 * coordinate, a kind-9999 item with an `e` header event id. An item naming several
 * parents belongs to the FIRST (mirrors the server's `listCoordOf`, E5).
 */
export function listCoordOf(event) {
  if (!event) return null;
  const name = event.kind === 39999 ? 'z' : 'e';
  const t = (event.tags || []).find((x) => Array.isArray(x) && x[0] === name && x[1]);
  return t ? t[1] : null;
}

/**
 * Group item events by their parent list, preserving first-seen order so the published
 * order of a Trusted List survives into the rendering.
 *
 * search-index-selection #1 — a tagged kind-39998 list HEADER is not an item of anything
 * (no field declarations to tabulate, and no parent), so headers are pulled out into one
 * leading `{ headers: true, listCoord: null, items }` group rendered as link cards. The
 * kind rule wins over a present `listCoord` (E2). With no headers in the input the output
 * is byte-identical to the legacy two-key grouping (E8).
 */
export function groupItemsByList(items) {
  const out = [];
  const index = new Map();
  const headers = [];
  for (const item of items || []) {
    if (item && item.kind === 39998) { headers.push(item); continue; }
    const key = item.listCoord || '';
    if (!index.has(key)) { index.set(key, out.length); out.push({ listCoord: item.listCoord || null, items: [] }); }
    out[index.get(key)].items.push(item);
  }
  if (headers.length) out.unshift({ headers: true, listCoord: null, items: headers });
  return out;
}

/**
 * A DList item row as `DListItemsTable` wants it. An item whose event is on no reachable
 * relay arrives with empty tags; re-deriving its `d` from the coordinate gives the row
 * something to display. Targeting never depends on this `d` — `itemCoord` uses the
 * carried `address` verbatim — so it is display-only, and synthesized for kind-39999 rows
 * alone. (dlist-item-tagging #4 Gate B finding 1.)
 */
export function toTableItem(item) {
  const hasD = (item.tags || []).some((t) => t[0] === 'd');
  const d = !hasD && item.address && item.kind === 39999
    ? item.address.split(':').slice(2).join(':')
    : null;
  return {
    ...item,
    id: item.id || item.address,
    tags: d ? [['d', d], ...(item.tags || [])] : (item.tags || []),
  };
}
