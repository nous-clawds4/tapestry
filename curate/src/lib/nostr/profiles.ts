/**
 * Profile metadata (kind 0) fetcher with in-memory cache.
 *
 * Batches multiple pubkey requests into a single relay query
 * to avoid hammering relays with individual lookups.
 */

import type { NostrEvent } from "nostr-tools/pure";
import { ensurePool } from "./ndk";

export interface ProfileMeta {
  pubkey: string;
  name?: string;
  displayName?: string;
  picture?: string;
  nip05?: string;
  about?: string;
  /** When we fetched it (ms). */
  fetchedAt: number;
}

// ---- Cache ----

const cache = new Map<string, ProfileMeta>();
const inflight = new Map<string, Promise<ProfileMeta | null>>();

/** Cache TTL — 10 minutes. */
const CACHE_TTL_MS = 10 * 60 * 1000;

export function getCachedProfile(pubkey: string): ProfileMeta | undefined {
  const entry = cache.get(pubkey);
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(pubkey);
    return undefined;
  }
  return entry;
}

// ---- Batch queue ----

let batchQueue: string[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let batchResolvers = new Map<string, Array<(p: ProfileMeta | null) => void>>();

function flushBatch() {
  batchTimer = null;
  const pubkeys = [...new Set(batchQueue)];
  batchQueue = [];
  const resolvers = batchResolvers;
  batchResolvers = new Map();

  if (pubkeys.length === 0) return;

  const { pool, relays } = ensurePool();
  const results = new Map<string, ProfileMeta>();

  pool.request(relays, { kinds: [0], authors: pubkeys }).subscribe({
    next(evt: NostrEvent) {
      if (evt.kind !== 0) return;
      try {
        const content = JSON.parse(evt.content);
        const existing = results.get(evt.pubkey);
        // Keep the newest kind 0 per pubkey
        if (existing && evt.created_at <= (cache.get(evt.pubkey)?.fetchedAt ?? 0) / 1000) return;

        const profile: ProfileMeta = {
          pubkey: evt.pubkey,
          name: content.name || content.username || undefined,
          displayName: content.display_name || content.displayName || undefined,
          picture: content.picture || undefined,
          nip05: content.nip05 || undefined,
          about: content.about || undefined,
          fetchedAt: Date.now(),
        };
        results.set(evt.pubkey, profile);
        cache.set(evt.pubkey, profile);
      } catch {
        // Invalid JSON in kind 0 — skip
      }
    },
    complete() {
      // Resolve all waiting promises
      for (const pk of pubkeys) {
        const profile = results.get(pk) ?? null;
        // Even if null, mark as "we looked" so we don't re-fetch immediately
        if (!profile) {
          cache.set(pk, {
            pubkey: pk,
            fetchedAt: Date.now(),
          });
        }
        const cbs = resolvers.get(pk);
        if (cbs) {
          for (const cb of cbs) cb(profile);
        }
        inflight.delete(pk);
      }
    },
    error() {
      // On error, resolve with null
      for (const pk of pubkeys) {
        const cbs = resolvers.get(pk);
        if (cbs) {
          for (const cb of cbs) cb(null);
        }
        inflight.delete(pk);
      }
    },
  });
}

/** Fetch a profile, batching with other requests within a 30ms window. */
export function fetchProfile(pubkey: string): Promise<ProfileMeta | null> {
  // Check cache first
  const cached = getCachedProfile(pubkey);
  if (cached) return Promise.resolve(cached);

  // Check inflight
  const existing = inflight.get(pubkey);
  if (existing) return existing;

  const promise = new Promise<ProfileMeta | null>((resolve) => {
    const arr = batchResolvers.get(pubkey) ?? [];
    arr.push(resolve);
    batchResolvers.set(pubkey, arr);
  });

  inflight.set(pubkey, promise);
  batchQueue.push(pubkey);

  if (!batchTimer) {
    batchTimer = setTimeout(flushBatch, 30);
  }

  return promise;
}
