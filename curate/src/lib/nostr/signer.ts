/**
 * NIP-07 signer wrapper.
 *
 * Curate only writes when a browser-extension signer (Alby, nos2x, etc.)
 * is present. Read flows are unsigned and don't touch this file.
 *
 * Powered by applesauce-signers' ExtensionSigner (NIP-07 proxy).
 */

import { ExtensionSigner, ExtensionMissingError } from "applesauce-signers/signers/extension-signer";
import type { NostrEvent, EventTemplate } from "nostr-tools/pure";

export interface SignerInfo {
  pubkey: string;
}

let _signer: ExtensionSigner | null = null;

export function hasNip07(): boolean {
  return typeof window !== "undefined" && !!(window as unknown as { nostr?: unknown }).nostr;
}

/** Connect to the browser extension. Returns the user's pubkey.
 * Throws on cancellation or absence. */
export async function connectSigner(): Promise<SignerInfo> {
  if (!hasNip07()) {
    throw new Error(
      "No nostr signer extension found. Install Alby, nos2x, or similar to sign events."
    );
  }
  _signer = new ExtensionSigner();
  try {
    const pubkey = await _signer.getPublicKey();
    return { pubkey };
  } catch (err) {
    _signer = null;
    if (err instanceof ExtensionMissingError) {
      throw new Error("Nostr signer extension not available.");
    }
    throw err;
  }
}

export function disconnectSigner() {
  _signer = null;
}

/** Get the active signer, or null if not connected. */
export function getSigner(): ExtensionSigner | null {
  return _signer;
}

/** Sign an event template via the connected NIP-07 extension.
 * Throws if no signer is connected. */
export async function signEvent(template: EventTemplate): Promise<NostrEvent> {
  if (!_signer) {
    throw new Error("No signer connected. Please connect your nostr extension first.");
  }
  return _signer.signEvent(template);
}
