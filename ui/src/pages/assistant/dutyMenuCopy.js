/**
 * The Duty Menu page's words and two pure helpers (assistant-duty-menu #1, ADR assistant-duty-menu/0001
 * sub-decision 6).
 *
 * Pure, no imports, so Node suites can load it (test/assistant-duty-menu-page.test.js). Named apart from the page
 * (DutyMenu.jsx): a module that differs from a page only by case resolves to the wrong file on a case-insensitive
 * filesystem (ADR assistant-identification-tags/0002 Amendment 1). The title, the description, the back link, "Needs
 * attention", "Done", the sign-in button and the no-assistant line are the hub's and the action entry's
 * (ui/src/pages/assistant/actions.js); the page imports those itself.
 *
 * The words were approved with the story; change them there first:
 * engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.md § Copy.
 */

export const DUTY_MENU_COPY = {
  signedOutLine: "Sign in to see your Assistant's Duty Menu.",
  offerHeading: 'What your Assistant offers',
  offerExplainer: 'Duties this instance publishes for your Assistant, and the relay where each is published.',
  offerEmpty: 'This instance publishes no duties for your Assistant yet.',
  notOffered: 'not offered',
  publishedHeading: "Your Assistant's published Duty Menu",
  checking: 'Checking…',
  none: 'Your Assistant has not published a Duty Menu yet.',
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
  // The Treasure Map's category names, as /treasure-map names them.
  categories: { scores: 'Scores', lists: 'Lists', concepts: 'Concepts' },
};

/**
 * The Treasure Map category a row's key belongs to, by its kind slot: 30380–30389 and `3038x` are Scores, 30390–30399
 * and `3039x` Lists, 39998 and 39999 Concepts, and a bare `*` all three, joined. It mirrors the Treasure Map rule's
 * appliesTo (src/lib/treasureMapCategories.mjs), so the page and /treasure-map sort a key the same way. null for a
 * key in none.
 * @param {string} key - a normalized Treasure Map key
 * @returns {?string}
 */
export function categoryOf(key) {
  const names = DUTY_MENU_COPY.categories;
  const s = typeof key === 'string' ? key : '';
  const colon = s.indexOf(':');
  const slot = colon < 0 ? s : s.slice(0, colon);
  if (/^\d{5}$/.test(slot)) {
    const kind = Number(slot);
    if (kind >= 30380 && kind <= 30389) return names.scores;
    if (kind >= 30390 && kind <= 30399) return names.lists;
    return kind === 39998 || kind === 39999 ? names.concepts : null;
  }
  if (slot === '3038x') return names.scores;
  if (slot === '3039x') return names.lists;
  if (slot === '*' && /^:*$/.test(colon < 0 ? '' : s.slice(colon + 1))) return `${names.scores}, ${names.lists} and ${names.concepts}`;
  return null;
}

/**
 * The page's one status line for this action's answer (story AC-4, AC-5): up to date when the menu found is current,
 * not published yet when none was found, out of date otherwise. None when the check did not finish, failed, or has
 * not answered: the published panel's reason line is then the only line (ADR 0001 Amendment 1 item 1).
 * @param {?Object} answer - actions['duty-menu'] of the attention answer
 * @returns {?string}
 */
export function statusLine(answer) {
  if (!answer || typeof answer !== 'object' || answer.finished !== true) return null;
  const words = DUTY_MENU_COPY.status;
  if (!answer.published) return words.notPublished;
  return answer.current === true ? words.upToDate : words.outOfDate;
}
