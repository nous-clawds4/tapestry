'use strict';
/**
 * The approved words, routes and shapes of assistant-duties-settings #1 (the Assistant Duties tab), as its story and
 * ADR state them. One copy, shared by the Node suite (test/assistant-duties-settings.test.js) and the browser suite
 * (tests/brainstorm/assistant-duties-settings.spec.js), so they cannot disagree about what the owner approved.
 *
 * Source of truth: engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.md (approved
 * 2026-10-12; § Copy) and engineering-team/decisions/assistant-duties-settings/0001-the-offered-duties-live-in-the-instance-settings.md
 * (accepted 2026-10-12, with sub-decision 7's copy additions). Change a word there first, then here.
 */

const DM = require('./dutyMenuFixtures');

// ─── The tab (story AC-1; ADR sub-decision 7) ────────────────────────────────────────────────────────────────────────
const TAB = {
  key: 'assistant-duties',
  path: 'assistant-duties',
  label: '📋 Assistant Duties',
  url: '/tapestry/settings/assistant-duties',
  crumb: 'Assistant Duties',
  /** The Settings tab it follows (ADR sub-decision 7: "right after the `assistant` entry"). */
  after: 'assistant',
};

// ─── The routes (ADR sub-decision 4) ─────────────────────────────────────────────────────────────────────────────────
const ROUTES = {
  list: '/api/settings/assistant-duties',
  reset: '/api/settings/assistant-duties/reset',
};
/** The route-table keys and their access (src/middleware/routeAccess.js), as ADR sub-decision 4 names them. */
const TABLE = [
  { key: `GET ${ROUTES.list}`, access: 'owner', kind: 'read' },
  { key: `PUT ${ROUTES.list}`, access: 'owner', kind: 'action' },
  { key: `POST ${ROUTES.reset}`, access: 'owner', kind: 'action' },
];
/** The settings key the list lives under (ADR sub-decision 1). */
const SETTINGS_KEY = 'assistantDuties';

// ─── The rule's bounds and refusal codes (ADR sub-decision 2) ────────────────────────────────────────────────────────
const MAX_DUTIES = 200;
const MAX_KEY_LENGTH = 512;
const CODES = ['bad-list', 'too-many', 'bad-key', 'duplicate-key', 'bad-relay', 'private-relay'];

// ─── The words (story § Copy; ADR sub-decision 7's additions) ───────────────────────────────────────────────────────
const COPY = {
  heading: 'Assistant Duties',
  intro: 'The duties every Assistant on this instance offers on its Duty Menu, in this order, and the relay where each is published. Changes apply to every Assistant\'s Duty Menu.',
  thisInstance: "This instance's relay",
  anotherRelay: 'Another relay',
  relayPlaceholder: 'wss://',
  keyLabel: 'Treasure Map key',
  add: 'Add duty',
  remove: 'Remove',
  moveUp: 'Move up',
  moveDown: 'Move down',
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
    // ADR sub-decision 7's addition.
    'too-many': 'The list can hold at most 200 duties.',
  },
  // ADR sub-decision 7's additions.
  changeRelay: 'Change relay',
  save: 'Save',
  cancel: 'Cancel',
  dragHandle: 'Drag to reorder',
};
/** Every sentence the tab shows from its copy module (never typed into the JSX). */
const SENTENCES = [
  COPY.intro, COPY.resetConfirm, COPY.saved, COPY.empty, COPY.requestFailed, ...Object.values(COPY.refusals),
];
/** Every label (button, field, choice) the tab shows. */
const LABELS = [
  COPY.heading, COPY.thisInstance, COPY.anotherRelay, COPY.keyLabel, COPY.add, COPY.remove, COPY.moveUp, COPY.moveDown,
  COPY.reset, COPY.changeRelay, COPY.save, COPY.cancel, COPY.dragHandle,
];

// ─── The defaults (story AC-2; ADR sub-decision 1) ───────────────────────────────────────────────────────────────────
const DEFAULT_DUTIES = DM.DEFAULT_DUTIES;
/** The category name each default shows (the Duty Menu page's names). */
const DEFAULT_CATEGORIES = { 30382: 'Scores', 30392: 'Lists', 30393: 'Lists', 30394: 'Lists', 39998: 'Concepts', 39999: 'Concepts' };

const copyOf = (list) => JSON.parse(JSON.stringify(list));

module.exports = {
  TAB, ROUTES, TABLE, SETTINGS_KEY, MAX_DUTIES, MAX_KEY_LENGTH, CODES,
  COPY, SENTENCES, LABELS, DEFAULT_DUTIES, DEFAULT_CATEGORIES, copyOf,
};
