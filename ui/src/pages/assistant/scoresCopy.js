/**
 * The Scores page's words and pure helpers (assistant-scores #1, ADR assistant-scores/0001 sub-decisions 6 and 7).
 *
 * The words were approved with the story; change them there first:
 * engineering-team/stories/assistant-scores/1-the-scores-page.md § Copy (the unreadable line is ADR sub-decision 7's).
 * The page (Scores.jsx) spells none of them itself.
 *
 * Pure, with one import (and its `.js`), so Node suites can load it as it is (test/assistant-scores-page.test.js).
 */

import { timeAgo } from '../../utils/timeAgo.js';

export const SCORES_COPY = {
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
  // While the page's one read is on its way (not in the story's § Copy; story § Deviations).
  checking: 'Checking…',
};

/** What follows "Couldn't start a recalculation: ", by the server's refusal code (POST /api/assistant/scores/recalculate). */
export const REASONS = {
  'not-signed-in': 'sign in first.',
  'no-assistant': "you don't have a Tapestry Assistant on this instance yet.",
  'no-pipeline': "your scores aren't calculated on this instance.",
  'queue-unavailable': "this instance's task queue isn't available right now.",
  already: 'one is already queued or running.',
  // The server answered and could not enqueue, or did not answer at all (ADR Amendment 1, N2).
  failed: "this instance couldn't start one.",
};

/**
 * "Last published: …": the date and time and how long ago, "not yet" for none, and "couldn't be read" when the read
 * did not finish, which is never shown as "not yet".
 * @param {?{ finished: boolean, latestAt?: ?number }} published  the read's `published`
 */
export function lastPublishedLine(published) {
  if (!published || published.finished !== true) return SCORES_COPY.unreadable;
  if (!published.latestAt) return SCORES_COPY.notYet;
  return `${SCORES_COPY.lastPublishedPrefix}${new Date(published.latestAt * 1000).toLocaleString()} (${timeAgo(published.latestAt)})`;
}

/** "Trusted Assertions published: N", a count of 0 included; null when there is no count. */
export function countLine(published) {
  if (!published || published.finished !== true || !Number.isInteger(published.count)) return null;
  return `${SCORES_COPY.countPrefix}${published.count.toLocaleString()}`;
}

/** The run's line: queued or running; null for no run, and for an unknown state, which claims nothing. */
export function runLine(run) {
  if (run === 'queued') return SCORES_COPY.queued;
  if (run === 'running') return SCORES_COPY.running;
  return null;
}

/**
 * The button: shown only when the read names a pipeline; off while a run is queued or running, or a press is in flight.
 * An unknown run state keeps it on: the press then says why it cannot start, if it cannot.
 * @param {?Object} answer  the read's answer (null before it arrives)
 * @param {boolean} pressing
 * @returns {{ show: boolean, disabled: boolean }}
 */
export function buttonState(answer, pressing) {
  const show = !!answer && answer.success === true && answer.signedIn === true && answer.hasAssistant === true && !!answer.pipeline;
  if (!show) return { show: false, disabled: true };
  return { show: true, disabled: !!pressing || answer.run === 'queued' || answer.run === 'running' };
}

/** "Couldn't start a recalculation: {reason}" for a refusal code; an unknown code reads as a request that failed. */
export function couldNotStartLine(code) {
  return `${SCORES_COPY.couldNotStartPrefix}${REASONS[code] || REASONS.failed}`;
}
