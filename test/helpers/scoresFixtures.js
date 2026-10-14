'use strict';
/**
 * The approved words, constants and answer shapes of book assistant-scores, as its story and ADR state them. One copy,
 * shared by the Node suites (test/assistant-scores-route.test.js, test/assistant-scores-page.test.js) and the browser
 * suite (tests/brainstorm/assistant-scores.spec.js), so they cannot disagree about what the owner approved.
 *
 * Source of truth: engineering-team/stories/assistant-scores/1-the-scores-page.md § Copy (approved 2026-10-13) and
 * engineering-team/decisions/assistant-scores/0001-a-session-bound-scores-read-and-recalculate-route.md (accepted
 * 2026-10-13; sub-decision 7 adds the unreadable line). Change a word there first, then here.
 *
 * Standalone on purpose: it requires no other fixture.
 */

// ─── The action and its routes (story AC-1; ADR sub-decisions 4–6) ──────────────────────────────────────────────────
const KEY = 'trusted-assertions';
const PATH = '/assistant/trusted-assertions';
const ROUTES = Object.freeze({
  status: '/api/assistant/scores',
  recalculate: '/api/assistant/scores/recalculate',
});

/** The hub card's entry, unchanged by this story (AC-6). */
const ACTION_TITLE = 'Scores';
const ACTION_ALERT_CRITERIA = 'Needs attention until your Treasure Map gives Scores to an Assistant. Shared while any of it goes to an Assistant other than your Tapestry Assistant on this instance.';
const ACTION_EDIT_LINK_TEXT = 'Manage your Treasure Map →';

// ─── The wire facts (ADR sub-decisions 1–3) ──────────────────────────────────────────────────────────────────────────
const SCORE_KIND = 30382;
/** Each role's one pipeline: the task a press enqueues. */
const PIPELINE_TASKS = Object.freeze({ owner: 'updateAllScoresForOwner', customer: 'processCustomer' });
/** The refusal codes, in the order the press checks them (sub-decision 4). */
const CODES = Object.freeze({
  notSignedIn: 'not-signed-in',
  noAssistant: 'no-assistant',
  noPipeline: 'no-pipeline',
  queueUnavailable: 'queue-unavailable',
  already: 'already',
});

// ─── The words (story § Copy; ADR sub-decision 7) ────────────────────────────────────────────────────────────────────
const COPY = Object.freeze({
  heading: 'Scores',
  assistantPrefix: 'Your Assistant: ',
  lastPublishedPrefix: 'Last published: ',
  notYet: 'Last published: not yet',
  unreadable: "Last published: couldn't be read right now",
  countPrefix: 'Trusted Assertions published: ',
  button: 'Recalculate and republish',
  takesAWhile: 'A recalculation takes a while, often 20–60 minutes. You can leave this page and reload it later to see the new time.',
  queued: 'A recalculation is queued.',
  running: 'A recalculation is running.',
  started: 'Recalculation started.',
  couldNotStartPrefix: "Couldn't start a recalculation: ",
  noPipeline: "Your scores aren't calculated on this instance. That's done for the Owner and for Customers.",
});

// ─── Canned answers of GET /api/assistant/scores (sub-decision 5) ────────────────────────────────────────────────────
const LATEST_AT = 1_760_000_000; // 2025-10-09T08:53:20Z
const COUNT = 48213;

/** A signed-in answer with an Assistant; `over` replaces any field. */
function answer(over = {}) {
  return {
    success: true,
    signedIn: true,
    hasAssistant: true,
    assistantPubkey: 'c1'.repeat(32),
    published: { finished: true, latestAt: LATEST_AT, count: COUNT },
    pipeline: 'customer',
    run: null,
    ...over,
  };
}

const ANSWERS = Object.freeze({
  SIGNED_OUT: { success: true, signedIn: false },
  NO_ASSISTANT: { success: true, signedIn: true, hasAssistant: false },
  IDLE: answer(),
  QUEUED: answer({ run: 'queued' }),
  RUNNING: answer({ run: 'running' }),
  UNKNOWN: answer({ run: 'unknown' }),
  NOT_YET: answer({ published: { finished: true, latestAt: null, count: 0 } }),
  UNREADABLE: answer({ published: { finished: false } }),
  NO_PIPELINE: answer({ pipeline: null, run: null }),
  OWNER_IDLE: answer({ assistantPubkey: 'aa'.repeat(32), pipeline: 'owner' }),
});

module.exports = {
  KEY,
  PATH,
  ROUTES,
  ACTION_TITLE,
  ACTION_ALERT_CRITERIA,
  ACTION_EDIT_LINK_TEXT,
  SCORE_KIND,
  PIPELINE_TASKS,
  CODES,
  COPY,
  LATEST_AT,
  COUNT,
  answer,
  ANSWERS,
};
