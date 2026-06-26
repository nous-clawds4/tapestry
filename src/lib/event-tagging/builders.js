/**
 * Unsigned-event builders for the event-tagging core (David's indirect
 * per-tag-header protocol — see protocols/drafts/event-taggings.md).
 *
 * Each builder returns a PARTIAL unsigned event `{ kind, tags, content }`.
 * It deliberately does NOT set `pubkey` or `created_at` — the caller/signer
 * adds those at sign time. This keeps the core pure and deterministic (no
 * wall-clock time), so output is a function of its inputs alone. No I/O, no signing.
 *
 * Dependency-free: the only imports are sibling modules in this folder.
 */

const { slug: toSlug } = require('./slug');
const {
  conceptTag,
  conceptNostrEventTag,
  conceptTaggingWithSpecificTag,
  tagElementAddr,
  taggingHeaderAddr,
} = require('./handles');

const HEX64 = /^[0-9a-f]{64}$/;

function requireHex64(value, label) {
  if (typeof value !== 'string' || !HEX64.test(value)) {
    throw new Error(`event-tagging: ${label} must be a 64-char lowercase hex pubkey (got: ${value})`);
  }
}

/**
 * Build a tag-element (the descriptor). Joins the deployment's `tag` concept.
 * `d` is the slug of the name — the SAME shape the existing tag concept uses
 * (39999:<author>:<slug>), so event-taggings reference real tag-elements.
 */
function buildTagElement({ name, description, taPubkey }) {
  const slug = toSlug(name);
  return {
    kind: 39999,
    tags: [
      ['d', slug],
      ['z', conceptTag(taPubkey)],
    ],
    content: JSON.stringify({ tag: { slug, name, description: description || '' } }),
  };
}

/**
 * Build a per-tag "tagging-with-specific-tag" header. Simultaneously a DList
 * header (names/description/d) and a DList item (z + a) — exactly per the spec.
 *
 * @param {string}   tagAuthorPubkey  64-hex author of the tag-element this header is for.
 * @param {string}   slug             the resolved tag-element's slug (NOT re-slugged here).
 * @param {string[]} names            display names, e.g. [singular, plural]; spread into the `names` tag.
 * @param {string}   description
 * @param {string}   taPubkey         runtime Tapestry-Assistant pubkey (composes the `z` concept handle).
 */
function buildTaggingHeader({ tagAuthorPubkey, slug, names, description, taPubkey }) {
  // tagAuthorPubkey composes the `a` coordinate (39999:<author>:<slug>). A
  // malformed value silently yields an undiscoverable header, so fail loud here
  // rather than mint an orphan (mirrors publishProfileTag.js:54). taPubkey is
  // intentionally NOT guarded — it is runtime-config sourced and non-fatal.
  requireHex64(tagAuthorPubkey, 'tagAuthorPubkey');
  return {
    kind: 39999,
    tags: [
      ['d', `tagging:${slug}-tagging`],
      ['names', ...names],
      ['description', description],
      ['z', conceptTaggingWithSpecificTag(taPubkey)],
      ['a', tagElementAddr(tagAuthorPubkey, slug)],
    ],
    content: '',
  };
}

/**
 * Build an event-tagging assertion (apply/dispute a tag on an event).
 *
 * @param target  { id } for a non-addressable event (e.g. a kind-1 note → `e`),
 *                or { address } for an addressable target (a-coordinate → `a`).
 *                If both are supplied, `id` takes precedence.
 * @param polarity 1 (apply) or -1 (dispute).
 */
function buildEventTaggingAssertion({ headerAuthorPubkey, slug, target, polarity, asserterPubkey, taPubkey }) {
  // Both pubkeys end up as permanent, signed, published coordinates: asserterPubkey
  // into the deterministic d-tag (replaceability key), headerAuthorPubkey into the
  // descriptor z-coordinate (39999:<author>:tagging:<slug>-tagging). A malformed
  // either one mints an orphan event signed with the user's real key, so fail loud
  // (mirrors publishProfileTag.js:54). taPubkey stays unguarded (runtime-config, non-fatal).
  requireHex64(asserterPubkey, 'asserterPubkey');
  requireHex64(headerAuthorPubkey, 'headerAuthorPubkey');

  const p = Number(polarity);
  if (p !== 1 && p !== -1) {
    throw new Error(`event-tagging: polarity must be 1 (apply) or -1 (dispute), got: ${polarity}`);
  }

  let targetTag;
  let target8;
  if (target && typeof target.id === 'string') {
    targetTag = ['e', target.id];
    target8 = target.id.slice(0, 8);
  } else if (target && typeof target.address === 'string') {
    targetTag = ['a', target.address];
    target8 = (target.address.split(':')[1] || '').slice(0, 8); // the coord's author-pubkey segment
  } else {
    throw new Error('event-tagging: target must be { id } (event id) or { address } (a-coordinate)');
  }

  const dTag = `event-tag-${slug}-${target8}-${asserterPubkey.slice(0, 8)}`;

  return {
    kind: 39999,
    tags: [
      ['d', dTag],
      targetTag,
      ['z', conceptNostrEventTag(taPubkey)],
      ['z', taggingHeaderAddr(headerAuthorPubkey, slug)],
      ['polarity', String(p)],
    ],
    content: '',
  };
}

module.exports = {
  buildTagElement,
  buildTaggingHeader,
  buildEventTaggingAssertion,
};
