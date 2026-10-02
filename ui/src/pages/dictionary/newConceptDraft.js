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

/**
 * The unsigned header for the form's values, signed by `pubkey` (null while unknown) and wired to
 * `target` when there is one: { event: { kind, tags, content }, coord, d, ready }. `ready` is true when
 * both names are filled in.
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
  return { event: { kind: 39998, tags, content: '' }, coord, d, ready: Boolean(sing && pl && d) };
}

const LIST_HEADER_ADDRESS = /^39998:[0-9a-f]{64}:.+$/;

/** A `?wire=` value the page can wire to: a list header's address, else null. */
export function wireTarget(value) {
  const v = typeof value === 'string' ? value.trim() : '';
  return LIST_HEADER_ADDRESS.test(v) ? v : null;
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
