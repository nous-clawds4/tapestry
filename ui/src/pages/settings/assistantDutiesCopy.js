/**
 * The Assistant Duties tab's words and pure helpers (assistant-duties-settings #1, ADR assistant-duties-settings/0001
 * sub-decision 7).
 *
 * Pure, no imports, so Node suites can load it (test/assistant-duties-settings.test.js). Named apart from the component
 * (AssistantDuties.jsx): a module that differs from a component only by case resolves to the wrong file on a
 * case-insensitive filesystem (ADR assistant-identification-tags/0002 Amendment 1). The tab's label sits in the Settings
 * page's TABS, beside the others.
 *
 * The words were approved with the story; change them there first:
 * engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.md § Copy, and ADR 0001 sub-decision 7's
 * additions (Change relay, Save, Cancel, the drag handle's label, the too-many line).
 */

export const ASSISTANT_DUTIES_COPY = {
  heading: 'Assistant Duties',
  intro: "The duties every Assistant on this instance offers on its Duty Menu, in this order, and the relay where each is published. Changes apply to every Assistant's Duty Menu.",
  loading: 'Loading…',
  loadFailed: 'Could not load the duties: this instance did not answer.',
  relayChoice: { thisInstance: "This instance's relay", another: 'Another relay', placeholder: 'wss://' },
  keyLabel: 'Treasure Map key',
  add: 'Add duty',
  remove: 'Remove',
  moveUp: 'Move up',
  moveDown: 'Move down',
  changeRelay: 'Change relay',
  save: 'Save',
  cancel: 'Cancel',
  dragHandle: 'Drag to reorder',
  reset: 'Reset to defaults',
  resetConfirm: 'Replace this list with the six default duties?',
  saved: "Saved. Each Assistant's Duty Menu now needs publishing again from its Duty Menu page.",
  empty: "No duties are offered. Every Assistant's Duty Menu lists none.",
  requestFailed: 'Could not save: this instance did not answer.',
  refusals: {
    'bad-key': "That isn't a Treasure Map key.",
    'duplicate-key': 'That key is already on the list.',
    'bad-relay': 'A relay must start with wss:// or ws://.',
    'private-relay': "That relay can't be reached by others.",
    'too-many': 'The list can hold at most 200 duties.',
  },
};

/**
 * The words for a refused save: the refusal's own, or the request-failed line for anything else.
 * @param {?string} code - the route's `code`
 * @returns {string}
 */
export function refusalLine(code) {
  const words = ASSISTANT_DUTIES_COPY.refusals;
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(words, code) ? words[code] : ASSISTANT_DUTIES_COPY.requestFailed;
}

const inRange = (list, i) => Number.isInteger(i) && i >= 0 && i < list.length;

/** The list with the entry at `from` moved to `to`; out of range, the same entries. Never changes `list`. */
export function moveDuty(list, from, to) {
  const next = list.slice();
  if (!inRange(list, from) || !inRange(list, to) || from === to) return next;
  const [entry] = next.splice(from, 1);
  next.splice(to, 0, entry);
  return next;
}

/** The list with `entry` added last. Never changes `list`. */
export function addDuty(list, entry) {
  return [...list, { ...entry }];
}

/** The list without the entry at `index`. Never changes `list`. */
export function removeDuty(list, index) {
  return list.filter((_, i) => i !== index);
}

/**
 * The list with the entry at `index` given a typed relay, or This instance's relay (no `relay` field) when `relay` is
 * null or undefined. An empty typed relay is kept, so the server refuses it as it does when adding (ADR
 * assistant-duties-settings/0001 Amendment 1 item 4). Never changes `list`.
 */
export function setRelay(list, index, relay) {
  return list.map((entry, i) => {
    if (i !== index) return entry;
    const { relay: _old, ...rest } = entry;
    return relay === null || relay === undefined ? rest : { ...rest, relay };
  });
}
