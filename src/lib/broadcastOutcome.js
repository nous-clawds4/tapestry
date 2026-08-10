/**
 * What actually happened when we tried to put an event on the community relay
 * (story shared-concepts-seeding/1).
 *
 * `publishToRelays` never throws on failure — it RESOLVES with
 * `{successes, failures}`, or with `{skippedByGate: true}` when the
 * deployment's local-only guard is on. Callers that merely `await` it and
 * assume success will claim community reach that never happened; that was the
 * defect this core exists to remove.
 *
 * Three outcomes, and the distinction between the last two matters:
 *
 *   published      — at least one relay accepted it; the community can see it.
 *   kept-local     — external publishing is switched off for this deployment.
 *                    A deliberate setting, NOT a failure.
 *   not-delivered  — we tried and nothing accepted it. Worth retrying.
 *
 * Pure CJS, zero requires (the bValueForms / adoptionQueue / trustedDictionary
 * / sharingState idiom). Imported by the browser through the
 * `@tapestry/broadcast-outcome` alias in ui/vite.config.js.
 */

'use strict';

/**
 * Classify a publishToRelays result.
 *
 * Anything we cannot read resolves to `not-delivered` — never `published`.
 * This story exists because code asserted community reach it had not verified,
 * so an unrecognised shape must fail toward honesty rather than toward the
 * cheerful answer.
 */
function classifyBroadcast(result) {
  if (!result || typeof result !== 'object') return 'not-delivered';
  if (result.skippedByGate === true) return 'kept-local';
  return Array.isArray(result.successes) && result.successes.length > 0
    ? 'published'
    : 'not-delivered';
}

// One row per (verb, outcome). `already` covers a repeat of an action that had
// already been recorded — the re-broadcast still has its own outcome, and
// saying "already done" without saying whether the resend landed is the same
// omission in a smaller form.
const MESSAGES = {
  submit: {
    published: {
      fresh: 'Submitted as a shared concept — published to the community relay.',
      already: 'Already offered — re-broadcast to the community relay.',
    },
    'kept-local': {
      fresh: 'Offered on this machine. External publishing is off for this deployment, so it was not sent onward.',
      already: 'Already offered here. External publishing is off for this deployment, so nothing was sent onward.',
    },
    'not-delivered': {
      fresh: 'Offered on this machine, but it did not get out to the community relay — try again.',
      already: 'Already offered here, but the re-broadcast did not get out to the community relay — try again.',
    },
  },
  wire: {
    published: {
      fresh: 'Wired — broadcast to the community relay.',
      already: 'Already wired — re-broadcast to the community relay.',
    },
    'kept-local': {
      fresh: 'Wired on this machine. External publishing is off for this deployment, so it was not sent onward.',
      already: 'Already wired here. External publishing is off for this deployment, so nothing was sent onward.',
    },
    'not-delivered': {
      fresh: 'Wired on this machine, but it did not get out to the community relay — try again.',
      already: 'Already wired here, but the re-broadcast did not get out to the community relay — try again.',
    },
  },
};

/**
 * The human-readable outcome.
 * @param {object}  input
 * @param {string}  input.outcome  from classifyBroadcast
 * @param {string}  input.verb     'submit' | 'wire'
 * @param {boolean} input.already  the action was already recorded before this call
 */
function outcomeMessage({ outcome, verb, already } = {}) {
  const byVerb = MESSAGES[verb] || MESSAGES.submit;
  const byOutcome = byVerb[outcome] || byVerb['not-delivered'];
  return already ? byOutcome.already : byOutcome.fresh;
}

module.exports = { classifyBroadcast, outcomeMessage };
