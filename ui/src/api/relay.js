/**
 * Client for querying strfry via the server-side scan API.
 */

const API_BASE = '/api';

/**
 * Query strfry events via the /api/strfry/scan endpoint.
 * @param {Object} filter - Nostr filter object (kinds, authors, limit, etc.)
 * @returns {Promise<Array>} Array of nostr events
 */
export async function queryRelay(filter = {}) {
  const encoded = encodeURIComponent(JSON.stringify(filter));
  const res = await fetch(`${API_BASE}/strfry/scan?filter=${encoded}`);
  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Strfry scan failed');
  }

  return data.events;
}

/**
 * Like queryRelay, but returns the whole envelope rather than just the events.
 *
 * The scan endpoint bounds what it returns and reports whether it did, so a
 * caller that renders a list needs `total` and `truncated` to say "showing 500
 * of 473,101" instead of presenting a truncated view as a complete one.
 *
 * @param {Object} filter - Nostr filter object (pass an explicit `limit` when
 *   you intend to render the result)
 * `total` is null when the scan was bounded and the true count could not be
 * read — unknown, not zero. Render it as such rather than assuming a number.
 *
 * @returns {Promise<{events: Array, count: number, total: number|null, truncated: boolean, limit: number}>}
 */
export async function queryRelayBounded(filter = {}) {
  const encoded = encodeURIComponent(JSON.stringify(filter));
  const res = await fetch(`${API_BASE}/strfry/scan?filter=${encoded}`);
  const data = await res.json();

  if (!data.success) {
    throw new Error(data.error || 'Strfry scan failed');
  }

  return {
    events: data.events,
    count: data.count,
    total: data.total === undefined ? null : data.total,
    truncated: Boolean(data.truncated),
    limit: data.limit,
  };
}
