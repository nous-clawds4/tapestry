/**
 * List Headers' 🧭 column — one header event's b-disposition, as marks and a state word
 * (ADR list-headers-disposition/0002).
 *
 * Pure: no React, no fetch, no module state. The rule itself stays in bDisposition.js's
 * dispositionOf (the one UI home of the W16 ruling); this only reads the event's own tags, builds
 * its own address, and maps the result to marks. The `.js` extension on the import is what lets
 * the Node test suite import this module.
 *
 * The three chips are Concept Headers' own (ConceptList.jsx dispositionCell), copied word for word;
 * test/list-headers-disposition-column.test.js D9 fails if the two drift apart. Kind 9998 headers
 * aren't replaceable, so they never take a disposition (book decision 3).
 */

import { dispositionOf } from './bDisposition.js';

const mark = (glyph, title, state) => Object.freeze({ glyph, title, state });

export const MARKS = Object.freeze({
  wired: mark('🔗', 'wired to an external shared concept', 'wired'),
  selfDeclared: mark('🤝', 'self-declared shared concept', 'self-declared'),
  deferred: mark('🔒', 'deliberately private (no shared affiliation)', 'private'),
  undecided: mark('○', 'not yet decided', 'undecided'),
  notApplicable: mark('—', "Kind 9998 headers can't be re-published, so they don't take a disposition", 'not applicable'),
});

export const COLUMN_TITLE = 'b-disposition (wired / self-declared / private / not yet decided)';

/**
 * { state, marks } for one header event. `marks` is in Concept Headers' order (wired, self-declared,
 * private); `state` is their state words joined with ' + ', so the column sorts and searches as words.
 */
export function listHeaderDisposition(event) {
  let marks;
  if (!event || event.kind !== 39998) {
    marks = [MARKS.notApplicable];
  } else {
    const tags = Array.isArray(event.tags) ? event.tags : [];
    const dTag = tags.find((t) => Array.isArray(t) && t[0] === 'd');
    const d = dTag && typeof dTag[1] === 'string' ? dTag[1] : '';
    const selfCoord = `39998:${event.pubkey}:${d}`;
    const bValues = tags.filter((t) => Array.isArray(t) && t[0] === 'b').map((t) => t[1]);
    const { wired, selfDeclared, deferred } = dispositionOf(bValues, selfCoord);
    marks = [];
    if (wired) marks.push(MARKS.wired);
    if (selfDeclared) marks.push(MARKS.selfDeclared);
    if (deferred) marks.push(MARKS.deferred);
    if (marks.length === 0) marks = [MARKS.undecided];
  }
  return { state: marks.map((m) => m.state).join(' + '), marks };
}
