/**
 * The Your Assistant's Treasure Map page's words and two pure helpers (assistant-self-map #1, ADR
 * assistant-self-map/0001 sub-decision 9 and Amendment 1 items 7–8).
 *
 * Pure, no imports, so Node suites can load it (test/assistant-self-map-page.test.js). Named apart from the page
 * (AssistantTreasureMap.jsx), as dutyMenuCopy.js is. The title, the description, the back link, "Needs attention",
 * "Done", the sign-in button and the no-assistant line are the hub's and the action entry's
 * (ui/src/pages/assistant/actions.js); the page imports those itself.
 *
 * The words were approved with the story; change them there first:
 * engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.md § Copy (with the three reasons
 * added at Architecture), and, for the buttons, the state line and the report,
 * engineering-team/stories/assistant-self-map/2-turning-the-self-map-on-and-off.md § Copy (ADR assistant-self-map/0002
 * sub-decision 7: selfMapStateLine and selfMapButtons). The server's summaries and refusals are the route's own.
 * engineering-team/stories/assistant-self-map/3-one-name-for-your-assistants-treasure-map.md § Copy then renamed every
 * line a person reads: "your Assistant's Treasure Map", never "self-Map", and what it holds for the Assistant is listed.
 * The names under the hood (SELF_MAP_COPY, selfMap*) are unchanged.
 * engineering-team/stories/assistant-self-map/4-show-your-assistants-raw-treasure-map.md § Copy adds the raw toggle's
 * words, and ADR assistant-self-map/0003 sub-decisions 2–4 the box's name, rawTreasureMap and rawTreasureMapText.
 */

export const SELF_MAP_COPY = {
  signedOutLine: "Sign in to see your Assistant's Treasure Map.",
  dutiesHeading: "Your Assistant's duties",
  dutiesExplainer: 'The duties your Treasure Map gives your Assistant, and which of them are live now.',
  statusWords: { active: 'Active', offered: 'Offered but not active', 'not-offered': 'Not offered' },
  reasons: {
    'live-unclaimed': "Live, but your Assistant's Treasure Map doesn't list it yet.",
    'not-published-here': "This instance doesn't publish these for your Assistant yet.",
    'nothing-to-publish': 'Nothing to publish yet.',
    'not-landed': 'Not published yet.',
    'older-form': "This instance publishes these in an older form that Treasure Map readers can't find yet.",
    'not-scheduled': 'Not kept up to date: no upkeep is scheduled on this instance.',
    unchecked: "This instance can't check this key yet, so it isn't listed.",
  },
  /** "Not kept up to date: last landed <date>." — the date is filled in by reasonLine. */
  upkeepStoppedLead: 'Not kept up to date: last landed',
  elsewhere: 'Your Treasure Map gives this to another Assistant.',
  falseClaim: "Your Assistant's Treasure Map lists this, but it isn't live.",
  noDuties: 'Your Treasure Map gives your Assistant no duties.',
  yourTreasureMap: 'your Treasure Map',
  shouldHeading: "What your Assistant's Treasure Map should list",
  shouldExplainer: 'Only the duties that are live now, each at the relay where it is published.',
  shouldEmpty: 'Nothing to list yet.',
  publishedHeading: "Your Assistant's published Treasure Map",
  checking: 'Checking…',
  none: "Your Assistant's Treasure Map lists none of its duties.",
  couldNotCheck: {
    'no-relay-answered': "No relay answered, so your Assistant's Treasure Map could not be checked.",
    'request-failed': 'Could not check: this instance did not answer.',
  },
  status: {
    upToDate: "Your Assistant's Treasure Map is up to date.",
    notPublished: "Your Assistant's Treasure Map doesn't list its live duties yet.",
    outOfDate: "Your Assistant's Treasure Map is out of date: it differs from the duties that are live now.",
  },
  links: {
    dutyMenuLead: 'What your Assistant offers:',
    dutyMenu: 'Duty Menu',
    treasureMapLead: 'The duties you give your Assistants:',
    treasureMap: 'your Treasure Map',
  },
  /** The Owner's line; `n` is the count of the event's entries naming other keys. */
  ownerLine: (n) => `Your Assistant's Treasure Map is also this instance's own Treasure Map. Its ${n} other entries are this instance's choices, not your Assistant's own duties, and this page never changes them.`,
  publicLine: "Your Assistant's Treasure Map is public. Anyone can read which duties it lists as live.",
  // The Treasure Map's category names, as /treasure-map names them.
  categories: { scores: 'Scores', lists: 'Lists', concepts: 'Concepts' },
  // Story 2: turning it on and off.
  press: {
    turnOn: "List your Assistant's live duties in its Treasure Map",
    update: "Update your Assistant's Treasure Map now",
    turnOff: "Remove your Assistant's duties from its Treasure Map",
    publishing: 'Publishing…',
    // The report's subject, as the server's summaries name it.
    subject: "Your Assistant's Treasure Map",
    // After a Turn off's summary.
    claimsNone: "Your Assistant's Treasure Map now lists none of its duties.",
    // A request that fails or never answers.
    requestFailed: 'This instance did not answer; nothing was published.',
  },
  state: {
    on: "Your Assistant's Treasure Map is set to list its live duties.",
    off: "Your Assistant's Treasure Map is set to list none of its duties.",
    offStillClaims: "Your Assistant's Treasure Map is set to list none of its duties, but the version found still lists some.",
  },
  // The Owner's note, by the buttons.
  ownerNote: "Listing or removing your Assistant's duties changes only those entries in this instance's own Treasure Map. Its other entries stay as they are.",
  // Story 4: the raw toggle. Each mark is drawn before its words, hidden from screen readers; boxLabel is the open box's
  // accessible name, never seen (ADR 0003 sub-decision 4).
  raw: {
    show: "Show your Assistant's raw Treasure Map",
    hide: "Hide your Assistant's raw Treasure Map",
    closedMark: '▸',
    openMark: '▾',
    boxLabel: "Your Assistant's raw Treasure Map",
  },
};

/** A Nostr created_at (seconds) as a plain date, e.g. "June 7, 2026"; null when there is none. */
function dateOf(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/**
 * The page's one status line for this action's answer (story AC-5, AC-6; ADR 0001 Amendment 1 item 7): up to date when
 * current; not published yet when nothing is claimed (no self-Map, or one with no self-entries); out of date
 * otherwise. None when the check did not finish, failed, or has not answered.
 * @param {?Object} answer - actions['treasure-map'] of the attention answer
 * @returns {?string}
 */
export function statusLine(answer) {
  if (!answer || typeof answer !== 'object' || answer.finished !== true) return null;
  const words = SELF_MAP_COPY.status;
  if (answer.current === true) return words.upToDate;
  const claimed = answer.published && Array.isArray(answer.published.selfEntries) ? answer.published.selfEntries.length : 0;
  return claimed === 0 ? words.notPublished : words.outOfDate;
}

/**
 * A duties line's reason, word for word (§ Copy; Amendment 1 item 7). upkeep-stopped carries its last landing as a
 * date, and has no line without one: § Copy gives no words for an unknown date (Amendment 2 item 7). None for a line
 * with no reason (an active one).
 * @param {?Object} line - one line of the answer's duties
 * @returns {?string}
 */
export function reasonLine(line) {
  if (!line || !line.reason) return null;
  if (line.reason === 'upkeep-stopped') {
    const date = dateOf(line.lastLandedAt);
    return date ? `${SELF_MAP_COPY.upkeepStoppedLead} ${date}.` : null;
  }
  return SELF_MAP_COPY.reasons[line.reason] || null;
}

/**
 * The could-not-check line for an unfinished answer's reason (Amendment 1 item 8): no-relay-answered names the relays;
 * anything else, and a failed request, says the instance did not answer.
 * @param {?string} reason
 */
export function couldNotCheckLine(reason) {
  return reason === 'no-relay-answered' ? SELF_MAP_COPY.couldNotCheck['no-relay-answered'] : SELF_MAP_COPY.couldNotCheck['request-failed'];
}

/** How many self-entries a finished check found (none for an unfinished one, whose found self-Map is unknown). */
function foundSelfEntries(answer) {
  if (!answer || answer.finished !== true || !answer.published || !Array.isArray(answer.published.selfEntries)) return 0;
  return answer.published.selfEntries.length;
}

/**
 * The page's one state line (story 2 AC-2, § Copy): on; off; off while the version found still claims duties. None when
 * the choice is unknown (a check that threw, an unreadable choice file) or there is no answer.
 * @param {?Object} answer - actions['treasure-map'] of the attention answer
 * @returns {?string}
 */
export function selfMapStateLine(answer) {
  if (!answer || typeof answer !== 'object') return null;
  if (answer.selfMapOn === true) return SELF_MAP_COPY.state.on;
  if (answer.selfMapOn === false) return foundSelfEntries(answer) > 0 ? SELF_MAP_COPY.state.offStillClaims : SELF_MAP_COPY.state.off;
  return null;
}

/**
 * Which buttons the page shows (story 2 AC-2; ADR 0002 sub-decision 7 with Amendment 1 item 4). Off or unknown: Turn on,
 * and Turn off when a finished check found self-entries or the check did not finish (the self-Map found is then
 * unknown), so no claim is stuck. On: Update now, enabled unless the self-Map is up to date, and Turn off. No answer yet:
 * none.
 * @param {?Object} answer
 * @returns {{ turnOn: boolean, update: { shown: boolean, enabled: boolean }, turnOff: boolean }}
 */
export function selfMapButtons(answer) {
  if (!answer || typeof answer !== 'object') return { turnOn: false, update: { shown: false, enabled: false }, turnOff: false };
  if (answer.selfMapOn === true) return { turnOn: false, update: { shown: true, enabled: answer.current !== true }, turnOff: true };
  return { turnOn: true, update: { shown: false, enabled: false }, turnOff: answer.finished !== true || foundSelfEntries(answer) > 0 };
}

/**
 * The found version of the Assistant's Treasure Map, for the raw view (story 4 AC-1, AC-3; ADR 0003 sub-decision 2):
 * the answer's `published.event` when the check finished and found a version, whatever it lists; null otherwise (no
 * answer, an unfinished or failed check, nothing found, or an `event` that is not an object).
 * @param {?Object} answer - actions['treasure-map'] of the attention answer
 * @returns {?Object}
 */
export function rawTreasureMap(answer) {
  if (!answer || typeof answer !== 'object' || answer.finished !== true) return null;
  const published = answer.published;
  if (!published || typeof published !== 'object') return null;
  const event = published.event;
  return event && typeof event === 'object' && !Array.isArray(event) ? event : null;
}

/** The raw view's text: the event exactly as it came, indented (ADR 0003 sub-decision 3, as /treasure-map's rawMapText); '' for none. */
export function rawTreasureMapText(event) {
  return event ? JSON.stringify(event, null, 2) : '';
}
