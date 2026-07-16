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
 * Publish a signed event to external relays via nostr-tools SimplePool (browser-side).
 * @param {object} signedEvent - A fully signed nostr event
 * @param {string[]} relays - Array of relay URLs
 * @returns {Promise<{successes: string[], failures: string[], skippedByGate?: boolean}>}
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

  try {
    const results = await Promise.allSettled(
      relays.map(async (relay) => {
        try {
          await Promise.race([
            pool.publish([relay], signedEvent),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
          ]);
          successes.push(relay);
        } catch {
          failures.push(relay);
        }
      })
    );
  } finally {
    try { pool.close(relays); } catch {}
  }

  return { successes, failures };
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
