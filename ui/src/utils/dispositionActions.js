import { publishToRelays } from './nostrPublish';
import { classifyBroadcast, outcomeMessage } from '@tapestry/broadcast-outcome';

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
  // The local declaration has succeeded by this point. What the broadcast did
  // is a SEPARATE fact — publishToRelays resolves rather than throwing on
  // failure, so it has to be read, not assumed.
  let result = null;
  try {
    result = await publishToRelays(data.event, CONCEPT_PUBLISH_RELAYS);
  } catch {
    result = null; // classifies as not-delivered — the honest direction
  }
  return outcomeMessage({
    outcome: classifyBroadcast(result),
    verb: 'submit',
    already: data.result === 'already-declared',
  });
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
  // Identical treatment to declareAndBroadcast above — this path carried the
  // same defect and must not be left behind.
  let result = null;
  try {
    result = await publishToRelays(data.event, CONCEPT_PUBLISH_RELAYS);
  } catch {
    result = null;
  }
  return outcomeMessage({
    outcome: classifyBroadcast(result),
    verb: 'wire',
    already: data.result === 'already-wired',
  });
}
