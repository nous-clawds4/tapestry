"use client";

/**
 * useDiscover — streams all list headers (kind 9998/39998) across the
 * configured relay set. Item counts are loaded lazily per-list on the
 * detail page, NOT globally here — that was causing multi-second loads.
 */

import { useEffect, useState } from "react";
import {
  streamAllListHeaders,
  type StreamingHandle,
} from "@/lib/nostr/subscriptions";
import type { ListHeader } from "@/lib/nostr/types";

export interface UseDiscoverResult {
  headers: ListHeader[];
  loading: boolean;
}

export function useDiscover(): UseDiscoverResult {
  const [headers, setHeaders] = useState<ListHeader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let handle: StreamingHandle | null = null;

    handle = streamAllListHeaders({
      onUpdate: (h) => setHeaders(h),
      onEose: () => setLoading(false),
    });

    return () => {
      handle?.stop();
    };
  }, []);

  return { headers, loading };
}
