'use strict';
/**
 * The items of a Tapestry Assistant's profile checklist (assistant-profile-checklist #1, ADR 0001 sub-decision 1): the
 * seven panels of /assistant/profile, in order, and whether each counts toward the profile being complete.
 *
 * Pure, dependency-free CommonJS, on purpose: the server checks from it (src/api/assistant/profileChecklist.js), the UI
 * imports it through the Vite alias @tapestry/assistant-profile-items, and the Node runner loads it as it is. Adding an
 * item is one entry here, its rule on the server, and its words on the page.
 *
 * The background image is listed and does not count: the owner's words, "its state … will not be calculated for now
 * and will not yet count towards the determination of whether the full Profile item is completed or not".
 */

const PROFILE_ITEMS = Object.freeze([
  Object.freeze({ key: 'avatar', counts: true }),
  Object.freeze({ key: 'banner', counts: false }),
  Object.freeze({ key: 'nip05', counts: true }),
  Object.freeze({ key: 'website', counts: true }),
  Object.freeze({ key: 'name-and-about', counts: true }),
  Object.freeze({ key: 'client-tag', counts: true }),
  Object.freeze({ key: 'visible', counts: true }),
]);

/** The items whose state decides whether the profile is complete. */
const COUNTED_PROFILE_ITEM_KEYS = Object.freeze(PROFILE_ITEMS.filter((i) => i.counts).map((i) => i.key));

/**
 * The kind-0 fields the one writer of an Assistant's profile keeps (src/api/assistant/index.js PROFILE_FIELDS, ADR
 * assistant-profile/0005). A fix on the checklist republishes exactly these.
 */
const PROFILE_CONTENT_FIELDS = Object.freeze(['name', 'display_name', 'about', 'picture', 'banner', 'website', 'lud16']);

/**
 * A stamped composite's file name on this instance's volume (src/api/assistant/avatar.js): the first 8 hex of its
 * SHA-256 until assistant-profile-checklist #3, 32 since (ADR 0003 sub-decision 5). Both are served and both count.
 */
const COMPOSITE_AVATAR_FILE_RE = /^ta-avatar-[0-9a-f]{8,64}\.png$/;

module.exports = { PROFILE_ITEMS, COUNTED_PROFILE_ITEM_KEYS, PROFILE_CONTENT_FIELDS, COMPOSITE_AVATAR_FILE_RE };
