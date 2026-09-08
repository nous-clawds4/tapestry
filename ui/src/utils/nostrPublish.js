/**
 * Relay fetch/publish utilities for browser-side nostr operations.
 *
 * - fetchFromRelays: reads events via the server-side /api/relay/external endpoint
 * - publishToLocalStrfry: publishes a signed event to the local strfry relay
 * - publishToRelays: publishes a signed event to external relays via SimplePool (browser-side)
 * - publishEverywhere: publishes to both local strfry and external relays in parallel
 */

import { SimplePool } from 'nostr-tools/pool';

export const PUBLISH_RELAYS = [
  'wss://purplepag.es',
  'wss://wot.grapevine.network',
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://relay.damus.io',
];

/**
 * Fetch events from external relays via the server proxy.
 * @param {object} filter - Nostr filter object
 * @param {string[]} relays - Array of relay URLs
 * @returns {Promise<object[]>} Array of nostr events
 */
export async function fetchFromRelays(filter, relays = PUBLISH_RELAYS) {
  const params = new URLSearchParams({
    filter: JSON.stringify(filter),
    relays: relays.join(','),
  });
  try {
    const resp = await fetch(`/api/relay/external?${params}`);
    const data = await resp.json();
    return data.success ? (data.events || []) : [];
  } catch {
    return [];
  }
}

/**
 * Publish a signed event to the local strfry relay via the server API.
 * @param {object} signedEvent - A fully signed nostr event
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function publishToLocalStrfry(signedEvent) {
  try {
    const resp = await fetch('/api/strfry/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: signedEvent, signAs: 'client' }),
    });
    return await resp.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Whether this deployment permits external (non-local) publishing.
 *
 * The opt-in LOCAL-ONLY guard (event-tagging ADR 0002): a deployment that sets
 * BRAINSTORM_PUBLISH_LOCAL_ONLY=true keeps every publish on the local relay. The
 * default (unset) is external publishing, so existing deployments are unchanged.
 *
 * FAIL-OPEN: any error / non-200 resolves to `true` (the unset default), so a
 * transient policy-read failure never silently pauses production publishing. The
 * policy is fetched once and cached at module scope.
 */
let _externalPublishAllowed;
export async function isExternalPublishAllowed() {
  if (_externalPublishAllowed === undefined) {
    _externalPublishAllowed = (async () => {
      try {
        const resp = await fetch('/api/publish-policy');
        if (!resp.ok) return true; // fail-open
        const data = await resp.json();
        return data?.allowExternalPublish !== false; // only an explicit false suppresses
      } catch {
        return true; // fail-open — never let a policy-read failure pause publishing
      }
    })();
  }
  return _externalPublishAllowed;
}

/**
 * What one relay actually did with the event.
 *
 * nostr-tools reports failure in two different shapes, and one of them looks like
 * success: a relay that answers `OK: false` REJECTS, but a relay we could not connect
 * to RESOLVES with a `"connection failure: …"` string, because `pool.publish` catches
 * the connect error itself. So the fulfilled VALUE has to be read — classifying on
 * settled status alone would call an unreachable relay a success.
 *
 * @param {{status: string, value?: unknown, reason?: unknown}} settled - one entry from
 *   Promise.allSettled over the promises SimplePool.publish() returns
 * @returns {{status: 'accepted'|'refused'|'unreachable'|'timeout', reason: string}}
 */
function classifyRelayOutcome(settled) {
  // No result at all: we cannot claim the relay took it. Fail toward honesty.
  if (!settled) return { status: 'unreachable', reason: 'no publish result' };

  if (settled.status === 'rejected') {
    const reason = String(settled.reason?.message ?? settled.reason ?? '');
    return reason === 'publish timed out'
      ? { status: 'timeout', reason }
      : { status: 'refused', reason };
  }

  const value = typeof settled.value === 'string' ? settled.value : '';
  return value.startsWith('connection failure:')
    ? { status: 'unreachable', reason: value }
    : { status: 'accepted', reason: value };
}

/**
 * Publish a signed event to external relays via nostr-tools SimplePool (browser-side).
 *
 * `details` carries the per-relay verdict (ADR honest-publish-reporting/0001) so a caller
 * — or whoever is watching a deploy — can tell "the relay said no" from "we never reached
 * it". It is derived from the same settled results as `successes`/`failures`, never a
 * second source of truth.
 *
 * @param {object} signedEvent - A fully signed nostr event
 * @param {string[]} relays - Array of relay URLs
 * @returns {Promise<{successes: string[], failures: string[], details?: Object<string, {status: string, reason: string}>, skippedByGate?: boolean}>}
 */
export async function publishToRelays(signedEvent, relays = PUBLISH_RELAYS) {
  // Opt-in LOCAL-ONLY guard (ADR 0002): when on, do not open any socket to an
  // external relay. Returns a normal result shape (so callers treat local-only as
  // success), marked skippedByGate so "kept local" is distinguishable from "failed".
  if (!(await isExternalPublishAllowed())) {
    console.info('[publish] local-only guard on — external publishing skipped');
    return { successes: [], failures: [], skippedByGate: true };
  }

  const pool = new SimplePool();
  const successes = [];
  const failures = [];
  const details = {};

  try {
    // One publish per relay, all in flight together. SimplePool.publish() returns an
    // ARRAY of promises rather than a promise, so the settled entries are what carry the
    // relay's answer — awaiting the array itself resolves immediately and proves nothing.
    // Publishing per relay (rather than one pool.publish(relays, …)) also sidesteps the
    // library's post-normalizeURL duplicate rejection; see ADR 0001.
    const outcomes = await Promise.all(
      relays.map(async (relay) => {
        try {
          const [settled] = await Promise.allSettled(pool.publish([relay], signedEvent));
          return classifyRelayOutcome(settled);
        } catch (err) {
          // pool.publish throws SYNCHRONOUSLY on a malformed relay URL (normalizeURL →
          // new URL). Relay lists come from the user's own kind-10002, so one bad entry
          // is reachable and must not take the publish to every other relay down with it.
          return { status: 'unreachable', reason: String(err?.message ?? err) };
        }
      })
    );
    // Deterministic: successes/failures follow the caller's relay order.
    relays.forEach((relay, i) => {
      const outcome = outcomes[i];
      details[relay] = outcome;
      (outcome.status === 'accepted' ? successes : failures).push(relay);
    });
  } finally {
    try { pool.close(relays); } catch {}
  }

  return { successes, failures, details };
}

/**
 * Publish a signed event to local strfry and a set of external relays.
 * @param {object} signedEvent - A fully signed nostr event
 * @param {string[]} [relays=PUBLISH_RELAYS] - External relay targets. Defaults
 *   to PUBLISH_RELAYS so every existing caller is unchanged; the concept-export
 *   path passes a restricted DList relay set (ADR 0004 Rev 1).
 * @returns {Promise<{local: object, external: {successes: string[], failures: string[]}}>}
 */
export async function publishEverywhere(signedEvent, relays = PUBLISH_RELAYS) {
  const [local, external] = await Promise.all([
    publishToLocalStrfry(signedEvent),
    publishToRelays(signedEvent, relays),
  ]);
  return { local, external };
}
