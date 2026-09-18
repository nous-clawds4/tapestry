/**
 * Concept-handle and addressable-coordinate composers for the event-tagging core.
 *
 * Every composer takes the runtime Tapestry-Assistant pubkey (`taPubkey`) and/or
 * author pubkeys as PARAMETERS — nothing is hardcoded (CLAUDE.md "Per-deployment
 * TA pubkey — NEVER hardcode"). Pure string composition; no imports, no I/O.
 */

// Firmware DList concept addresses (kind-39998 headers), keyed by the deployment TA.
function conceptTag(taPubkey) {
  return `39998:${taPubkey}:tag`;
}
function conceptNostrEventTag(taPubkey) {
  return `39998:${taPubkey}:nostr-event-tag`;
}
function conceptTaggingWithSpecificTag(taPubkey) {
  return `39998:${taPubkey}:tagging-with-specific-tag`;
}

// ADR dlist-item-tagging/0002 — the Trusted-List discovery concepts.
//   conceptTrustedList       — "I am a Trusted List" (the deployment-wide axis).
//   conceptTrustedListForTag — the TYPE header whose items are per-tag TL headers.
function conceptTrustedList(taPubkey) {
  return `39998:${taPubkey}:trusted-list`;
}
function conceptTrustedListForTag(taPubkey) {
  return `39998:${taPubkey}:trusted-list-for-tag`;
}

// The per-tag Trusted-List header (TA-authored kind-39999). `tlHeaderDTag` is the
// bare `d` the publisher needs; `tlHeaderAddr` is the coordinate the Trusted Lists
// z-stamp. One place, so the two can never be hand-formatted apart.
function tlHeaderDTag(slug) {
  return `tl:${slug}-tls`;
}
function tlHeaderAddr(taPubkey, slug) {
  return `39999:${taPubkey}:${tlHeaderDTag(slug)}`;
}

// Addressable coordinates of user-authored kind-39999 events.
//   tagElementAddr   — the tag-element (descriptor) itself: 39999:<author>:<slug>
//   taggingHeaderAddr — the per-tag "tagging-with-specific-tag" header:
//                       39999:<author>:tagging:<slug>-tagging
function tagElementAddr(authorPubkey, slug) {
  return `39999:${authorPubkey}:${slug}`;
}
function taggingHeaderAddr(authorPubkey, slug) {
  return `39999:${authorPubkey}:tagging:${slug}-tagging`;
}

module.exports = {
  conceptTag,
  conceptNostrEventTag,
  conceptTaggingWithSpecificTag,
  conceptTrustedList,
  conceptTrustedListForTag,
  tlHeaderDTag,
  tlHeaderAddr,
  tagElementAddr,
  taggingHeaderAddr,
};
