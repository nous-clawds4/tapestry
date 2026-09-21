/**
 * The /setup answer, summarized for the page and the Setup Alert (ADR setup-status-and-alert/0001).
 *
 * Pure, no React, so Node suites can import it. The rules live on the server
 * (src/api/setup/status.js); this only reads its answer. Anything but a signed-in answer — still
 * checking, a failure, an expired session — is "not answered": every step neither done nor pending,
 * which the page shows as not done and the alert does not count.
 */

const STEP_KEYS = ['account', 'follow', 'activate'];

const notAnswered = () => ({ done: false, pending: false, finished: false });

/**
 * @param {Object|null} answer  the /api/setup/status response, or null while it is not in
 * @returns {{ answered: boolean, steps: { account: Object, follow: Object, activate: Object },
 *             doneCount: number, pendingCount: number }}
 *   `pendingCount` is what the alert counts: steps that are pending and not done.
 */
export function summarizeSetup(answer) {
  const answered = !!answer && typeof answer === 'object' && answer.success === true && answer.signedIn === true
    && !!answer.steps && typeof answer.steps === 'object';

  const steps = {};
  for (const key of STEP_KEYS) {
    const step = answered ? answer.steps[key] : null;
    steps[key] = step && typeof step === 'object' ? step : notAnswered();
  }

  const list = STEP_KEYS.map((key) => steps[key]);
  return {
    answered,
    steps,
    doneCount: list.filter((s) => s.done === true).length,
    pendingCount: list.filter((s) => s.pending === true && s.done !== true).length,
  };
}
