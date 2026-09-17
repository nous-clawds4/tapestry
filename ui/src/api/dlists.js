/**
 * Client for the DList read endpoints.
 *
 * `fetchPageCounts` asks the server for item counts for exactly the header
 * coordinates on the visible page — a bounded per-coordinate scan — rather
 * than the whole-relay item-count walk the operator page still pays (OPEN 301).
 */

/**
 * Item counts for one page of list headers.
 *
 * Coordinates travel as repeated query params, so a comma (or any other
 * delimiter) inside a `d` tag survives intact.
 *
 * @param {string[]} coords header coordinates / event ids, at most 50
 * @returns {Promise<Object>} { [coord]: number } — an empty object when there
 *   is nothing to ask for. Rejects on a failed request; callers catch and
 *   render — rather than taking the page down.
 */
export async function fetchPageCounts(coords) {
  const list = (coords || []).filter(Boolean);
  if (list.length === 0) return {};

  const qs = list.map((c) => `coords=${encodeURIComponent(c)}`).join('&');
  const res = await fetch(`/api/dlists/page-counts?${qs}`);
  const data = await res.json();

  if (!data || !data.success) {
    throw new Error((data && data.error) || 'Page counts failed');
  }
  return data.counts || {};
}
