'use strict';
/**
 * The approved words and shapes of book assistant-identification-tags, as its stories and ADRs state them, re-aimed
 * by book identification-tags-authorship #1 (each definition has its author; My Agent and My Human are parked). One
 * copy, shared by the Node suites (test/assistant-attention.test.js, …) and the browser suites
 * (tests/brainstorm/assistant-attention.spec.js, and the re-aimed assistant-alert / assistant-management-page specs),
 * so they cannot disagree about what the owner approved.
 *
 * Source of truth: engineering-team/stories/done/assistant-identification-tags/1-…md, 2-…md, 3-…md (approved
 * 2026-09-22), engineering-team/stories/identification-tags-authorship/1-two-authored-tags-and-two-parked-taggings.md
 * (approved 2026-09-22) and its ADR 0001. Change a word there first, then here.
 */

// ─── The two definition authors (identification-tags-authorship #1 § Background; ADR 0001 sub-decision 1) ───────
// Found on the relays 2026-09-22: "My Tapestry Assistant" by Nous 🧠, "My Tapestry Owner" by Nous 🧠's Tapestry
// Assistant. Constants of the list, the same on every instance — never a runtime TA, never a read filter.
const AUTHORS = {
  'my-tapestry-assistant': { name: 'Nous', npub: 'npub1zhma4lzxyjc7dvq2klux8hs62wm3je6jspcwclgcxlr6grquwfcq28ccgm', hex: '15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270' },
  'my-tapestry-owner': { name: "Nous' Tapestry Assistant", npub: 'npub15uaznqrgf946yhva0u6c88jk3r9kp64cn4dt5z24yrtcxk5lj55q2fvc99', hex: 'a73a298068496ba25d9d7f35839e5688cb60eab89d5aba095520d7835a9f9528' },
};

/** The address of an offered entry's definition (ADR 0001 sub-decision 1); null for a parked one. */
const definitionAddress = (entry) => (entry && entry.offered && entry.author ? `39999:${entry.author}:${entry.slug}` : null);

// ─── The four taggings, in order (assistant-identification-tags #1 AC-1; Discovery decision 6: "My Owner" became
// "My Human"; identification-tags-authorship #1 AC-1: offered / parked, and each definition's author) ─────────────
// signer: who signs the tagging; target: whom it tags; offered: whether the page can issue it today.
const REQUIRED = [
  { key: 'my-tapestry-assistant', name: 'My Tapestry Assistant', slug: 'my-tapestry-assistant', signer: 'person', target: 'assistant', offered: true, author: AUTHORS['my-tapestry-assistant'].hex },
  { key: 'my-agent', name: 'My Agent', slug: 'my-agent', signer: 'person', target: 'assistant', offered: false, author: null },
  { key: 'my-tapestry-owner', name: 'My Tapestry Owner', slug: 'my-tapestry-owner', signer: 'assistant', target: 'person', offered: true, author: AUTHORS['my-tapestry-owner'].hex },
  { key: 'my-human', name: 'My Human', slug: 'my-human', signer: 'assistant', target: 'person', offered: false, author: null },
].map((e) => ({ ...e, address: definitionAddress(e) }));
const OFFERED = REQUIRED.filter((e) => e.offered);
const PARKED = REQUIRED.filter((e) => !e.offered);

/** The action this book gives a real check (ADR 0001 sub-decision 6: CHECKED_ACTIONS). */
const CHECKED_ACTION = 'identification-tags';

/**
 * The replaceable address of one signer's stance on one slug and one target — the publisher's rule
 * (ui/src/utils/publishProfileTag.js, `profile-tag-${tag.slug}-${targetPubkey.slice(0, 8)}-${authorPk.slice(0, 8)}`),
 * which ADR 0001 sub-decision 3 looks taggings up by.
 */
const taggingDTag = ({ slug, targetPubkey, signerPubkey }) => `profile-tag-${slug}-${targetPubkey.slice(0, 8)}-${signerPubkey.slice(0, 8)}`;

// ─── Canned answers of GET /api/assistant/attention (ADR 0001 § Implementation notes 2): one row per OFFERED tagging,
// never a parked one (identification-tags-authorship #1 AC-2) ──────────────────────────────────────────────────────
const SIGNED_OUT = { success: true, signedIn: false };
const NO_ASSISTANT = { success: true, signedIn: true, hasAssistant: false, actions: {} };

/** One tagging's row, with every field the answer carries; `over` adjusts it. */
function taggingRow(entry, over = {}) {
  return {
    key: entry.key, name: entry.name, slug: entry.slug, signer: entry.signer, target: entry.target,
    present: true, finished: true, source: 'local',
    definition: { finished: true, found: true, source: 'local', eventId: `${entry.slug.replace(/-/g, '')}00`.padEnd(64, '0').slice(0, 64), address: definitionAddress(entry) },
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

/** Both offered taggings present and finished: the action is done. The hub marks nine; the pill says nine. */
const DONE = attentionAnswer({ finished: true, done: true, pending: false, rows: OFFERED.map((e) => taggingRow(e)) });

/** "My Tapestry Assistant" present, "My Tapestry Owner" missing (finished): pending. The hub marks ten; the pill says ten. */
const PENDING = attentionAnswer({
  finished: true, done: false, pending: true,
  rows: OFFERED.map((e) => taggingRow(e, e.key === 'my-tapestry-owner' ? { present: false, source: null } : {})),
});

/** Nothing could be checked (no outside relay configured, nothing local): unfinished. The hub marks ten; the pill says nine. */
const UNFINISHED = attentionAnswer({
  finished: false, done: false, pending: false,
  rows: OFFERED.map((e) => taggingRow(e, {
    present: false, finished: false, source: null, reason: 'no-outside-relays',
    definition: { finished: false, found: null, source: null, reason: 'no-outside-relays', eventId: null, address: definitionAddress(e) },
  })),
});

// ─── Story 2: the page (story § Copy, as amended by ADR 0002 sub-decision 5; the parked words from
// identification-tags-authorship #1 § Copy) ───────────────────────────────────────────────────────────────────────
const PAGE = '/assistant/identification-tags';

/** The page's own words. The heading, the description, "Needs attention" and the sign-in / no-assistant lines are the
 *  hub's (assistantManagementFixtures) and the action entry's; these are new here. */
const PAGE_COPY = {
  treasureMap: 'Your Treasure Map tells apps what your Assistant publishes for you; these tags are simply an additional mechanism to associate you and your Assistant.',
  cards: { person: 'Taggings you put on your Assistant', assistant: 'Taggings your Assistant puts on you' },
  states: { present: 'Present', missing: 'Missing', checking: 'Checking…', parked: 'Not offered yet' },
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

/** Every offered tagging missing, every definition found: the publishable state. */
const MISSING_ALL = attentionAnswer({
  finished: true, done: false, pending: true,
  rows: OFFERED.map((e) => taggingRow(e, { present: false, source: null })),
});

/** As MISSING_ALL, but "My Tapestry Assistant"'s definition is not found (finished). */
const TAG_NOT_FOUND = attentionAnswer({
  finished: true, done: false, pending: true,
  rows: OFFERED.map((e) => taggingRow(e, {
    present: false, source: null,
    ...(e.key === 'my-tapestry-assistant' ? { definition: { finished: true, found: false, source: null, eventId: null, address: definitionAddress(e) } } : {}),
  })),
});

// ─── Story 3: your Assistant's taggings (story § Copy; ADR 0003 sub-decisions 2, 6, 8) ─────────────────────────
const PUBLISH_ROUTE = '/api/assistant/identification-tags/publish';

/** The route's refusal words (story 3 § Copy) and the page's notice for a request that never answered. */
const REFUSALS = {
  'not-signed-in': "Sign in to have your Assistant publish its taggings.",
  'no-assistant': "You don't have a Tapestry Assistant on this instance yet.",
  'not-an-assistant-tagging': "That is not one of the taggings your Assistant publishes.",
};
const REQUEST_FAILED = 'This instance did not answer; nothing was published.';

/** One published tagging's row in the route's answer, in the profile publish's words. */
function serverPublishedRow(entry, { relays = ['wss://a.example', 'wss://b.example'], accepted = relays.length, localOnly = false } = {}) {
  const rows = relays.map((relay, i) => (localOnly
    ? { relay, status: 'skipped', reason: 'local-only publish mode' }
    : { relay, status: i < accepted ? 'accepted' : 'refused', reason: i < accepted ? '' : 'blocked' }));
  const subject = `"${entry.name}"`;
  let outcome, message;
  if (localOnly) { outcome = 'kept-local'; message = `${subject} was saved on this instance's relay only: local-only publish mode is on, so it was not sent to any other relay.`; }
  else if (accepted > 0) { outcome = 'published'; message = `${subject} was saved on this instance's relay and accepted by ${accepted} of ${relays.length} relays.` + (accepted < relays.length ? ` ${relays.length - accepted} did not accept it; see below.` : ''); }
  else { outcome = 'not-delivered'; message = `${subject} was saved on this instance's relay, but none of the ${relays.length} relays accepted it; see below.`; }
  return { key: entry.key, name: entry.name, ok: true, outcome, message, localOnly, relays: { total: rows.length, success: localOnly ? 0 : accepted, results: rows } };
}
function serverLocalFailedRow(entry, reason = 'strfry import failed') {
  return { key: entry.key, name: entry.name, ok: false, stage: 'local', outcome: 'not-delivered', localOnly: false,
    message: `"${entry.name}" could not be saved on this instance's relay (${reason}), so it was not sent to any other relay.`,
    relays: { total: 0, success: 0, results: [] } };
}
function serverTagNotFoundRow(entry) {
  return { key: entry.key, name: entry.name, ok: false, code: 'tag-not-found', message: PAGE_COPY.tagNotFound(entry.name) };
}
const serverAnswer = (rows) => ({ success: true, results: rows });
const serverRefusal = (code) => ({ success: false, code, error: REFUSALS[code] });

module.exports = {
  AUTHORS, REQUIRED, OFFERED, PARKED, CHECKED_ACTION,
  definitionAddress, taggingDTag, taggingRow, attentionAnswer,
  SIGNED_OUT, NO_ASSISTANT, DONE, PENDING, UNFINISHED,
  PAGE, PAGE_COPY, PUBLISH_WORDS, MISSING_ALL, TAG_NOT_FOUND,
  PUBLISH_ROUTE, REFUSALS, REQUEST_FAILED, serverPublishedRow, serverLocalFailedRow, serverTagNotFoundRow, serverAnswer, serverRefusal,
};
