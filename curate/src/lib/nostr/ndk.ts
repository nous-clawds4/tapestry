/**
 * Relay pool singleton — one shared RelayPool instance, lazily created.
 *
 * Browser-only. We don't try to share connections across SSR/hydration
 * because relay sockets are inherently client-side state. Server-rendered
 * pages render skeletons; data arrives after hydration.
 *
 * Despite the filename (kept for import-path stability), this is now
 * powered by applesauce-relay instead of NDK.
 */

import { RelayPool } from "applesauce-relay";
import { DEFAULT_RELAYS } from "./relays";

let _pool: RelayPool | null = null;
let _relayUrls: string[] = [...DEFAULT_RELAYS];

export function getPool(): RelayPool {
  if (typeof window === "undefined") {
    throw new Error("getPool() can only be called in the browser");
  }
  if (!_pool) {
    _pool = new RelayPool();
  }
  return _pool;
}

/** Return the current relay URL set. */
export function getRelayUrls(): string[] {
  return _relayUrls;
}

/**
 * Ensure the pool exists. Returns the pool and the current relay URLs.
 * Replaces the old `ensureConnected()` — applesauce connects lazily
 * on first subscription, so there's nothing async to await.
 */
export function ensurePool(): { pool: RelayPool; relays: string[] } {
  return { pool: getPool(), relays: _relayUrls };
}

/** Swap the relay set at runtime. Called from settings. */
export function setRelayUrls(urls: string[]) {
  _relayUrls = urls;
  // Existing subscriptions keep running on their relays;
  // new subscriptions will pick up the updated URL list.
}
