import { publishToRelays } from './nostrPublish';
import { classifyBroadcast, outcomeMessage } from '@tapestry/broadcast-outcome';
import { CONCEPT_PUBLISH_RELAYS } from './dispositionActions';
import { getActiveSignerOrThrow, getSessionPubkey, SignerMismatchError } from './signerGuard';

/**
 * List Headers' disposition actions on headers the signed-in person wrote with their own key — Me rows
 * (ADR list-headers-disposition/0005). The server prepares the new version, the person's browser signer
 * (NIP-07) signs it, and the server takes back only that exact change. The composition rules stay on the
 * server; this module only signs, and asks the signer once per action — never for an "already" answer, and
 * never before the server's own checks have passed. Mirrors utils/myAssistantDisposition.js.
 */

const NO_SIGNER = 'Signing your own headers needs a NIP-07 browser signer — nothing was saved';
const DECLINED = 'Signing was cancelled in your signer — nothing was saved';

async function postMe(handle, action, phase, body = {}) {
  const resp = await fetch(`/api/list-headers/me/${encodeURIComponent(handle)}/${action}/${phase}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!data.success) throw new Error(data.error || 'Disposition failed.');
  return data;
}

/** Sign the server's template with the browser signer, as the signed-in account and nobody else. */
async function signAsMe(template) {
  try {
    await getActiveSignerOrThrow();
  } catch (err) {
    if (err && err.message === 'No NIP-07 extension detected.') throw new Error(NO_SIGNER);
    throw err; // SignerMismatchError keeps its own sentence
  }
  let signed;
  try {
    signed = await window.nostr.signEvent(template);
  } catch {
    throw new Error(DECLINED);
  }
  const session = getSessionPubkey();
  if (!signed || signed.pubkey !== session) throw new SignerMismatchError(signed && signed.pubkey, session);
  return signed;
}

/** prepare → (sign → commit) when something new is needed; an "already" answer comes back unsigned. */
async function prepareSignCommit(handle, action, body = {}) {
  const prepared = await postMe(handle, action, 'prepare', body);
  if (prepared.result !== 'sign') return prepared;
  const signed = await signAsMe(prepared.template);
  return postMe(handle, action, 'commit', { ...body, event: signed });
}

async function broadcast(data, verb, alreadyResult) {
  // Saved here by now. What the broadcast did is a separate fact: publishToRelays resolves rather
  // than throwing on failure, so it has to be read, not assumed.
  let result = null;
  try {
    result = await publishToRelays(data.event, CONCEPT_PUBLISH_RELAYS);
  } catch {
    result = null; // classifies as not-delivered — the honest direction
  }
  return {
    message: outcomeMessage({ outcome: classifyBroadcast(result), verb, already: data.result === alreadyResult }),
    event: data.event,
  };
}

/** Submit as a Shared Concept, signed by the person, then broadcast. Returns { message, event }. */
export async function submitAsMe(handle) {
  return broadcast(await prepareSignCommit(handle, 'self-declare'), 'submit', 'already-declared');
}

/** Wire to an external shared concept, signed by the person, then broadcast. Returns { message, event }. */
export async function wireAsMe(handle, target) {
  return broadcast(await prepareSignCommit(handle, 'b-append', { target }), 'wire', 'already-wired');
}

/** Keep private, signed by the person. Never broadcast: deferral is a stance, not an announcement. */
export async function keepPrivateAsMe(handle) {
  const data = await prepareSignCommit(handle, 'b-defer');
  return {
    message: data.result === 'already-deferred'
      ? 'Already kept private — nothing new was signed.'
      : 'Kept private — this header is marked as deliberately unaffiliated.',
    event: data.event,
  };
}
