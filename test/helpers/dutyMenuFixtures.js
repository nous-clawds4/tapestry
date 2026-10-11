'use strict';
/**
 * The approved words, constants and answer shapes of book assistant-duty-menu, as its story and ADR state them. One
 * copy, shared by the Node suites (test/assistant-duty-menu-check.test.js, test/assistant-duty-menu-page.test.js), the
 * browser suite (tests/brainstorm/assistant-duty-menu.spec.js), and the hub fixtures and specs this story re-aims
 * (test/helpers/dutyCardsFixtures.js, which the hub fixture reads), so they cannot disagree about what the owner approved.
 *
 * Story 2 (engineering-team/stories/assistant-duty-menu/2-your-assistant-publishes-its-duty-menu.md § Copy, approved
 * 2026-10-11; ADR 0002) adds PUBLISH and PUBLISH_SENTENCES.
 *
 * Source of truth: engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.md (approved
 * 2026-10-11; AC-2 amended at Architecture, § Copy's none line and AC-3 amended before Review, § Deviations) and
 * engineering-team/decisions/assistant-duty-menu/0001-a-duty-menu-check-beside-the-others.md (accepted 2026-10-11, R1
 * and K1), following protocols/drafts/duty-menus.md §§ 4, 5, 6.1 and 8.1. Change a word there first, then here.
 *
 * Standalone on purpose (it requires no other fixture), so dutyCardsFixtures.js can read the Duty Menu card's new
 * alert criteria from here without a require cycle.
 */

// ─── The wire facts (duty-menus.md §§ 2–4; ADR 0001 sub-decision 1 and § Implementation notes) ─────────────────────
/** Nous, the key that publishes the shared header: a fixed community constant, never the per-deployment TA. */
const NOUS_PUBKEY = '15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270';
const DUTY_MENU_KIND = 39999;
const DUTY_MENU_D = 'duty-menu';
const DUTY_MENU_HEADER = `39998:${NOUS_PUBKEY}:duty-menu`;
/** § 8.1's filter for one key's menu. */
const menuFilter = (author) => ({ kinds: [DUTY_MENU_KIND], authors: [author], '#d': [DUTY_MENU_D] });
const RELAY_LIST_KIND = 10002;
const TREASURE_MAP_KIND = 10040;

// ─── The check's timing and bounds (ADR 0001 sub-decision 3; Amendment 2 item 2) ─────────────────────────────────────
const RELAY_BUDGET_MS = 8000;
/** At most this many relays named inside events are guarded and read per check (MAX_RELAYS, src/lib/relay-list). */
const MAX_EVENT_RELAYS = 50;
/** A found Nous relay list is remembered in-process for one hour; a miss never is. */
const NOUS_CACHE_MS = 60 * 60 * 1000;

// ─── The action (story AC-4, ADR 0001 sub-decision 6) ────────────────────────────────────────────────────────────────
const KEY = 'duty-menu';
const PATH = '/assistant/duty-menu';
const ALERT_CRITERIA = 'If your Assistant has not published a Duty Menu, or the one it published differs from what this instance offers for it now.';
const PLANNING_NOTES = null;
/** The action it follows in CHECKED_ACTIONS (ADR 0001 sub-decision 6), and the placeholder that stays one (AC-4). */
const CHECKED_AFTER = 'outbox-relays';
const STILL_PLACEHOLDER = 'treasure-map';

// ─── The offer (story AC-2 as amended; ADR 0001 R1 and K1) ──────────────────────────────────────────────────────────
/** K1: the kinds actually built, by category, in the offer's order: Scores, Lists, Concepts. */
const OFFER_KEYS = { scores: ['30382'], lists: ['30392', '30393', '30394'], concepts: ['39998', '39999'] };
/** The Treasure Map's category names (story § Copy: /treasure-map's). */
const CATEGORY_NAMES = { scores: 'Scores', lists: 'Lists', concepts: 'Concepts' };

/**
 * The offer ADR 0001 sub-decision 1 says buildOffer gives: 30382 when `scores`, at ownRelay; the three List kinds at
 * ownRelay; 39998 and 39999 at ownRelay, else dlistRelay; a row whose relay is null left out; Scores, Lists, Concepts.
 * The suites' oracle — written from the ADR, not from the code.
 */
function expectedOffer({ ownRelay = null, dlistRelay = null, scores = false } = {}) {
  const rows = [];
  const add = (key, relay) => { if (relay) rows.push({ tag: 'duty', key, relay }); };
  if (scores) for (const k of OFFER_KEYS.scores) add(k, ownRelay);
  for (const k of OFFER_KEYS.lists) add(k, ownRelay);
  for (const k of OFFER_KEYS.concepts) add(k, ownRelay || dlistRelay);
  return rows;
}

// ─── The page's words (story § Copy) ────────────────────────────────────────────────────────────────────────────────
const PAGE = {
  signedOutLine: "Sign in to see your Assistant's Duty Menu.",
  offerHeading: 'What your Assistant offers',
  offerExplainer: 'Duties this instance publishes for your Assistant, and the relay where each is published.',
  offerEmpty: 'This instance publishes no duties for your Assistant yet.',
  notOffered: 'not offered',
  publishedHeading: "Your Assistant's published Duty Menu",
  checking: 'Checking…',
  // Amended 2026-10-11 (ADR 0001 Amendment 2 item 3): it was the status line's sentence, so the page said it twice.
  none: 'No Duty Menu was found for your Assistant.',
  couldNotCheck: {
    'no-relay-answered': "No relay answered, so your Assistant's Duty Menu could not be checked.",
    'request-failed': 'Could not check: this instance did not answer.',
  },
  status: {
    upToDate: "Your Assistant's Duty Menu is up to date.",
    notPublished: 'Your Assistant has not published a Duty Menu yet.',
    outOfDate: "Your Assistant's published Duty Menu is out of date: it differs from what your Assistant offers now.",
  },
  publicLine: "Your Assistant's Duty Menu is public. Anyone can find it, and list it among every Assistant's Duty Menu.",
};

// ─── Story 2: the publish (story 2 § Copy; ADR 0002 sub-decisions 1, 5, 8) ──────────────────────────────────────────
const PUBLISH_SUBJECT = "Your Assistant's Duty Menu";
const PUBLISH = {
  route: '/api/assistant/duty-menu/publish',
  button: 'Have your Assistant publish its Duty Menu',
  publishing: 'Publishing…',
  subject: PUBLISH_SUBJECT,
  // After the summary, when the menu written has no rows.
  empty: "Your Assistant's Duty Menu now lists no duties.",
  requestFailed: 'This instance did not answer; nothing was published.',
  // AC-6: the published panel, when the menu found has no rows.
  emptyMenu: "Your Assistant's Duty Menu lists no duties.",
  codes: { notSignedIn: 'not-signed-in', noAssistant: 'no-assistant' },
  refusals: {
    'not-signed-in': 'Sign in to have your Assistant publish its Duty Menu.',
    'no-assistant': "You don't have a Tapestry Assistant on this instance yet.",
  },
  failed: "Could not publish your Assistant's Duty Menu",
  notSent: { status: 'not-sent', reason: 'not a public address', line: 'not sent: not a public address' },
  skipped: { status: 'skipped', reason: 'local-only publish mode' },
  // The profile publish's sentence shapes (src/api/assistant/profilePublish.js summarizePublish), with this subject.
  published: (a, n) => `${PUBLISH_SUBJECT} was saved on this instance's relay and accepted by ${a} of ${n} relays.${a < n ? ` ${n - a} did not accept it; see below.` : ''}`,
  noneAccepted: (n) => `${PUBLISH_SUBJECT} was saved on this instance's relay, but none of the ${n} relays accepted it; see below.`,
  localOnly: `${PUBLISH_SUBJECT} was saved on this instance's relay only: local-only publish mode is on, so it was not sent to any other relay.`,
  localFailed: (reason) => `${PUBLISH_SUBJECT} could not be saved on this instance's relay (${reason}), so it was not sent to any other relay.`,
};
/** Story 2's sentences the page shows from its copy module, never typed into the JSX. */
const PUBLISH_SENTENCES = [PUBLISH.button, PUBLISH.empty, PUBLISH.requestFailed, PUBLISH.emptyMenu];

/** Every sentence § Copy gives this page (not the hub's shared words), for "is it there" and "is it retyped" checks. */
const PAGE_SENTENCES = [
  PAGE.signedOutLine, PAGE.offerHeading, PAGE.offerExplainer, PAGE.offerEmpty, PAGE.publishedHeading, PAGE.none,
  PAGE.couldNotCheck['no-relay-answered'], PAGE.couldNotCheck['request-failed'],
  PAGE.status.upToDate, PAGE.status.notPublished, PAGE.status.outOfDate, PAGE.publicLine,
];

// ─── Canned answers of GET /api/assistant/attention for this action (ADR 0001 sub-decision 4) ───────────────────────
const OWN = 'wss://tapestry.example/relay';
const OFFER = expectedOffer({ ownRelay: OWN, scores: true });
const shuffled = (rows) => rows.slice().reverse();

/** The duty-menu action, with every field the answer carries; `over` adjusts it. */
function action(over = {}) {
  return {
    finished: true, done: true, pending: false, reason: null,
    offer: OFFER.slice(),
    published: { rows: shuffled(OFFER), createdAt: 1_760_000_000, source: 'local', eventId: 'd'.repeat(64) },
    current: true,
    ...over,
  };
}
const STALE_ROWS = OFFER.map((r) => (r.key === '30382' ? { ...r, relay: 'wss://elsewhere.example' } : r));
const ANSWERS = {
  DONE: action(),
  NONE: action({ done: false, pending: true, published: null, current: false }),
  STALE: action({ done: false, pending: true, current: false, published: { rows: STALE_ROWS, createdAt: 1_759_000_000, source: 'relay', eventId: 'e'.repeat(64) } }),
  UNFINISHED: action({ finished: false, done: false, pending: false, reason: 'no-relay-answered', published: null, current: null }),
  CHECK_FAILED: { finished: false, done: false, pending: false, reason: 'check-failed', offer: [], published: null, current: null },
  EMPTY_DONE: action({ offer: [], published: { rows: [], createdAt: 1_760_000_000, source: 'local', eventId: 'f'.repeat(64) } }),
  EMPTY_NONE: action({ offer: [], done: false, pending: true, published: null, current: false }),
};

/**
 * An attention answer with a duty-menu action added, unless it already has one (the trustedContentFixtures.withTrio
 * pattern). The default, a finished check that found no menu, is pending: it marks AND counts the card, as the
 * placeholder did, so a suite that pins counts about another action keeps them.
 */
function withDutyMenu(answer, dutyMenu = ANSWERS.NONE) {
  if (!answer || typeof answer !== 'object' || !answer.actions || typeof answer.actions !== 'object') return answer;
  if (Object.prototype.hasOwnProperty.call(answer.actions, KEY)) return answer;
  return { ...answer, actions: { ...answer.actions, [KEY]: dutyMenu } };
}

module.exports = {
  NOUS_PUBKEY, DUTY_MENU_KIND, DUTY_MENU_D, DUTY_MENU_HEADER, menuFilter, RELAY_LIST_KIND, TREASURE_MAP_KIND,
  RELAY_BUDGET_MS, MAX_EVENT_RELAYS, NOUS_CACHE_MS,
  KEY, PATH, ALERT_CRITERIA, PLANNING_NOTES, CHECKED_AFTER, STILL_PLACEHOLDER,
  OFFER_KEYS, CATEGORY_NAMES, expectedOffer,
  PAGE, PAGE_SENTENCES, PUBLISH, PUBLISH_SENTENCES,
  OWN, OFFER, STALE_ROWS, action, ANSWERS, withDutyMenu,
};
