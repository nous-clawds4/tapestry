import { nip19 } from 'nostr-tools';

/**
 * Pure validation/normalization core for the Negentropy Sync panel's tag
 * filters (ADR relay-management/0001). No React, no DOM, no network — executed
 * directly by the Node test runner (test/sync-panel-tag-filters.test.js), the
 * eventParam.js pattern.
 *
 * A tag filter is { letter, values }: a single-ASCII-letter tag name (case-
 * sensitive — #x and #X are distinct keys on the wire) plus one or more value
 * strings. Values for p/P and e/E must be 64-hex (npub/nprofile resp.
 * note/nevent accepted and decoded to hex); values for a/A must be
 * kind:pubkey:identifier coordinates (naddr accepted and decoded); every other
 * letter takes arbitrary non-empty strings verbatim.
 */

const HEX64 = /^[0-9a-f]{64}$/i;
const LETTER = /^[a-zA-Z]$/;
// kind : 64-hex pubkey : identifier — the identifier may be empty and may
// itself contain further colons.
const COORD = /^(\d+):([0-9a-fA-F]{64}):([\s\S]*)$/;

// Keep inline errors readable when the offending value is long.
function snip(value) {
  return value.length > 24 ? `${value.slice(0, 24)}…` : value;
}

/** Exactly one ASCII letter (after trimming). → { ok, letter } | { ok, error } */
export function validateTagLetter(raw) {
  const letter = typeof raw === 'string' ? raw.trim() : '';
  if (!LETTER.test(letter)) {
    return { ok: false, error: 'Tag name must be a single letter a–z or A–Z (nostr filters only index single-letter tags).' };
  }
  return { ok: true, letter };
}

/** Validate/normalize one value for the given letter. → { ok, value } | { ok, error } */
export function normalizeTagValue(letter, raw) {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return { ok: false, error: 'Values must be non-empty.' };

  const cls = String(letter).toLowerCase();

  if (cls === 'p' || cls === 'e') {
    const expected = cls === 'p'
      ? 'a 64-char hex pubkey, npub or nprofile'
      : 'a 64-char hex event id, note or nevent';
    if (HEX64.test(value)) return { ok: true, value: value.toLowerCase() };
    try {
      const d = nip19.decode(value);
      if (cls === 'p' && d.type === 'npub') return { ok: true, value: d.data };
      if (cls === 'p' && d.type === 'nprofile') return { ok: true, value: d.data.pubkey };
      if (cls === 'e' && d.type === 'note') return { ok: true, value: d.data };
      if (cls === 'e' && d.type === 'nevent') return { ok: true, value: d.data.id };
      return { ok: false, error: `"${snip(value)}" is a ${d.type}; #${letter} takes ${expected}.` };
    } catch {
      return { ok: false, error: `"${snip(value)}" is not a valid #${letter} value — expected ${expected}.` };
    }
  }

  if (cls === 'a') {
    const m = COORD.exec(value);
    if (m) return { ok: true, value: `${parseInt(m[1], 10)}:${m[2].toLowerCase()}:${m[3]}` };
    try {
      const d = nip19.decode(value);
      if (d.type !== 'naddr') {
        return { ok: false, error: `"${snip(value)}" is a ${d.type}; #${letter} takes a kind:pubkey:identifier coordinate or naddr.` };
      }
      return { ok: true, value: `${d.data.kind}:${d.data.pubkey}:${d.data.identifier}` };
    } catch {
      return { ok: false, error: `"${snip(value)}" is not a valid #${letter} value — expected kind:pubkey:identifier or naddr.` };
    }
  }

  // Any other letter: arbitrary non-empty string, verbatim.
  return { ok: true, value };
}

/**
 * Parse a comma-separated values entry for a letter: split, trim, drop
 * empties, validate/normalize each, dedupe (first occurrence wins).
 * → { ok, values } | { ok, error }
 */
export function parseTagValues(letter, rawInput) {
  const parts = String(rawInput ?? '').split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { ok: false, error: 'Enter at least one value (comma-separate several).' };
  }
  const values = [];
  for (const part of parts) {
    const r = normalizeTagValue(letter, part);
    if (!r.ok) return { ok: false, error: r.error };
    if (!values.includes(r.value)) values.push(r.value);
  }
  return { ok: true, values };
}

/**
 * Merge an add into the tag-filter list ([{ letter, values }]). Same-letter
 * (case-sensitive) entries merge — existing order kept, new values appended,
 * duplicates dropped; a new letter appends a new entry. Pure: no mutation.
 */
export function mergeTagFilter(tagFilters, letter, values) {
  const list = Array.isArray(tagFilters) ? tagFilters : [];
  const existing = list.find(f => f.letter === letter);
  if (!existing) return [...list, { letter, values: [...values] }];
  const merged = [...existing.values];
  for (const v of values) {
    if (!merged.includes(v)) merged.push(v);
  }
  return list.map(f => (f.letter === letter ? { letter, values: merged } : f));
}
