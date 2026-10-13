'use strict';
/**
 * about-this-instance #1 — the words both halves pin, and the fixture people.
 *
 * Story: engineering-team/stories/about-this-instance/1-owner-admins-customer-count.md (§ Look and wording)
 * ADR:   engineering-team/decisions/about-this-instance/0001-public-instance-roles-read.md (Decisions 1, 6, 7)
 * Used by test/about-this-instance.test.js (Node) and tests/brainstorm/about-this-instance.spec.js (browser).
 *
 * Fixtures only: no live key, and never this instance's TA (CLAUDE.md, "Per-deployment TA pubkey").
 */

const { nip19 } = require('nostr-tools');

/** The words, as the story's § Look and wording and ADR Decision 6 give them. */
const COPY = Object.freeze({
  title: 'About this Brainstorm Instance',
  subtitle: 'Who runs this instance, and how many customers it serves.',
  ownerHeading: 'Owner',
  adminsHeading: 'Admins',
  noAdmins: 'No admins',
  customerOne: 'customer',
  customerMany: 'customers',
  countUnavailable: 'Customer count unavailable',
  loadFailed: "Couldn't load this instance's details.",
  linkText: 'About this Brainstorm Instance',
});

/** The section's anchor and the link's target (AC-1, AC-5). */
const ANCHOR_ID = 'this-instance';
const LINK_HREF = '/about#this-instance';
const ROUTE = '/api/about-this-instance';
const PAGE = '/about';
const SEARCH_ABOUT = '/about-brainstorm-search';

/** The reads this page must never make: each would load customer identities, or the owner-only admin list (AC-4). */
const FORBIDDEN_READS = Object.freeze(['/api/get-customers', '/api/get-customer', '/api/assistant/roster', '/api/admin/list']);

/** Fixture people for the browser half. */
const OWNER = 'a1'.repeat(32);
const ADMIN_NAMED = 'b1'.repeat(32);
const ADMIN_UNKNOWN = 'b2'.repeat(32);
const PROFILES = Object.freeze({
  [OWNER]: { display_name: 'Olive Owner', name: 'olive', nip05: 'olive@example.com', picture: '' },
  [ADMIN_NAMED]: { name: 'adam', nip05: 'adam@example.org', picture: '' },
  // ADMIN_UNKNOWN has no profile: the card falls back to a shortened npub.
});

/**
 * The shortened npub a card shows when the person's profile is not known (story AC-2; ADR Decision 6):
 * "npub1" and the next four characters, an ellipsis, and the last four.
 */
function shortNpub(hex) {
  const npub = nip19.npubEncode(hex);
  return `${npub.slice(0, 9)}…${npub.slice(-4)}`;
}

/** The count line's word for N (story § Look and wording: "N customers"; one reads "1 customer"). */
function customerWord(n) {
  return n === 1 ? COPY.customerOne : COPY.customerMany;
}

module.exports = {
  COPY, ANCHOR_ID, LINK_HREF, ROUTE, PAGE, SEARCH_ABOUT, FORBIDDEN_READS,
  OWNER, ADMIN_NAMED, ADMIN_UNKNOWN, PROFILES, shortNpub, customerWord,
};
