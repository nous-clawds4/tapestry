/**
 * High-level subscribe/fetch helpers. Wrap applesauce-relay's RelayPool
 * with the parsing + dedupe pipeline so callers get domain types directly.
 *
 * Uses request() for proper EOSE detection, but delivers results
 * progressively via micro-batching (50ms) so the UI renders instantly
 * as events arrive from the fastest relay.
 */

import type { NostrEvent } from "nostr-tools/pure";
import type { Subscription } from "rxjs";
import { ensurePool } from "./ndk";
import {
  dedupeHeaders,
  dedupeItems,
  parseListHeader,
  parseListItem,
} from "./parsers";
import type { ListHeader, ListItem } from "./types";

export interface StreamingHandle {
  stop(): void;
}

export interface ListsStreamHandlers {
  onUpdate: (headers: ListHeader[]) => void;
  onEose?: () => void;
}

/** Stream all list headers across the configured relay set.
 *  Delivers progressively as events arrive, fires onEose when all relays done. */
export function streamAllListHeaders(
  handlers: ListsStreamHandlers
): StreamingHandle {
  const { pool, relays } = ensurePool();
  const collected: ListHeader[] = [];
  const subs: Subscription[] = [];
  let stopped = false;
  let dirty = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    flushTimer = null;
    if (stopped || !dirty) return;
    dirty = false;
    handlers.onUpdate(dedupeHeaders(collected));
  };

  const scheduleFlush = () => {
    dirty = true;
    if (!flushTimer) flushTimer = setTimeout(flush, 50);
  };

  // request() completes on EOSE from all relays, but emits events as they arrive
  const reqSub = pool
    .request(relays, { kinds: [9998, 39998] })
    .subscribe({
      next(evt: NostrEvent) {
        if (stopped) return;
        const parsed = parseListHeader(evt);
        if (parsed) {
          collected.push(parsed);
          scheduleFlush();
        }
      },
      error(err) {
        console.error("streamAllListHeaders request error:", err);
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        flush();
        handlers.onEose?.();
      },
      complete() {
        if (stopped) return;
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        dirty = true;
        flush();
        handlers.onEose?.();

        // Phase 2: live subscription for real-time updates
        const liveSub = pool
          .subscription(relays, { kinds: [9998, 39998] })
          .subscribe({
            next(evt: NostrEvent) {
              if (stopped) return;
              const parsed = parseListHeader(evt);
              if (!parsed) return;
              const existing = collected.find((h) => h.uuid === parsed.uuid);
              if (existing && existing.createdAt >= parsed.createdAt) return;
              if (existing) {
                const idx = collected.indexOf(existing);
                collected[idx] = parsed;
              } else {
                collected.push(parsed);
              }
              handlers.onUpdate(dedupeHeaders(collected));
            },
          });
        subs.push(liveSub);
      },
    });
  subs.push(reqSub);

  return {
    stop() {
      stopped = true;
      if (flushTimer) clearTimeout(flushTimer);
      for (const s of subs) s.unsubscribe();
    },
  };
}

// ---- Lightweight item count streamer ----

export interface ItemCountsHandlers {
  onUpdate: (counts: Map<string, number>) => void;
  onEose?: () => void;
}

/**
 * Count items per parent-list UUID without fully parsing events.
 * Only extracts the `z` tag from each event — much lighter than streamListItems.
 */
export function streamItemCounts(
  handlers: ItemCountsHandlers
): StreamingHandle {
  const { pool, relays } = ensurePool();
  const counts = new Map<string, number>();
  const seen = new Set<string>(); // dedupe by event id
  const subs: Subscription[] = [];
  let stopped = false;
  let dirty = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    flushTimer = null;
    if (stopped || !dirty) return;
    dirty = false;
    handlers.onUpdate(new Map(counts));
  };

  const scheduleFlush = () => {
    dirty = true;
    if (!flushTimer) flushTimer = setTimeout(flush, 80);
  };

  const processEvent = (evt: NostrEvent) => {
    if (stopped) return;
    if (seen.has(evt.id)) return;
    seen.add(evt.id);

    // Extract z-tag values (parent list UUIDs)
    for (const tag of evt.tags) {
      if (tag[0] === "z" && tag[1]) {
        counts.set(tag[1], (counts.get(tag[1]) ?? 0) + 1);
      }
    }
    scheduleFlush();
  };

  const reqSub = pool
    .request(relays, { kinds: [9999, 39999] })
    .subscribe({
      next: processEvent,
      error(err) {
        console.error("streamItemCounts request error:", err);
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        flush();
        handlers.onEose?.();
      },
      complete() {
        if (stopped) return;
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        dirty = true;
        flush();
        handlers.onEose?.();

        // Live updates
        const liveSub = pool
          .subscription(relays, { kinds: [9999, 39999] })
          .subscribe({ next: processEvent });
        subs.push(liveSub);
      },
    });
  subs.push(reqSub);

  return {
    stop() {
      stopped = true;
      if (flushTimer) clearTimeout(flushTimer);
      for (const s of subs) s.unsubscribe();
    },
  };
}

export interface ItemsStreamHandlers {
  onUpdate: (items: ListItem[]) => void;
  onEose?: () => void;
}

/** Stream items for one or more parent list UUIDs.
 *  Delivers progressively, fires onEose when all relays done. */
export function streamListItems(
  parentListUuids: string[],
  handlers: ItemsStreamHandlers
): StreamingHandle {
  const { pool, relays } = ensurePool();
  const collected: ListItem[] = [];
  const subs: Subscription[] = [];
  let stopped = false;
  let dirty = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    flushTimer = null;
    if (stopped || !dirty) return;
    dirty = false;
    handlers.onUpdate(dedupeItems(collected));
  };

  const scheduleFlush = () => {
    dirty = true;
    if (!flushTimer) flushTimer = setTimeout(flush, 50);
  };

  const reqSub = pool
    .request(relays, { kinds: [9999, 39999], "#z": parentListUuids })
    .subscribe({
      next(evt: NostrEvent) {
        if (stopped) return;
        const parsed = parseListItem(evt);
        if (parsed) {
          collected.push(parsed);
          scheduleFlush();
        }
      },
      error(err) {
        console.error("streamListItems request error:", err);
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        flush();
        handlers.onEose?.();
      },
      complete() {
        if (stopped) return;
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
        dirty = true;
        flush();
        handlers.onEose?.();

        // Live updates
        const liveSub = pool
          .subscription(relays, { kinds: [9999, 39999], "#z": parentListUuids })
          .subscribe({
            next(evt: NostrEvent) {
              if (stopped) return;
              const parsed = parseListItem(evt);
              if (!parsed) return;
              const existing = collected.find((it) => it.uuid === parsed.uuid);
              if (existing && existing.createdAt >= parsed.createdAt) return;
              if (existing) {
                const idx = collected.indexOf(existing);
                collected[idx] = parsed;
              } else {
                collected.push(parsed);
              }
              handlers.onUpdate(dedupeItems(collected));
            },
          });
        subs.push(liveSub);
      },
    });
  subs.push(reqSub);

  return {
    stop() {
      stopped = true;
      if (flushTimer) clearTimeout(flushTimer);
      for (const s of subs) s.unsubscribe();
    },
  };
}
