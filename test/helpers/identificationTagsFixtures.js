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

module.exports = {
  CANONICAL_TAG_AUTHOR, CANONICAL_TAG_AUTHOR_NPUB, REQUIRED, CHECKED_ACTION,
  canonicalTagAddress, taggingDTag, taggingRow, attentionAnswer,
  SIGNED_OUT, NO_ASSISTANT, DONE, PENDING, UNFINISHED,
};
