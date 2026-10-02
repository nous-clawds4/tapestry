/**
 * GUM₂, the Dictionary's recognition metric (the design's "Recognized by N members"; handoff SPEC § 4,
 * with the owner's rules of 2026-10-02):
 *   - a person owns an Assistant they tagged My Brainstorm/Tapestry Assistant (newest stance, not
 *     retracted, an apply), or their Assistant on this instance's roster; each owner counts once;
 *   - a concept is recognized by a person when their own header, or one of their Assistants', carries
 *     a b-tag pointing at it;
 *   - the concept's author (and that author's owners) and the reader don't count;
 *   - each trusted recognizer adds their influence (0–1) from the active point of view;
 *   - it is shown on the entry strip and sortable on the list; GUM₁ stays the Dictionary's metric.
 *
 *   R1..R10 — pure: recognitionByConcept and computeConceptDictionary in src/lib/trustedDictionary.js
 *             (R9: nobody's claim takes recognition away; R10: GUM₁ is untouched by the shared trust read).
 *   O1..O5  — pure: ownersFromTaggings in src/api/adoption/assistantOwners.js.
 *   I1..I2  — the reads, with fake dependencies: recognitionInputs (src/api/adoption/index.js) and
 *             resolveOwners, including scanning long lists in parts.
 *   S1..S5  — structural pins, read off comment-stripped source.
 *
 * The browser half is tests/brainstorm/dictionary-concepts.spec.js D28.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIB_JS = path.join(ROOT, 'src/lib/trustedDictionary.js');
const OWNERS_JS = path.join(ROOT, 'src/api/adoption/assistantOwners.js');
const ADOPTION_JS = path.join(ROOT, 'src/api/adoption/index.js');
const CONCEPTS_JSX = path.join(ROOT, 'ui/src/pages/dictionaries/Concepts.jsx');
const ENTRY_JSX = path.join(ROOT, 'ui/src/pages/dictionaries/ConceptEntry.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function src(p) {
  let s = '';
  try { s = fs.readFileSync(p, 'utf8'); } catch { /* reported below */ }
  assert(s.length > 0, `${path.relative(ROOT, p)} must exist`);
  return s;
}
const flat = (s) => s.replace(/\s+/g, ' ');
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');

const hex = (c) => c.repeat(64);
const AUTHOR = hex('a'); // the shared concept's author
const AUTHOR_TA = hex('b'); // the author's Assistant
const ALICE = hex('1');
const ALICE_TA = hex('2');
const ALICE_TA2 = hex('3');
const BOB = hex('4');
const CAROL = hex('5'); // not trusted
const READER = hex('6');
const READER_TA = hex('7');
const C = `39998:${AUTHOR}:dog`;
const OTHER = `39998:${AUTHOR}:cat`;

const lib = () => require(LIB_JS);
const ptr = (pubkey, d, b) => ({ coord: `39998:${pubkey}:${d}`, pubkey, b });
const owners = (pairs) => new Map(pairs);
const influence = new Map([[ALICE, 0.4], [BOB, 0.35], [AUTHOR, 0.9], [READER, 0.8]]);

// ═══ R — recognitionByConcept ═════════════════════════════════════════════════

test('R1: each trusted recognizer adds their influence; recognizedBy counts them', () => {
  const out = lib().recognitionByConcept({
    sharedCoords: [C], pointers: [ptr(ALICE_TA, 'dog', [C]), ptr(BOB, 'dog', [C])],
    ownersOf: owners([[ALICE_TA, [ALICE]]]), exclude: [], influence,
  });
  const r = out.get(C);
  // ALICE_TA stands for itself and ALICE: three recognizers, of whom ALICE and BOB are trusted.
  assert(r.gum2 === 0.75 && r.recognizedBy === 2 && r.recognizers === 3, JSON.stringify(r));
});

test('R2: a person counts once, however many of their headers or Assistants recognize it', () => {
  const out = lib().recognitionByConcept({
    sharedCoords: [C],
    pointers: [ptr(ALICE_TA, 'dog', [C]), ptr(ALICE_TA2, 'pup', [C]), ptr(ALICE, 'mine', [C])],
    ownersOf: owners([[ALICE_TA, [ALICE]], [ALICE_TA2, [ALICE]]]), exclude: [], influence,
  });
  assert(out.get(C).recognizedBy === 1 && out.get(C).gum2 === 0.4, JSON.stringify(out.get(C)));
});

test('R3: the concept\'s author, and whoever owns the author, never count', () => {
  const asAssistant = `39998:${AUTHOR_TA}:dog`;
  const out = lib().recognitionByConcept({
    sharedCoords: [asAssistant],
    pointers: [ptr(AUTHOR, 'dog-too', [asAssistant]), ptr(AUTHOR_TA, 'other', [asAssistant]), ptr(BOB, 'dog', [asAssistant])],
    ownersOf: owners([[AUTHOR_TA, [AUTHOR]]]), exclude: [], influence,
  });
  assert(out.get(asAssistant).recognizedBy === 1 && out.get(asAssistant).gum2 === 0.35, JSON.stringify(out.get(asAssistant)));
});

test('R4: the reader (their account and their Assistant) never counts', () => {
  const out = lib().recognitionByConcept({
    sharedCoords: [C], pointers: [ptr(READER_TA, 'dog', [C]), ptr(READER, 'dog', [C]), ptr(BOB, 'dog', [C])],
    ownersOf: owners([[READER_TA, [READER]]]), exclude: [READER, READER_TA], influence,
  });
  assert(out.get(C).recognizedBy === 1, JSON.stringify(out.get(C)));
});

test('R5: the concept\'s own header (self-declared) is not recognition of itself', () => {
  const out = lib().recognitionByConcept({ sharedCoords: [C], pointers: [{ coord: C, pubkey: AUTHOR, b: [C] }], ownersOf: new Map(), exclude: [], influence });
  assert(out.get(C).recognizers === 0, JSON.stringify(out.get(C)));
});

test('R6: an untrusted recognizer is counted as a recognizer but adds nothing; nobody\'s Assistant stands for itself', () => {
  const out = lib().recognitionByConcept({
    sharedCoords: [C, OTHER], pointers: [ptr(CAROL, 'dog', [C]), ptr(BOB, 'both', [C, OTHER])],
    ownersOf: new Map(), exclude: [], influence,
  });
  assert(out.get(C).recognizers === 2 && out.get(C).recognizedBy === 1 && out.get(C).gum2 === 0.35, JSON.stringify(out.get(C)));
  assert(out.get(OTHER).recognizedBy === 1, 'one header can recognize two concepts');
});

test('R7: the sum is rounded to two decimals', () => {
  const inf = new Map([[ALICE, 0.333333], [BOB, 0.333333]]);
  const out = lib().recognitionByConcept({ sharedCoords: [C], pointers: [ptr(ALICE, 'x', [C]), ptr(BOB, 'y', [C])], ownersOf: new Map(), exclude: [], influence: inf });
  assert(out.get(C).gum2 === 0.67, `got ${out.get(C).gum2}`);
});

test('R8: computeConceptDictionary carries GUM₂ for the shared concept each entry is scored for, and only when given', () => {
  const rows = [{ coord: `39998:${READER_TA}:dog`, name: 'dog', author: READER_TA, targets: [C], scoreCoords: [C], selfDeclared: false, isFirmware: false }];
  const recognition = new Map([[C, { gum2: 1.25, recognizedBy: 3, recognizers: 4 }]]);
  const withIt = lib().computeConceptDictionary({ rows, zCarriers: [], qualifying: new Set(), recognition });
  assert(withIt.entries[0].gum2 === 1.25 && withIt.entries[0].recognizedBy === 3, JSON.stringify(withIt.entries[0]));
  assert(withIt.metric === 'gum1', 'GUM₁ stays the metric');
  const without = lib().computeConceptDictionary({ rows, zCarriers: [], qualifying: new Set() });
  assert(!('gum2' in without.entries[0]) && !('recognizedBy' in without.entries[0]), 'no recognition read, no GUM₂ fields (the page then says nothing)');
});

test('R9: nobody\'s "My Assistant" claim takes a person\'s own recognition away', () => {
  const EVE = hex('e'); // untrusted
  const out = lib().recognitionByConcept({
    sharedCoords: [C], pointers: [ptr(BOB, 'dog', [C]), ptr(ALICE, 'dog', [C])],
    ownersOf: owners([[BOB, [EVE]]]), exclude: [], influence,
  });
  assert(out.get(C).recognizedBy === 2 && out.get(C).gum2 === 0.75, `BOB still counts: ${JSON.stringify(out.get(C))}`);
});

test('R10: GUM₁ is the same however many other pubkeys the shared trust read was asked about', () => {
  const rows = [{ coord: `39998:${READER_TA}:dog`, name: 'dog', author: READER_TA, targets: [C], scoreCoords: [C], selfDeclared: false, isFirmware: false }];
  const zCarriers = [{ pubkey: ALICE, id: hex('f'), tags: [['z', C]] }, { pubkey: CAROL, id: hex('0'), tags: [['z', C]] }];
  const narrow = lib().computeConceptDictionary({ rows, zCarriers, qualifying: new Set([ALICE]) });
  const wide = lib().computeConceptDictionary({ rows, zCarriers, qualifying: new Set([ALICE, BOB, READER, AUTHOR]) });
  assert(narrow.entries[0].gum === 1 && wide.entries[0].gum === 1, `GUM₁ ${narrow.entries[0].gum} vs ${wide.entries[0].gum}`);
});

// ═══ O — ownersFromTaggings ═══════════════════════════════════════════════════

const Z = '39998:nous:nostr-user-tag';
let n = 0;
function tagging(signer, target, { slug = 'my-brainstorm-assistant', polarity, at } = {}) {
  n += 1;
  const tags = [['d', `profile-tag-${slug}-${target.slice(0, 8)}-${signer.slice(0, 8)}`], ['z', Z], ['p', target], ['a', `39999:${hex('9')}:${slug}`]];
  if (polarity !== undefined) tags.push(['polarity', String(polarity)]);
  return { id: n.toString(16).padStart(64, '0'), kind: 39999, pubkey: signer, created_at: at ?? n, tags };
}
const ownersOf = (input) => require(OWNERS_JS).ownersFromTaggings(input);

test('O1: tagging an Assistant My Brainstorm (or Tapestry) Assistant makes you its owner', () => {
  const out = ownersOf({ taggings: [tagging(ALICE, ALICE_TA), tagging(BOB, hex('8'), { slug: 'my-tapestry-assistant' })] });
  assert(JSON.stringify(out.get(ALICE_TA)) === JSON.stringify([ALICE]), JSON.stringify([...out]));
  assert(JSON.stringify(out.get(hex('8'))) === JSON.stringify([BOB]), 'the Tapestry tag counts too');
});

test('O2: a retracted tagging, or a newer dispute, makes no owner', () => {
  const t = tagging(ALICE, ALICE_TA);
  const del = { id: hex('d'), kind: 5, pubkey: ALICE, created_at: 999, tags: [['e', t.id]] };
  assert(!ownersOf({ taggings: [t], deletions: [del] }).has(ALICE_TA), 'retracted (NIP-09)');
  const later = tagging(BOB, ALICE_TA, { polarity: -1, at: 500 });
  const earlier = tagging(BOB, ALICE_TA, { at: 100 });
  assert(!ownersOf({ taggings: [earlier, later] }).has(ALICE_TA), 'the newest stance (a dispute) wins');
});

test('O3: someone else\'s retraction doesn\'t undo your tagging', () => {
  const t = tagging(ALICE, ALICE_TA);
  const del = { id: hex('e'), kind: 5, pubkey: BOB, created_at: 999, tags: [['e', t.id]] };
  assert(JSON.stringify(ownersOf({ taggings: [t], deletions: [del] }).get(ALICE_TA)) === JSON.stringify([ALICE]), 'only the signer retracts');
});

test('O4: the roster names owners too, alongside taggings, each once', () => {
  const out = ownersOf({ taggings: [tagging(ALICE, ALICE_TA)], roster: [{ accountPubkey: ALICE, assistantPubkey: ALICE_TA }, { accountPubkey: BOB, assistantPubkey: hex('c') }, { accountPubkey: CAROL, assistantPubkey: null }] });
  assert(JSON.stringify(out.get(ALICE_TA)) === JSON.stringify([ALICE]), 'not twice');
  assert(JSON.stringify(out.get(hex('c'))) === JSON.stringify([BOB]), 'from the roster');
});

test('O5: several people can claim one Assistant; nobody owns themselves', () => {
  const out = ownersOf({ taggings: [tagging(ALICE, ALICE_TA), tagging(BOB, ALICE_TA), tagging(CAROL, CAROL)] });
  assert(out.get(ALICE_TA).length === 2, JSON.stringify(out.get(ALICE_TA)));
  assert(!out.has(CAROL), 'a self-tagging is not ownership');
});

// ═══ I — the reads, with fakes ═══════════════════════════════════════════════

/** A fake strfry: answers each filter from `events`, the way a scan would, and records the filters. */
function fakeScan(events) {
  const asked = [];
  const scan = async (filter, project) => {
    asked.push(filter);
    const hit = (ev) => (!filter.kinds || filter.kinds.includes(ev.kind))
      && (!filter.authors || filter.authors.includes(ev.pubkey))
      && Object.entries(filter).filter(([k]) => k.startsWith('#')).every(([k, vals]) => (ev.tags || []).some((t) => t[0] === k.slice(1) && vals.includes(t[1])));
    return events.filter(hit).map((ev) => project(ev)).filter(Boolean);
  };
  return { scan, asked };
}

test('I1: recognitionInputs finds the b-pointers, their signers\' owners, the reader to leave out, and who to ask about', async () => {
  const { recognitionInputs } = require(ADOPTION_JS);
  const dogs = [`39998:${AUTHOR}:dog`, ...Array.from({ length: 450 }, (_, i) => `39998:${AUTHOR}:c${i}`)];
  const events = [
    { id: hex('1'), kind: 39998, pubkey: ALICE_TA, created_at: 5, tags: [['d', 'dog'], ['b', dogs[0]]] },
    { id: hex('2'), kind: 39998, pubkey: BOB, created_at: 6, tags: [['d', 'late'], ['b', dogs[449]]] },
    tagging(ALICE, ALICE_TA, { at: 7 }),
  ];
  const { scan, asked } = fakeScan(events);
  const deps = { scan, zTag: () => Z, roster: async () => [{ accountPubkey: READER, assistantPubkey: READER_TA }] };
  const out = await recognitionInputs({ rows: [{ scoreCoords: dogs }], authors: [READER, READER_TA] }, deps);
  assert(asked.filter((f) => f['#b']).length === 2, `the 451 concepts are scanned in two parts, got ${asked.filter((f) => f['#b']).length}`);
  assert(out.pointers.length === 2, `two pointers, got ${out.pointers.length}`);
  assert(JSON.stringify(out.ownersOf.get(ALICE_TA)) === JSON.stringify([ALICE]), 'ALICE owns ALICE_TA by her tagging');
  assert(out.exclude.includes(READER) && out.exclude.includes(READER_TA), 'the reader and their Assistant are left out');
  assert(out.candidates.includes(ALICE) && out.candidates.includes(ALICE_TA) && out.candidates.includes(BOB), JSON.stringify(out.candidates));
});

test('I2: resolveOwners reads taggings by #p (in parts), and only their signers\' deletions', async () => {
  const { resolveOwners } = require(OWNERS_JS);
  const many = Array.from({ length: 900 }, (_, i) => i.toString(16).padStart(64, '0'));
  const t = tagging(ALICE, many[850]);
  const retract = { id: hex('d'), kind: 5, pubkey: ALICE, created_at: 999, tags: [['e', t.id]] };
  const keep = tagging(BOB, many[5]);
  const { scan, asked } = fakeScan([t, retract, keep]);
  const out = await resolveOwners(many, { scan, zTag: () => Z, roster: async () => { throw new Error('roster down'); } });
  assert(asked.filter((f) => f['#p']).length === 3, `900 pubkeys in three parts, got ${asked.filter((f) => f['#p']).length}`);
  assert(!out.has(many[850]), 'ALICE\'s retracted claim makes no owner');
  assert(JSON.stringify(out.get(many[5])) === JSON.stringify([BOB]), 'BOB\'s claim stands, and a failed roster read is just no roster');
  assert(asked.filter((f) => f.kinds && f.kinds[0] === 5).every((f) => f.authors.every((a) => a === ALICE || a === BOB)), 'deletions only by the taggers');
});

// ═══ S — structural ═══════════════════════════════════════════════════════════

test('S1: the Dictionary read finds b-pointers on this relay, resolves owners, and reads trust once for both metrics', () => {
  const s = flat(code(src(ADOPTION_JS)));
  assert(/for \(const part of chunks\(sharedCoords, SCAN_CHUNK\)\) \{ found\.push\(\.\.\.await deps\.scan\(\{ kinds: \[39998\], '#b': part \}/.test(s)
    && /scan: strfryScanStream,/.test(s), 'headers that b-point at the scored concepts, from this instance\'s relay, in parts');
  assert(/await resolveOwners\(\[\.\.\.signers, \.\.\.conceptAuthors, \.\.\.authors\]/.test(s), 'owners of the signers, the concepts\' authors and the reader');
  assert(/const asked = \[\.\.\.new Set\(\[\.\.\.zAuthors, \.\.\.\(gum2Inputs \? gum2Inputs\.candidates : \[\]\)\]\)\];/.test(s), 'one trust read: GUM₁\'s filers and GUM₂\'s recognizers');
  assert(/RETURN u\.pubkey AS pubkey, u\.influence AS influence/.test(s) && /RETURN c\.observee_pubkey AS pubkey, c\.influence AS influence/.test(s), 'influence from the house or the personalized point of view');
  assert(/\} catch \(err\) \{ console\.error\('concept-dictionary: GUM₂ inputs unavailable:'/.test(s), 'a GUM₂ failure leaves GUM₂ out, not the Dictionary');
});

test('S2: the list sorts by GUM₂ and says what it is', () => {
  const s = flat(code(src(CONCEPTS_JSX)));
  assert(/'General Usage Metric: recognition \(lowest first\)'/.test(s) && /'General Usage Metric: recognition \(highest first\)'/.test(s), 'the two GUM₂ sorts');
  assert(/<strong>General Usage Metric, recognition \(GUM₂\):<\/strong>/.test(s), 'its note');
  assert(/e\.gum2\.toFixed\(2\)/.test(s), 'its decimal value on each row');
});

test('S3: the entry strip says the design\'s "Recognized by N members", with the score, only when the server sent it', () => {
  const s = flat(code(src(ENTRY_JSX)));
  assert(/entry && sharedCoord && typeof entry\.recognizedBy === 'number' &&/.test(s), 'only when GUM₂ was read');
  assert(/Recognized by <strong>\{entry\.recognizedBy\} \{entry\.recognizedBy === 1 \? 'member' : 'members'\}<\/strong> of \{whose\} trusted, extended community/.test(s), 'the design\'s words');
  assert(/\(GUM₂ \{typeof entry\.gum2 === 'number' \? entry\.gum2\.toFixed\(2\) : '0\.00'\}\)/.test(s), 'and the score');
});

test('S4: the public read\'s roster is the owner and customers, never the admin list', () => {
  const s = flat(code(src(ADOPTION_JS)));
  assert(/listInstanceAssistants\(\{ includeAdmins: false \}\)/.test(s) && !/includeAdmins: true/.test(s), 'ADR author-scoped-inspection/0001');
});

test('S5: a list read without GUM₂ offers no GUM₂ sort', () => {
  const s = flat(code(src(CONCEPTS_JSX)));
  assert(/const hasGum2 = entries\.some\(\(e\) => typeof e\.gum2 === 'number'\);/.test(s) && /\.filter\(\(\[key\]\) => hasGum2 \|\| !isGum2Sort\(key\)\)/.test(s), 'hidden when unread');
});

// ═══ runner ══════════════════════════════════════════════════════════════════

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  ✓ ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      failures.push({ name: t.name, message: err.message });
      fail++;
    }
  }
  console.log(`\ndictionary-gum2: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };
