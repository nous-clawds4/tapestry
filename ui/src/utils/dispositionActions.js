import { publishToRelays } from './nostrPublish';

// Same community target as the self-declare button (ConceptDetail.jsx) and the
// F1 panel. Extracted (ADR shared-concepts-adoption/0003) so the disposition
// actions and their broadcast-fallback strings live once, shared by
// DispositionPanel (F5/F1) and the Adoption Queue's publish view (F2).
export const CONCEPT_PUBLISH_RELAYS = ['wss://dcosl.brainstorm.world'];

async function postJson(pathname, body) {
  const resp = await fetch(pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  return resp.json();
}

/**
 * Submit a header as a Shared Concept: the shipped self-declare + the
 * community-relay broadcast. Returns a human-readable outcome message;
 * throws with the server's error when the declare itself fails.
 */
export async function declareAndBroadcast(handle) {
  const data = await postJson(`/api/concept/${encodeURIComponent(handle)}/self-declare`);
  if (!data.success) throw new Error(data.error || 'Self-declare failed.');
  try {
    await publishToRelays(data.event, CONCEPT_PUBLISH_RELAYS);
    return data.result === 'already-declared'
      ? 'Already self-declared — re-broadcast to the community relay.'
      : 'Submitted as a shared concept.';
  } catch {
    return 'Self-declared locally — community broadcast failed (retry from the concept page).';
  }
}

/**
 * Keep a header private: the shipped keep-private disposition (the sentinel).
 * Deliberately NO broadcast — deferral is a stance, not an announcement.
 */
export async function defer(handle) {
  const data = await postJson(`/api/concept/${encodeURIComponent(handle)}/b-defer`);
  if (!data.success) throw new Error(data.error || 'Keep-private failed.');
  return 'Kept private — this header is marked as deliberately unaffiliated.';
}

/**
 * Wire a header to an external shared concept: the shipped b-append + the
 * community-relay broadcast.
 */
export async function wireAndBroadcast(handle, target) {
  const data = await postJson(`/api/concept/${encodeURIComponent(handle)}/b-append`, { target });
  if (!data.success) throw new Error(data.error || 'Wiring failed.');
  try {
    await publishToRelays(data.event, CONCEPT_PUBLISH_RELAYS);
    return data.result === 'already-wired'
      ? 'Already wired — re-broadcast to the community relay.'
      : 'Wired — broadcast to the community relay.';
  } catch {
    return 'Wired locally — community broadcast failed (retry from the concept page).';
  }
}
