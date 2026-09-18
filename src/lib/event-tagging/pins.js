/**
 * Context-scoped pins — the portable spine (contextual-pins ADR 0001).
 *
 * Pure string/array composition, no I/O (the only import is the equally pure
 * sibling `handles.js`) — the stack-agnostic core
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
const { conceptTrustedList, tlHeaderAddr } = require('./handles');
const { slug: canonicalSlug } = require('./slug');

const KNOWN_CONTEXTS = [
  { slug: 'lfo', name: 'LFO' },
  { slug: 'tapestry-web-of-trust', name: 'Tapestry & Web of Trust' },
];

const KNOWN_CONTEXT_SLUGS = new Set(KNOWN_CONTEXTS.map((c) => c.slug));

/**
 * search-index-selection ADR 0003 §1 — the variant slug bound. The pin `d`
 * already carries the tag slug plus two 8-char prefixes; 40 keeps the worst
 * realistic address comfortably under ~120 bytes while leaving room for a
 * memorable name. Enforced client-side, PRE-SIGNATURE (`validateVariantSlug`).
 */
const VARIANT_SLUG_MAX = 40;

/**
 * The single d-tag discriminator. Threaded (as a suffix) through all five pin/TL/
 * export d-tag schemes so a contextual pin gets a DISTINCT replaceable identity
 * from a neutral pin of the same (tag, author, viewer) — letting them coexist.
 *
 * Bare pins ⇒ empty string ⇒ their d-tags are byte-identical to today (no
 * migration). search-index-selection ADR 0003 §1 generalises the helper the
 * contextual-pins ADR wrote it to be: a PLACE (a community context) keys on
 * `-in-<ctx>`, exactly as before; a RECIPE (an arbitrary named curation) keys on
 * `-v-<slug>`. The two members are MUTUALLY EXCLUSIVE and the variant wins when
 * both are somehow present, matching `variantOfPin`'s precedence — so a reader
 * can never compute an address the publisher did not (E3).
 */
function pinVariantKey({ contextSlug, variantSlug } = {}) {
  if (variantSlug) return `-v-${variantSlug}`;   // a recipe
  if (contextSlug) return `-in-${contextSlug}`;  // a place — byte-identical to today
  return '';                                     // neutral — byte-identical to today
}

/**
 * The concept handle a contextual pin stamps as its second `z` — the kind-39998
 * firmware context concept, keyed by the deployment's RUNTIME TA.
 */
function contextHandle(taPubkey, contextSlug) {
  return `39998:${taPubkey}:${contextSlug}`;
}

/**
 * The Trusted List `d`-tags a pin materializes — the SINGLE source of both
 * strings (ADR feat-tags-modernization/0001 §2/§5). The server runner
 * (`refreshPinnedTags.js`) and the client publisher (`publishTagPin.js`) both
 * delegate here, so the two cannot drift apart again (they did, across the
 * step-1 merge).
 *
 * `contextSlug` is an OPTIONAL trailing member: omitting it (a neutral pin)
 * reproduces the pre-context string byte-for-byte.
 */
function tlDTag({ observer, tagAuthorPubkey, tagSlug, contextSlug, variantSlug }) {
  return `tl-pin-${observer.slice(0, 8)}-${tagAuthorPubkey.slice(0, 8)}-${tagSlug}${pinVariantKey({ contextSlug, variantSlug })}`;
}

/** The note twin of `tlDTag` (kind-30393 note Trusted List). Same rules. */
function noteTlDTag({ observer, tagAuthorPubkey, tagSlug, contextSlug, variantSlug }) {
  return `tl-pin-notes-${observer.slice(0, 8)}-${tagAuthorPubkey.slice(0, 8)}-${tagSlug}${pinVariantKey({ contextSlug, variantSlug })}`;
}

/** The item twin of `tlDTag` (kind-30394 addressable-item Trusted List). Same rules. */
function itemTlDTag({ observer, tagAuthorPubkey, tagSlug, contextSlug, variantSlug }) {
  return `tl-pin-items-${observer.slice(0, 8)}-${tagAuthorPubkey.slice(0, 8)}-${tagSlug}${pinVariantKey({ contextSlug, variantSlug })}`;
}

/**
 * ADR dlist-item-tagging/0002 — the two `z` tags EVERY Trusted List in the 3039x
 * family carries: the concept `z` ("I am a Trusted List", a deployment-wide
 * discovery axis and the federation seam) and a membership claim on the tag's
 * per-tag Trusted-List header. One composer for all three runners, so the pair
 * cannot drift across call sites.
 */
function trustedListZTags({ taPubkey, tagSlug }) {
  return [
    ['z', conceptTrustedList(taPubkey)],
    ['z', tlHeaderAddr(taPubkey, tagSlug)],
  ];
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
 * search-index-selection ADR 0003 §1 — the pin's VARIANT: the generalisation of
 * the context, and the single reader every address composer keys off.
 *
 * A pin is a PLACE (a community context, stamped as a `z`) or a RECIPE (an
 * arbitrary named curation, carried in its own `['variant', '<slug>']` tag) or
 * neither — never both. The CARRIER decides the kind, not membership in a
 * deployment-local set, so extending `KNOWN_CONTEXTS` tomorrow can never move an
 * already-published recipe's address or start emitting a community claim it did
 * not make (E2). The variant tag wins over a stray context `z` (E3), matching
 * `pinVariantKey`'s precedence.
 *
 * Legacy pins carry no `variant` tag and derive through `contextSlugOfPin`
 * exactly as before — no back-fill, no address moves (ADR §7).
 *
 * @returns {{kind: 'context'|'recipe'|null, slug: string|null}}
 */
function variantOfPin(pinEvent, taPubkey) {
  const v = ((pinEvent && pinEvent.tags) || [])
    .find((t) => t[0] === 'variant' && typeof t[1] === 'string' && t[1]);
  if (v) return { kind: 'recipe', slug: v[1] };
  const ctx = contextSlugOfPin(pinEvent, taPubkey);
  if (ctx) return { kind: 'context', slug: ctx };
  return { kind: null, slug: null };
}

/**
 * Adapter: a `variantOfPin` result → the members `pinVariantKey` (and therefore
 * every composer) takes. Exported so no call site re-writes the ternary.
 */
function variantKeyArgs(variant) {
  const kind = variant && variant.kind;
  const slug = (variant && variant.slug) || null;
  return {
    contextSlug: kind === 'context' ? slug : null,
    variantSlug: kind === 'recipe' ? slug : null,
  };
}

/**
 * search-index-selection ADR 0003 §3 — the PRE-SIGNATURE house rule for naming a
 * recipe. This is the only guard that prevents the replaceable-event stomp: two
 * pins sharing a variant slug share an address, so the second silently REPLACES
 * the first (pin and derived lists together) and no server check can see it.
 *
 * Pure and shared so the rule has exactly one home: the create dialog renders
 * `error` inline and signs nothing on `ok: false`.
 *
 * @param {{name: string, existing?: Array<{kind: string|null, slug: string|null}>}} args
 *   `existing` is the viewer's other pins of THIS tag, as `variantOfPin` outputs.
 * @returns {{ok: true, slug: string}
 *          |{ok: false, reason: 'empty'|'too-long'|'known-context'|'in-use', error: string}}
 */
function validateVariantSlug({ name, existing = [] } = {}) {
  const candidate = canonicalSlug(name == null ? '' : name);
  if (!candidate) {
    return {
      ok: false,
      reason: 'empty',
      error: 'Enter a name that contains at least one letter or number.',
    };
  }
  if (candidate.length > VARIANT_SLUG_MAX) {
    return {
      ok: false,
      reason: 'too-long',
      error: `That name is too long: "${candidate}" is ${candidate.length} characters and the limit is ${VARIANT_SLUG_MAX}.`,
    };
  }
  if (KNOWN_CONTEXT_SLUGS.has(candidate)) {
    // Refused, never silently promoted to a context — that would publish a
    // community claim the curator did not make (ADR §1).
    return {
      ok: false,
      reason: 'known-context',
      error: `"${candidate}" names a community. Pin to a community from "Pin to a community" instead, or choose another name.`,
    };
  }
  const clash = (existing || []).find((v) => v && v.slug && v.slug === candidate);
  if (clash) {
    return {
      ok: false,
      reason: 'in-use',
      error: clash.kind === 'context'
        ? `You already have a pin of this tag in "${clash.slug}". Choose another name.`
        : `You already have a curation named "${clash.slug}" for this tag. Choose another name.`,
    };
  }
  return { ok: true, slug: candidate };
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

/**
 * search-index-selection ADR 0001 — the pin's author constraint.
 *
 * A pin's `curationMethod` may carry `authorConstraint`, narrowing WHOSE
 * assertions its Trusted List folds in. The vocabulary is CLOSED and
 * case-exact; absent means unconstrained (today's POV behaviour, byte for
 * byte), and an unknown value fails OPEN to unconstrained — an old reader
 * meeting a rung-2 value reads today's list rather than silently publishing a
 * narrower one under a guarantee it did not compute.
 *
 * Rung 2 (`author ∈ <list>`) extends this constant and `authorPredicateFor`;
 * nothing else moves.
 */
const AUTHOR_CONSTRAINTS = ['observer'];

/** Is `v` a constraint value THIS build knows how to apply? (Closed, case-exact.) */
function isKnownAuthorConstraint(v) {
  return typeof v === 'string' && AUTHOR_CONSTRAINTS.includes(v);
}

/** A 64-char lowercase-hex pubkey — the only observer we will compare against. */
function isHexPubkey(v) {
  return typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
}

/**
 * Compose the pin's author constraint into this POV's trust verdict.
 *
 * - `'observer'` + a hex observer ⇒ `(pk) => pk === observer`. The constraint
 *   REPLACES the POV predicate rather than intersecting it, so the observer's
 *   own taggings count regardless of their own rank, and a GrapeRank-trusted
 *   third party is excluded.
 * - `'observer'` + a non-hex observer ⇒ deny everyone. Unreachable through the
 *   runners (they bail on a malformed observer first), but "deny" is the safe
 *   corner — never "everyone".
 * - absent or unknown ⇒ `isAsserterTrusted` unchanged (`() => true` when none
 *   was given: the existing no-POV "everyone counts" semantic).
 */
function authorPredicateFor({ authorConstraint, observer, isAsserterTrusted } = {}) {
  const base = typeof isAsserterTrusted === 'function' ? isAsserterTrusted : () => true;
  if (!isKnownAuthorConstraint(authorConstraint)) return base;
  if (!isHexPubkey(observer)) return () => false;
  return (pk) => pk === observer;
}

/**
 * The weight twin of `authorPredicateFor` (operator ruling 2026-09-18, AC-7).
 *
 * Under the constraint the observer's own weight is 1.0 — "I am certain about
 * my own taggings" — so the weighted membership methods (`input` / `certainty`)
 * do not publish an empty list for want of a `wot_rank_<suffix>` doc. Absent or
 * unknown constraint ⇒ today's weight function, untouched (no carve-out for a
 * constraint that was not applied).
 */
function authorWeightFor({ authorConstraint, observer, authorWeight } = {}) {
  const base = typeof authorWeight === 'function' ? authorWeight : () => null;
  if (!isKnownAuthorConstraint(authorConstraint)) return base;
  if (!isHexPubkey(observer)) return () => null;
  return (pk) => (pk === observer ? 1 : base(pk));
}

module.exports = {
  KNOWN_CONTEXTS,
  AUTHOR_CONSTRAINTS,
  isKnownAuthorConstraint,
  authorPredicateFor,
  authorWeightFor,
  pinVariantKey,
  VARIANT_SLUG_MAX,
  variantOfPin,
  variantKeyArgs,
  validateVariantSlug,
  contextHandle,
  tlDTag,
  noteTlDTag,
  itemTlDTag,
  trustedListZTags,
  contextSlugOfPin,
  contextPinsToTags,
};
