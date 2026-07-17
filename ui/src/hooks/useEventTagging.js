import { useCallback } from 'react';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { assertSignerMatches } from '../utils/signerGuard';
import { publishOrThrow } from '../utils/publishProfileTag';
import notifyTagApplicability from '../utils/notifyTagApplicability';
// Single source of truth for the event-tagging wire shape + publish sequence:
// the dependency-free CJS core, imported through the Vite alias (see
// ui/vite.config.js). The hook never re-inlines the wire shape — it only
// supplies the browser deps (signer / transport / discovery / clock).
import { applyEventTagging } from '@tapestry/event-tagging';

// Canonical concept namespace — the ADR-0015 lineage literal (as in
// publishProfileTag.js / publishTagPin.js). This is the ONE sanctioned hardcode;
// the LOCAL namespace is always the RUNTIME TA from config, never a literal.
const LEGACY_TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const HEX64 = /^[0-9a-f]{64}$/;

// contextual-pins Story 3 — after a viewer tags an event, refresh THEIR pins so
// the newly-tagged note is folded into the TA-signed note TLs (kind-30393) the
// Pinned tab displays. Server-side recompute (no NIP-07 prompt); the
// for-viewer endpoint recomputes ALL of the viewer's pins, which satisfies the
// fan-out across coexisting neutral + context pins for free, and no-ops when the
// viewer has no pins. Debounced per viewer to coalesce rapid tag/untag bursts.
const _pinRefreshTimers = new Map();
const PIN_REFRESH_DEBOUNCE_MS = 1500;
function refreshViewerPinsDebounced(viewerPubkey) {
  if (!HEX64.test(viewerPubkey || '')) return;
  const existing = _pinRefreshTimers.get(viewerPubkey);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    _pinRefreshTimers.delete(viewerPubkey);
    fetch(
      `/api/trusted-list/refresh-pinned-tags-for-viewer?viewerPubkey=${encodeURIComponent(viewerPubkey)}`,
      { method: 'POST' }
    ).catch(() => { /* best-effort; the note appears on the next materialization */ });
  }, PIN_REFRESH_DEBOUNCE_MS);
  _pinRefreshTimers.set(viewerPubkey, timer);
}

/**
 * Story 5 — the client publish path for event-taggings. Exposes apply/dispute;
 * the core orchestrator decides the 1/2/3-publish sequence (existing header /
 * tag-without-header / brand-new tag), signs all, and publishes in order through
 * the guarded publishOrThrow (Story-2 local-only guard inherited).
 *
 * @returns {{ applyTag: Function, disputeTag: Function }}
 *   applyTag(tagInput, target)   — tagInput is { name, description } (new) or
 *   disputeTag(tagInput, target)   { authorPubkey, slug } (existing); target is
 *                                  { id } (kind-1 note) or { address } (a-coord).
 *   Resolves to { sequence, published, failedAt? }.
 */
export function useEventTagging() {
  const { taPubkey } = useConfig();
  // The signed-in session identity — used to guard against the extension's
  // active account having drifted away from it (see signerGuard.js).
  const { user } = useAuth();

  const run = useCallback(async (tagInput, target, polarity) => {
    if (!window.nostr) {
      throw new Error('No NIP-07 extension detected. Install one to apply tags.');
    }
    const asserterPubkey = await window.nostr.getPublicKey();
    // Refuse to publish as a different account than the one shown as signed in.
    assertSignerMatches(asserterPubkey, user?.pubkey);

    // Dual-z: canonical + the runtime local TA. A missing/malformed local TA is
    // non-fatal — the canonical z still ships (mirrors createTag / publishProfileTag).
    const taPubkeys = [LEGACY_TA_PUBKEY, ...(HEX64.test(taPubkey || '') ? [taPubkey] : [])];

    return applyEventTagging({
      tagInput,
      target,
      polarity,
      asserterPubkey,
      taPubkeys,
      deps: {
        // Story-4 read: which per-tag tagging headers already exist for this tag.
        findHeaders: async ({ tagAuthorPubkey, slug }) => {
          const params = new URLSearchParams({ tagAuthor: tagAuthorPubkey, slug });
          const r = await fetch(`/api/event-tags/headers-for-tag?${params}`);
          const j = await r.json().catch(() => ({}));
          return Array.isArray(j.headers) ? j.headers : [];
        },
        sign: (unsigned) => window.nostr.signEvent(unsigned),
        publish: publishOrThrow,
        now: () => Math.floor(Date.now() / 1000),
      },
    });
  }, [taPubkey, user?.pubkey]);

  const applyTag = useCallback(async (tagInput, target) => {
    const r = await run(tagInput, target, 1);
    // Creating a tag or first-applying it to an event may graduate it into the event
    // applicability list — nudge the server to republish (debounced + diff-guarded). ADR 0003.
    notifyTagApplicability();
    // Story 3 — keep the asserter's own pins of this tag current.
    refreshViewerPinsDebounced(user?.pubkey);
    return r;
  }, [run, user?.pubkey]);
  const disputeTag = useCallback(async (tagInput, target) => {
    const r = await run(tagInput, target, -1);
    // Story 3 — a dispute may drop the note from the pin's list; refresh too.
    refreshViewerPinsDebounced(user?.pubkey);
    return r;
  }, [run, user?.pubkey]);

  return { applyTag, disputeTag };
}
