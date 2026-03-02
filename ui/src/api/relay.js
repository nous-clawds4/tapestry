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
