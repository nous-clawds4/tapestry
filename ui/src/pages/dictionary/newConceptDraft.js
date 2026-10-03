/**
 * Create New Concept on /dictionary, as data: the concept header a person publishes (the design's
 * "Create New Concept" screen, 2026-10-02).
 *
 * In this product a "concept" is a DList header: a kind-39998 event with the concept's names and
 * description, and one pointer-typed b-tag (as the self-declare and Wire actions write it,
 * community-reference ADR 0029). Created plainly it is shared at once: the b-tag points to itself, so
 * it is a row of the signer's Dictionary and others can find it and adopt it. Created from the
 * finder for a shared concept (`target`), the b-tag points to that concept instead: the header is
 * wired to it, so it joins the signer's Dictionary as that concept's row. There is no Private option
 * in this version (the owner's decision, 2026-10-02).
 *
 * The d-tag is the singular name's slug (utils/dtag headerDTag), as the New DList page derives it.
 * The signer is the person's own Assistant, and the server composes the same event
 * (src/api/adoption/newConcept.js composeConceptHeader; the suite holds the two equal), so the page's
 * preview is exact.
 *
 * No React, and only `.js`-suffixed imports, so the Node runner loads it as it is
 * (test/dictionary-new-concept.test.js).
 */

import { headerDTag } from '../../utils/dtag.js';

// strfry looks up tag values of at most 255 bytes (MAX_INDEXED_TAG_VAL_SIZE): a longer one in a filter fails
// the whole read. The Dictionary looks up every row's own address and its b-target, so both stay within it,
// as the server checks too (src/api/adoption/newConcept.js).
export const MAX_FILTER_VALUE_BYTES = 255;
export const MAX_D_BYTES = MAX_FILTER_VALUE_BYTES - '39998:'.length - 64 - 1; // 184
const byteLength = (s) => new TextEncoder().encode(s).length;

/** Can this relay look the value up (a b-target, an address)? */
export function lookupable(value) {
  return typeof value === 'string' && byteLength(value) <= MAX_FILTER_VALUE_BYTES;
}

/**
 * The unsigned header for the form's values, signed by `pubkey` (null while unknown) and wired to
 * `target` when there is one: { event: { kind, tags, content }, coord, d, tooLong, ready }. `tooLong` is
 * true when the d-tag would make an address this relay can't look up; `ready` is true when both names
 * are filled in and the d-tag is usable.
 */
export function conceptHeaderDraft({ singular, plural, description, pubkey, target } = {}) {
  const sing = String(singular || '').trim();
  const pl = String(plural || '').trim();
  const desc = String(description || '').trim();
  const d = sing ? headerDTag(sing) : '';
  const coord = pubkey && d ? `39998:${pubkey}:${d}` : null;
  const tags = [['d', d], ['names', sing, pl]];
  if (desc) tags.push(['description', desc]);
  // Wired to the shared concept, or shared itself: the header recognizes itself as a shared concept.
  tags.push(['b', target || coord || `39998:<signer>:${d}`, 'pointer']);
  const tooLong = byteLength(d) > MAX_D_BYTES;
  return { event: { kind: 39998, tags, content: '' }, coord, d, tooLong, ready: Boolean(sing && pl && d && !tooLong) };
}

const LIST_HEADER_ADDRESS = /^39998:[0-9a-f]{64}:.+$/;

/** What is wrong with a `?wire=` value, if anything: null, 'not-an-address' or 'too-long'. */
export function wireProblem(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!LIST_HEADER_ADDRESS.test(v)) return 'not-an-address';
  return lookupable(v) ? null : 'too-long';
}

/** A `?wire=` value the page can wire to: a list header's address this relay can look up, else null. */
export function wireTarget(value) {
  return wireProblem(value) === null ? value.trim() : null;
}

/** The form's starting values from the shared concept's header: its names and description. */
export function fieldsFromHeader(event) {
  const tag = (name) => (event?.tags || []).find((t) => Array.isArray(t) && t[0] === name);
  const text = (v) => (typeof v === 'string' ? v.trim() : '');
  const names = tag('names');
  const singular = text(names?.[1]) || text(tag('name')?.[1]) || text(tag('title')?.[1]) || text(tag('d')?.[1]);
  return { singular, plural: text(names?.[2]), description: text(tag('description')?.[1]) };
}

/** The preview as the design shows it: the event, one tag per line. */
export function draftPreview(event) {
  const lines = (event.tags || []).map((t) => `    ${JSON.stringify(t)}`).join(',\n');
  return `{\n  "kind": ${event.kind},\n  "tags": [\n${lines}\n  ],\n  "content": ""\n}`;
}
