'use strict';
/**
 * The approved words and shapes of book assistant-outbox-relays, as its stories and ADRs state them. One copy, shared
 * by the Node suites (test/assistant-outbox-check.test.js, test/assistant-outbox-relays-page.test.js,
 * test/assistant-relay-list-publish.test.js) and the browser suite (tests/brainstorm/assistant-outbox-relays.spec.js),
 * so they cannot disagree about what the owner approved.
 *
 * Source of truth: engineering-team/stories/assistant-outbox-relays/1-…md, 2-…md, 3-…md (approved 2026-10-09) and
 * engineering-team/decisions/assistant-outbox-relays/0001-…md, 0002-…md, 0003-…md (accepted 2026-10-09). Change a word
 * there first, then here.
 */

const T = require('./identificationTagsFixtures');

// ─── The action (story 1 AC-1 and § Copy; ADR 0001 sub-decision 6) ─────────────────────────────────────────────────
const KEY = 'outbox-relays';
const PATH = '/assistant/outbox-relays';
const NIP65 = 'https://github.com/nostr-protocol/nips/blob/master/65.md';
const ACTION = {
  key: KEY,
  section: 'persona',
  path: PATH,
  title: 'Outbox Relays',
  text: 'Let other clients and apps know where to find the events your Assistant publishes. Your Assistant lists its outbox relays in a relay list (kind 10002), according to NIP-65.',
  link: { text: 'NIP-65', href: NIP65 },
  alertCriteria: "If your Assistant's relay list (kind 10002) names no outbox relay.",
  planningNotes: null,
};

/** The hub's Done badge (story 1 § Copy; ADR assistant-profile-checklist/0001 sub-decision 7). */
const DONE_BADGE = { word: 'Done', srPrefix: 'Done: ' };

// ─── ADR constants ─────────────────────────────────────────────────────────────────────────────────────────────────
const RELAY_LIST_KIND = 10002;
const MAX_RELAYS = 50;
const MAX_PARSED_R_TAGS = 100;
const RELAY_BUDGET_MS = 8000;
/** The profile publish set (ADR assistant-profile/0002): where a relay list is always sent, and read back from. */
const PROFILE_PUBLISH_CATEGORIES = ['aPopularGeneralPurposeRelays', 'aProfileRelays', 'aWotRelays'];
/** Where the Assistant already publishes (book Decision 2; ADR 0002 sub-decision 1), in order. */
const SUGGESTION_RELAY_CATEGORIES = ['aPopularGeneralPurposeRelays', 'aTrustedAssertionRelays', 'aTrustedListRelays', 'aDListRelays', 'aOutboxRelays'];
const PUBLISH_ROUTE = '/api/assistant/outbox-relays/publish';

// ─── The page's words (story 2 § Copy; ADR 0002 § Consequences for tooMany) ─────────────────────────────────────────
const PAGE = {
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
  inboxLine: (n) => (n === 1
    ? "Your Assistant's relay list also names 1 inbox relay; this page leaves it as it is."
    : `Your Assistant's relay list also names ${n} inbox relays; this page leaves them as they are.`),
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
};

// ─── The publish's words (story 3 § Copy; ADR 0003 sub-decisions 1, 5) ─────────────────────────────────────────────
const SUBJECT = "Your Assistant's relay list";
const PUBLISH = {
  button: 'Have your Assistant publish',
  publishing: 'Publishing…',
  subject: SUBJECT,
  emptyOutbox: 'Your Assistant now has no outbox relays.',
  requestFailed: 'This instance did not answer; nothing was published.',
  failed: "Could not publish your Assistant's relay list",
  codes: { notSignedIn: 'not-signed-in', notARelayList: 'not-a-relay-list', noAssistant: 'no-assistant' },
  refusals: {
    'not-signed-in': 'Sign in to have your Assistant publish its relay list.',
    'no-assistant': "You don't have a Tapestry Assistant on this instance yet.",
    'not-a-relay-list': 'That is not a list of relay addresses.',
  },
  // The profile publish's sentence shapes (src/api/assistant/profilePublish.js summarizePublish), with this subject.
  published: (a, n) => `${SUBJECT} was saved on this instance's relay and accepted by ${a} of ${n} relays.${a < n ? ` ${n - a} did not accept it; see below.` : ''}`,
  noneAccepted: (n) => `${SUBJECT} was saved on this instance's relay, but none of the ${n} relays accepted it; see below.`,
  localOnly: `${SUBJECT} was saved on this instance's relay only: local-only publish mode is on, so it was not sent to any other relay.`,
  localFailed: (reason) => `${SUBJECT} could not be saved on this instance's relay (${reason}), so it was not sent to any other relay.`,
};

// ─── Canned answers of GET /api/assistant/attention (ADR 0001 sub-decision 4; ADR 0002 sub-decision 1) ─────────────
const OUT_A = 'wss://relay.alpha.example';
const OUT_B = 'wss://relay.beta.example';
const IN_C = 'wss://inbox.gamma.example';
const SUGGESTIONS = ['wss://staging.example/relay', 'wss://relay.damus.io', 'wss://nos.lol', 'wss://nip85.example'];

/** The outbox action, with every field the answer carries; `over` adjusts it. */
function outboxAction(over = {}) {
  return {
    finished: true, done: true, pending: false, reason: null, source: 'local', createdAt: 1_700_000_000,
    outbox: [OUT_A, OUT_B], inboxOnlyCount: 0, suggestions: SUGGESTIONS.slice(), ...over,
  };
}
const OUTBOX = {
  DONE: outboxAction(),
  DONE_WITH_INBOX: outboxAction({ inboxOnlyCount: 1 }),
  PENDING: outboxAction({ done: false, pending: true, outbox: [], source: null, createdAt: null }),
  UNFINISHED: outboxAction({ finished: false, done: false, pending: false, reason: 'no-outside-relays', source: null, createdAt: null, outbox: [] }),
  CHECK_FAILED: { finished: false, done: false, pending: false, reason: 'check-failed', source: null, createdAt: null, outbox: [], inboxOnlyCount: 0, suggestions: [] },
};

/** A signed-in answer for a viewer with an assistant: Identification Tags as given (default done), the outbox action as given. */
function attentionWith({ outbox = OUTBOX.DONE, idtags = T.DONE.actions[T.CHECKED_ACTION] } = {}) {
  const actions = { [T.CHECKED_ACTION]: idtags };
  if (outbox) actions[KEY] = outbox;
  return { success: true, signedIn: true, hasAssistant: true, actions };
}

module.exports = {
  KEY, PATH, NIP65, ACTION, DONE_BADGE,
  RELAY_LIST_KIND, MAX_RELAYS, MAX_PARSED_R_TAGS, RELAY_BUDGET_MS,
  PROFILE_PUBLISH_CATEGORIES, SUGGESTION_RELAY_CATEGORIES, PUBLISH_ROUTE,
  PAGE, SUBJECT, PUBLISH,
  OUT_A, OUT_B, IN_C, SUGGESTIONS, outboxAction, OUTBOX, attentionWith,
};
