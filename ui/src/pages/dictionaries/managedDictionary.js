/**
 * "Managed by" on the Dictionary page, as data (the design's Dictionary screen, 2026-10-01): which
 * Assistants' Dictionaries the reader can show, which one the URL names, and the union of several.
 *
 * An Assistant's Dictionary is its concept headers that carry a real b-tag, read from this
 * instance's relay as GET /api/dictionaries/concepts reads any person's (the owner's decision: no
 * cross-instance read). The local Assistant's Dictionary is the reader's own, as before: their
 * account's headers and their Assistant's. A tagged Assistant on another instance may have few or
 * none of its headers here, and the page says so.
 *
 * The union ("All of my Assistants") groups entries by the shared concept they point to, so two
 * Assistants that both carry "dog breed" are one row, supported by 2 of the reader's Assistants.
 *
 * No React, and only `.js`-suffixed imports plus nostr-tools, so the Node runner loads it as it is
 * (test/dictionary-managed-by.test.js).
 */

import { nip19 } from 'nostr-tools';
import { buildRows } from '../assistants/myAssistants.js';

export const ALL = 'all';
export const MANAGED_BY_PARAM = 'managedBy';
export const ALL_LABEL = 'All of my Assistants';

const HEX64 = /^[0-9a-f]{64}$/;

/**
 * The picker's Assistants, the local one first (myAssistants buildRows' order): each with what the
 * menu shows and the `authors` its Dictionary is read for. When the reader has no Assistant on this
 * instance, their own concepts head the list in its place.
 * @param {{ rows: Array<{pubkey, local, tags}>, profiles: Object, person: { account, assistant, authors } }} input
 *   `rows` as GET /api/assistant/my-assistants answers them.
 */
export function managerOptions({ rows, profiles, person }) {
  const built = buildRows({ rows: Array.isArray(rows) ? rows : [], profiles });
  const options = built.map((r) => ({
    key: r.pubkey,
    pubkey: r.pubkey,
    name: r.name,
    initial: r.initial,
    detail: r.url !== '—' ? r.url : r.nip05Id || r.npubShort,
    local: r.local,
    authors: r.local && person && Array.isArray(person.authors) && person.authors.length ? person.authors : [r.pubkey],
  }));
  if (!options.some((o) => o.local) && person && person.account) {
    options.unshift({
      key: person.account,
      pubkey: person.account,
      name: 'Your own concepts',
      initial: 'Y',
      detail: 'You have no Assistant on this instance',
      local: true,
      self: true, // the reader's own Dictionary, not an Assistant's: no Local pill, and counted as a Dictionary
      authors: Array.isArray(person.authors) && person.authors.length ? person.authors : [person.account],
    });
  }
  return options;
}

/** The URL value for a choice: "all", or the Assistant's npub. */
export function managedByParam(choice) {
  if (choice === ALL) return ALL;
  try { return nip19.npubEncode(choice); } catch { return null; }
}

/**
 * The choice the URL names, against the options: { choice: ALL | pubkey, unknown } where `unknown` is
 * true when the URL named something that is not one of the options (the page then shows the local
 * Assistant, and says so). No value → the local Assistant. Options not loaded yet → the URL's pubkey
 * as named, so the page can wait for them.
 */
export function parseManagedBy(value, options) {
  const local = (options || []).find((o) => o.local) || (options || [])[0] || null;
  const fallback = { choice: local ? local.key : null, unknown: false };
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  const v = value.trim();
  if (v === ALL) return (options || []).length > 1 ? { choice: ALL, unknown: false } : { ...fallback, unknown: (options || []).length > 0 };
  let pubkey = null;
  if (HEX64.test(v.toLowerCase())) pubkey = v.toLowerCase();
  else {
    try {
      const decoded = nip19.decode(v);
      if (decoded.type === 'npub') pubkey = decoded.data;
    } catch { /* not an npub */ }
  }
  if (!pubkey) return { ...fallback, unknown: true };
  if (!options || options.length === 0) return { choice: pubkey, unknown: false };
  return options.some((o) => o.key === pubkey) ? { choice: pubkey, unknown: false } : { ...fallback, unknown: true };
}

/** The shared concept an entry stands for: what it points to, else itself. */
export const conceptKey = (entry) => (entry && entry.sharedCoord) || (entry && entry.coord) || null;

/**
 * Every concept an entry stands for: the shared concept it is scored for, each b target, and itself
 * when it is self-declared (or points nowhere a concept can be named). Two entries are the same row
 * when these overlap, so a header whose b-tags list the same targets in another order still joins.
 */
export function conceptKeys(entry) {
  if (!entry) return [];
  const keys = new Set();
  if (entry.sharedCoord) keys.add(entry.sharedCoord);
  for (const t of Array.isArray(entry.targets) ? entry.targets : []) if (typeof t === 'string' && t) keys.add(t);
  if (entry.selfDeclared || keys.size === 0) keys.add(entry.coord);
  return [...keys].filter(Boolean);
}

/**
 * The union of several Assistants' Dictionaries. `reads` is one per Assistant, in the picker's
 * order: { key, entries } for a read that answered, { key, error } for one that failed. An entry
 * supports every row whose concepts it overlaps (conceptKeys), and starts a row of its own only when
 * it overlaps none; rows are never merged. With several b-tags on a header the rows depend on the
 * order of `reads` (an entry that overlaps an earlier row supports it instead of getting its own), so
 * a count is a lower bound — as the page says of these counts anyway. A
 * row's entry is the first Assistant's (the local one when it has it), with `support` = { count, of,
 * keys } — how many of the reader's Assistants carry it, out of all of them. `failed` lists the keys
 * whose read failed; they count in `of` but support nothing. `answered` is how many reads answered.
 */
export function mergeDictionaries(reads) {
  const list = Array.isArray(reads) ? reads : [];
  const of = list.length;
  const failed = [];
  const rows = []; // { entry, keys:Set (Assistants) }
  const rowsOf = new Map(); // concept key → Set of rows
  for (const read of list) {
    if (!read || !Array.isArray(read.entries)) { if (read && read.key) failed.push(read.key); continue; }
    for (const entry of read.entries) {
      const concepts = conceptKeys(entry);
      if (!concepts.length) continue;
      const touched = new Set(concepts.flatMap((k) => [...(rowsOf.get(k) || [])]));
      if (touched.size === 0) {
        const row = { entry, keys: new Set([read.key]) };
        rows.push(row);
        for (const c of concepts) rowsOf.set(c, new Set([row]));
      } else {
        for (const row of touched) row.keys.add(read.key);
      }
    }
  }
  const entries = rows.map(({ entry, keys }) => ({
    ...entry,
    support: { count: keys.size, of, keys: [...keys] },
  }));
  return { entries, failed, answered: of - failed.length };
}

/**
 * What the list reads for a choice. The local Assistant's Dictionary is the reader's own, read as the
 * page always has (`person: true`); another Assistant's, or all of them, are Assistant reads (`sets`).
 * @returns {{ person: boolean, all: boolean, sets: Array<{key, authors}>, current: object|null }}
 */
export function managedView({ choice, options }) {
  const list = Array.isArray(options) ? options : [];
  if (choice === ALL && list.length > 1) {
    return { person: false, all: true, sets: list.map((o) => ({ key: o.key, authors: o.authors })), current: null };
  }
  const current = list.find((o) => o.key === choice) || list.find((o) => o.local) || null;
  if (!current || current.local) return { person: true, all: false, sets: [], current };
  return { person: false, all: false, sets: [{ key: current.key, authors: current.authors }], current };
}
