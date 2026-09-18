/**
 * trustedListView — pure helpers for reading a Trusted List event (kinds 30392–30395)
 * the way the protocol actually defines it.
 *
 * Two facts drive everything here:
 *
 * 1. **The member tag is a function of the kind**, not of the letter alone
 *    (`protocols/drafts/trusted-lists.md`, the NIP-85 `+10` table): 30392 = `p`
 *    (pubkeys), 30393 = `e` (notes), 30394 = `a` (addressables), 30395 = `i`
 *    (identities). A letter that is NOT the kind's member letter is metadata — e.g. a
 *    30393 carries `['p', observer]` and `['a', '39999:<author>:<slug>']` as *discovery*
 *    tags, and counting those as members overstates the list.
 *
 * 2. **`z` means membership** (`protocols/drafts/event-taggings.md` § "Tag references"):
 *    "this event is an element of that list/concept." So a TL's `z` tags read literally
 *    as "this list is a member of <that list>". Since ADR dlist-item-tagging/0002 every
 *    TL carries the concept `z` (`39998:<TA>:trusted-list`) plus a per-tag TL-header `z`
 *    (`39999:<TA>:tl:<slug>-tls`), and a contextual list adds its context concept.
 */

/** kind → the single letter its members are tagged with. */
export const MEMBER_LETTER = {
  30392: 'p',
  30393: 'e',
  30394: 'a',
  30395: 'i',
};

/** The member letter for a TL kind, or null for a kind that is not a Trusted List. */
export function memberLetterOf(kind) {
  return MEMBER_LETTER[Number(kind)] || null;
}

const SINGLE_LETTER = /^[a-zA-Z]$/;
/** `d` is the event's own address, not a pointer at another event — always metadata. */
const SELF_LETTERS = new Set(['d']);

/**
 * Split a TL event's tags into the four roles the wire shape actually has.
 *
 *   members   — tags of the kind's member letter, in event order (index preserved).
 *   memberships — `z` tags: the lists/concepts this list is itself an element of.
 *   otherRefs — single-letter tags that are neither members nor `z`: legacy/relay
 *               discovery pointers (a 30393's `a` back-ref, its `p` observer).
 *   metadata  — everything else (multi-letter: observer, source-tag, metric, …).
 *
 * Returns empty arrays for a null/!tags event rather than throwing — every caller
 * renders before the relay answers.
 */
export function splitTLTags(event) {
  const out = { members: [], memberships: [], otherRefs: [], metadata: [] };
  if (!event || !Array.isArray(event.tags)) return out;
  const memberLetter = memberLetterOf(event.kind);
  let idx = 0;
  for (const tag of event.tags) {
    if (!Array.isArray(tag) || typeof tag[0] !== 'string') continue;
    const letter = tag[0];
    if (memberLetter && letter === memberLetter) {
      idx += 1;
      out.members.push({ idx, type: letter, value: tag[1] || '', rest: tag.slice(2) });
    } else if (letter === 'z') {
      out.memberships.push(tag[1] || '');
    } else if (SINGLE_LETTER.test(letter) && !SELF_LETTERS.has(letter)) {
      out.otherRefs.push({ type: letter, value: tag[1] || '', rest: tag.slice(2) });
    } else {
      out.metadata.push({ name: letter, values: tag.slice(1) });
    }
  }
  return out;
}

/** How many members a TL event declares, counted by its kind's member letter. */
export function memberCountOf(event) {
  return splitTLTags(event).members.length;
}

const COORD_RE = /^(\d+):([0-9a-fA-F]{64}):(.*)$/;

/**
 * Parse an addressable coordinate `<kind>:<pubkey>:<d>` (the shape of every `z` value).
 * Returns null for anything that is not one — a malformed `z` is shown raw, never dropped.
 */
export function parseCoord(coord) {
  const m = COORD_RE.exec(String(coord || '').trim());
  if (!m) return null;
  return {
    coord: `${Number(m[1])}:${m[2].toLowerCase()}:${m[3]}`,
    kind: Number(m[1]),
    pubkey: m[2].toLowerCase(),
    dTag: m[3],
  };
}

/**
 * One relay filter that fetches the header events for a set of `z` coordinates, or null
 * when there is nothing addressable to fetch.
 *
 * The distinct-coordinate count is what matters for cost, not the tag count: every TL in
 * the corpus shares the same concept `z`, so a page of 200 lists resolves in one bounded
 * query over a handful of d-tags.
 */
export function zHeaderFilter(coords) {
  const parsed = (coords || []).map(parseCoord).filter(Boolean);
  if (parsed.length === 0) return null;
  return {
    kinds: [...new Set(parsed.map((p) => p.kind))],
    authors: [...new Set(parsed.map((p) => p.pubkey))],
    '#d': [...new Set(parsed.map((p) => p.dTag))],
  };
}

/** A header event's human name: `title`, else the first `names` value, else its d-tag. */
export function headerName(event) {
  if (!event || !Array.isArray(event.tags)) return null;
  const find = (n) => event.tags.find((t) => Array.isArray(t) && t[0] === n);
  const title = find('title');
  if (title && title[1]) return title[1];
  const names = find('names');
  if (names && names[1]) return names[1];
  const d = find('d');
  return d && d[1] ? d[1] : null;
}

/**
 * Index header events by the coordinate they answer to, newest wins (headers are
 * replaceable, and a relay may still hold an older copy).
 */
export function indexHeaders(events) {
  const byCoord = {};
  for (const ev of events || []) {
    if (!ev || !Array.isArray(ev.tags)) continue;
    const d = ev.tags.find((t) => Array.isArray(t) && t[0] === 'd');
    if (!d || typeof d[1] !== 'string') continue;
    const coord = `${ev.kind}:${String(ev.pubkey || '').toLowerCase()}:${d[1]}`;
    if (!byCoord[coord] || ev.created_at > byCoord[coord].created_at) byCoord[coord] = ev;
  }
  return byCoord;
}

/**
 * Render model for one `z` tag: what list this event is a member of, named when the
 * header has been resolved and falling back to the bare coordinate when it has not.
 * `resolved` false means "not fetched yet or not held locally", never "invalid".
 */
export function describeMembership(coord, headersByCoord = {}) {
  const parsed = parseCoord(coord);
  if (!parsed) return { coord: String(coord || ''), malformed: true, resolved: false, name: null };
  const name = headerName(headersByCoord[parsed.coord]);
  return { ...parsed, malformed: false, resolved: !!name, name: name || null };
}

/**
 * Positional fields of one member tag, which differ per letter (see the emitter in
 * `src/api/trustedList/index.js`): `p` = [relay, score], `e` = [relay, author, score],
 * `a` = bare coordinate (no score in v1). Empty-string placeholders read as absent.
 */
export function memberDetail(member) {
  const rest = (member && member.rest) || [];
  const at = (i) => (rest[i] === '' || rest[i] == null ? null : rest[i]);
  const base = { value: (member && member.value) || '', relay: at(0), author: null, score: null };
  if (!member) return base;
  if (member.type === 'p') return { ...base, score: at(1) };
  if (member.type === 'e') return { ...base, author: at(1), score: at(2) };
  return { ...base, relay: null };
}
