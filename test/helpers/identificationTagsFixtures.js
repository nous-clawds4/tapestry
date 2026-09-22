'use strict';
/**
 * The approved words and shapes of book assistant-identification-tags, as its stories and ADRs state them. One copy,
 * shared by the Node suites (test/assistant-attention.test.js, …) and the browser suites
 * (tests/brainstorm/assistant-attention.spec.js, and the re-aimed assistant-alert / assistant-management-page specs),
 * so they cannot disagree about what the owner approved.
 *
 * Source of truth: engineering-team/stories/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.md
 * (approved 2026-09-22), ADR assistant-identification-tags/0001, and the discovery brief's decisions
 * (product-team/discoveries/assistant-identification-tags.md). Change a word there first, then here.
 */

// ─── The canonical author (Discovery decision 5; story 1 open question 1, settled 2026-09-22) ────────────
// The owner's own key, BIBLE §20's npub for wds4/straycat. A publishing convention for four well-known tag
// definitions — never a TA pubkey, never a read filter, never a signer.
const CANONICAL_TAG_AUTHOR_NPUB = 'npub1u5njm6g5h5cpw4wy8xugu62e5s7f6fnysv0sj0z3a8rengt2zqhsxrldq3';
const CANONICAL_TAG_AUTHOR = 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f';

// ─── The four required taggings, in order (story 1 AC-1; Discovery decision 6: "My Owner" became "My Human") ──
// signer: who signs the tagging; target: whom it tags.
const REQUIRED = [
  { key: 'my-tapestry-assistant', name: 'My Tapestry Assistant', slug: 'my-tapestry-assistant', signer: 'person', target: 'assistant' },
  { key: 'my-agent', name: 'My Agent', slug: 'my-agent', signer: 'person', target: 'assistant' },
  { key: 'my-tapestry-owner', name: 'My Tapestry Owner', slug: 'my-tapestry-owner', signer: 'assistant', target: 'person' },
  { key: 'my-human', name: 'My Human', slug: 'my-human', signer: 'assistant', target: 'person' },
];

/** The action this book gives a real check (ADR 0001 sub-decision 6: CHECKED_ACTIONS). */
const CHECKED_ACTION = 'identification-tags';

/** The canonical address of a required tag's definition (ADR 0001 sub-decision 2). */
const canonicalTagAddress = (slug) => `39999:${CANONICAL_TAG_AUTHOR}:${slug}`;

/**
 * The replaceable address of one signer's stance on one slug and one target — the publisher's rule
 * (ui/src/utils/publishProfileTag.js, `profile-tag-${tag.slug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`),
 * which ADR 0001 sub-decision 3 looks taggings up by.
 */
const taggingDTag = ({ slug, targetPubkey, signerPubkey }) => `profile-tag-${slug}-${targetPubkey.slice(0, 8)}-${signerPubkey.slice(0, 8)}`;

// ─── Canned answers of GET /api/assistant/attention (ADR 0001 § Implementation notes 2) ─────────────────
const SIGNED_OUT = { success: true, signedIn: false };
const NO_ASSISTANT = { success: true, signedIn: true, hasAssistant: false, actions: {} };

/** One tagging's row, with every field the answer carries; `over` adjusts it. */
function taggingRow(entry, over = {}) {
  return {
    key: entry.key, name: entry.name, slug: entry.slug, signer: entry.signer, target: entry.target,
    present: true, finished: true, source: 'local',
    definition: { finished: true, found: true, source: 'local', eventId: `${entry.slug.replace(/-/g, '')}00`.padEnd(64, '0').slice(0, 64), address: canonicalTagAddress(entry.slug) },
    ...over,
  };
}

/** A signed-in answer for a viewer with an assistant, with the checked action's flags and rows as given. */
function attentionAnswer({ finished, done, pending, rows }) {
  return {
    success: true, signedIn: true, hasAssistant: true,
    actions: { [CHECKED_ACTION]: { finished, done, pending, taggings: rows } },
  };
}

/** Every tagging present and finished: the action is done. The hub marks nine; the pill says nine. */
const DONE = attentionAnswer({ finished: true, done: true, pending: false, rows: REQUIRED.map((e) => taggingRow(e)) });

/** Three present, "My Human" missing (finished): pending. The hub marks ten; the pill says ten. */
const PENDING = attentionAnswer({
  finished: true, done: false, pending: true,
  rows: REQUIRED.map((e) => taggingRow(e, e.key === 'my-human' ? { present: false, source: null } : {})),
});

/** Nothing could be checked (no outside relay configured, nothing local): unfinished. The hub marks ten; the pill says nine. */
const UNFINISHED = attentionAnswer({
  finished: false, done: false, pending: false,
  rows: REQUIRED.map((e) => taggingRow(e, {
    present: false, finished: false, source: null, reason: 'no-outside-relays',
    definition: { finished: false, found: null, source: null, reason: 'no-outside-relays', eventId: null, address: canonicalTagAddress(e.slug) },
  })),
});

// ─── Story 2: the page (story § Copy, as amended by ADR 0002 sub-decision 5) ───────────────────────────
const PAGE = '/assistant/identification-tags';

/** The page's own words. The heading, the description, "Needs attention" and the sign-in / no-assistant lines are the
 *  hub's (assistantManagementFixtures) and the action entry's; these are new here. */
const PAGE_COPY = {
  treasureMap: 'Your Treasure Map tells apps what your Assistant publishes for you; these tags are simply an additional mechanism to associate you and your Assistant.',
  cards: { person: 'Taggings you put on your Assistant', assistant: 'Taggings your Assistant puts on you' },
  states: { present: 'Present', missing: 'Missing', checking: 'Checking…' },
  tagNotFound: (name) => `Tag not found: the tag "${name}" has not been published yet, so this tagging can't be made here.`,
  couldNotCheck: {
    'local-unreadable': "Could not read this instance's relay.",
    'no-outside-relays': "Not found on this instance's relay, and no outside relay is configured to check.",
    'outside-unreachable': "Not found on this instance's relay, and no outside relay answered.",
    'request-failed': 'Could not check: this instance did not answer.',
  },
  definitionUnknown: "Its tag definition could not be checked, so it can't be published yet.",
  buttons: { person: 'Publish with your nostr extension', assistant: 'Have your Assistant publish' },
  publishing: 'Publishing…',
  signedOutLine: 'Sign in to see your identification tags.',
  noExtension: 'No nostr extension was found. Install one to publish taggings.',
  signatureRefused: (name, reason) => `"${name}" was not published: your nostr extension did not sign it (${reason}).`,
  doneBadge: 'Done',
  doneSrPrefix: 'Done: ',
};

/** The per-tagging publish summaries (story § Copy; ADR 0002 sub-decision 5 for a failed local write). */
const PUBLISH_WORDS = {
  published: (name, a, n) => `"${name}" was saved on this instance's relay and accepted by ${a} of ${n} relays.`,
  partly: (n, a) => ` ${n - a} did not accept it; see below.`,
  none: (name, n) => `"${name}" was saved on this instance's relay, but none of the ${n} relays accepted it; see below.`,
  keptLocal: (name) => `"${name}" was saved on this instance's relay only: local-only publish mode is on, so it was not sent to any other relay.`,
  noRelays: (name) => `"${name}" was saved on this instance's relay only: no outside relay was given.`,
  localFailedSome: (name, reason, a, n) => `"${name}" could not be saved on this instance's relay (${reason}), but ${a} of ${n} relays accepted it.`,
  localFailedNone: (name, reason, n) => `"${name}" could not be saved on this instance's relay (${reason}), and none of the ${n} relays accepted it.`,
  localFailedKept: (name, reason) => `"${name}" could not be saved on this instance's relay (${reason}), and local-only publish mode kept it from any other relay.`,
  relay: { accepted: 'accepted', refused: (r) => (r ? `rejected: ${r}` : 'rejected'), unreachable: (r) => (r ? `unreachable: ${r}` : 'unreachable'), timeout: (r) => (r ? `timed out: ${r}` : 'timed out'), skipped: 'skipped (local-only publish mode)' },
};

/** Every tagging missing, every definition found: the publishable state. */
const MISSING_ALL = attentionAnswer({
  finished: true, done: false, pending: true,
  rows: REQUIRED.map((e) => taggingRow(e, { present: false, source: null })),
});

/** As MISSING_ALL, but "My Agent"'s canonical definition is not found (finished). */
const TAG_NOT_FOUND = attentionAnswer({
  finished: true, done: false, pending: true,
  rows: REQUIRED.map((e) => taggingRow(e, {
    present: false, source: null,
    ...(e.key === 'my-agent' ? { definition: { finished: true, found: false, source: null, eventId: null, address: canonicalTagAddress(e.slug) } } : {}),
  })),
});

module.exports = {
  CANONICAL_TAG_AUTHOR, CANONICAL_TAG_AUTHOR_NPUB, REQUIRED, CHECKED_ACTION,
  canonicalTagAddress, taggingDTag, taggingRow, attentionAnswer,
  SIGNED_OUT, NO_ASSISTANT, DONE, PENDING, UNFINISHED,
  PAGE, PAGE_COPY, PUBLISH_WORDS, MISSING_ALL, TAG_NOT_FOUND,
};
