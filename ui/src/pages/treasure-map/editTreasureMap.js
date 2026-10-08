/**
 * Edit mode's rules for the Manage your Treasure Map page (treasure-map-edit #3, ADR treasure-map-edit/0003 sub-decision
 * 2): which entries a category owns, the Map an edit would publish, the pending changes, the save note and the picker's
 * rows. Pure, with only `.js`-suffixed imports, so a Node suite loads it as it is (test/treasure-map-edit-mode.test.js).
 *
 * It reads keys with the card rule's own reader (entryOf, appliesTo), so a key that counts on a card is the key an edit
 * rewrites. What an assignment changes is the owner's book decisions 12 and 15: the category's own entries move to the
 * new Assistant in place, their backups stay, the family entry is added when the Map has none, and everything else keeps
 * its bytes and its place. Nothing here reads, signs, publishes or stores.
 *
 * Story 4 (ADR treasure-map-edit/0004) adds the switches to the same pending value: `override` ({ scores?, lists?,
 * concepts?: true }) removes a pending card's individually assigned duties, and `backups` (true) leaves every
 * draft-grammar key with only its first entry. planEdit derives what the page shows from it in one pass.
 */

import { COPY, entryOf, appliesTo } from './manageTreasureMap.js';

/** Each category's family entry: added when an assignment finds the Map has none (book decision 12). */
export const FAMILY = { scores: '3038x', lists: '3039x', concepts: '39998' };

const CATEGORIES = ['scores', 'lists', 'concepts'];
const PENDING_KEYS = ['scores', 'lists', 'concepts', 'everything'];
const SYSTEM_WORDS = new Set(['tag', 'pin', 'dlist', 'contexts']);
// The instance's relay settings group for each category, for the viewer's own Assistant here.
const RELAY_GROUP = { scores: 'aTrustedAssertionRelays', lists: 'aTrustedListRelays', concepts: 'aDListRelays' };
// A draft-grammar key's kind slot (protocols/drafts/treasure-maps.md § 4.7): only these entries have backups.
const GRAMMAR_SLOT = /^(\d{5}|3038x|3039x|\*)$/;

/** The role of one parsed entry in a category: 'own', 'individual', or null (not the category's, or a bare `*`). */
function roleOf(category, entry) {
  if (!entry || entry.slot === '*' || !appliesTo(category, entry)) return null;
  if (category === 'concepts') return entry.norm === '39998' || entry.norm === '39999' ? 'own' : 'individual';
  if (category === 'lists') return entry.segments.length === 0 ? 'own' : 'individual';
  const { segments } = entry;
  return segments.length === 0 || (segments.length === 1 && !SYSTEM_WORDS.has(segments[0])) ? 'own' : 'individual';
}

/**
 * Is this tag one of the category's own entries, one of its individually assigned duties, or neither (null)? Own: a
 * whole family, a whole kind, or (Scores) one standard score, `<kind or 3038x>:<metric>`. Individual: the category's
 * narrower entries (a Tag, a Pin, a DList, `contexts`, a Concept's own list). A bare `*` is no category's; a `*:…`
 * entry, an invalid one or another category's has no role.
 * @param {'scores'|'lists'|'concepts'} category
 */
export function entryRole(category, tag) {
  return roleOf(category, entryOf(tag));
}

/**
 * The Map's tags with the pending assignments made (story 3 AC-5). For each category with a pending Assistant B, each
 * own key's first valid tag (its Preferred one) names B, in place, keeping its key's spelling and any extra elements;
 * its other tags (backups) stay. The family entry is appended when no valid tag has it. `everything` does the same for
 * the plain `*` entry, with relay ''. Every other tag is copied as it is. The input is never changed.
 * @param {Array} tags
 * @param {{ scores?: string, lists?: string, concepts?: string, everything?: string }} pending  lowercase hex pubkeys
 * @param {(pubkey: string, category: string) => string} relayFor
 */
export function editedTags(tags, pending, relayFor) {
  const source = Array.isArray(tags) ? tags : [];
  const out = source.map((tag) => (Array.isArray(tag) ? [...tag] : tag));
  const entries = source.map(entryOf);
  const want = pending && typeof pending === 'object' ? pending : {};
  const moved = (i, pubkey, relay) => [source[i][0], pubkey, relay, ...source[i].slice(3)];

  for (const category of CATEGORIES) {
    const pubkey = want[category];
    if (!pubkey) continue;
    const seen = new Set();
    entries.forEach((entry, i) => {
      if (roleOf(category, entry) !== 'own' || seen.has(entry.norm)) return;
      seen.add(entry.norm);
      if (entry.pubkey !== pubkey) out[i] = moved(i, pubkey, relayFor(pubkey, category));
    });
    if (!entries.some((entry) => entry && entry.norm === FAMILY[category])) {
      out.push([FAMILY[category], pubkey, relayFor(pubkey, category)]);
    }
  }

  const everyone = want.everything;
  if (everyone) {
    const i = entries.findIndex((entry) => entry && entry.norm === '*');
    if (i < 0) out.push(['*', everyone, '']);
    else if (entries[i].pubkey !== everyone) out[i] = moved(i, everyone, '');
  }

  // Story 4: a pending card's override removes its counted duties whole, every tag of each key.
  const drop = new Set();
  const override = want.override && typeof want.override === 'object' ? want.override : {};
  for (const category of CATEGORIES) {
    if (!want[category] || !override[category]) continue;
    const duties = new Set(individualDuties(source, category, want[category]));
    entries.forEach((entry, i) => {
      if (roleOf(category, entry) === 'individual' && duties.has(entry.norm)) drop.add(i);
    });
  }
  const kept = drop.size === 0 ? out : out.filter((tag, i) => !drop.has(i));
  return want.backups ? dropBackups(kept) : kept;
}

/**
 * The category's individually assigned duties that a card's override switch counts and removes (story 4 AC-1): the
 * `norm` of each individual entry with some valid tag naming an Assistant other than `pubkey`, each once, in first-seen
 * order. A `*` or `*:…` entry is no category's duty (book decision 11). Never throws.
 * @param {Array} tags
 * @param {'scores'|'lists'|'concepts'} category
 * @param {string} pubkey  the card's pending Assistant
 */
export function individualDuties(tags, category, pubkey) {
  const out = [];
  for (const tag of Array.isArray(tags) ? tags : []) {
    const entry = entryOf(tag);
    if (roleOf(category, entry) !== 'individual' || entry.pubkey === pubkey || out.includes(entry.norm)) continue;
    out.push(entry.norm);
  }
  return out;
}

/** Is this tag a draft-grammar entry, the only kind with a first entry and backups? Its parsed entry, else null. */
function grammarEntry(tag) {
  const entry = entryOf(tag);
  return entry && GRAMMAR_SLOT.test(entry.slot) ? entry : null;
}

/**
 * The tags with every draft-grammar key keeping only its first entry (story 4 AC-4, book decision 8): later entries for
 * the same key, however it's spelled, are removed, a repeat of the same Assistant included. Every other tag stays, in
 * its place. The input is never changed.
 * @param {Array} tags
 */
export function dropBackups(tags) {
  const seen = new Set();
  return (Array.isArray(tags) ? tags : []).filter((tag) => {
    const entry = grammarEntry(tag);
    if (!entry) return true;
    if (seen.has(entry.norm)) return false;
    seen.add(entry.norm);
    return true;
  });
}

/** How many tags dropBackups would remove. */
export function backupCount(tags) {
  const list = Array.isArray(tags) ? tags : [];
  return list.length - dropBackups(list).length;
}

/**
 * The edited Map as Save would sign it (story 3 AC-6): the viewer's kind 10040 with its content and the edited tags. No
 * id, signature or created_at; story 5 stamps and signs.
 * @param {{ event: ?object, viewer: string, pending: object, relayFor: Function }} input
 */
export function editedDraft({ event, viewer, pending, relayFor }) {
  return {
    kind: 10040,
    pubkey: viewer,
    content: event && typeof event.content === 'string' ? event.content : '',
    tags: editedTags(event && Array.isArray(event.tags) ? event.tags : [], pending, relayFor),
  };
}

/**
 * Everything the page shows of an edit, in one pass (ADR 0004 sub-decision 2): each pending card's duties, the backups
 * left after the assignments and overrides, the pending that takes effect (without `backups` when none are left to
 * remove), and the draft as Save would sign it.
 * @param {{ event: ?object, viewer: string, pending: object, relayFor: Function }} input
 */
export function planEdit({ event, viewer, pending, relayFor }) {
  const tags = event && Array.isArray(event.tags) ? event.tags : [];
  const want = pending && typeof pending === 'object' ? pending : {};
  const duties = {};
  for (const category of CATEGORIES) duties[category] = want[category] ? individualDuties(tags, category, want[category]) : [];
  const rest = { ...want };
  delete rest.backups;
  const backups = backupCount(editedTags(tags, rest, relayFor));
  const effective = backups > 0 ? want : rest;
  return { duties, backups, pending: effective, draft: editedDraft({ event, viewer, pending: effective, relayFor }) };
}

/**
 * The All duties override switch (story 4 AC-2): how many duties the three cards' switches count together, and whether
 * it reads on, which it does when every card with duties has its own switch on.
 * @param {{ scores: string[], lists: string[], concepts: string[] }} duties  planEdit's
 * @param {object} pending
 */
export function overrideAllState(duties, pending) {
  const override = (pending && pending.override) || {};
  const withDuties = CATEGORIES.filter((category) => pending && pending[category] && duties && duties[category] && duties[category].length > 0);
  const count = withDuties.reduce((n, category) => n + duties[category].length, 0);
  return { count, on: count > 0 && withDuties.every((category) => override[category] === true) };
}

/**
 * The relay an edited entry names: for the viewer's own Assistant here, the first relay the instance has set for the
 * category's insights; for any other Assistant, and for the everything entry, ''. Never throws.
 * @param {{ localPubkey: ?string, aRelays: ?object }} input  user.assistantPubkey; useConfig().aRelays
 */
export function makeRelayFor({ localPubkey, aRelays }) {
  return (pubkey, category) => {
    const group = RELAY_GROUP[category];
    if (!localPubkey || pubkey !== localPubkey || !group || !aRelays || typeof aRelays !== 'object') return '';
    const list = aRelays[group];
    return Array.isArray(list) && typeof list[0] === 'string' ? list[0] : '';
  };
}

// ── The pending changes: { scores?, lists?, concepts?, everything? } (each a pubkey), with story 4's switches,
// override ({ scores?, lists?, concepts?: true }) and backups (true). Every step returns a new object, and never leaves
// an empty override or a false flag behind.

/** The pending value with one card's override set or cleared. */
function withOverride(pending, category, on) {
  const override = { ...(pending.override || {}) };
  if (on) override[category] = true;
  else delete override[category];
  const next = { ...pending, override };
  if (Object.keys(override).length === 0) delete next.override;
  return next;
}

/** Only the backup switch, which no assignment step touches (story 4 default 5). */
const onlyBackups = (pending) => (pending && pending.backups ? { backups: true } : {});

/**
 * Pick an Assistant for one card; its override stays as it was. Picking the card's current Assistant removes the
 * card's change, its override and, by book decision 16, the everything entry's change.
 */
export function pickCategory(pending, category, pubkey, current) {
  if (pubkey === current) return undoCategory(pending, category);
  return { ...pending, [category]: pubkey };
}

/** Undo one card's change: its override and, by book decision 16, the everything entry's change go with it. */
export function undoCategory(pending, category) {
  const next = withOverride({ ...pending }, category, false);
  delete next[category];
  delete next.everything;
  return next;
}

/**
 * Assign to all: every card and the everything entry to one Assistant, with every override off; or, when it is
 * already theirs, no assignment pending. The backup switch stays either way.
 */
export function pickAll(pending, pubkey, currentAll) {
  if (pubkey === currentAll) return onlyBackups(pending);
  return { scores: pubkey, lists: pubkey, concepts: pubkey, everything: pubkey, ...onlyBackups(pending) };
}

/** Undo every pending assignment and override; the backup switch stays. */
export function undoAll(pending) {
  return onlyBackups(pending);
}

/** Turn one card's override switch on or off. */
export function setOverride(pending, category, on) {
  return withOverride({ ...pending }, category, on);
}

/** Turn the All duties override switch on or off: all three cards' switches with it, as the blueprint does. */
export function setOverrideAll(pending, on) {
  return CATEGORIES.reduce((next, category) => withOverride(next, category, on), { ...pending });
}

/** Turn the backup switch on or off. */
export function setBackups(pending, on) {
  const next = { ...pending };
  if (on) next.backups = true;
  else delete next.backups;
  return next;
}

/**
 * The save note (story 3 AC-4): "No changes yet"; "All duties → name" when every card and the everything entry are
 * pending to one Assistant; otherwise how many changes are pending. The backup switch is one change, and while it's on
 * the note counts (story 4 AC-4). Overrides are part of their card's change and never count. Pass planEdit's pending.
 * @param {object} pending
 * @param {(pubkey: string) => string} nameOf
 */
export function saveNote(pending, nameOf) {
  const set = PENDING_KEYS.filter((key) => pending && pending[key]);
  const backups = Boolean(pending && pending.backups);
  const count = set.length + (backups ? 1 : 0);
  if (count === 0) return COPY.edit.noChanges;
  if (!backups && set.length === PENDING_KEYS.length && set.every((key) => pending[key] === pending.scores)) {
    return COPY.edit.allDutiesTo(nameOf(pending.scores));
  }
  return COPY.edit.unsavedChanges(count);
}

/** A card's current Assistant: its one Assistant when it names exactly one, else null. */
export function currentOf(card) {
  return card && card.state === 'single' && card.people && card.people[0] ? card.people[0].pubkey : null;
}

/** The Assistant all three cards name alone, else null. */
export function currentAll(cards) {
  const current = (Array.isArray(cards) ? cards : []).map(currentOf);
  return current.length === CATEGORIES.length && current[0] && current.every((pubkey) => pubkey === current[0]) ? current[0] : null;
}

/**
 * The picker's rows (story 3 AC-2), in the My Assistants page's order (buildRows: Local first, then by name): the name,
 * the avatar letter, Local, Current, the selected row (the pending pick, else the current one), and the detail line
 * (website, else NIP-05, else the shortened npub).
 * @param {Array} rows  buildRows' rows
 * @param {{ current: ?string, selected: ?string }} marks
 */
export function pickerRows(rows, { current, selected }) {
  const chosen = selected || current;
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    pubkey: row.pubkey,
    name: row.name,
    initial: row.initial,
    local: row.local === true,
    current: Boolean(current) && row.pubkey === current,
    selected: Boolean(chosen) && row.pubkey === chosen,
    detail: row.url && row.url !== '—' ? row.url : row.nip05 && row.nip05 !== '—' ? row.nip05 : row.npubShort,
  }));
}
