'use strict';
/**
 * The approved words and addresses of book assistant-duty-cards: the hub's Duty Menu and Your Assistant's Treasure
 * Map cards, placeholders until the Duty Menus protocol is ratified (book duty-menus-and-self-maps). One copy, shared
 * by test/assistant-duty-cards.test.js and the hub fixture (test/helpers/assistantManagementFixtures.js), which lists
 * them among the hub's actions, so every hub suite and spec agrees on them.
 *
 * Source of truth: engineering-team/stories/assistant-duty-cards/1-duty-menu-and-treasure-map-placeholder-cards.md
 * § Copy (approved 2026-10-11). Keys follow ADR assistant-duty-cards/0001 sub-decision 2 (each key is its path's last
 * segment). Change a word there first, then here.
 *
 * Re-aimed 2026-10-11 by assistant-duty-menu #1 (its story AC-4 and ADR 0001 sub-decision 6): the Duty Menu card is built.
 * It keeps its section, address, title and description; its page has the ADR's alert criteria and no planning notes
 * (read from test/helpers/dutyMenuFixtures.js), and it joins CHECKED right after Outbox Relays. Your Assistant's Treasure
 * Map stays a placeholder (PLACEHOLDER_KEYS), word for word.
 */

const DMF = require('./dutyMenuFixtures');

const HUB = '/assistant';

/** The two cards, in order: the fourth and fifth in "Your Assistant's Public Persona", after Outbox Relays. */
const CARDS = [
  {
    key: 'duty-menu',
    section: 'persona',
    path: `${HUB}/duty-menu`,
    title: 'Duty Menu',
    text: "Let other clients, apps and Assistants know which duties your Assistant can take on, and which relay each one is published to. Your Assistant's Duty Menu is one item on the shared list of Duty Menus.",
    link: null,
    // Re-aimed by assistant-duty-menu #1 (ADR 0001 sub-decision 6). The placeholder's words were: alertCriteria null;
    // planningNotes 'Your Assistant will tell the world which duties it is capable of supporting by publishing a Duty
    // Menu, which is an item on the DList of Duty Menus. The protocol is still being written; this page will be built
    // once it is settled.'
    alertCriteria: DMF.ALERT_CRITERIA,
    planningNotes: DMF.PLANNING_NOTES,
  },
  {
    key: 'treasure-map',
    section: 'persona',
    path: `${HUB}/treasure-map`,
    title: "Your Assistant's Treasure Map",
    text: 'Your Assistant keeps its own Treasure Map (kind 10040), naming itself as its own Assistant, to show which duties it is publishing right now. If you move a duty to this Assistant and it is already publishing it, the switch takes effect right away instead of waiting for a first computation.',
    link: null,
    alertCriteria: null,
    planningNotes: 'Your Assistant will tell the world which duties it is actively managing by publishing its own Treasure Map, in which it acts as its own Assistant. The protocol is still being written; this page will be built once it is settled.',
  },
];

/** The card the two follow, and the persona section as it reads with them (story AC-1). */
const AFTER_KEY = 'outbox-relays';
const PERSONA_KEYS = ['profile', 'identification-tags', 'outbox-relays', 'duty-menu', 'treasure-map'];

/** The hub's actions, by key, in order, once the two are in (story AC-1: thirteen; the other eleven unchanged). */
const ALL_KEYS = [
  'profile', 'identification-tags', 'outbox-relays', 'duty-menu', 'treasure-map',
  'trusted-assertions', 'trusted-lists', 'dlists', 'bounties', 'pins', 'tags',
  'notifications-and-alerts', 'preferences',
];

/**
 * The actions with a real check (ADR 0001 sub-decision 3 left them unchanged; re-aimed by assistant-duty-menu #1, whose
 * ADR 0001 sub-decision 6 adds duty-menu right after outbox-relays).
 */
const CHECKED = ['profile', 'identification-tags', 'outbox-relays', 'duty-menu', 'trusted-assertions', 'trusted-lists', 'dlists'];

/** The book's cards that are still placeholders (assistant-duty-menu #1 AC-4: the Treasure Map card stays one). */
const PLACEHOLDER_KEYS = ['treasure-map'];

/** The person's own Treasure Map page, which neither card links to (story § Out of scope). */
const PERSON_TREASURE_MAP_PATH = '/treasure-map';

module.exports = { HUB, CARDS, AFTER_KEY, PERSONA_KEYS, ALL_KEYS, CHECKED, PLACEHOLDER_KEYS, PERSON_TREASURE_MAP_PATH };
