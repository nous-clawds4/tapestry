/**
 * Context-scoped pins — the portable spine (contextual-pins ADR 0001).
 *
 * Pure string/array composition, no imports, no I/O — the stack-agnostic core
 * a third-party client (e.g. the LFO team) can build its community feed against.
 * All relay scanning and POV/trust lookup is the caller's, injected via
 * `trustFilter`.
 *
 * Every composer takes the runtime Tapestry-Assistant pubkey (`taPubkey`) as a
 * PARAMETER — nothing is hardcoded (CLAUDE.md "Per-deployment TA pubkey — NEVER
 * hardcode"). Contexts are greenfield, so they use the RUNTIME TA, unlike the
 * legacy `tag-pinning` z (ADR event-tagging/0015).
 */

/**
 * The initial offered set of contexts. Product-config: a deployment may extend
 * or override this. Slugs only — contexts are addressed by a runtime-derived
 * concept handle (`contextHandle`), never by a copied event id.
 */
const KNOWN_CONTEXTS = [
  { slug: 'lfo', name: 'LFO' },
  { slug: 'tapestry-web-of-trust', name: 'Tapestry & Web of Trust' },
];

const KNOWN_CONTEXT_SLUGS = new Set(KNOWN_CONTEXTS.map((c) => c.slug));

/**
 * The single d-tag discriminator. Threaded (as a suffix) through all five pin/TL/
 * export d-tag schemes so a contextual pin gets a DISTINCT replaceable identity
 * from a neutral pin of the same (tag, author, viewer) — letting them coexist.
 *
 * Bare pins ⇒ empty string ⇒ their d-tags are byte-identical to today (no
 * migration). Context is the first — and, for v1, only — discriminator value;
 * future "other ways to pin the same tag" extend this one helper.
 */
function pinVariantKey({ contextSlug } = {}) {
  return contextSlug ? `-in-${contextSlug}` : '';
}

/**
 * The concept handle a contextual pin stamps as its second `z` — the kind-39998
 * firmware context concept, keyed by the deployment's RUNTIME TA.
 */
function contextHandle(taPubkey, contextSlug) {
  return `39998:${taPubkey}:${contextSlug}`;
}

/**
 * Recover a pin's context slug from its `z` STAMP (never by parsing the d-tag —
 * d-tags stay opaque). Matches a `39998:<taPubkey>:<slug>` z whose slug is a known
 * context. Matching against the known set is what disambiguates the context stamp
 * from the base `tag-pinning` z, which composes from the LEGACY pubkey — so even
 * on a deployment where the runtime TA coincides with the legacy literal, the
 * `tag-pinning` stamp is never misread as a context.
 *
 * @returns {string|null} the context slug, or null for a neutral pin.
 */
function contextSlugOfPin(pinEvent, taPubkey) {
  const prefix = `39998:${taPubkey}:`;
  for (const t of (pinEvent && pinEvent.tags) || []) {
    if (t[0] !== 'z' || typeof t[1] !== 'string') continue;
    if (!t[1].startsWith(prefix)) continue;
    const slug = t[1].slice(prefix.length);
    if (KNOWN_CONTEXT_SLUGS.has(slug)) return slug;
  }
  return null;
}

/**
 * Derive the display-ready set of pinned tags ("chips") from a collection of
 * pins already scoped to one context (the caller pre-filters by `#z`). Pure:
 *   - drop pins whose author fails the injected `trustFilter` (the POV gate);
 *   - de-duplicate by the pinned tag's a-coordinate (two people pinning the same
 *     tag → one chip);
 *   - return enough to display each: slug, author, a-coordinate.
 *
 * @param {Array<object>} pinEvents — raw kind-39999 pin events.
 * @param {{trustFilter?: (authorPubkey: string) => boolean}} [opts]
 * @returns {Array<{aCoord: string, tagSlug: string, tagAuthorPubkey: string}>}
 */
function contextPinsToTags(pinEvents, { trustFilter = () => true } = {}) {
  const byACoord = new Map();
  for (const ev of pinEvents || []) {
    if (!trustFilter(ev.pubkey)) continue;
    const aTag = (ev.tags || []).find((t) => t[0] === 'a' && typeof t[1] === 'string');
    if (!aTag) continue;
    const aCoord = aTag[1];
    if (byACoord.has(aCoord)) continue;
    const parts = aCoord.split(':');
    byACoord.set(aCoord, {
      aCoord,
      tagAuthorPubkey: parts[1] || '',
      tagSlug: parts[2] || '',
    });
  }
  return Array.from(byACoord.values());
}

module.exports = {
  KNOWN_CONTEXTS,
  pinVariantKey,
  contextHandle,
  contextSlugOfPin,
  contextPinsToTags,
};
