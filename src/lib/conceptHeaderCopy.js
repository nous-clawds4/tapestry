/**
 * Create New Concept from the finder, wired: the person's own header is a copy of the shared concept's
 * header (the owner's rule of 2026-10-02). Every tag of the shared header is copied, in its order, except:
 *
 *   replaced — `d` (the copy's own address, from its singular name), `names` and `description` (the
 *              form's, which start as the shared header's), `slug` (the copy's own d-tag, so it can't
 *              disagree with it after a rename), and `b` (the copy's one b-tag points at the shared concept);
 *   left out — COPY_SKIPPED:
 *     `json`           the owner's exception: the shared author's derived naming record, not the concept;
 *     `concept-graph`  points at the shared author's own derived graph (39999:<their key>:…-concept-graph),
 *                      which the copy would otherwise claim (the curation copies leave it out too);
 *     `client`, `alt`  facts about the shared event (which app published it, a summary of that event);
 *     `expiration`, `-`, `nonce`  event mechanics: an expiry date, a protected-event marker relays refuse
 *                      from anyone else, and a proof of work that no longer holds.
 * Everything else (required / optional / recommended, field-type, allowed, display, image, t, founder, …)
 * is copied as it is.
 *
 * Pure CJS, zero requires: the server's endpoint (src/api/adoption/newConcept.js) composes with it, and
 * the browser imports the same code through the `@tapestry/concept-header-copy` alias (ui/vite.config.js),
 * so Create New Concept's preview is exactly what is signed.
 */

'use strict';

const COPY_SKIPPED = ['json', 'concept-graph', 'client', 'alt', 'expiration', '-', 'nonce'];

const isTag = (t) => Array.isArray(t) && t.length > 0 && typeof t[0] === 'string';

/**
 * The copy's tags: `source` (the shared header's event) with the copy's own `d`, `names` (singular,
 * plural), `description` (left out when blank) and `slug`, and one `["b", target, "pointer"]`.
 * Each replaced tag takes the place of the first one it replaces; a `names` or `description` the source
 * lacks goes after the d-tag (and the names), and the b-tag where the source's first b-tag stood, else last.
 */
function copiedHeaderTags({ source, d, singular, plural, description, target }) {
  const out = [];
  const placed = new Set();
  const once = (name, tags) => {
    if (placed.has(name)) return;
    placed.add(name);
    out.push(...tags);
  };
  for (const t of (source && Array.isArray(source.tags) ? source.tags : []).filter(isTag)) {
    const name = t[0];
    if (COPY_SKIPPED.includes(name)) continue;
    if (name === 'd') once('d', [['d', d]]);
    else if (name === 'names') once('names', [['names', singular, plural, ...t.slice(3)]]);
    else if (name === 'description') once('description', description ? [['description', description, ...t.slice(2)]] : []);
    else if (name === 'slug') once('slug', [['slug', d]]);
    else if (name === 'b') once('b', [['b', target, 'pointer']]);
    else out.push(t.map((v) => (typeof v === 'string' ? v : String(v))));
  }
  const after = (names) => {
    let at = -1;
    out.forEach((t, i) => { if (names.includes(t[0])) at = i; });
    return at + 1;
  };
  if (!placed.has('d')) out.unshift(['d', d]);
  if (!placed.has('names')) out.splice(after(['d']), 0, ['names', singular, plural]);
  if (!placed.has('description') && description) out.splice(after(['d', 'names']), 0, ['description', description]);
  if (!placed.has('b')) out.push(['b', target, 'pointer']);
  return out;
}

module.exports = { COPY_SKIPPED, copiedHeaderTags };
