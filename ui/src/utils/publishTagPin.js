import { nip19 } from 'nostr-tools';
import { publishOrThrow } from './publishProfileTag';
import { publishEverywhere, fetchFromRelays, PUBLISH_RELAYS } from './nostrPublish';

// Story 19 / ADR 0017 Amendment III — publish targets for the
// kind-30000 export. The user's own write relays (per NIP-07 /
// NIP-65) ARE the canonical place readers find their events, but
// many users haven't populated either; co-publishing to a curated
// set of well-known public relays guarantees baseline discoverability
// for the public follow-set we're publishing. Public list, public
// relays — no identity-leak concern.
export const WELL_KNOWN_FALLBACK_RELAYS = PUBLISH_RELAYS;

/**
 * Single source of truth for the tag-pinning wire shape from ADR 0009.
 *
 * Used by:
 *   - Tag page (Story 10) — header Pin / Unpin affordance.
 *   - Story 12 — CurationMethodDialog (custom curation values).
 *
 * The wire layout lives in one place here so future changes to the
 * pin event's tags / content body only touch this file.
 *
 * The z-tag is composed from LEGACY_TA_PUBKEY (a hardcoded literal),
 * not from the deployment's runtime TA pubkey — see ADR 0015. This
 * preserves visibility of historical pin events on non-dev
 * deployments. The runtime TA pubkey continues to be the right value
 * for every OTHER use (signer reads, kind-30392 author filtering on
 * the server side); only z-tag composition uses the legacy literal.
 */

/**
 * Legacy z-tag-composition pubkey — see ADR 0015.
 *
 * Used only for composing the kind-39999 `z` tag handle that
 * historical pin events reference. NOT to be confused with the
 * deployment's runtime TA pubkey (`useConfig().taPubkey`), which
 * is correct for any OTHER use of "the TA pubkey" but, by
 * deliberate design, is NOT used here.
 *
 * Mirrors the same pattern in `useProfileTags.js` and
 * `publishProfileTag.js` (sibling client publishers for the other
 * two z-tag namespaces).
 */
const LEGACY_TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_PINNING_HANDLE = `39998:${LEGACY_TA_PUBKEY}:tag-pinning`;

/**
 * Compose the kind-39999 pin event's `d`-tag identifier. This is the
 * tag the *viewer* writes onto their own pin event so that re-pinning
 * the same tag replaces the prior pin (parameterized replaceable).
 *
 * NOT the URL slug — see `computeTLDTag()` for the kind-30392 TL
 * identifier the `/pin/:dTag` route navigates to.
 */
export function computePinEventDTag({ tagSlug, tagAuthorPubkey, viewerPubkey }) {
  return `tag-pin-${tagSlug}-${tagAuthorPubkey.slice(0, 8)}-${viewerPubkey.slice(0, 8)}`;
}

/**
 * Compose the kind-30392 Trusted List event's `d`-tag identifier — the
 * one the TA writes when materializing a pin into a published TL, and
 * the one the `/pin/:dTag` route in `PinDetail.jsx` uses to address it.
 *
 * Server source of truth: `src/api/trustedList/refreshPinnedTags.js`
 * (`computeTLDTag()` at :67). This client helper mirrors that exact
 * formula. If the server formula changes, update this one in lockstep.
 *
 * `observer` is the curation-method's observer pubkey (defaults to
 * the viewer's own pubkey via `defaultCurationMethod()`).
 */
export function computeTLDTag({ observer, tagAuthorPubkey, tagSlug }) {
  return `tl-pin-${observer.slice(0, 8)}-${tagAuthorPubkey.slice(0, 8)}-${tagSlug}`;
}

/**
 * Default curation-method payload.
 *
 * Story 17 flipped cutoff 2→1 (WYSIWYG with Curated view) and
 * includeScoreInTL false→true (richer TLs by default).
 */
export function defaultCurationMethod(viewerPubkey) {
  return {
    observer: viewerPubkey,
    method: 'nip85:rank',
    cutoff: 1,
    includeScoreInTL: true,
  };
}

/**
 * Build, sign, and publish a kind-39999 tag-pinning event for one tag.
 *
 * @param {object} args
 * @param {{eventId: string, slug: string, authorPubkey: string}} args.tag —
 *   the tag being pinned. `authorPubkey` is the tag-event's publisher
 *   (used in the d-tag and a-tag).
 * @param {object} [args.curationMethod] — optional override; defaults to
 *   `defaultCurationMethod(viewerPubkey)`.
 * @returns {Promise<object>} the signed Pin event.
 */
export async function pinTag({ tag, curationMethod }) {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension detected. Install one to pin tags.');
  }
  const authorPk = await window.nostr.getPublicKey();
  const curation = curationMethod || defaultCurationMethod(authorPk);
  const dTag = computePinEventDTag({
    tagSlug: tag.slug,
    tagAuthorPubkey: tag.authorPubkey,
    viewerPubkey: authorPk,
  });
  const unsigned = {
    kind: 39999,
    pubkey: authorPk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['d', dTag],
      ['e', tag.eventId],
      ['a', `39999:${tag.authorPubkey}:${tag.slug}`],
      ['z', TAG_PINNING_HANDLE],
      ['curation-method', JSON.stringify(curation)],
    ],
    content: JSON.stringify({
      tagPinning: { tagEventId: tag.eventId, curationMethod: curation },
    }),
  };
  const signed = await window.nostr.signEvent(unsigned);
  await publishOrThrow(signed);
  return signed;
}

/**
 * Story 19 / ADR 0017 Amendment II §II-2 (updated 2026-05-28) —
 * read the logged-in user's NIP-65 write-relay list with a two-step
 * fallback:
 *
 *   1. Try `window.nostr.getRelays()` (NIP-07 extension's local
 *      relay config). Fastest path; works when the user has
 *      populated their extension's relay settings.
 *   2. If that returns nothing, fetch the user's latest kind-10002
 *      from PUBLISH_RELAYS via fetchFromRelays. This is the
 *      authoritative source for nostr-wide identity (other clients
 *      read it to find where the user publishes), so even users
 *      with empty extension relay configs but a live published
 *      kind 10002 still get the right answer.
 *
 * Returns []:
 *   - extension is absent;
 *   - getRelays() returns nothing AND the fallback fetch finds no
 *     kind 10002.
 *
 * Callers treat [] as the "no NIP-65 relay list" fallback (the
 * kind-30000 is published to local strfry only and the UI surfaces
 * the warning).
 */
export async function fetchUserWriteRelays() {
  // Step 1: NIP-07 getRelays() — extension's local relay config.
  const fromExtension = await fetchWriteRelaysFromNip07();
  if (fromExtension.length > 0) return fromExtension;

  // Step 2: fallback — fetch the user's latest kind-10002 from
  // PUBLISH_RELAYS. Requires the extension to give us the user's
  // pubkey first.
  if (!window.nostr?.getPublicKey) return [];
  let pubkey;
  try { pubkey = await window.nostr.getPublicKey(); }
  catch { return []; }
  if (!pubkey) return [];

  return await fetchWriteRelaysFromKind10002(pubkey);
}

/** Parse NIP-07 getRelays() output → write-eligible URLs. */
async function fetchWriteRelaysFromNip07() {
  if (!window.nostr?.getRelays) return [];
  try {
    const relays = await window.nostr.getRelays();
    if (!relays || typeof relays !== 'object') return [];
    return Object.entries(relays)
      .filter(([, meta]) => meta && meta.write !== false)
      .map(([url]) => url);
  } catch {
    return [];
  }
}

/** Fetch the user's latest kind-10002 from PUBLISH_RELAYS and
 *  extract write-eligible r-tag URLs. */
async function fetchWriteRelaysFromKind10002(pubkey) {
  let events;
  try {
    events = await fetchFromRelays({ kinds: [10002], authors: [pubkey] });
  } catch {
    return [];
  }
  if (!Array.isArray(events) || events.length === 0) return [];
  events.sort((a, b) => b.created_at - a.created_at);
  const latest = events[0];
  const writeRelays = [];
  for (const t of (latest.tags || [])) {
    if (t[0] !== 'r' || typeof t[1] !== 'string' || !t[1]) continue;
    const marker = t[2];
    if (marker === 'read') continue;
    writeRelays.push(t[1]);
  }
  return writeRelays;
}

/**
 * Story 19 / ADR 0017: prepare + sign + publish a kind-30000 NIP-51
 * follow-set export for a pinned tag.
 *
 * Flow per ADR (with Amendment II layering):
 *   1. POST /api/trusted-list/prepare-nip51-export with { pinEventId,
 *      title? }. Server resolves the d-tag, reads current kind-30392
 *      membership, returns { unsigned, dTag, memberCount }.
 *   2. Read the user's NIP-65 write relays client-side (caller-provided
 *      or via fetchUserWriteRelays — NIP-07 `getRelays()`).
 *   3. NIP-07 sign the unsigned template.
 *   4. Publish via publishEverywhere(signed, writeRelays) so the event
 *      lands on local strfry AND on the user's own write relays (other
 *      nostr clients can find it on the user's identity).
 *   5. Compose the naddr client-side via nip19.naddrEncode using the
 *      user's write relays.
 *
 * @param {object} args
 * @param {string} args.pinEventId
 * @param {string} [args.title]
 * @param {string[]} [args.writeRelays] — if omitted, calls fetchUserWriteRelays.
 * @param {number} [args.kind=30000] — 30000 (Follow Set) or 39089 (Follow
 *   Pack / NIP-51 "starter pack"). Both carry the same membership; only
 *   the published event kind (and the encoded naddr) differ.
 *
 * Returns { signed, naddr, writeRelays, dTag, memberCount }.
 */
export async function publishNip51ExportForPin({ pinEventId, title, writeRelays, kind = 30000 } = {}) {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension detected. Install one to export lists.');
  }
  const prepareResp = await fetch('/api/trusted-list/prepare-nip51-export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinEventId, title, kind }),
  });
  const prepareData = await prepareResp.json().catch(() => null);
  if (!prepareResp.ok || !prepareData?.success) {
    throw new Error(prepareData?.error || `prepare-nip51-export failed: status ${prepareResp.status}`);
  }
  const { unsigned, dTag, memberCount } = prepareData;

  const userWriteRelays = Array.isArray(writeRelays)
    ? writeRelays
    : await fetchUserWriteRelays();

  // Amendment III: ALWAYS publish to PUBLISH_RELAYS too, so the
  // event is discoverable on a curated set of well-known relays even
  // if the user's own list is empty or unusual. Dedupe to avoid
  // double-publishing if the user's NIP-65 already includes any of
  // PUBLISH_RELAYS.
  const publishRelays = Array.from(new Set([...userWriteRelays, ...WELL_KNOWN_FALLBACK_RELAYS]));

  const signed = await window.nostr.signEvent(unsigned);

  // Publish to local strfry + the union of user + well-known relays.
  const result = await publishEverywhere(signed, publishRelays);
  const localOk = result?.local?.success;
  const externalOk = (result?.external?.successes?.length || 0) > 0;
  if (!localOk && !externalOk) {
    throw new Error(result?.local?.error || 'Publish failed on every relay.');
  }

  // Compose naddr client-side. Include the user's own relays so the
  // event renders under their identity in recipient clients; include
  // well-known too so recipients can locate it anywhere.
  const naddr = nip19.naddrEncode({
    kind,
    pubkey: signed.pubkey,
    identifier: dTag,
    relays: publishRelays,
  });

  return {
    signed, naddr, dTag, memberCount,
    writeRelays: userWriteRelays,     // user's own (for UI display)
    publishRelays,                     // actual final target set (deduped)
  };
}

/**
 * Build, sign, and publish a NIP-09 kind-5 deletion targeting a Pin event.
 *
 * @param {object} args
 * @param {string} args.pinEventId — the id of the Pin event to retract.
 * @returns {Promise<object>} the signed deletion event.
 */
export async function unpinTag({ pinEventId }) {
  if (!window.nostr) {
    throw new Error('No NIP-07 extension detected.');
  }
  const authorPk = await window.nostr.getPublicKey();
  const unsigned = {
    kind: 5,
    pubkey: authorPk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['e', pinEventId]],
    content: 'unpinned',
  };
  const signed = await window.nostr.signEvent(unsigned);
  await publishOrThrow(signed);
  return signed;
}

/**
 * Story 21 / ADR 0019 — keep a pinned tag's exports current after the
 * viewer Applies/Disputes that tag (or reconfigures its curation).
 *
 * Called from BOTH assertion entry points (Tag.jsx handlers and
 * useProfileTags applyTag/disputeTag). It:
 *   1. Finds the viewer's pin matching the asserted tag by its stable
 *      (authorPubkey, slug) identity. No matching pin → no-op (AC-16).
 *   2. Recomputes the TA-signed kind-30392 (silent server call).
 *   3. Re-publishes the user-signed kind-30000 ONLY when an export
 *      footprint already exists (nip51ExportStatus.status !==
 *      'never-exported') — this is the one step that needs a NIP-07
 *      prompt (AC-12/13). Never-exported pins recompute only, no prompt
 *      (AC-15).
 *
 * Rapid taggings for the same pin are coalesced by a trailing debounce
 * keyed on pinEventId (Open Q1).
 *
 * @param {object} args
 * @param {{authorPubkey: string, slug: string}} args.tag
 * @param {string} args.viewerPubkey
 * @param {object} [args.knownPinRow] — a full /pins row (with
 *   nip51ExportStatus) if the caller already has it; otherwise we fetch.
 * @param {(state: 'changed'|'exporting'|'idle'|'declined') => void} [args.onProgress]
 */
const REEXPORT_DEBOUNCE_MS = 2000;
const _reexportTimers = new Map();

export async function syncPinnedExportsForTag({ tag, viewerPubkey, knownPinRow, onProgress } = {}) {
  if (!tag || !viewerPubkey || !tag.slug) return;

  // 1. Resolve the matching pin row.
  let pinRow = knownPinRow && knownPinRow.nip51ExportStatus ? knownPinRow : null;
  if (!pinRow) {
    try {
      const r = await fetch(`/api/profile-tags/pins?viewerPubkey=${encodeURIComponent(viewerPubkey)}`);
      const j = await r.json();
      pinRow = (j?.pins || []).find(
        (p) => p.tag?.slug === tag.slug && p.tag?.authorPubkey === tag.authorPubkey
      ) || null;
    } catch {
      return; // can't resolve — best-effort, give up quietly
    }
  }
  if (!pinRow || !pinRow.pinEventId) return; // AC-16: tag not pinned by viewer

  // 2. Debounce per pin: coalesce rapid Apply/Dispute bursts into one run.
  const pinEventId = pinRow.pinEventId;
  const existing = _reexportTimers.get(pinEventId);
  if (existing) { clearTimeout(existing.timer); existing.resolve?.(); }

  return new Promise((resolve) => {
    const timer = setTimeout(async () => {
      _reexportTimers.delete(pinEventId);
      try { await runReexportForPin(pinRow, onProgress); } finally { resolve(); }
    }, REEXPORT_DEBOUNCE_MS);
    _reexportTimers.set(pinEventId, { timer, resolve });
  });
}

/** Recompute the kind-30392, then re-export the kind-30000 if a footprint
 *  exists. Reflects the just-published assertion because prepare-nip51-export
 *  reads the *current* kind-30392 (recomputed in step 1 first). */
async function runReexportForPin(pinRow, onProgress) {
  const pinEventId = pinRow.pinEventId;
  onProgress?.('changed');

  // Step 1: recompute the TA-signed kind-30392 (silent).
  try {
    await fetch('/api/trusted-list/refresh-pinned-tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinEventId }),
    });
  } catch { /* best-effort; cron remains the backstop */ }

  // Step 2: re-export the user-signed kind-30000 only if one already exists.
  // NOTE (Story 22 / ADR 0020): the kind-39089 Follow Pack is deliberately
  // NOT re-exported here. Packs are explicit point-in-time snapshots — auto-
  // re-signing one on every re-tag would mean a NIP-07 prompt per assertion.
  // Drift is surfaced honestly via followPackStatus instead (PinnedListPanel).
  const status = pinRow.nip51ExportStatus?.status;
  if (status && status !== 'never-exported') {
    onProgress?.('exporting');
    try {
      await publishNip51ExportForPin({
        pinEventId,
        title: pinRow.nip51ExportStatus?.currentTitle || undefined,
      });
      onProgress?.('idle');
    } catch {
      // User declined the NIP-07 prompt (or publish failed): the 30392
      // update stands; the 30000 is now stale → surfaced as out-of-sync.
      onProgress?.('declined');
    }
  } else {
    onProgress?.('idle');
  }
}
