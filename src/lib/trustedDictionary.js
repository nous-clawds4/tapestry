/**
 * Trusted-dictionary arithmetic — the single owner of the S3b-with-threshold
 * semantics (ADR shared-concepts-adoption/0005; the owner's taxonomy, intake
 * 2026-08-05; scoring semantics ratified at /discuss 2026-08-07).
 *
 * computeDictionary({headers, zCarriers, qualifying, threshold, taPubkey})
 *   → { entries, metric }                   — the trusted dictionary (below)
 * computeConceptDictionary({rows, zCarriers, qualifying, taPubkey})
 *   → { entries, metric }                   — Dictionary › Concepts (its own
 *                                              doc comment, further down)
 * recognitionByConcept({sharedCoords, pointers, ownersOf, exclude, influence})
 *   → Map coord → { gum2, recognizedBy, recognizers } — GUM₂ (its own doc comment)
 * trustedItems({zCarriers, coords, qualifying, own, limit})
 *   → { items, keptCount, truncated, filerCount, totalCount } — one entry's Items
 * itemCarrier(ev)                           — a z-carrier as the Items read's scan keeps it
 * usageByHeader(…)                          — the counting rule both share
 *
 * Headers arrive PRE-CLASSIFIED at the handler seam
 * ({coord, name, plural, description, author, isMine, isFirmware, bState})
 * and the qualifying set — the carrier authors whose influence clears the
 * verified cutoff from the active POV — is resolved at the same seam, so
 * this core never touches Neo4j, b semantics or the firmware manifest (the
 * ADR 0003 pattern).
 *
 * Membership: ≥ threshold DISTINCT qualifying authors. A carrier author
 * never counts — for the threshold OR the context totals — when it is the
 * header's own author (cross-author rule, PR #494) or the instance's TA
 * (self-evidence is not community evidence), even when nominally in the
 * qualifying set. Sentinel-deferred headers stay IN the view, marked
 * (the snapshot mint drops them); real-b headers are ordinary members —
 * the dictionary is not the worklist. Declined stances are never read:
 * decline governs adoption, not usage observability. Sorted by qualifying
 * count desc, then total events desc.
 *
 * The General Usage Metric (handoff SPEC § 4):
 * every entry carries `gum`, the value of the metric the result names in
 * `metric`, so later metrics can arrive without changing the shape. Version
 * 1 has one — GUM₁, the qualifying-author count above — so `gum` equals
 * `qualifyingAuthorCount`. `itemCount` is the concept's size: distinct
 * events z-filed under the header by ANYONE, the header's own author and
 * the TA included. It is not usage evidence and never touches membership.
 * `override` (Added / Vetoed by the owner) is always null in version 1.
 *
 * Pure CJS, zero requires. The UI never re-derives this — it renders the
 * server-assembled result.
 */

'use strict';

// GUM₂ is recognitionByConcept, below (2026-10-02). TODO(GUM₃ — handoff SPEC § 4): add it here, still
// server-side, each with its inputs resolved at the handler seam (as the
// qualifying set is) and its own cutoff (default 1.50) as the membership test:
//   gum2 — built: recognitionByConcept sums the trusted recognizers' influence
//          (0–1; a Trusted Assertions rank is influence × 100) from the active POV;
//   gum3 — the rank-weighted sum of `add-to-dictionary` pinnings (apply +,
//          dispute −), once the Pins wire format lands.
// The owner picks the metric and cutoff (Automated Assistant Tasks); `metric`
// then reports the choice and `gum` carries that metric's value.
const METRIC = 'gum1';

/**
 * The counting rule, once, for both reads below. For every header coordinate
 * the z-carriers file under:
 *   items    — coord → Set of event ids, every author (the concept's size);
 *   evidence — coord → { qa, aa, ev }: the distinct authors and events once
 *              the header's own author and the TA are set aside, and those
 *              authors who are in the qualifying set (qa.size is GUM₁).
 *              A coordinate filed under only by its own author or the TA has
 *              items but no evidence entry.
 * `headers` needs only { coord, author }.
 */
function usageByHeader({ headers, zCarriers, qualifying, taPubkey } = {}) {
  const hs = new Map(); // coord → header
  for (const h of Array.isArray(headers) ? headers : []) {
    if (h && typeof h.coord === 'string' && h.coord) hs.set(h.coord, h);
  }
  const q = qualifying instanceof Set ? qualifying : new Set(Array.isArray(qualifying) ? qualifying : []);

  const evidence = new Map(); // coord → { qa:Set, aa:Set, ev:Set }
  const items = new Map(); // coord → Set of event ids, every author (the concept's size)
  for (const ev of Array.isArray(zCarriers) ? zCarriers : []) {
    if (!ev || typeof ev.pubkey !== 'string') continue;
    for (const t of ev.tags || []) {
      if (!t || t[0] !== 'z' || !hs.has(t[1])) continue;
      const h = hs.get(t[1]);
      let it = items.get(t[1]);
      if (!it) { it = new Set(); items.set(t[1], it); }
      it.add(ev.id);
      if (ev.pubkey === h.author) continue; // self-filed: internal filing, never usage
      if (taPubkey && ev.pubkey === taPubkey) continue; // the TA never counts
      let u = evidence.get(t[1]);
      if (!u) { u = { qa: new Set(), aa: new Set(), ev: new Set() }; evidence.set(t[1], u); }
      u.aa.add(ev.pubkey);
      u.ev.add(ev.id);
      if (q.has(ev.pubkey)) u.qa.add(ev.pubkey);
    }
  }
  return { items, evidence };
}

function computeDictionary({ headers, zCarriers, qualifying, threshold, taPubkey } = {}) {
  const hs = new Map(); // coord → { name, plural, description, author, isMine, isFirmware, bState }
  for (const h of Array.isArray(headers) ? headers : []) {
    if (h && typeof h.coord === 'string' && h.coord) hs.set(h.coord, h);
  }
  const n = Number.isFinite(threshold) ? threshold : 2;
  const { items, evidence: usage } = usageByHeader({ headers: [...hs.values()], zCarriers, qualifying, taPubkey });

  const entries = [];
  for (const [coord, u] of usage) {
    if (u.qa.size < n) continue;
    const h = hs.get(coord);
    entries.push({
      coord,
      name: h.name || null,
      plural: h.plural || null,
      description: h.description || null,
      author: h.author,
      isMine: !!h.isMine,
      isFirmware: !!h.isFirmware,
      sentinelDeferred: h.bState === 'deferred',
      qualifyingAuthorCount: u.qa.size,
      totalAuthorCount: u.aa.size,
      totalEventCount: u.ev.size,
      itemCount: items.get(coord).size,
      gum: u.qa.size, // GUM₁
      override: null, // version 2: the owner's add-to-dictionary pinning (Pins § 6, owner over community)
    });
  }
  entries.sort((a, b) => b.qualifyingAuthorCount - a.qualifyingAuthorCount
    || b.totalEventCount - a.totalEventCount);

  return { entries, metric: METRIC };
}

/** "kind:pubkey:d" → the pubkey: an a-tag coordinate names its own author. */
const coordAuthor = (coord) => String(coord).split(':')[1];
/** The row's display name, else its d-tag. */
const sortName = (e) => (e.name || String(e.coord).split(':').slice(2).join(':')).toLowerCase();

/**
 * Dictionary › Concepts — one person's dictionary (the owner's correction of
 * 2026-09-29). Rows arrive PRE-CLASSIFIED at the handler seam: the person's
 * concept headers that carry a real b-tag, as
 * {coord, name, plural, description, author, selfDeclared, targets,
 *  scoreCoords, isFirmware, firmwareHeader}. `isFirmware` marks a row that is a
 * firmware concept or points at one; `firmwareHeader` only a row whose own
 * header a firmware reinstall rebuilds. `scoreCoords` are the shared concepts the row
 * points to by coordinate — itself when self-declared.
 *
 * Each entry's `gum` is GUM₁ of the best-scoring of its scoreCoords: the
 * number computeDictionary gives that concept (same exclusions, same
 * qualifying set), named in `sharedCoord`. A row that points only at event
 * ids scores 0 with sharedCoord null. `totalAuthorCount` / `totalEventCount`
 * are that shared concept's evidence totals. `itemCount` counts every event
 * z-filed under the row's OWN header. No threshold: the score describes an
 * entry, it does not admit one. Sorted by name.
 */
function computeConceptDictionary({ rows, zCarriers, qualifying, taPubkey, recognition } = {}) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r.coord === 'string' && r.coord);
  const coords = new Set();
  for (const r of list) {
    coords.add(r.coord);
    for (const c of Array.isArray(r.scoreCoords) ? r.scoreCoords : []) {
      if (typeof c === 'string' && c) coords.add(c);
    }
  }
  const { items, evidence } = usageByHeader({
    headers: [...coords].map((coord) => ({ coord, author: coordAuthor(coord) })),
    zCarriers,
    qualifying,
    taPubkey,
  });

  const entries = list.map((r) => {
    let best = null; // first wins a tie, so tag order decides between equals
    for (const c of Array.isArray(r.scoreCoords) ? r.scoreCoords : []) {
      if (typeof c !== 'string' || !c) continue;
      const u = evidence.get(c) || null;
      const gum = u ? u.qa.size : 0;
      if (!best || gum > best.gum) best = { coord: c, gum, u };
    }
    return {
      coord: r.coord,
      name: r.name || null,
      plural: r.plural || null,
      description: r.description || null,
      author: r.author,
      targets: Array.isArray(r.targets) ? [...r.targets] : [],
      selfDeclared: !!r.selfDeclared,
      isFirmware: !!r.isFirmware,
      firmwareHeader: !!r.firmwareHeader,
      itemCount: items.has(r.coord) ? items.get(r.coord).size : 0,
      sharedCoord: best ? best.coord : null,
      gum: best ? best.gum : 0, // GUM₁ of the shared concept
      totalAuthorCount: best && best.u ? best.u.aa.size : 0,
      totalEventCount: best && best.u ? best.u.ev.size : 0,
      override: null, // version 2: the owner's add-to-dictionary pinning
      // GUM₂ of the same shared concept, when the seam resolved recognition (recognitionByConcept).
      ...(recognition instanceof Map ? recognitionFields(best ? recognition.get(best.coord) : null) : {}),
    };
  });
  entries.sort((a, b) => sortName(a).localeCompare(sortName(b)) || a.coord.localeCompare(b.coord));

  return { entries, metric: METRIC };
}

const recognitionFields = (r) => ({ gum2: r ? r.gum2 : 0, recognizedBy: r ? r.recognizedBy : 0 });

/**
 * GUM₂ (handoff SPEC § 4, owner's rules of 2026-10-02): for each shared concept, the trusted members
 * who recognize it — whose own concept header, or one of whose Assistants' headers, carries a `b`
 * pointing at it — each counted once by their influence from the active point of view (0–1, so the
 * sum is a decimal). `recognizedBy` is how many of them there are: the design's "Recognized by N
 * members".
 *
 * Inputs arrive resolved at the handler seam, as GUM₁'s qualifying set does:
 *   sharedCoords — the concepts to score;
 *   pointers     — newest kind-39998 headers, as { coord, pubkey, b: [values] };
 *   ownersOf     — Map signer → its owners (who tagged it as their Assistant, or own it on this
 *                  instance's roster). A header stands for its signer AND the signer's owners: a
 *                  person's own header counts as theirs, and nobody's claim can take that away
 *                  (anyone can publish a "My Assistant" tag, so a claim only ever adds);
 *   exclude      — the reader (their account and Assistant): recognition is other people's;
 *   influence    — Map pubkey → influence, holding only the trusted (above the verified cutoff).
 * Also never counted: the concept's own header, and its author with that author's owners (the
 * author recognizing their own concept is not community recognition). `recognizers` counts every
 * distinct recognizer before the trust filter.
 */
function recognitionByConcept({ sharedCoords, pointers, ownersOf, exclude, influence } = {}) {
  const owners = (pk) => {
    const o = ownersOf instanceof Map ? ownersOf.get(pk) : null;
    return [pk, ...(Array.isArray(o) ? o.filter((x) => x !== pk) : [])];
  };
  const inf = influence instanceof Map ? influence : new Map();
  const reader = new Set(Array.isArray(exclude) ? exclude : []);
  const out = new Map();
  for (const c of new Set((Array.isArray(sharedCoords) ? sharedCoords : []).filter((x) => typeof x === 'string' && x))) {
    const author = coordAuthor(c);
    const excluded = new Set([...reader, author, ...owners(author)]);
    const recognizers = new Set();
    for (const p of Array.isArray(pointers) ? pointers : []) {
      if (!p || p.coord === c || !Array.isArray(p.b) || !p.b.includes(c)) continue;
      for (const o of owners(p.pubkey)) if (!excluded.has(o)) recognizers.add(o);
    }
    let sum = 0;
    let trusted = 0;
    for (const o of recognizers) {
      const v = inf.get(o);
      if (typeof v === 'number' && Number.isFinite(v)) { sum += v; trusted += 1; }
    }
    out.set(c, { gum2: Math.round(sum * 100) / 100, recognizedBy: trusted, recognizers: recognizers.size });
  }
  return out;
}

/** The item's display name: its names, else name, else title, else d-tag, else a short id. */
function itemName(ev) {
  for (const n of ['names', 'name', 'title', 'd']) {
    const t = (ev.tags || []).find((x) => x && x[0] === n && typeof x[1] === 'string' && x[1].trim() !== '');
    if (t) return t[1];
  }
  return `${String(ev.id || '').slice(0, 8)}…`;
}

/** The most items one read returns; the counts still cover every item. */
const ITEMS_LIMIT = 1000;

// An item's own words, bounded: its description, and the property tags its header's Item Property Tags
// (required / optional / recommended) name. A property is any tag but a single-letter (indexed) one and
// those that name or describe the item; the first of each name counts.
const NOT_PROPERTIES = new Set(['names', 'name', 'title', 'description', 'json', 'alt', 'client']);
const MAX_ITEM_PROPERTIES = 20;
const MAX_ITEM_TEXT = 300;
const textTag = (t) => Array.isArray(t) && typeof t[0] === 'string' && typeof t[1] === 'string' && t[1].trim() !== '';

/** The item's own description tag, trimmed and bounded, else null. */
function itemDescription(ev) {
  const t = (ev.tags || []).find((x) => textTag(x) && x[0] === 'description');
  return t ? t[1].trim().slice(0, MAX_ITEM_TEXT) : null;
}

/** The item's property tags as {name: value}: what it carries, for a DList's own page to show. */
function itemProperties(ev) {
  const out = {};
  let n = 0;
  for (const t of ev.tags || []) {
    if (n >= MAX_ITEM_PROPERTIES) break;
    if (!textTag(t) || t[0].length < 2 || t[0].length > 64 || NOT_PROPERTIES.has(t[0])) continue;
    if (Object.prototype.hasOwnProperty.call(out, t[0])) continue;
    out[t[0]] = t[1].trim().slice(0, MAX_ITEM_TEXT);
    n += 1;
  }
  return out;
}

// The tags trustedItems reads off a z-carrier: its filing, its address, its name, and a curation copy's q.
const ITEM_CARRIER_TAGS = ['z', 'd', 'names', 'name', 'title', 'q'];

/**
 * A z-carrier as the Items read keeps it from the scan (assembleConceptItems): only the tags
 * trustedItems reads, with the item's own words (itemDescription, itemProperties) computed and bounded
 * here, from all its tags, so a scan never holds every tag of every event.
 */
function itemCarrier(ev) {
  return {
    id: ev.id, kind: ev.kind, pubkey: ev.pubkey, created_at: ev.created_at,
    tags: (ev.tags || []).filter((t) => Array.isArray(t) && ITEM_CARRIER_TAGS.includes(t[0])),
    description: itemDescription(ev),
    properties: itemProperties(ev),
  };
}

/** A curation copy (assistant-designation.md § Curation copies): a kind-39999 item whose d is "copy-<sha256>". */
const isCurationCopy = (ev) => ev.kind === 39999
  && (ev.tags || []).some((t) => t && t[0] === 'd' && typeof t[1] === 'string' && t[1].startsWith('copy-'));

/**
 * A Dictionary entry's Items: the events z-filed under the entry's concept
 * (its own header and the shared concept it points to, `coords`) by people the
 * active point of view trusts. `qualifying` is the trusted set resolved at the
 * handler seam (resolveQualifying: influence above the verified cutoff), the
 * same one GUM₁ counts. `own` is the reader (their account and assistant):
 * their own filings always stay, since a point of view trusts itself.
 *
 * An addressable item (kind 30000–39999) is one item however many versions
 * arrive: the newest wins. A curation copy and the original its `q` tags name
 * are one item too (assistant-designation.md: "a reader merging items across
 * related lists … treats a copy and its original as one item"): the original
 * stays when its filer is kept, else the copy does. Items are in filing order,
 * oldest first, so an item keeps its number as new ones arrive. Each carries
 * its name, its own description and its property tags (itemProperties). At most
 * `limit` are returned (`truncated` says when more were kept); `filerCount`
 * and `totalCount` (every distinct item before the trust filter) cover all.
 */
function trustedItems({ zCarriers, coords, qualifying, own, limit = ITEMS_LIMIT } = {}) {
  const cs = new Set((Array.isArray(coords) ? coords : []).filter((c) => typeof c === 'string' && c));
  const q = qualifying instanceof Set ? qualifying : new Set(Array.isArray(qualifying) ? qualifying : []);
  const mine = new Set(Array.isArray(own) ? own : []);
  const kept = (ev) => q.has(ev.pubkey) || mine.has(ev.pubkey);

  const all = new Map(); // item key → newest event
  for (const ev of Array.isArray(zCarriers) ? zCarriers : []) {
    if (!ev || typeof ev.pubkey !== 'string' || typeof ev.id !== 'string') continue;
    if (!(ev.tags || []).some((t) => t && t[0] === 'z' && cs.has(t[1]))) continue;
    const d = (ev.tags || []).find((t) => t && t[0] === 'd')?.[1];
    const addressable = ev.kind >= 30000 && ev.kind < 40000 && typeof d === 'string';
    const key = addressable ? `${ev.kind}:${ev.pubkey}:${d}` : ev.id;
    const prev = all.get(key);
    if (!prev || (ev.created_at || 0) > (prev.created_at || 0)) all.set(key, ev);
  }

  // A copy names its original by address (a kind-39999 original) and by version id.
  const keyOf = new Map(); // address or id → item key
  for (const [key, ev] of all) {
    keyOf.set(ev.id, key);
    keyOf.set(key, key);
  }
  for (const [key, ev] of [...all]) {
    if (!all.has(key) || !isCurationCopy(ev)) continue;
    const original = (ev.tags || [])
      .filter((t) => t && t[0] === 'q' && typeof t[1] === 'string')
      .map((t) => keyOf.get(t[1]))
      .find((k) => k && k !== key && all.has(k));
    if (!original) continue;
    if (kept(all.get(original)) || !kept(ev)) all.delete(key);
    else all.delete(original);
  }

  const items = [];
  const filers = new Set();
  for (const [key, ev] of all) {
    if (!kept(ev)) continue;
    filers.add(ev.pubkey);
    items.push({
      id: ev.id,
      address: key === ev.id ? null : key,
      kind: ev.kind,
      author: ev.pubkey,
      name: itemName(ev),
      // As itemCarrier computed them in the scan, else from the event's own tags.
      description: ev.description !== undefined ? ev.description : itemDescription(ev),
      properties: ev.properties !== undefined ? ev.properties : itemProperties(ev),
      createdAt: ev.created_at || 0,
    });
  }
  items.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

  const cap = Number.isFinite(limit) && limit > 0 ? limit : ITEMS_LIMIT;
  return {
    items: items.slice(0, cap),
    keptCount: items.length,
    truncated: items.length > cap,
    filerCount: filers.size,
    totalCount: all.size,
  };
}

module.exports = { computeDictionary, computeConceptDictionary, usageByHeader, trustedItems, itemCarrier, recognitionByConcept };
