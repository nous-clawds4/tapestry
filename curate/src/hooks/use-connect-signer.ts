"use client";

import { useCallback } from "react";
import {
  connectSigner,
  disconnectSigner,
  hasNip07,
} from "@/lib/nostr/signer";
import { useSigner } from "@/stores/signer";

export function useConnectSigner() {
  const status = useSigner((s) => s.status);
  const pubkey = useSigner((s) => s.pubkey);
  const setConnecting = useSigner((s) => s.setConnecting);
  const setConnected = useSigner((s) => s.setConnected);
  const setError = useSigner((s) => s.setError);
  const setDisconnected = useSigner((s) => s.setDisconnected);

  const connect = useCallback(async () => {
    setConnecting();
    try {
      if (!hasNip07()) {
        setError(
          "No nostr signer extension found. Install Alby, nos2x, or similar."
        );
        return;
      }
      const info = await connectSigner();
      setConnected(info.pubkey);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  }, [setConnecting, setConnected, setError]);

  const disconnect = useCallback(() => {
    disconnectSigner();
    setDisconnected();
  }, [setDisconnected]);

  return { status, pubkey, connect, disconnect };
}
