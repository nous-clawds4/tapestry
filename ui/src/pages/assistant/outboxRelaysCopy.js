/**
 * The Outbox Relays page's words and two pure helpers (assistant-outbox-relays #2 and #3, ADR 0002 sub-decision 3).
 *
 * Pure, no imports, so Node suites can load it (test/assistant-outbox-relays-page.test.js). Named apart from the page
 * (OutboxRelays.jsx): a module that differs from a page only by case resolves to the wrong file on a case-insensitive
 * filesystem, which the dev container's bind mount is (ADR assistant-identification-tags/0002 Amendment 1). The title,
 * the description, the back link, "Needs attention", "Done", the sign-in button and the no-assistant line are the hub's
 * and the action entry's (ui/src/pages/assistant/actions.js); the page imports those itself.
 *
 * The words were approved with the stories; change them there first:
 * engineering-team/stories/assistant-outbox-relays/2-the-outbox-relays-page.md § Copy (and the 50-relay line, approved
 * with ADR 0002 § Consequences), and 3-your-assistant-publishes-its-relay-list.md § Copy.
 */

export const OUTBOX_RELAYS_COPY = {
  signedOutLine: "Sign in to manage your Assistant's outbox relays.",
  panelHeading: "Your Assistant's outbox relays",
  noneYet: 'Your Assistant has no outbox relays yet.',
  checking: 'Checking…',
  couldNotCheck: {
    'local-unreadable': "Could not read this instance's relay.",
    'no-outside-relays': "No relay list on this instance's relay, and no outside relay is configured to check.",
    'outside-unreachable': "No relay list on this instance's relay, and no outside relay answered.",
    'request-failed': 'Could not check: this instance did not answer.',
  },
  unpublished: 'You have changes that are not published yet.',
  fieldLabel: 'Add a relay',
  placeholder: 'wss://relay.example.com',
  add: 'Add',
  refusals: {
    'not-a-relay': 'A relay address starts with wss:// (or ws://).',
    'already-listed': 'That relay is already on the list.',
    'too-many': 'A relay list here holds at most 50 relays.',
  },
  suggestionsHeading: 'Suggested relays',
  suggestionsExplainer: "Relays your Assistant already publishes to, from this instance's relay settings.",
  addAll: 'Add all',
  remove: 'Remove',
  srAdd: (relay) => `Add ${relay}`,
  srRemove: (relay) => `Remove ${relay}`,
  allListed: 'Every suggested relay is on the list.',
  noneToSuggest: 'This instance has no relays to suggest.',
  publish: {
    button: 'Have your Assistant publish',
    publishing: 'Publishing…',
    subject: "Your Assistant's relay list",
    emptyOutbox: 'Your Assistant now has no outbox relays.',
    requestFailed: 'This instance did not answer; nothing was published.',
  },
};

/**
 * The line under the panel heading for the provider's phase and this action's answer: Checking… while it is on its way;
 * nothing once the check finished; a reason's words when it did not; the request-failed line when the request failed,
 * the check itself failed, or the answer has no outbox action.
 * @param {string} phase - 'idle' | 'checking' | 'answered' | 'failed'
 * @param {?Object} action - actions['outbox-relays'] of the answer
 * @returns {?string}
 */
export function checkLine(phase, action) {
  const words = OUTBOX_RELAYS_COPY.couldNotCheck;
  if (phase === 'checking') return OUTBOX_RELAYS_COPY.checking;
  if (phase !== 'answered' || !action || typeof action !== 'object') return words['request-failed'];
  if (action.finished === true) return null;
  return words[action.reason] || words['request-failed'];
}

/** How many inbox relays the list also names, in the singular for one; null for none. */
export function inboxLine(n) {
  if (!Number.isInteger(n) || n <= 0) return null;
  return n === 1
    ? "Your Assistant's relay list also names 1 inbox relay; this page leaves it as it is."
    : `Your Assistant's relay list also names ${n} inbox relays; this page leaves them as they are.`;
}
