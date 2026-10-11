'use strict';
/**
 * assistant-trusted-content-status #1 — Scores, Lists and Concepts on the hub: the approved words and the answer
 * shapes, one copy for the Node suite (test/assistant-trusted-content.test.js), the browser suites
 * (tests/brainstorm/assistant-trusted-content.spec.js, tests/brainstorm/treasure-map-save.spec.js SV17) and the suites
 * re-aimed to carry these three actions (assistant-attention, assistant-alert, assistant-management-page,
 * assistant-profile-check).
 *
 * Since assistant-shared-categories #1 (Done, but shared): a category the Map gives to any other Assistant is done and
 * carries `shared` ('partly' or 'entirely'); `other-assistants-only` is retired; every answer carries `shared`; and the
 * alert criteria and the shared card's words are that story's (test/assistant-shared-categories.test.js,
 * tests/brainstorm/assistant-shared-categories.spec.js, SV18).
 *
 * Source of truth: engineering-team/stories/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md
 * § Copy (approved 2026-10-08), and ADR assistant-trusted-content-status/0001 sub-decision 4 (the answer's shape), as
 * superseded in part by engineering-team/stories/assistant-shared-categories/1-done-but-shared.md (§ Copy and its Design
 * note, approved 2026-10-11). Change a word there first, then here.
 */

const MANAGE_TREASURE_MAP_PATH = '/treasure-map';
const MAP_LINK = { text: 'Manage your Treasure Map →', to: MANAGE_TREASURE_MAP_PATH };

// assistant-shared-categories #1 § Copy.
const criteria = (name) => `Needs attention until your Treasure Map gives ${name} to an Assistant. Shared while any of it goes to an Assistant other than your Tapestry Assistant on this instance.`;

/** The three cards, in hub order: the action key (unchanged), the Treasure Map category it reads, and its words. */
const CARDS = [
  { key: 'trusted-assertions', category: 'scores', title: 'Scores', path: '/assistant/trusted-assertions', alertCriteria: criteria('Scores') },
  { key: 'trusted-lists', category: 'lists', title: 'Lists', path: '/assistant/trusted-lists', alertCriteria: criteria('Lists') },
  { key: 'dlists', category: 'concepts', title: 'Concepts', path: '/assistant/dlists', alertCriteria: criteria('Concepts') },
];
const KEYS = CARDS.map((c) => c.key);
const CATEGORY_OF = Object.fromEntries(CARDS.map((c) => [c.key, c.category]));

/** The hub's Done look (shared with assistant-profile-checklist #1 § Copy). */
const DONE_COPY = { done: 'Done', doneSrPrefix: 'Done: ' };

/** A shared card's words (assistant-shared-categories #1 § Copy): the pill, the prefix, the line and its link. */
const SHARED_COPY = {
  pill: 'Shared',
  srPrefix: 'Done, shared: ',
  line: { partly: 'Partly handled by another Assistant', entirely: 'Handled by another Assistant' },
  link: 'Move it here →',
  to: MANAGE_TREASURE_MAP_PATH,
};
const EXTENTS = ['partly', 'entirely'];

/** The reasons (ADR 0001 sub-decision 4; `other-assistants-only` retired by assistant-shared-categories #1). */
const REASONS = {
  finished: ['no-map', 'not-assigned'],
  unfinished: ['local-unreadable', 'no-outside-relays', 'outside-unreachable', 'check-failed'],
};

// ─── One action's answer, by state ───────────────────────────────────────────────────────
// Every answer carries `shared`, non-null only when done (assistant-shared-categories #1, Design note).
const done = (category, source = 'local') => ({ category, finished: true, done: true, pending: false, reason: null, source, shared: null });
/** Done, but the Map gives the category to another Assistant too ('partly') or only ('entirely'). */
const shared = (category, extent = 'entirely', source = 'local') =>
  ({ category, finished: true, done: true, pending: false, reason: null, source, shared: extent });
const pending = (category, reason = 'no-map', source = reason === 'no-map' ? null : 'local') =>
  ({ category, finished: true, done: false, pending: true, reason, source, shared: null });
const unfinished = (category, reason = 'outside-unreachable') => ({ category, finished: false, done: false, pending: false, reason, source: null, shared: null });
const checkFailed = (category) => unfinished(category, 'check-failed');

/** The three actions, each made by `make(category)`: e.g. trio(done), trio((c) => pending(c, 'not-assigned')). */
function trio(make) {
  return Object.fromEntries(CARDS.map((c) => [c.key, make(c.category)]));
}

/**
 * An attention answer with the three actions added — pending (a finished check that found no Map) by default, which marks
 * and counts each card exactly as a placeholder did, so a suite about another action keeps its counts. An answer that
 * already carries any of the three, or carries no actions map, is returned as it is.
 */
function withTrio(answer, make = (c) => pending(c)) {
  if (!answer || typeof answer !== 'object' || !answer.actions || typeof answer.actions !== 'object') return answer;
  if (KEYS.some((k) => Object.prototype.hasOwnProperty.call(answer.actions, k))) return answer;
  return { ...answer, actions: { ...answer.actions, ...trio(make) } };
}

module.exports = {
  MANAGE_TREASURE_MAP_PATH,
  MAP_LINK,
  CARDS,
  KEYS,
  CATEGORY_OF,
  DONE_COPY,
  SHARED_COPY,
  EXTENTS,
  REASONS,
  done,
  shared,
  pending,
  unfinished,
  checkFailed,
  trio,
  withTrio,
};
