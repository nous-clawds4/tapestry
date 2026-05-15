/**
 * Signed-in user state — pubkey of the currently connected NIP-07 signer.
 *
 * We persist the *intent* to be connected (the last successful pubkey) so
 * subsequent page loads can offer a quick reconnect, but the signer itself
 * lives only in-memory until the user re-confirms via the extension.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type SignerStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

interface SignerState {
  pubkey: string | null;
  status: SignerStatus;
  error: string | null;
  setConnecting: () => void;
  setConnected: (pubkey: string) => void;
  setError: (message: string) => void;
  setDisconnected: () => void;
}

export const useSigner = create<SignerState>()(
  persist(
    (set) => ({
      pubkey: null,
      status: "disconnected",
      error: null,
      setConnecting: () => set({ status: "connecting", error: null }),
      setConnected: (pubkey) =>
        set({ pubkey, status: "connected", error: null }),
      setError: (message) => set({ status: "error", error: message }),
      setDisconnected: () =>
        set({ pubkey: null, status: "disconnected", error: null }),
    }),
    {
      name: "curate-signer",
      storage: createJSONStorage(() => localStorage),
      // Only persist the last-known pubkey; status always resets on load.
      partialize: (s) => ({ pubkey: s.pubkey }),
      version: 1,
    }
  )
);
