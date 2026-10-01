/**
 * The My Assistants page, as data (my-assistants #1, ADR my-assistants/0001 sub-decision 5): its words, the two links
 * it reads from their owners, and how the server's rows become what a row shows and in what order. Since my-assistants
 * #2 (ADR my-assistants/0002 sub-decision 10) also the pure planning of the page's actions: which search results to
 * offer, which buttons a row gets and whether they work, and what a withdrawal names.
 *
 * No React, and only `.js`-suffixed imports plus nostr-tools, so the Node runner loads it as it is
 * (test/my-assistants-page.test.js C-class, test/my-assistants-actions.test.js V-class).
 *
 * The words are the stories' § Copy; change them there first:
 * engineering-team/stories/my-assistants/1-the-my-assistants-page.md § Copy, and 2-tag-and-untag-from-the-page.md § Copy.
 */

import { nip19 } from 'nostr-tools';
import { PROFILE_LOOKUP_FAILED } from '../../utils/profileBatch.js';
import { personalLinks } from '../../config/avatarMenuLinks.js';
import { ASSISTANT_ACTIONS } from '../assistant/actions.js';

export const COPY = {
  kicker: 'My Assistants',
  fieldUrl: 'URL',
  fieldNip05: 'NIP-05',
  localBadge: 'Local',
  localTooltip: 'The Assistant hosted on the instance you’re using right now',
  notTagged: 'Not tagged',
  notTaggedTooltip: 'You haven’t tagged this Assistant as yours yet',
  tagPrompt: 'This is your Assistant on this instance, but you haven’t tagged it as yours.',
  tagPromptLink: 'Tag it as My Tapestry Assistant →',
  empty: 'You haven’t tagged any Assistants yet. Search above to find one.',
  signedOut: 'Sign in to see your Assistants.',
  signInButton: 'Sign in with nostr',
  loading: 'Loading your Assistants…',
  error: 'Couldn’t load your Assistants.',
  retry: 'Try again',
  // my-assistants #2
  searchHeading: 'Find a profile to tag as an Assistant',
  searchPlaceholder: 'Search by name, NIP-05, URL or npub',
  resultsLabel: 'Profiles you can tag',
  resultCount: (n) => `${n} untagged ${n === 1 ? 'profile' : 'profiles'}`,
  noMatch: 'No untagged profile matches.',
  searchFailed: 'Search isn’t answering right now.',
  tagButton: (name) => `Tag: ${name}`,
  changeButton: (name) => `Change to ${name}`,
  removeButton: 'Remove Tag',
  unavailable: (name) => `The ${name} tag hasn’t been published yet, so it can’t be applied.`,
  busy: { tag: 'Tagging…', change: 'Changing…', remove: 'Removing…' },
  refreshFailed: 'The list couldn’t be re-read; it may not show this yet.',
};

/** The two tags' names, by key, in the order a row shows them (src/lib/my-assistant-tags owns the list). */
export const TAG_KEYS = ['brainstorm', 'tapestry'];
export const TAG_NAMES = { brainstorm: 'My Brainstorm Assistant', tapestry: 'My Tapestry Assistant' };

/** The accessible name of the list of rows. */
export const LIST_LABEL = 'Your Assistants';

/** Where the introduction's "Treasure Map" goes: wherever the avatar menus' My Treasure Map goes. */
export const TREASURE_MAP_PATH = personalLinks({ pubkey: '', assistantPubkey: null, classification: null, profileBase: '' })
  .find((link) => link.key === 'my-treasure-map').to;

/** Where the untagged Local row's prompt goes: the Identification Tags action's own page. */
export const IDENTIFICATION_TAGS_PATH = ASSISTANT_ACTIONS.find((action) => action.key === 'identification-tags').path;

/** A pubkey's npub, shortened: the first 12 characters, an ellipsis, the last 6. */
export function npubShort(pubkey) {
  const npub = nip19.npubEncode(pubkey);
  return `${npub.slice(0, 12)}…${npub.slice(-6)}`;
}

/**
 * A profile field as text: trimmed, or null when it is missing, blank or not a string. A kind 0 is arbitrary JSON, so a
 * name can arrive as a number or an array; such a field is skipped rather than shown, and never throws (review 1 of
 * my-assistants #1).
 */
function textOf(v) {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * What a profile shows: its name (display_name, else name, else the shortened npub), avatar letter, npub, URL and
 * NIP-05, with the fallbacks. `profile` is as fetchProfilesChunked answers, or a search hit (same fields).
 */
function cardFields(pubkey, found) {
  const profile = found && found !== PROFILE_LOOKUP_FAILED && typeof found === 'object' ? found : {};
  const short = npubShort(pubkey);
  const name = textOf(profile.display_name) || textOf(profile.name) || short;
  return {
    pubkey,
    name,
    initial: Array.from(name)[0], // a whole character, so a name that starts with an emoji keeps it whole
    npubShort: short,
    url: textOf(profile.website) || '—',
    nip05: textOf(profile.nip05) || '—',
  };
}

/** "0 Assistants", "1 Assistant", "N Assistants". */
export function countText(n) {
  return `${n} ${n === 1 ? 'Assistant' : 'Assistants'}`;
}

/**
 * The rows as the page shows them: the Local row first, then alphabetically by the name shown (case and accents
 * aside), the pubkey breaking a tie.
 * @param {{rows: Array<{pubkey, local, tags}>, profiles: Object}} input  profiles as fetchProfilesChunked answers:
 *   a profile, null (none published) or PROFILE_LOOKUP_FAILED, per pubkey
 */
export function buildRows({ rows, profiles }) {
  const built = (Array.isArray(rows) ? rows : []).map((row) => {
    const tags = Array.isArray(row.tags) ? row.tags : [];
    const local = row.local === true;
    return {
      ...cardFields(row.pubkey, profiles ? profiles[row.pubkey] : null),
      local,
      untagged: local && tags.length === 0,
      tags,
      retract: row.retract && typeof row.retract === 'object' ? row.retract : {},
    };
  });
  return built.sort((a, b) => (Number(b.local) - Number(a.local))
    || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    || (a.pubkey < b.pubkey ? -1 : a.pubkey > b.pubkey ? 1 : 0));
}

// ── my-assistants #2: the actions' planning (ADR my-assistants/0002 sub-decision 10) ──────────────────────────────

const HEX64 = /^[0-9a-f]{64}$/i;

/** A search query that names one key exactly: an npub, or 64-hex in any case. The hex key, lowercased; else null. */
export function parseExactKey(query) {
  const q = typeof query === 'string' ? query.trim() : '';
  if (HEX64.test(q)) return q.toLowerCase();
  if (!q.startsWith('npub1')) return null;
  try {
    const decoded = nip19.decode(q);
    return decoded.type === 'npub' && HEX64.test(decoded.data) ? decoded.data.toLowerCase() : null;
  } catch {
    return null;
  }
}

/**
 * The profiles the search offers: nothing under 2 characters; otherwise the exact key first, when the query named
 * one, then the search's hits without repeats. Everyone already in the list, the untagged Local row included, is left
 * out (the blueprint's "untagged profiles").
 * @param {{ query: string, hits: Object[], exact: ?{ pubkey: string, profile: ?Object }, rows: Array<{pubkey}> }} input
 * @returns {Array<{pubkey, name, initial, npubShort, url, nip05}>}
 */
export function searchCandidates({ query, hits, exact, rows }) {
  const q = typeof query === 'string' ? query.trim() : '';
  if (q.length < 2) return [];
  const listed = new Set((Array.isArray(rows) ? rows : []).map((row) => row.pubkey));
  const offered = [];
  const seen = new Set();
  const offer = (pubkey, profile) => {
    if (!pubkey || listed.has(pubkey) || seen.has(pubkey)) return;
    seen.add(pubkey);
    offered.push(cardFields(pubkey, profile));
  };
  if (exact && exact.pubkey) offer(exact.pubkey, exact.profile);
  for (const hit of Array.isArray(hits) ? hits : []) if (hit && typeof hit.pubkey === 'string') offer(hit.pubkey, hit);
  return offered;
}

/**
 * Whether each tag can be applied: its definition must have been found, with the id a tagging points at. A missing
 * definition — or no `definitions` at all — disables that tag, with the reason the page shows beside it (AC-6).
 * @returns {{ brainstorm: { enabled: boolean, reason: ?string }, tapestry: { enabled: boolean, reason: ?string } }}
 */
export function tagAvailability(definitions) {
  const out = {};
  for (const key of TAG_KEYS) {
    const def = definitions && definitions[key];
    const enabled = !!(def && def.found === true && typeof def.eventId === 'string' && def.eventId);
    out[key] = { enabled, reason: enabled ? null : COPY.unavailable(TAG_NAMES[key]) };
  }
  return out;
}

/**
 * A row's actions (AC-4, AC-5): Change to the other tag when the row carries exactly one, and Remove Tag. The
 * untagged Local row has none in this story, so it does not open (ADR 0002 sub-decision 9).
 * @returns {?{ change: ?{ toKey, label, enabled, reason }, remove: { label } }}
 */
export function rowActions(row, definitions) {
  const keys = row && Array.isArray(row.tags) ? row.tags.map((t) => t.key) : [];
  if (keys.length === 0) return null;
  let change = null;
  if (keys.length === 1) {
    const toKey = keys[0] === 'brainstorm' ? 'tapestry' : 'brainstorm';
    const availability = tagAvailability(definitions)[toKey];
    change = { toKey, label: COPY.changeButton(TAG_NAMES[toKey]), enabled: availability.enabled, reason: availability.reason };
  }
  return { change, remove: { label: COPY.removeButton } };
}

/**
 * What withdrawing a row's tags names: every id and every address in its `retract`, across the tags it carries, and
 * the report's subject ("Withdrawal of My Tapestry Assistant", or both names joined by "and").
 * @param {?{ tags: Array<{key}>, retract: Object }} row
 * @param {?string[]} [onlyKeys]  the tags to withdraw; all the row carries by default (a change withdraws one)
 */
export function withdrawalOf(row, onlyKeys) {
  const carried = row && Array.isArray(row.tags) ? row.tags.map((t) => t.key) : [];
  const keys = Array.isArray(onlyKeys) ? carried.filter((k) => onlyKeys.includes(k)) : carried;
  const ids = [];
  const addresses = [];
  for (const key of keys) {
    const retraction = row.retract && row.retract[key];
    if (!retraction) continue;
    for (const id of retraction.ids || []) if (!ids.includes(id)) ids.push(id);
    for (const address of retraction.addresses || []) if (!addresses.includes(address)) addresses.push(address);
  }
  return { ids, addresses, subject: `Withdrawal of ${keys.map((k) => TAG_NAMES[k]).join(' and ')}` };
}
