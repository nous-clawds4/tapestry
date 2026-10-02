/**
 * The tag rules for re-signing a list header's b-disposition (ADR list-headers-disposition/0003).
 *
 * One home for what Submit as a Shared Concept and Keep private do to a header's tags, so the
 * List Headers endpoints, story 5's browser signing, and the deferred Concept Headers fix (OPEN.md row
 * `2026-10-01-concept-headers-disposition-owner-signer`) all read the same rules. Concept Headers'
 * handlers (src/api/concept/selfDeclare.js, bDisposition.js) still carry these rules inline until that
 * fix; test/list-headers-my-assistant-disposition.test.js P1–P2 run both and fail if they disagree.
 *
 * Pure: requires only ./bValueForms, never mutates its input. Each compose returns exactly one of
 * { tags } (re-sign with these), { already: true } (nothing new to sign), or { refused } (domain refusal).
 */

'use strict';

const { SENTINEL, classifyBValue, stripSentinel } = require('./bValueForms');

const KEEP_PRIVATE_REFUSAL = 'this header already carries a real b — deferral applies only to unaffiliated headers';

function tagsOf(header) {
  return header && Array.isArray(header.tags) ? header.tags : [];
}

/**
 * Submit as a Shared Concept: every earlier tag except the keep-private marker, plus a pointer-typed
 * b to the header's own address. Already self-declared (any b type) means nothing new.
 */
function composeSelfDeclare(header, selfCoord) {
  const tags = tagsOf(header);
  if (tags.some((t) => t[0] === 'b' && t[1] === selfCoord)) return { already: true };
  return { tags: [...stripSentinel(tags), ['b', selfCoord, 'pointer']] };
}

/**
 * Keep private: the marker, only on a header with no real b (an a-tag or event id) — a real
 * affiliation is never deferred. Already marked means nothing new.
 */
function composeKeepPrivate(header) {
  const tags = tagsOf(header);
  const bValues = tags.filter((t) => t[0] === 'b').map((t) => t[1]);
  if (bValues.some((v) => ['a-tag', 'event-id'].includes(classifyBValue(v)))) return { refused: KEEP_PRIVATE_REFUSAL };
  if (bValues.includes(SENTINEL)) return { already: true };
  return { tags: [...tags, ['b', SENTINEL]] };
}

/**
 * Wire to an external shared concept (ADR list-headers-disposition/0004): every earlier tag except the
 * keep-private marker, plus a pointer b to the target. Already wired to that target (any b type) means
 * nothing new; the header's own address is Submit's lane and is never composed here.
 */
function composeWire(header, selfCoord, target) {
  const tags = tagsOf(header);
  if (target === selfCoord) return { refused: 'self' };
  if (tags.some((t) => t[0] === 'b' && t[1] === target)) return { already: true };
  return { tags: [...stripSentinel(tags), ['b', target, 'pointer']] };
}

/**
 * A re-sign's created_at: strictly newer than the version it replaces, or a same-second pair ties and
 * strfry's replaceable-event tie-break can drop the newer one (bDisposition.js resignWithTags).
 */
function nextCreatedAt(prevCreatedAt, now) {
  return Math.max(now, (prevCreatedAt || 0) + 1);
}

module.exports = { composeSelfDeclare, composeKeepPrivate, composeWire, nextCreatedAt, KEEP_PRIVATE_REFUSAL };
