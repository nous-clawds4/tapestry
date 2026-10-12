'use strict';
/**
 * Self-Maps — what one Assistant key's own kind 10040 should say about the duties it is publishing now, read against a
 * person's Treasure Map, this instance's offer and the evidence that each duty has landed and is kept up to date
 * (protocols/drafts/treasure-maps.md § 9.2; assistant-self-map #1, ADR assistant-self-map/0001 sub-decisions 1–4 and 7,
 * with Amendment 1).
 *
 * Pure CommonJS with no I/O: the server's check (src/api/assistant/selfMap.js) gathers the inputs, and story 2's
 * writer reuses the should-say rule.
 *
 * The engine is bounded (ADR 0001 K1). It reasons over kind slots (an exact kind, `3038x`, `3039x`, a bare `*`), Score
 * metric keys (`<kind>:<metric>`) and Concept keys (`39998`, `39999`, `39998:<d>`, `39999:<d>`). Any other key shape
 * is unchecked: never claimed, and, as a duty, it keeps a broader self-entry from winning it.
 *
 * It reasons over a finite set of probe insights, each standing for one region of insights that every key either
 * matches whole or not at all (sub-decision 1). A probe's winning key in the Map is § 6's most specific matching key; it
 * is the Assistant's duty when that key's entries name it, as Preferred or Alternate (§ 9), and, under a scope key, only
 * where it can hold an insight of the observer's supported sets (§ 8; read from this instance's own record).
 */

const { normalizeMenuKey } = require('../duty-menu');
const { normalizeRelayUrl } = require('../relay-list');
const { TRUST_ASSERTION_METRICS } = require('../treasureMapMerge');

const SELF_MAP_KIND = 10040;
const HEX64 = /^[0-9a-f]{64}$/i;
const KIND_SLOT = /^(\d{5}|3038x|3039x|\*)$/;

/** The metric tags both Score publishers write: the observer's supported Scores on this instance (open question 1). */
const PUBLISHED_SCORE_METRICS = TRUST_ASSERTION_METRICS.slice();

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const SCORE_KINDS = range(30380, 30389);
const LIST_KINDS = range(30390, 30399);
const CONCEPT_KINDS = [39998, 39999];
const SCORE_KIND = 30382;
const SYSTEM_WORDS = ['tag', 'pin', 'dlist', 'contexts'];

const isScoreKind = (k) => k >= 30380 && k <= 30389;
const isListKind = (k) => k >= 30390 && k <= 30399;
const isConceptKind = (k) => k === 39998 || k === 39999;

/** The category a kind belongs to, in /treasure-map's names' keys; null outside the three (Amendment 2 item 6). */
function categoryOfKind(kind) {
  if (isScoreKind(kind)) return 'scores';
  if (isListKind(kind)) return 'lists';
  return isConceptKind(kind) ? 'concepts' : null;
}

/**
 * The Concept kinds a bare Concept slot covers, and their order (ADR 0001 sub-decision 4; duty-menus.md § 6.2 step 1,
 * provisional until story 4 of duty-menus-and-self-maps settles it): a bare `39998` covers every Concept key, `39999`
 * headers included; a bare `39999` covers the `39999:<d>` keys; a `39999` slot beats a bare `39998`.
 * @param {'39998'|'39999'} slot
 * @returns {{ kinds: number[], rank: number }}  rank orders kind slots in § 6 (higher is more specific)
 */
function conceptReading(slot) {
  return slot === '39998' ? { kinds: [39998, 39999], rank: 2 } : { kinds: [39999], rank: 3 };
}

/**
 * Spellings that name nothing (Amendment 3 item 1), after normalizeMenuKey: a Concept kind and a colon alone is not a
 * key, and readers ignore such an entry as if absent (Treasure Maps § 4.5); `39999:dlist-header` and `39999:duty-menu`
 * name no Concept (§ 4.6).
 */
const NAMELESS_KEYS = new Set(['39998:', '39999:', '39999:dlist-header', '39999:duty-menu']);

/**
 * One key, parsed for the engine (sub-decision 1): its normalized form, kind slot, the kinds the slot covers, its
 * later segments, and its scope. null when the kind slot does not parse, and for the four spellings that name nothing
 * (NAMELESS_KEYS, Amendment 3 item 1), so every reader here drops them.
 * @param {string} key
 * @returns {?{ norm: string, slot: string, kinds: number[], segs: string[], rank: number,
 *              scope: { type: 'all'|'metric'|'d'|'unchecked', metric?: string, d?: string } }}
 */
function parseKey(key) {
  if (typeof key !== 'string') return null;
  const colon = key.indexOf(':');
  const slot = colon < 0 ? key : key.slice(0, colon);
  if (!KIND_SLOT.test(slot)) return null;
  const norm = normalizeMenuKey(key);
  if (NAMELESS_KEYS.has(norm)) return null;
  if (slot === '39998' || slot === '39999') {
    const { kinds, rank } = conceptReading(slot);
    if (norm === slot) return { norm, slot, kinds, segs: [], rank, scope: { type: 'all' } };
    const d = norm.slice(slot.length + 1);
    return { norm, slot, kinds: [Number(slot)], segs: [d], rank: 3, scope: { type: 'd', d } };
  }
  const segs = norm.split(':').slice(1);
  let kinds;
  let rank;
  if (slot === '*') {
    kinds = segs.length === 0 ? [...SCORE_KINDS, ...LIST_KINDS, ...CONCEPT_KINDS] : [...SCORE_KINDS, ...LIST_KINDS];
    rank = 0;
  } else if (slot === '3038x') { kinds = SCORE_KINDS.slice(); rank = 1; } else if (slot === '3039x') { kinds = LIST_KINDS.slice(); rank = 1; } else {
    kinds = [Number(slot)];
    rank = 3;
  }
  let scope;
  if (segs.length === 0) scope = { type: 'all' };
  else if (slot !== '*' && kinds.every(isScoreKind) && segs.length === 1 && segs[0] !== '' && !SYSTEM_WORDS.includes(segs[0])) {
    scope = { type: 'metric', metric: segs[0] };
  } else scope = { type: 'unchecked' };
  return { norm, slot, kinds, segs, rank, scope };
}

const asParsed = (k) => (typeof k === 'string' ? parseKey(k) : k);

/**
 * Treasure Maps § 6 as a sort comparator (Amendment 1 item 3): negative when `a` is the more specific key, so
 * `keys.sort(compareKeys)` puts the most specific first. The kind slot first (an exact kind, then a family, then `*`,
 * with a `39999` slot above a bare `39998`), then each later segment, where a value beats an empty or omitted one.
 * Keys that never overlap are ordered by their spelling, so the order is total and stable.
 */
function compareKeys(a, b) {
  const pa = asParsed(a);
  const pb = asParsed(b);
  if (!pa || !pb) return (pa ? -1 : 0) - (pb ? -1 : 0);
  if (pa.rank !== pb.rank) return pb.rank - pa.rank;
  if (pa.slot !== pb.slot) return pa.slot < pb.slot ? -1 : 1;
  const n = Math.max(pa.segs.length, pb.segs.length);
  for (let i = 0; i < n; i += 1) {
    const va = pa.segs[i] ?? '';
    const vb = pb.segs[i] ?? '';
    if (va === vb) continue;
    if (va !== '' && vb === '') return -1;
    if (va === '' && vb !== '') return 1;
    return va < vb ? -1 : 1;
  }
  return 0;
}

/** Does a parsed key match a probe insight? Covering, for the bounded shapes (duty-menus.md § 6.2 step 1). */
function matches(key, probe) {
  const k = asParsed(key);
  if (!k || !probe || !k.kinds.includes(probe.kind)) return false;
  switch (k.scope.type) {
    case 'all': return true;
    case 'metric': return probe.scope.type === 'metric' && probe.scope.metric === k.scope.metric;
    case 'd': return probe.scope.type === 'd' && probe.scope.d === k.scope.d;
    default: return probe.scope.type === 'unchecked' && probe.scope.key === k.norm;
  }
}

const probeId = (p) => `${p.kind}|${p.scope.type}|${p.scope.metric ?? p.scope.d ?? p.scope.key ?? ''}`;

/**
 * The finite set of probe insights for the keys given (sub-decision 1): per metric named, and the published ones, for
 * each Score kind; one per List kind; per `d` named, and one other, for each Concept kind; one per unchecked key and
 * kind it covers; and one for any other kind a key names.
 * @param {Array<object>} keys  parsed keys (Map entries' and found self-entries')
 */
function buildProbes(keys) {
  const parsed = (Array.isArray(keys) ? keys : []).map(asParsed).filter(Boolean);
  const out = new Map();
  const add = (p) => { const id = probeId(p); if (!out.has(id)) out.set(id, p); };
  for (const kind of SCORE_KINDS) {
    const metrics = new Set(kind === SCORE_KIND ? PUBLISHED_SCORE_METRICS : []);
    for (const k of parsed) if (k.scope.type === 'metric' && k.kinds.includes(kind)) metrics.add(k.scope.metric);
    for (const metric of metrics) add({ kind, scope: { type: 'metric', metric } });
    add({ kind, scope: { type: 'other' } });
  }
  for (const kind of LIST_KINDS) add({ kind, scope: { type: 'other' } });
  for (const kind of CONCEPT_KINDS) {
    for (const k of parsed) if (k.scope.type === 'd' && k.kinds.includes(kind)) add({ kind, scope: { type: 'd', d: k.scope.d } });
    add({ kind, scope: { type: 'other' } });
  }
  for (const k of parsed) {
    if (k.scope.type === 'unchecked') for (const kind of k.kinds) add({ kind, scope: { type: 'unchecked', key: k.norm } });
    for (const kind of k.kinds) if (!isScoreKind(kind) && !isListKind(kind) && !isConceptKind(kind)) add({ kind, scope: { type: 'other' } });
  }
  return [...out.values()];
}

/**
 * A Map's entries as the engine reads them: one group per normalized key, in the order the Map first names it, with its
 * valid delegates in Map order, each once (lower-cased). Tags whose key doesn't parse, or whose delegate isn't a key,
 * are left out.
 */
function mapGroups(event) {
  const tags = event && Array.isArray(event.tags) ? event.tags : [];
  const byNorm = new Map();
  for (const t of tags) {
    if (!Array.isArray(t) || typeof t[1] !== 'string' || !HEX64.test(t[1])) continue;
    const parsed = parseKey(t[0]);
    if (!parsed) continue;
    let g = byNorm.get(parsed.norm);
    if (!g) { g = { key: parsed, providers: [], relays: [] }; byNorm.set(parsed.norm, g); }
    const who = t[1].toLowerCase();
    if (!g.providers.includes(who)) { g.providers.push(who); g.relays.push(typeof t[2] === 'string' ? t[2] : ''); }
  }
  return [...byNorm.values()];
}

/** The most specific of `candidates` (parsed keys, or objects with `.key`) that matches the probe, or null. */
function winnerOf(candidates, probe, keyOf = (c) => c) {
  let best = null;
  for (const c of candidates) {
    const k = keyOf(c);
    if (!matches(k, probe)) continue;
    if (!best || compareKeys(k, keyOf(best)) < 0) best = c;
  }
  return best;
}

/**
 * Whether a probe can hold an insight of the observer's supported sets (§ 8), read from this instance's own record
 * (sub-decision 1): the eleven published metrics for 30382; the Concepts the Assistant curates; none for `39999`; and,
 * where there is no record, assumed so.
 * @param {object} probe
 * @param {{ anyHeader: boolean, headers: Set<string> }} record
 */
function inSupportedSets(probe, record) {
  if (probe.scope.type === 'unchecked') return true;
  if (probe.kind === SCORE_KIND) return probe.scope.type === 'metric' && PUBLISHED_SCORE_METRICS.includes(probe.scope.metric);
  if (probe.kind === 39998) {
    if (probe.scope.type === 'd') return record.headers.has(probe.scope.d);
    return record.anyHeader;
  }
  if (probe.kind === 39999) return false;
  return true;
}

/**
 * The Assistant's duties among the probes (§ 9): for each probe, the Map's winning group, and whether it is a duty.
 * @returns {Map<string, { probe, winner: ?object, duty: boolean }>}
 */
function dutiesOf(groups, assistant, probes, record) {
  const who = String(assistant || '').toLowerCase();
  const out = new Map();
  for (const probe of probes) {
    const winner = winnerOf(groups, probe, (g) => g.key);
    let duty = false;
    if (winner && winner.providers.includes(who)) duty = winner.key.scope.type !== 'all' || inSupportedSets(probe, record);
    out.set(probeId(probe), { probe, winner, duty });
  }
  return out;
}

/**
 * Is a probe live, and if not why (sub-decision 3)? `offered` is false when the offer has no row for its kind.
 * @param {object} probe
 * @param {{ offer: Map<number,string>, assistantIsTa: boolean, scores: { status: string, lastLandedAt: ?number },
 *           record: { anyHeader: boolean, headers: Set<string> } }} ctx
 * @returns {{ offered: boolean, live: boolean, relay: ?string, reason: ?string, lastLandedAt: ?number }}
 */
function evaluateLive(probe, ctx) {
  const relay = ctx.offer.get(probe.kind) || null;
  const no = (reason, extra = {}) => ({ offered: true, live: false, relay, reason, lastLandedAt: null, ...extra });
  if (!relay) return { offered: false, live: false, relay: null, reason: null, lastLandedAt: null };
  if (probe.scope.type === 'unchecked') return no('unchecked');
  if (isScoreKind(probe.kind)) {
    if (probe.kind !== SCORE_KIND || probe.scope.type !== 'metric' || !PUBLISHED_SCORE_METRICS.includes(probe.scope.metric)) return no('not-published-here');
    const s = ctx.scores || { status: 'not-scheduled' };
    if (s.status === 'live') return { offered: true, live: true, relay, reason: null, lastLandedAt: null };
    return no(s.status, s.status === 'upkeep-stopped' ? { lastLandedAt: s.lastLandedAt ?? null } : {});
  }
  if (isListKind(probe.kind)) return no(ctx.assistantIsTa ? 'older-form' : 'not-published-here');
  if (probe.kind === 39998) {
    if (probe.scope.type === 'd') return ctx.record.headers.has(probe.scope.d) ? { offered: true, live: true, relay, reason: null, lastLandedAt: null } : no('not-landed');
    return ctx.record.anyHeader ? { offered: true, live: true, relay, reason: null, lastLandedAt: null } : no('nothing-to-publish');
  }
  return no('not-published-here');
}

/** The one relay the offer gives every kind a key covers, or null when one isn't offered or they differ. */
function relayFor(key, offer) {
  const relays = new Set();
  for (const kind of key.kinds) {
    const r = offer.get(kind);
    if (!r) return null;
    relays.add(r);
  }
  return relays.size === 1 ? [...relays][0] : null;
}

/** A key narrowed to one kind (a meet, sub-decision 2): the kind in its slot, its later segments kept. */
function meetOf(key, kind) {
  if (key.kinds.length === 1 && key.slot === String(kind)) return key;
  if (key.slot === '39998' && kind === 39998 && key.scope.type === 'all') return key;
  return parseKey([String(kind), ...key.segs].join(':'));
}

/**
 * What the self-Map should say (sub-decision 2): deterministic and greedy, most specific first. Each of the viewer's
 * keys naming the Assistant is tried verbatim, then its meets with each offered kind it covers, then, for a `30382`
 * meet, one `30382:<metric>` per published metric that is a duty under it. A candidate at relay R is valid when every
 * duty probe it would win among the self-entries chosen so far is live at R, and it wins at least one.
 * @returns {Array<{ key: string, relay: string }>}
 */
function buildShouldSay({ groups, assistant, duties, live, offer }) {
  const who = String(assistant || '').toLowerCase();
  const mine = groups.filter((g) => g.providers.includes(who)).map((g) => g.key).sort(compareKeys);
  const probes = [...duties.values()];
  const chosen = [];
  const has = (norm) => chosen.some((c) => c.key.norm === norm);
  const valid = (cand, relay) => {
    let speaks = false;
    for (const { probe, duty } of probes) {
      if (!duty || !matches(cand, probe)) continue;
      const w = winnerOf([...chosen.map((c) => c.key), cand], probe);
      if (w !== cand) continue;
      const l = live.get(probeId(probe));
      if (!l || !l.live || l.relay !== relay) return false;
      speaks = true;
    }
    return speaks;
  };
  const tryKey = (cand) => {
    if (!cand || has(cand.norm)) return false;
    const relay = relayFor(cand, offer);
    if (!relay || !valid(cand, relay)) return false;
    chosen.push({ key: cand, relay });
    return true;
  };
  for (const k of mine) {
    if (has(k.norm) || tryKey(k)) continue;
    const meets = k.kinds.filter((kind) => offer.has(kind)).map((kind) => meetOf(k, kind)).filter(Boolean)
      .filter((m, i, all) => all.findIndex((x) => x.norm === m.norm) === i).sort(compareKeys);
    for (const m of meets) {
      if (m.norm !== k.norm && tryKey(m)) continue;
      if (!m.kinds.includes(SCORE_KIND) || m.kinds.length !== 1 || m.scope.type !== 'all') continue;
      for (const metric of PUBLISHED_SCORE_METRICS) {
        const d = duties.get(probeId({ kind: SCORE_KIND, scope: { type: 'metric', metric } }));
        if (d && d.duty && d.winner && d.winner.key.norm === k.norm) tryKey(parseKey(`${SCORE_KIND}:${metric}`));
      }
    }
  }
  return chosen.map((c) => ({ key: c.key.norm, relay: c.relay }));
}

/**
 * A self-entry's relay (Amendment 3 item 2): '' when element 3 is missing or empty, which claims nothing (§ 9.2); else
 * the normalized URL; else the string as written (trimmed), a claim at a relay no live part is at.
 */
function selfEntryRelay(value) {
  if (typeof value !== 'string' || value.trim() === '') return '';
  return normalizeRelayUrl(value) || value.trim();
}

/**
 * A found self-Map's self-entries (Amendment 1 item 2): its entries naming the author, each { key, relay } normalized,
 * and the count of entries naming any other key. An entry is a tag whose element 1 parses as a key and whose element 2
 * is a 64-hex key, as mapGroups reads them (Amendment 2 item 5), so the four nameless spellings count in neither
 * (Amendment 3 item 1). Relays are read by selfEntryRelay (Amendment 3 item 2).
 */
function readSelfEntries(event, author) {
  const who = String(author || '').toLowerCase();
  const selfEntries = [];
  const seen = new Set();
  let otherEntries = 0;
  for (const t of event && Array.isArray(event.tags) ? event.tags : []) {
    if (!Array.isArray(t) || typeof t[0] !== 'string' || typeof t[1] !== 'string' || !HEX64.test(t[1])) continue;
    const parsed = parseKey(t[0]);
    if (!parsed) continue;
    if (t[1].toLowerCase() !== who) { otherEntries += 1; continue; }
    const entry = { key: parsed.norm, relay: selfEntryRelay(t[2]) };
    const id = `${entry.key}|${entry.relay}`;
    if (seen.has(id)) continue;
    seen.add(id);
    selfEntries.push(entry);
  }
  return { selfEntries, otherEntries };
}

/** Do two lists hold the same self-entries? Sets of key and relay; order never counts. */
function sameSelfEntries(a, b) {
  const set = (xs) => new Set((Array.isArray(xs) ? xs : []).map((x) => `${x && x.key}|${x && x.relay}`));
  const x = set(a);
  const y = set(b);
  if (x.size !== y.size) return false;
  for (const id of x) if (!y.has(id)) return false;
  return true;
}

/**
 * The duties lines (sub-decision 7, Amendment 1 items 4, 5 and 9): one item per viewer key naming the Assistant, in Map
 * order; a line per offered kind the key still wins something in, a not-offered line, and an elsewhere line per more
 * specific key naming only others that wins some of its probes.
 */
function dutyLines({ groups, assistant, duties, live, shouldSay, found }) {
  const who = String(assistant || '').toLowerCase();
  const probes = [...duties.values()];
  const should = shouldSay.map((e) => ({ key: parseKey(e.key), relay: e.relay })).filter((e) => e.key);
  const claims = (found || []).map((e) => ({ key: parseKey(e.key), relay: e.relay })).filter((e) => e.key);
  const items = [];
  for (const g of groups) {
    if (!g.providers.includes(who)) continue;
    const k = g.key;
    const won = probes.filter((p) => p.winner === g);
    const lines = [];
    for (const kind of k.kinds) {
      const ofKind = won.filter((p) => p.probe.kind === kind);
      if (ofKind.length === 0) continue;
      const first = evaluateLive(ofKind[0].probe, live.ctx);
      if (!first.offered) continue;
      const lineKey = (meetOf(k, kind) || k).norm;
      const dutyProbes = ofKind.filter((p) => p.duty);
      let reason = null;
      let lastLandedAt = null;
      let allLive = dutyProbes.length > 0;
      let claimedRight = dutyProbes.length > 0;
      let falseClaim = false;
      for (const { probe } of dutyProbes) {
        const l = live.get(probeId(probe));
        const fw = winnerOf(claims, probe, (c) => c.key);
        const sw = winnerOf(should, probe, (c) => c.key);
        // A winning self-entry with an empty relay claims nothing, so it is no false claim (Amendment 3 item 2).
        if (fw && fw.relay !== '' && (!l.live || fw.relay !== l.relay)) falseClaim = true;
        if (!l.live) {
          allLive = false;
          if (reason === null) { reason = l.reason; lastLandedAt = l.lastLandedAt; }
        }
        if (!fw || !sw || fw.key.norm !== sw.key.norm || fw.relay !== sw.relay) claimedRight = false;
      }
      if (dutyProbes.length === 0) reason = first.live ? 'nothing-to-publish' : first.reason;
      const active = allLive && claimedRight;
      if (allLive && !active) reason = 'live-unclaimed';
      lines.push({
        key: lineKey, category: categoryOfKind(kind), relay: first.relay,
        status: active ? 'active' : 'offered', reason: active ? null : reason,
        lastLandedAt: reason === 'upkeep-stopped' ? lastLandedAt : null, falseClaim,
      });
    }
    const unoffered = won.filter((p) => p.duty && !live.ctx.offer.has(p.probe.kind));
    if (unoffered.length) {
      // A part that isn't offered is never live, so any found self-entry winning one is a false claim (Amendment 2 item 4).
      const falseClaim = unoffered.some((p) => { const fw = winnerOf(claims, p.probe, (c) => c.key); return Boolean(fw && fw.relay !== ''); });
      lines.push({ key: k.norm, category: categoryOfKind(unoffered[0].probe.kind), relay: null, status: 'not-offered', reason: null, lastLandedAt: null, falseClaim });
    }
    const elsewhere = [];
    for (const p of probes) {
      const w = p.winner;
      if (!w || w === g || w.providers.includes(who) || !matches(k, p.probe) || compareKeys(w.key, k) >= 0) continue;
      if (!elsewhere.includes(w)) elsewhere.push(w);
    }
    for (const w of elsewhere) {
      lines.push({ key: w.key.norm, category: categoryOfKind(w.key.kinds[0]), relay: null, status: 'elsewhere', reason: null, lastLandedAt: null, falseClaim: false });
    }
    items.push({ key: k.norm, lines });
  }
  return items;
}

/**
 * The action from its gathered inputs (sub-decision 7). Pure.
 * @param {{ mapEvent: ?object, offer: Array<{key,relay}>, assistantPubkey: string, isOwner: boolean,
 *           scores: { status, lastLandedAt }, record: { anyHeader, headers }, lookup: { published: ?object } }} input
 */
function evaluateSelfMap({ mapEvent, offer, assistantPubkey, isOwner, scores, record, lookup }) {
  const offerMap = new Map();
  for (const row of Array.isArray(offer) ? offer : []) {
    if (row && row.tag === 'duty' && /^\d{5}$/.test(row.key) && row.relay) offerMap.set(Number(row.key), row.relay);
  }
  const rec = { anyHeader: Boolean(record && record.anyHeader), headers: record && record.headers instanceof Set ? record.headers : new Set() };
  const groups = mapGroups(mapEvent);
  const published = lookup && lookup.published ? lookup.published : null;
  const foundEntries = published ? published.selfEntries : [];
  const probes = buildProbes([...groups.map((g) => g.key), ...foundEntries.map((e) => parseKey(e.key)).filter(Boolean)]);
  const duties = dutiesOf(groups, assistantPubkey, probes, rec);
  const ctx = { offer: offerMap, assistantIsTa: Boolean(isOwner), scores, record: rec };
  const live = new Map(probes.map((p) => [probeId(p), evaluateLive(p, ctx)]));
  live.ctx = ctx;
  const shouldSay = buildShouldSay({ groups, assistant: assistantPubkey, duties, live, offer: offerMap });
  const current = sameSelfEntries(shouldSay, foundEntries);
  return {
    finished: true, done: current, pending: !current, reason: null,
    mapFound: Boolean(mapEvent),
    duties: dutyLines({ groups, assistant: assistantPubkey, duties, live, shouldSay, found: foundEntries }),
    shouldSay,
    published,
    current,
    instanceMap: Boolean(isOwner),
  };
}

module.exports = {
  SELF_MAP_KIND,
  PUBLISHED_SCORE_METRICS,
  parseKey,
  compareKeys,
  matches,
  conceptReading,
  buildProbes,
  dutiesOf,
  evaluateLive,
  buildShouldSay,
  readSelfEntries,
  sameSelfEntries,
  evaluateSelfMap,
  categoryOfKind,
  mapGroups,
};
