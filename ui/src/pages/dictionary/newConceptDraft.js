/**
 * Create New Concept on /dictionary, as data: the concept header a person publishes (the design's
 * "Create New Concept" screen, 2026-10-02).
 *
 * In this product a "concept" is a DList header: a kind-39998 event with the concept's names and
 * description. Created here it is shared at once: its b-tag points to itself (pointer-typed, as the
 * self-declare action writes it, community-reference ADR 0029), so it is a row of the signer's
 * Dictionary and others can find it and adopt it. There is no Private option in this version (the
 * owner's decision, 2026-10-02).
 *
 * The d-tag is the singular name's slug (utils/dtag headerDTag), as the New DList page derives it.
 * The draft is exactly the event that is signed and published, so the page's preview is exact.
 *
 * No React, and only `.js`-suffixed imports, so the Node runner loads it as it is
 * (test/dictionary-new-concept.test.js).
 */

import { headerDTag } from '../../utils/dtag.js';

/**
 * The unsigned header for the form's values, signed by `pubkey` (null while unknown):
 * { event: { kind, tags, content }, coord, d, ready }. `ready` is true when both names are filled in.
 */
export function conceptHeaderDraft({ singular, plural, description, pubkey } = {}) {
  const sing = String(singular || '').trim();
  const pl = String(plural || '').trim();
  const desc = String(description || '').trim();
  const d = sing ? headerDTag(sing) : '';
  const coord = pubkey && d ? `39998:${pubkey}:${d}` : null;
  const tags = [['d', d], ['names', sing, pl]];
  if (desc) tags.push(['description', desc]);
  // Shared: the header recognizes itself as a shared concept.
  tags.push(['b', coord || `39998:<signer>:${d}`, 'pointer']);
  return { event: { kind: 39998, tags, content: '' }, coord, d, ready: Boolean(sing && pl && d) };
}

/** The preview as the design shows it: the event, one tag per line. */
export function draftPreview(event) {
  const lines = (event.tags || []).map((t) => `    ${JSON.stringify(t)}`).join(',\n');
  return `{\n  "kind": ${event.kind},\n  "tags": [\n${lines}\n  ],\n  "content": ""\n}`;
}
