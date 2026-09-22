/**
 * The /api/assistant/attention answer, summarized for the hub, the Assistant Alert and the action pages
 * (ADR assistant-identification-tags/0001 § Implementation notes 3).
 *
 * Pure, no React, so Node suites can import it. The rules live on the server (src/api/assistant/attention.js);
 * this only reads its answer. Anything but a signed-in answer with an actions map — still checking, a failure, an
 * expired session — is "not answered": no action has an answer, which the hub marks and the alert does not count
 * (the two readings are assistantAttention(user, attention) in ui/src/pages/assistant/actions.js).
 */

/**
 * @param {Object|null} answer  the /api/assistant/attention response, or null while it is not in
 * @returns {{ answered: boolean, hasAssistant: boolean, actions: Object<string, Object> }}
 *   `actions` maps an action key to its answer ({ finished, done, pending, … }); empty when not answered.
 */
export function summarizeAttention(answer) {
  const answered = !!answer && typeof answer === 'object' && answer.success === true && answer.signedIn === true
    && !!answer.actions && typeof answer.actions === 'object' && !Array.isArray(answer.actions);
  return {
    answered,
    hasAssistant: answered && answer.hasAssistant === true,
    actions: answered ? answer.actions : {},
  };
}
