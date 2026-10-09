'use strict';
/**
 * assistant-trusted-content-status #1 — Scores, Lists and Concepts on the hub: the approved words and the answer
 * shapes, one copy for the Node suite (test/assistant-trusted-content.test.js), the browser suites
 * (tests/brainstorm/assistant-trusted-content.spec.js, tests/brainstorm/treasure-map-save.spec.js SV17) and the suites
 * re-aimed to carry these three actions (assistant-attention, assistant-alert, assistant-management-page,
 * assistant-profile-check).
 *
 * Source of truth: engineering-team/stories/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md
 * § Copy (approved 2026-10-08), and ADR assistant-trusted-content-status/0001 sub-decision 4 (the answer's shape).
 * Change a word there first, then here.
 */

const MANAGE_TREASURE_MAP_PATH = '/treasure-map';
const MAP_LINK = { text: 'Manage your Treasure Map →', to: MANAGE_TREASURE_MAP_PATH };

const criteria = (name) => `Needs attention until your Treasure Map gives ${name} to your Tapestry Assistant on this instance, on its own or alongside other Assistants.`;

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

/** The reasons (ADR 0001 sub-decision 4). */
const REASONS = {
  finished: ['no-map', 'not-assigned', 'other-assistants-only'],
  unfinished: ['local-unreadable', 'no-outside-relays', 'outside-unreachable', 'check-failed'],
};

// ─── One action's answer, by state ───────────────────────────────────────────────────────
const done = (category, source = 'local') => ({ category, finished: true, done: true, pending: false, reason: null, source });
const pending = (category, reason = 'no-map', source = reason === 'no-map' ? null : 'local') =>
  ({ category, finished: true, done: false, pending: true, reason, source });
const unfinished = (category, reason = 'outside-unreachable') => ({ category, finished: false, done: false, pending: false, reason, source: null });
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
  REASONS,
  done,
  pending,
  unfinished,
  checkFailed,
  trio,
  withTrio,
};
