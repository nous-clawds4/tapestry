'use strict';
/**
 * The approved words and cards of book assistant-coming-soon: the five hub actions that say "Coming soon" and are never
 * marked or counted. One copy, shared by test/assistant-coming-soon.test.js, tests/brainstorm/assistant-coming-soon.spec.js
 * and the hub fixture (test/helpers/assistantManagementFixtures.js, whose COUNTED leaves them out), so every hub suite and
 * spec agrees on them.
 *
 * Source of truth: engineering-team/stories/assistant-coming-soon/1-coming-soon-cards.md § Copy and AC-1–AC-3 (approved
 * at Gate A, 2026-10-12). Keys follow ADR assistant-duty-cards/0001 sub-decision 2 (each key is its path's last
 * segment). Change a word there first, then here.
 */

const HUB = '/assistant';

/** The five, in ASSISTANT_ACTIONS order (story AC-1). */
const CARDS = [
  { key: 'bounties', path: `${HUB}/bounties`, title: 'Bounties' },
  { key: 'pins', path: `${HUB}/pins`, title: 'Pins' },
  { key: 'tags', path: `${HUB}/tags`, title: 'Tags' },
  { key: 'notifications-and-alerts', path: `${HUB}/notifications-and-alerts`, title: 'Notifications and Alerts' },
  { key: 'preferences', path: `${HUB}/preferences`, title: 'Preferences' },
];
const KEYS = CARDS.map((c) => c.key);
const PATHS = CARDS.map((c) => c.path);

/** The one hub action without a check that is still marked and counted (story AC-4; the owner kept it at intake). */
const STILL_PLACEHOLDER = 'treasure-map';

/** The words (story § Copy). The pill's are the background image panel's, PROFILE_CHECKLIST_COPY.comingSoon. */
const COPY = {
  pill: 'Coming soon',
  srPrefix: 'Coming soon: ',
  pageLine: 'Coming soon.',
  // Unchanged, on every other page the placeholder component serves (Your Assistant's Treasure Map's among them).
  placeholder: 'Placeholder page.',
};

module.exports = { HUB, CARDS, KEYS, PATHS, STILL_PLACEHOLDER, COPY };
