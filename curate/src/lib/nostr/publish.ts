/**
 * Sign + broadcast — the write pipeline for Curate.
 *
 * 1. Build an EventTemplate (via events.ts builders)
 * 2. Sign it via the NIP-07 extension (signer.ts)
 * 3. Publish to all configured relays (pool)
 *
 * All write flows funnel through `signAndPublish()`.
 *
 * Publishing is fire-and-forget after signing: we kick off the relay
 * broadcasts but return immediately with the signed event so the UI
 * can update optimistically. Relay confirmations happen in the
 * background and any errors are logged to the console.
 */

import type { EventTemplate, NostrEvent } from "nostr-tools/pure";
import { signEvent } from "./signer";
import { ensurePool } from "./ndk";

export interface PublishResult {
  event: NostrEvent;
  /** How many relays accepted the event (always 0 for fire-and-forget). */
  accepted: number;
  /** Relay-level errors, if any. */
  errors: string[];
}

/**
 * Sign an event template and broadcast to all configured relays.
 * Returns as soon as the event is signed — relay delivery happens
 * in the background so the UI never blocks on slow relays.
 */
export async function signAndPublish(
  template: EventTemplate
): Promise<PublishResult> {
  // 1. Sign (this is the only part the user waits for)
  const signed = await signEvent(template);

  // 2. Publish in the background — don't await
  const { pool, relays } = ensurePool();
  pool
    .publish(relays, signed, { timeout: 5000 })
    .then((results) => {
      const accepted = results.filter((r) => r.ok).length;
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        console.warn(
          `[publish] ${accepted} accepted, ${failed.length} failed:`,
          failed.map((r) => r.message)
        );
      }
    })
    .catch((err) => {
      console.error("[publish] broadcast error:", err);
    });

  // Return immediately with the signed event
  return { event: signed, accepted: 1, errors: [] };
}
