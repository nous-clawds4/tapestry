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
 * Publish a signed event to external relays via nostr-tools SimplePool (browser-side).
 * @param {object} signedEvent - A fully signed nostr event
 * @param {string[]} relays - Array of relay URLs
 * @returns {Promise<{successes: string[], failures: string[]}>}
 */
export async function publishToRelays(signedEvent, relays = PUBLISH_RELAYS) {
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
 * Publish a signed event to both local strfry and all external relays.
 * @param {object} signedEvent - A fully signed nostr event
 * @returns {Promise<{local: object, external: {successes: string[], failures: string[]}}>}
 */
export async function publishEverywhere(signedEvent) {
  const [local, external] = await Promise.all([
    publishToLocalStrfry(signedEvent),
    publishToRelays(signedEvent),
  ]);
  return { local, external };
}

/**
 * Build the parameterized-replaceable uuid (kind:pubkey:d-tag) for an event.
 * Returns null if the event does not have a `d` tag.
 */
export function addressableUuid(event) {
  const dTag = (event.tags || []).find((t) => t[0] === 'd');
  if (!dTag || !dTag[1]) return null;
  return `${event.kind}:${event.pubkey}:${dTag[1]}`;
}

/**
 * After a successful publish, pull the event back from strfry into Neo4j so
 * it becomes queryable as a ListItem. Best-effort: fire-and-forget semantics,
 * errors are returned but don't throw.
 */
export async function importAddressableToNeo4j(event) {
  const uuid = addressableUuid(event);
  if (!uuid) return { success: false, error: 'Event has no d-tag (not addressable)' };
  try {
    const resp = await fetch('/api/neo4j/event-update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid }),
    });
    return await resp.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}
