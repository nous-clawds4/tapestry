"use client";

import { useEffect, useState } from "react";
import {
  streamItemCounts,
  type StreamingHandle,
} from "@/lib/nostr/subscriptions";

/**
 * Streams item counts per parent-list UUID.
 * Lightweight — only reads z-tags, doesn't parse full items.
 */
export function useItemCounts(): {
  counts: Map<string, number>;
  loading: boolean;
} {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let handle: StreamingHandle | null = null;

    handle = streamItemCounts({
      onUpdate: (c) => setCounts(c),
      onEose: () => setLoading(false),
    });

    return () => {
      handle?.stop();
    };
  }, []);

  return { counts, loading };
}
