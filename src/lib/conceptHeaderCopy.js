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
 *     `z`              files the header as an item under another concept: copied, the copy would be filed
 *                      there too, listed twice in that concept's Items and counted as a filer (owner, 2026-10-02);
 *     `client`, `alt`  facts about the shared event (which app published it, a summary of that event);
 *     `expiration`, `-`, `nonce`  event mechanics: an expiry date, a protected-event marker relays refuse
 *                      from anyone else, and a proof of work that no longer holds.
 * Everything else (required / optional / recommended, field-type, allowed, display, image, t, name, title,
 * titles, founder, claims, …) is copied as it is: the owner kept name / title / titles and founder / claims
 * when asked (2026-10-02).
 *
 * Re-Sync (the owner's request of 2026-10-02) rebuilds a wired header from the shared concept it points
 * to with the same rule, from scratch: the shared header's names, description and tags replace the
 * local ones, and only the local header's own address (`d`) and its own KEPT_LOCAL tags stay. Those are
 * `json`, `concept-graph` and `z`: the kinds the copy never takes from the shared header, because they
 * are about the header's own author (its naming record, its own derived graph, where it is filed). The
 * owner chose to keep them (2026-10-02). The kept `json`'s names and description follow the new ones,
 * as an Edit's do.
 *
 * Pure CJS, zero requires: the server's endpoints (src/api/adoption/newConcept.js, resyncConcept.js)
 * compose with it, and the browser imports the same code through the `@tapestry/concept-header-copy`
 * alias (ui/vite.config.js), so a preview or a summary of changes is exactly what is signed.
 */

'use strict';

const COPY_SKIPPED = ['json', 'concept-graph', 'z', 'client', 'alt', 'expiration', '-', 'nonce'];
const KEPT_LOCAL = ['json', 'concept-graph', 'z'];
const LIST_HEADER_ADDRESS_RE = /^39998:[0-9a-f]{64}:.+$/;

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

const firstValue = (event, name) => {
  const t = (event && Array.isArray(event.tags) ? event.tags : []).find((x) => isTag(x) && x[0] === name);
  return t && typeof t[1] === 'string' ? t[1] : null;
};

/**
 * The shared concept a header is wired to: its first pointer b-tag (typed "pointer", or untyped) whose
 * value is another list header's address. null for a header that is itself the shared concept, or has no
 * such b-tag. Re-Sync rebuilds from it, and leaves the header with that one b-tag.
 */
function wiredTarget(event) {
  const d = firstValue(event, 'd');
  const self = event && typeof event.pubkey === 'string' && d !== null ? `39998:${event.pubkey}:${d}` : null;
  const b = (event && Array.isArray(event.tags) ? event.tags : []).find((t) => isTag(t) && t[0] === 'b'
    && typeof t[1] === 'string' && LIST_HEADER_ADDRESS_RE.test(t[1]) && t[1] !== self
    && (t[2] === undefined || t[2] === '' || t[2] === 'pointer'));
  return b ? b[1] : null;
}

/** The `json` tag with its conceptHeader's names and description set, when they differ (else as it was). */
function syncedJson(tag, { singular, plural, description }) {
  let obj;
  try { obj = JSON.parse(tag[1]); } catch { return [...tag]; }
  const ch = obj && typeof obj === 'object' && obj.conceptHeader && typeof obj.conceptHeader === 'object' ? obj.conceptHeader : null;
  if (!ch) return [...tag];
  const names = ch.oNames && typeof ch.oNames === 'object' ? ch.oNames : {};
  const sameNames = names.singular === singular && names.plural === plural;
  const sameDesc = description ? ch.description === description : ch.description === undefined;
  if (sameNames && sameDesc) return [...tag];
  if (!sameNames) ch.oNames = { ...names, singular, plural };
  if (!sameDesc) { if (description) ch.description = description; else delete ch.description; }
  return [tag[0], JSON.stringify(obj), ...tag.slice(2)];
}

/**
 * Re-Sync: `local` (the header being rebuilt) as a fresh copy of `source` (the shared header it is wired
 * to, at `target`). Names and description are the source's (a source without a names tag keeps the
 * local names); `d` stays the local one; the local KEPT_LOCAL tags stay, after the copied names, slug and
 * description, in their own order, with a kept `json` following the new names and description.
 */
function resyncedHeaderTags({ local, source, target }) {
  const d = firstValue(local, 'd') || '';
  const sourceNames = (source && Array.isArray(source.tags) ? source.tags : []).find((t) => isTag(t) && t[0] === 'names');
  const localNames = (local && Array.isArray(local.tags) ? local.tags : []).find((t) => isTag(t) && t[0] === 'names');
  const names = sourceNames || localNames || ['names', d, d];
  // Trimmed, as Edit trims what a person types.
  const singular = typeof names[1] === 'string' ? names[1].trim() : d;
  const plural = typeof names[2] === 'string' ? names[2].trim() : singular;
  const description = (firstValue(source, 'description') || '').trim();
  const out = copiedHeaderTags({ source, d, singular, plural, description, target });
  const kept = (local && Array.isArray(local.tags) ? local.tags : []).filter((t) => isTag(t) && KEPT_LOCAL.includes(t[0]))
    .map((t) => (t[0] === 'json' && typeof t[1] === 'string' ? syncedJson(t, { singular, plural, description }) : [...t]));
  let at = 0;
  out.forEach((t, i) => { if (['d', 'names', 'slug', 'description'].includes(t[0])) at = i + 1; });
  out.splice(at, 0, ...kept);
  return out;
}

/**
 * What a new version changes, tag by tag, as Re-Sync's summary shows it: { removed, added }. A tag is the
 * same only when every value is; a changed one (a different b, a renamed names) is the old one removed and
 * the new one added. Repeats count: two identical tags where there was one is one added.
 */
function tagDiff(before, after) {
  const key = (t) => JSON.stringify(t);
  const count = (tags) => {
    const m = new Map();
    for (const t of tags) m.set(key(t), (m.get(key(t)) || 0) + 1);
    return m;
  };
  const a = (Array.isArray(before) ? before : []).filter(isTag);
  const b = (Array.isArray(after) ? after : []).filter(isTag);
  const left = count(b);
  const removed = [];
  for (const t of a) {
    const n = left.get(key(t)) || 0;
    if (n > 0) left.set(key(t), n - 1); else removed.push(t);
  }
  const right = count(a);
  const added = [];
  for (const t of b) {
    const n = right.get(key(t)) || 0;
    if (n > 0) right.set(key(t), n - 1); else added.push(t);
  }
  return { removed, added };
}

module.exports = { COPY_SKIPPED, KEPT_LOCAL, copiedHeaderTags, wiredTarget, resyncedHeaderTags, tagDiff };
