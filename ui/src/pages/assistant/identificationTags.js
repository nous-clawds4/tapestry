/**
 * The Identification Tags page's words and rules (assistant-identification-tags #2, ADR 0002 sub-decision 2).
 *
 * Pure, no imports, so Node suites can load it (test/assistant-identification-tags-page.test.js). The heading, the
 * description, "Needs attention" and its screen-reader prefix, the sign-in button and the no-assistant line are the
 * hub's and the action entry's (ui/src/pages/assistant/actions.js); the page imports those itself.
 *
 * The words were approved with the story; change them there first:
 * engineering-team/stories/assistant-identification-tags/2-the-page-and-your-two-taggings.md § Copy, as amended by
 * ADR 0002 sub-decision 5 (the failed-local-write lines live in ui/src/utils/taggingPublishReport.js).
 */

export const IDENTIFICATION_TAGS_COPY = {
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

/**
 * One row's state, from the required entry, its row in the /api/assistant/attention answer (or null) and the
 * provider's phase (AC-2, AC-3).
 *   unknown          — nothing to show: signed out, or no assistant here (phase idle)
 *   checking         — the answer is on its way
 *   present, missing — a finished check
 *   tag-not-found    — the canonical definition was looked for and not found, whatever the check found
 *   could-not-check  — the check did not finish (`reason`), or the request failed (`request-failed`)
 * `definitionKnown` is true only when the definition was found, which a publish needs (its eventId).
 * @returns {{ state: string, reason: ?string, definitionKnown: boolean }}
 */
export function rowState(entry, answerRow, phase) {
  if (phase === 'idle') return { state: 'unknown', reason: null, definitionKnown: false };
  if (phase === 'checking') return { state: 'checking', reason: null, definitionKnown: false };
  if (phase !== 'answered' || !answerRow || typeof answerRow !== 'object') {
    return { state: 'could-not-check', reason: 'request-failed', definitionKnown: false };
  }
  const definition = answerRow.definition && typeof answerRow.definition === 'object' ? answerRow.definition : {};
  const definitionKnown = definition.found === true;
  if (definition.finished === true && definition.found === false) return { state: 'tag-not-found', reason: null, definitionKnown };
  if (answerRow.finished === true) return { state: answerRow.present === true ? 'present' : 'missing', reason: null, definitionKnown };
  return { state: 'could-not-check', reason: answerRow.reason || 'outside-unreachable', definitionKnown };
}

/**
 * A card's state from its rows' states: `done` when every row is present, `unknown` when every row is unknown
 * (no mark, no badge), `marked` otherwise — missing, tag-not-found, could-not-check and checking all mark the card,
 * the page reading: marked until proven done (AC-2).
 * @param {Array<{ state: string } | string>} rows
 * @returns {'done' | 'unknown' | 'marked'}
 */
export function cardState(rows) {
  const states = (Array.isArray(rows) ? rows : []).map((r) => (typeof r === 'string' ? r : r && r.state));
  if (states.length > 0 && states.every((s) => s === 'unknown')) return 'unknown';
  if (states.length > 0 && states.every((s) => s === 'present')) return 'done';
  return 'marked';
}
