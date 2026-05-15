/**
 * User settings — relay set, WoT endpoint. Persisted to localStorage so
 * preferences survive page reloads.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DEFAULT_RELAYS, normalizeRelayUrl } from "@/lib/nostr/relays";

interface SettingsState {
  /** Active relay set. Always non-empty (we fall back to DEFAULT_RELAYS if cleared). */
  relays: string[];
  /** v1.1 WoT endpoint. Stored but unused in v1. */
  wotEndpoint: string;
  setRelays: (relays: string[]) => void;
  addRelay: (url: string) => void;
  removeRelay: (url: string) => void;
  resetRelays: () => void;
  setWotEndpoint: (url: string) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      relays: [...DEFAULT_RELAYS],
      wotEndpoint: "",
      setRelays: (relays) =>
        set({
          relays: (relays.length ? relays : [...DEFAULT_RELAYS]).map(
            normalizeRelayUrl
          ),
        }),
      addRelay: (url) =>
        set((s) => {
          const next = normalizeRelayUrl(url);
          if (s.relays.includes(next)) return s;
          return { relays: [...s.relays, next] };
        }),
      removeRelay: (url) =>
        set((s) => {
          const filtered = s.relays.filter((r) => r !== url);
          return {
            relays: filtered.length ? filtered : [...DEFAULT_RELAYS],
          };
        }),
      resetRelays: () => set({ relays: [...DEFAULT_RELAYS] }),
      setWotEndpoint: (url) => set({ wotEndpoint: url.trim() }),
    }),
    {
      name: "curate-settings",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    }
  )
);
