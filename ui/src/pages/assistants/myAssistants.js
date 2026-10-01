/**
 * The My Assistants page, as data (my-assistants #1, ADR my-assistants/0001 sub-decision 5): its words, the two links
 * it reads from their owners, and how the server's rows become what a row shows and in what order. Since my-assistants
 * #2 (ADR my-assistants/0002 sub-decision 10) also the pure planning of the page's actions: which search results to
 * offer, which buttons a row gets and whether they work, and what a withdrawal names. Since my-assistants #3 (ADR
 * my-assistants/0003 sub-decision 4) also the Treasure Map's duties: what each entry asks of whom, per Assistant and
 * for the Duties tab. Since my-assistants #4 (ADR my-assistants/0004 sub-decision 3) also how a NIP-05 check's answer
 * reads, and where a profile link goes.
 *
 * No React, and only `.js`-suffixed imports plus nostr-tools, so the Node runner loads it as it is
 * (test/my-assistants-page.test.js C-class, test/my-assistants-actions.test.js V-class,
 * test/my-assistants-map.test.js, test/my-assistants-nip05.test.js).
 *
 * The words are the stories' § Copy; change them there first:
 * engineering-team/stories/my-assistants/1-the-my-assistants-page.md § Copy, 2-tag-and-untag-from-the-page.md § Copy,
 * 3-the-treasure-map-on-the-page.md § Copy and 4-nip05-validity-and-profile-links.md § Copy.
 */

import { nip19 } from 'nostr-tools';
import { PROFILE_LOOKUP_FAILED } from '../../utils/profileBatch.js';
import { personalLinks } from '../../config/avatarMenuLinks.js';
import { ASSISTANT_ACTIONS } from '../assistant/actions.js';
import { classifyEntry } from '../../utils/treasureMap.js';

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
  searching: 'Searching…',
  searchFailed: 'Search isn’t answering right now.',
  tagButton: (name) => `Tag: ${name}`,
  changeButton: (name) => `Change to ${name}`,
  removeButton: 'Remove Tag',
  unavailable: (name) => `The ${name} tag hasn’t been published yet, so it can’t be applied.`,
  busy: { tag: 'Tagging…', change: 'Changing…', remove: 'Removing…' },
  refreshFailed: 'The list couldn’t be re-read; it may not show this yet.',
  // my-assistants #3
  onMap: 'On Treasure Map',
  notOnMap: 'Not on Treasure Map',
  onMapCount: (n) => `${n} on your Treasure Map`,
  mapLoading: 'Reading your Treasure Map…',
  mapNone: 'You haven’t published a Treasure Map yet, so no Assistant has duties.',
  mapEmpty: 'Your Treasure Map lists no duties yet.',
  mapError: 'Couldn’t read your Treasure Map.',
  dutiesHeading: 'Duties on your Treasure Map',
  dutyCount: (n) => (n === 0 ? 'No duties' : `${n} ${n === 1 ? 'duty' : 'duties'}`),
  groups: { scores: 'Scores', lists: 'Lists', concepts: 'Concepts' },
  noDuties: 'This Assistant isn’t listed on your Treasure Map, so clients won’t ask it for anything. Add it from your Treasure Map to give it duties.',
  manage: 'Manage on Treasure Map',
  sectionHeading: 'On your Treasure Map, but not tagged',
  sectionText: 'These Assistants have duties on your Treasure Map, but you haven’t tagged them as yours. Tag them to add them to the table above.',
  sectionLine: (n) => `${n} ${n === 1 ? 'duty' : 'duties'} on your Treasure Map`,
  sectionTag: { brainstorm: 'Tag: Brainstorm', tapestry: 'Tag: Tapestry' },
  tabs: { assistants: 'Assistants', duties: 'Duties' },
  tabsLabel: 'View',
  dutiesIntro: 'Every duty on your Treasure Map, from the most generic (a whole kind of Score or List) to the most granular (one exact Score, List or Concept). Within a duty, the first Assistant listed is preferred; the rest are alternates.',
  dutiesCount: (n) => `${n} ${n === 1 ? 'duty' : 'duties'}`,
  dutiesOrder: 'Most generic first',
  columns: { rank: '#', duty: 'Duty', preferred: 'Preferred Assistant' },
  alternatesLine: (names) => `Alternates: ${names.join(', ')}`,
  assistantsFor: 'Assistants for this duty',
  firstPreferred: 'First listed is preferred',
  onlyProvider: 'Only provider',
  preferred: 'Preferred',
  alternate: (i, n) => (n > 1 ? `Alternate ${i}` : 'Alternate'),
  notTaggedDutyTooltip: 'On your Treasure Map, but not tagged as one of your Assistants',
  sentenceLabel: 'On your Treasure Map',
  manageLink: 'Manage on Treasure Map →',
  // my-assistants #4
  nip05Verified: 'Verified',
  nip05Invalid: 'Not valid',
  nip05Unchecked: 'Couldn’t check',
  nip05Checking: 'Checking…',
  nip05VerifiedTitle: 'Its domain confirms this NIP-05 belongs to this profile.',
  nip05InvalidTitle: 'Its domain doesn’t list this NIP-05 for this profile.',
  nip05UncheckedTitle: 'Its domain didn’t answer, so this NIP-05 couldn’t be checked.',
  viewProfile: 'View profile',
  // The accessible name holds the visible words, so speech input can say them (ADR 0004 sub-decision 5).
  viewProfileLabel: (name) => `View profile of ${name} (opens in a new tab)`,
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
 * NIP-05, with the fallbacks. `profile` is as fetchProfilesChunked answers, or a search hit (same fields). `nip05Id` is
 * the NIP-05 itself, or null when there is none, apart from the '—' shown in its place (my-assistants #4): a NIP-05 is
 * checked only when there is one.
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
    nip05Id: textOf(profile.nip05),
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
 * A row's actions (AC-4, AC-5): Change to the other tag when the row carries exactly one, and Remove Tag. Every row
 * opens since my-assistants #3 (ADR 0003 sub-decision 4): the untagged Local row's panel holds its duties and Manage on
 * Treasure Map, with neither action.
 * @returns {{ change: ?{ toKey, label, enabled, reason }, remove: ?{ label } }}
 */
export function rowActions(row, definitions) {
  const keys = row && Array.isArray(row.tags) ? row.tags.map((t) => t.key) : [];
  if (keys.length === 0) return { change: null, remove: null };
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

// ── my-assistants #3: your Treasure Map's duties (ADR my-assistants/0003 sub-decisions 2–4) ─────────────────────────

/** The classes the app can place, and how each groups (sub-decision 2). Anything else is not a duty (AC-7). */
const GROUP_OF = { ta: 'scores', tl: 'lists', dlist: 'concepts', designation: 'concepts' };
const GROUP_RANK = { scores: 0, lists: 1, concepts: 2 };
const LEVEL_RANK = { Scope: 0, Exact: 1 };

/** A Score or List kind's subject, plural and singular, from its last digit (3038x / 3039x). */
const SUBJECTS = {
  2: ['profiles', 'profile'],
  3: ['events', 'event'],
  4: ['addressable events', 'addressable event'],
  6: ['content categories', 'content category'],
};
function subjectOf(kind) {
  return SUBJECTS[kind % 10] || ['items', 'item'];
}

/** One entry's duty: its group, level, name and "what" (story § Copy's table; ADR 0003 sub-decision 3). */
function describeEntry(entry) {
  const [things, thing] = subjectOf(entry.kind);
  const named = entry.name !== null && entry.name !== '';
  if (entry.cls === 'designation') {
    return { level: 'Scope', title: 'All Concept headers', what: 'my Concept Graph — my DList headers and the items filed under them, except where this Map says otherwise.' };
  }
  if (entry.cls === 'dlist') {
    // The list's d tag stands for its name: the header's display name would need a lookup per list (sub-decision 3).
    return { level: 'Exact', title: `Curated DList: ${entry.name}`, what: `my curated copy of ${entry.name}: its header, and a copy of each item.` };
  }
  if (entry.cls === 'ta') {
    if (!named) return { level: 'Scope', title: `All Scores about ${things}`, what: `every Score about ${things}, except where this Map says otherwise.` };
    return {
      level: 'Exact',
      title: entry.name,
      what: entry.name === 'rank' ? `a rank for every ${thing}, as seen from my trusted community.` : `a “${entry.name}” score for every ${thing}.`,
    };
  }
  if (!named) return { level: 'Scope', title: `All Lists of ${things}`, what: `every Trusted List of ${things}, except where this Map says otherwise.` };
  return { level: 'Exact', title: entry.name, what: `the Trusted List “${entry.name}” of ${things}.` };
}

/**
 * Every duty on a Treasure Map (kind 10040): one per distinct entry key among the entries the app can place with a
 * valid delegate, most generic first — Scope before Exact, then Scores, Lists, Concepts, then the Map's order.
 * A duty's Assistants are its entries' delegates in the Map's order, without repeats: the first is Preferred, the rest
 * Alternates. `at` is the Map position of the duty's first entry and `seenAt[i]` that of `assistants[i]`'s first entry
 * under it. Never throws: no event, no tags, or garbage give [].
 * @returns {Array<{ key, group, level, title, what, assistants: string[], entries: Array[], at: number, seenAt: number[] }>}
 */
export function treasureMapDuties(event) {
  const tags = event && Array.isArray(event.tags) ? event.tags : [];
  const byKey = new Map();
  tags.forEach((tag, at) => {
    const entry = classifyEntry(tag);
    const group = GROUP_OF[entry.cls];
    if (!group || !entry.pubkey) return;
    let duty = byKey.get(entry.raw);
    if (!duty) {
      duty = { key: entry.raw, group, ...describeEntry(entry), assistants: [], entries: [], at, seenAt: [] };
      byKey.set(entry.raw, duty);
    }
    if (!duty.assistants.includes(entry.pubkey)) {
      duty.assistants.push(entry.pubkey);
      duty.seenAt.push(at);
    }
    duty.entries.push(tag);
  });
  return [...byKey.values()].sort((a, b) => (LEVEL_RANK[a.level] - LEVEL_RANK[b.level])
    || (GROUP_RANK[a.group] - GROUP_RANK[b.group])
    || (a.at - b.at));
}

/** One Assistant's duties — as Preferred or as an Alternate — grouped, in duty order, with their count (AC-2, AC-3). */
export function dutiesOf(pubkey, duties) {
  const out = { scores: [], lists: [], concepts: [], count: 0 };
  for (const duty of Array.isArray(duties) ? duties : []) {
    if (!duty.assistants.includes(pubkey)) continue;
    out[duty.group].push(duty);
    out.count += 1;
  }
  return out;
}

/** The Assistants with duties who aren't in the list, each with its duty count, in the order the Map first names them (AC-4). */
export function mapOnlyAssistants(duties, rows) {
  const listed = new Set((Array.isArray(rows) ? rows : []).map((row) => row.pubkey));
  const found = new Map();
  for (const duty of Array.isArray(duties) ? duties : []) {
    duty.assistants.forEach((pubkey, i) => {
      if (listed.has(pubkey)) return;
      const seen = found.get(pubkey) || { pubkey, count: 0, first: Infinity };
      seen.count += 1;
      seen.first = Math.min(seen.first, Array.isArray(duty.seenAt) ? duty.seenAt[i] : Infinity);
      found.set(pubkey, seen);
    });
  }
  return [...found.values()].sort((a, b) => a.first - b.first).map(({ pubkey, count }) => ({ pubkey, count }));
}

/** An Assistant's name: as the page shows it (`names`), else its shortened npub. */
function nameOf(pubkey, names) {
  return (names && names[pubkey]) || npubShort(pubkey);
}

/** The duty as a sentence: "I entrust {Preferred} to publish and maintain {what}", then " If it can’t, ask {Alternates}." */
export function dutySentence(duty, names) {
  const [preferred, ...alternates] = duty.assistants;
  const sentence = `I entrust ${nameOf(preferred, names)} to publish and maintain ${duty.what}`;
  if (alternates.length === 0) return sentence;
  return `${sentence} If it can’t, ask ${alternates.map((pubkey) => nameOf(pubkey, names)).join(', then ')}.`;
}

/**
 * The Duties tab's rows (AC-6), in duty order. An Assistant is marked untagged when the list doesn't hold it as one of
 * yours: it isn't in the list, or it is your untagged Assistant here.
 * @param {Object} names  { pubkey: the name the page shows }
 * @param {Array<{ pubkey, untagged? }>} rows  the list's rows
 */
export function dutyRows(duties, names, rows) {
  const byPubkey = new Map((Array.isArray(rows) ? rows : []).map((row) => [row.pubkey, row]));
  const untagged = (pubkey) => !byPubkey.has(pubkey) || byPubkey.get(pubkey).untagged === true;
  const alternateCount = (duty) => duty.assistants.length - 1;
  return (Array.isArray(duties) ? duties : []).map((duty, i) => ({
    rank: i + 1,
    key: duty.key,
    group: duty.group,
    title: duty.title,
    level: duty.level,
    preferred: nameOf(duty.assistants[0], names),
    untagged: untagged(duty.assistants[0]),
    alternates: duty.assistants.slice(1).map((pubkey) => nameOf(pubkey, names)),
    assistants: duty.assistants.map((pubkey, j) => ({
      pubkey,
      name: nameOf(pubkey, names),
      untagged: untagged(pubkey),
      label: j === 0 ? COPY.preferred : COPY.alternate(j, alternateCount(duty)),
    })),
    sentence: dutySentence(duty, names),
    raw: duty.entries.map((entry) => JSON.stringify(entry)).join('\n'),
  }));
}

// ── my-assistants #4: a NIP-05's status, and the profile link (ADR my-assistants/0004 sub-decision 3) ──────────────

const NIP05_STATUSES = ['verified', 'invalid', 'unchecked'];

/**
 * How a GET /api/nip05/verify answer reads: its `status` when it is one of the three, else 'unchecked'. A missing
 * answer, a failed request, an older server's answer without `status`, or anything unknown is never 'invalid': only
 * a domain that answered can make a NIP-05 not valid (story AC-1).
 */
export function nip05StatusOf(answer) {
  const status = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer.status : null;
  return NIP05_STATUSES.includes(status) ? status : 'unchecked';
}

/** An Assistant's Brainstorm profile page (`/user/:pubkey`, ui/src/App.jsx), which shows the tags on it. */
export function profilePath(pubkey) {
  return `/user/${pubkey}`;
}
