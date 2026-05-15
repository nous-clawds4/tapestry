"use client";

import { useEffect, useState } from "react";
import {
  fetchProfile,
  getCachedProfile,
  type ProfileMeta,
} from "@/lib/nostr/profiles";

/**
 * Hook to fetch and cache profile metadata for a pubkey.
 * Returns the profile (or null while loading).
 */
export function useProfile(pubkey: string | undefined): ProfileMeta | null {
  const [profile, setProfile] = useState<ProfileMeta | null>(() => {
    if (!pubkey) return null;
    return getCachedProfile(pubkey) ?? null;
  });

  useEffect(() => {
    if (!pubkey) {
      setProfile(null);
      return;
    }

    // Check cache synchronously
    const cached = getCachedProfile(pubkey);
    if (cached) {
      setProfile(cached);
      return;
    }

    let cancelled = false;
    fetchProfile(pubkey).then((p) => {
      if (!cancelled) setProfile(p);
    });

    return () => {
      cancelled = true;
    };
  }, [pubkey]);

  return profile;
}
