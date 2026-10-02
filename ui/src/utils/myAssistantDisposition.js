import { publishToRelays } from './nostrPublish';
import { classifyBroadcast, outcomeMessage } from '@tapestry/broadcast-outcome';
import { CONCEPT_PUBLISH_RELAYS } from './dispositionActions';

/**
 * List Headers' disposition actions on the signed-in person's own Assistant's headers
 * (ADR list-headers-disposition/0003). The server signs with that Assistant only; this module sends a
 * submitted header to the same community relay Concept Headers uses, and reports what the broadcast
 * actually did. Mirrors utils/dispositionActions.js, which stays Concept Headers' until its fix.
 */

async function postDisposition(handle, action) {
  const resp = await fetch(`/api/list-headers/my-assistant/${encodeURIComponent(handle)}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || 'Disposition failed.');
  return data;
}

/** Submit as a Shared Concept, then broadcast. Returns { message, event }. */
export async function submitAndBroadcast(handle) {
  const data = await postDisposition(handle, 'self-declare');
  // Saved here by now. What the broadcast did is a separate fact: publishToRelays resolves rather
  // than throwing on failure, so it has to be read, not assumed.
  let result = null;
  try {
    result = await publishToRelays(data.event, CONCEPT_PUBLISH_RELAYS);
  } catch {
    result = null; // classifies as not-delivered — the honest direction
  }
  return {
    message: outcomeMessage({ outcome: classifyBroadcast(result), verb: 'submit', already: data.result === 'already-declared' }),
    event: data.event,
  };
}

/** Keep private. Never broadcast: deferral is a stance, not an announcement. Returns { message, event }. */
export async function keepPrivate(handle) {
  const data = await postDisposition(handle, 'b-defer');
  return {
    message: data.result === 'already-deferred'
      ? 'Already kept private — nothing new was signed.'
      : 'Kept private — this header is marked as deliberately unaffiliated.',
    event: data.event,
  };
}
