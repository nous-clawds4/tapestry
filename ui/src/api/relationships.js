/**
 * Client for the strfry-free relationship primitives (ADR
 * relationship-primitives/0001; UI consumption per ADR graph-curation-ui/0001
 * decision 2).
 *
 * Unlike the ui/src/api/normalize.js helpers, these return the FULL response
 * body: the `result` discriminator (created | already-existed | deleted |
 * not-found) and the firmware-install hazard `note` are load-bearing UI
 * inputs, never discarded. On failure they throw Error(data.error) with
 * `.status` (HTTP status) and `.allowed` (whitelist, on 400) attached.
 */
const API_BASE = '/api/normalize';

async function postRelationship(path, { fromUuid, toUuid, relType } = {}) {
  const res = await fetch(`${API_BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromUuid, toUuid, relType }),
  });
  const data = await res.json().catch(() => null);
  if (!data || !data.success) {
    const err = new Error((data && data.error) || `${path} failed (HTTP ${res.status})`);
    err.status = res.status;
    if (data && data.allowed) err.allowed = data.allowed;
    throw err;
  }
  return data;
}

export function addRelationship(args) {
  return postRelationship('add-relationship', args);
}

export function deleteRelationship(args) {
  return postRelationship('delete-relationship', args);
}
