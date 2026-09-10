/**
 * dlist-curation #7: regenerating a Treasure Map preserves every entry the generator does not own.
 *
 * Story: engineering-team/stories/dlist-curation/7-treasure-map-merge-preserve.md (Bug lane —
 *        Architecture skipped; the story's Design note is the design)
 *
 * Stack-free. Three classes:
 *   U (behavioral) — src/lib/treasureMapMerge.js (zero-require: the eleven-row builder, the merge,
 *                    the template) required directly; src/api/export/nip85/currentMap.js
 *                    fetchCurrentMap driven with injected seams. FAIL now: neither module exists.
 *   S (structure)  — both generators route through the shared modules and no longer carry the
 *                    eleven-row literal; the API reports the merge; the CLI refuses on a lookup
 *                    error. FAIL now.
 *   R (sentinel)   — the publish half untouched; story 4's exported seams; the three routes; the
 *                    eleven metric names unchanged wherever they are defined. PASS before and after.
 *
 * Not covered here: the legacy pages' browser flows (unchanged, and they need NIP-07), a live
 * regeneration against strfry/relays (the seams' own lanes).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIB = path.join(ROOT, 'src/lib/treasureMapMerge.js');
const CURRENT = path.join(ROOT, 'src/api/export/nip85/currentMap.js');
const API_GEN = path.join(ROOT, 'src/api/export/nip85/commands/create-unsigned-kind10040.js');
const CLI_GEN = path.join(ROOT, 'bin/brainstorm-create-kind10040.js');
const API_PUBLISH = path.join(ROOT, 'src/api/export/nip85/commands/publish-signed-kind10040.js');
const CLI_PUBLISH = path.join(ROOT, 'bin/brainstorm-create-and-publish-kind10040.js');
const ENDPOINT_MODULE = path.join(ROOT, 'src/api/dlist-curation/index.js');
const API_INDEX = path.join(ROOT, 'src/api/index.js');

const PK_USER = 'b'.repeat(64);
const PK_PROVIDER = 'c'.repeat(64);
const PK_OTHER = '0123456789abcdef'.repeat(4);
const RELAY = 'wss://nip85.brainstorm.world';
const DLIST_RELAY = 'wss://dcosl.brainstorm.world';
const NOW = 1800000000;

// AC-2: today's eleven Trust-Assertion rows, in today's order (read from both generators this session).
const METRICS = ['rank', 'followers', 'personalizedGrapeRank_influence', 'personalizedGrapeRank_average', 'personalizedGrapeRank_confidence', 'personalizedGrapeRank_input', 'personalizedPageRank', 'verifiedFollowerCount', 'verifiedMuterCount', 'verifiedReporterCount', 'hops'];
const FRESH = METRICS.map((m) => [`30382:${m}`, PK_PROVIDER, RELAY]);

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function lib() {
  let mod; try { mod = require(LIB); } catch (e) { throw new Error(`src/lib/treasureMapMerge.js must load: ${e.message}`); }
  for (const name of ['trustAssertionRows', 'mergeTreasureMapTags', 'restampTreasureMap', 'buildTreasureMapTemplate']) {
    assert(typeof mod[name] === 'function', `src/lib/treasureMapMerge.js must export ${name} (Design note)`);
  }
  assert(Array.isArray(mod.TRUST_ASSERTION_METRICS), 'src/lib/treasureMapMerge.js must export TRUST_ASSERTION_METRICS');
  return mod;
}
function currentMap() {
  let mod; try { mod = require(CURRENT); } catch (e) { throw new Error(`src/api/export/nip85/currentMap.js must load: ${e.message}`); }
  assert(typeof mod.fetchCurrentMap === 'function', 'currentMap.js must export fetchCurrentMap(pubkey, deps)');
  return mod;
}
const oldMap = (tags, over = {}) => ({ id: 'e'.repeat(64), kind: 10040, pubkey: PK_USER, created_at: 1700000000, content: '', sig: 'f'.repeat(128), tags, ...over });

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── U: the shared merge library ───────────────────────────── */

test('U1: the library loads with no requires, and builds exactly today\'s eleven rows', () => {
  const mod = lib();
  assert(!/require\s*\(/.test(safeRead(LIB)), 'Design note: src/lib/treasureMapMerge.js is zero-require (pure)');
  assert(deepEq(mod.TRUST_ASSERTION_METRICS, METRICS), `AC-2: the metric list is today's eleven, in order; got ${JSON.stringify(mod.TRUST_ASSERTION_METRICS)}`);
  assert(deepEq(mod.trustAssertionRows(PK_PROVIDER, RELAY), FRESH), 'AC-2: trustAssertionRows(providerPubkey, relay) → ["30382:<metric>", provider, relay] × 11');
});

test('U2: merge with no current Map → the fresh rows only (AC-3)', () => {
  const { mergeTreasureMapTags } = lib();
  for (const none of [null, undefined, { tags: [] }, { tags: 'junk' }]) {
    const r = mergeTreasureMapTags(none, FRESH);
    assert(deepEq(r.tags, FRESH) && r.preserved === 0 && r.regenerated === 11, `AC-3: ${JSON.stringify(none)} → fresh rows only, preserved 0, regenerated 11`);
  }
});

test('U3: merge preserves every non-30382 tag verbatim and in order, drops the old 30382 rows, places the fresh block where the old block began', () => {
  const { mergeTreasureMapTags } = lib();
  const kept1 = ['30392', PK_PROVIDER, RELAY];
  const kept2 = ['39998:dogs', PK_PROVIDER, DLIST_RELAY];
  const kept3 = ['39998:dlist-header', PK_PROVIDER, DLIST_RELAY];
  const kept4 = ['t', 'unknown-tag'];
  const kept5 = ['39999:cats', PK_OTHER, ''];
  const existing = oldMap([['30382:rank', PK_OTHER, 'wss://old'], kept1, kept2, ['30382:followers', PK_OTHER, 'wss://old'], kept3, kept4, kept5]);
  const r = mergeTreasureMapTags(existing, FRESH);
  assert(deepEq(r.tags, [...FRESH, kept1, kept2, kept3, kept4, kept5]), `AC-1/AC-2: fresh block at the old block's position (index 0), then the kept tags in order; got ${JSON.stringify(r.tags)}`);
  assert(r.preserved === 5 && r.regenerated === 11, `AC-7: preserved 5, regenerated 11; got ${r.preserved}/${r.regenerated}`);
  assert(!r.tags.some((t) => t[1] === PK_OTHER && String(t[0]).startsWith('30382:')), 'AC-1: no old 30382 row survives');
});

test('U4: the fresh block lands where the first old 30382 row stood, even when preserved tags precede it', () => {
  const { mergeTreasureMapTags } = lib();
  const existing = oldMap([['30392', PK_PROVIDER, RELAY], ['39998:dogs', PK_PROVIDER, DLIST_RELAY], ['30382:rank', PK_OTHER, 'x'], ['30382:hops', PK_OTHER, 'x'], ['d', 'x']]);
  const r = mergeTreasureMapTags(existing, FRESH);
  assert(deepEq(r.tags, [['30392', PK_PROVIDER, RELAY], ['39998:dogs', PK_PROVIDER, DLIST_RELAY], ...FRESH, ['d', 'x']]), `AC-2: block at index 2; got ${JSON.stringify(r.tags.map((t) => t[0]))}`);
});

test('U5: a current Map with no 30382 rows → the fresh block first, then everything preserved', () => {
  const { mergeTreasureMapTags } = lib();
  const existing = oldMap([['30392', PK_PROVIDER, RELAY], ['39998:dogs', PK_PROVIDER, DLIST_RELAY]]);
  const r = mergeTreasureMapTags(existing, FRESH);
  assert(deepEq(r.tags, [...FRESH, ['30392', PK_PROVIDER, RELAY], ['39998:dogs', PK_PROVIDER, DLIST_RELAY]]), 'AC-2: fresh block first when the old Map had no 30382 rows');
});

test('U6: preserved tags are copies (the current Map is never mutated), and malformed tags are kept as found', () => {
  const { mergeTreasureMapTags } = lib();
  const tagA = ['30392', PK_PROVIDER, RELAY];
  const existing = oldMap([['30382:rank', PK_OTHER, 'x'], tagA, 'stray-string', ['39998:dogs', PK_PROVIDER, DLIST_RELAY]]);
  const before = JSON.stringify(existing);
  const r = mergeTreasureMapTags(existing, FRESH);
  assert(JSON.stringify(existing) === before, 'AC-1: input not mutated');
  assert(r.tags[11] !== tagA && deepEq(r.tags[11], tagA), 'AC-1: a preserved tag is an equal copy, not the same array');
  assert(r.tags[12] === 'stray-string', 'Out of scope: no validation — a malformed tag is kept as found');
});

test('U7: restamp + template — created_at strictly past the old Map even under skew, content preserved, unsigned', () => {
  const { restampTreasureMap, buildTreasureMapTemplate } = lib();
  assert(restampTreasureMap(oldMap([], { created_at: NOW + 500 }), NOW) === NOW + 501, 'AC-4: max(now, old + 1) under clock skew');
  assert(restampTreasureMap(oldMap([], { created_at: 1 }), NOW) === NOW, 'AC-4: now when the old Map is older');
  assert(restampTreasureMap(null, NOW) === NOW, 'AC-4: no Map → now');
  const existing = oldMap([['30392', PK_PROVIDER, RELAY]], { content: 'kept', created_at: NOW + 5 });
  const t = buildTreasureMapTemplate({ pubkey: PK_USER, existingEvent: existing, freshRows: FRESH, now: NOW });
  assert(t.template.kind === 10040 && t.template.pubkey === PK_USER && t.template.content === 'kept' && t.template.created_at === NOW + 6, `AC-4: template kind/pubkey/content/created_at; got ${JSON.stringify({ ...t.template, tags: undefined })}`);
  assert(deepEq(t.template.tags, [...FRESH, ['30392', PK_PROVIDER, RELAY]]) && t.preserved === 1 && t.regenerated === 11, 'AC-1/AC-7: merged tags and counts');
  assert(!('id' in t.template) && !('sig' in t.template), 'AC-4: unsigned — no id/sig');
  const fresh = buildTreasureMapTemplate({ pubkey: PK_USER, existingEvent: null, freshRows: FRESH, now: NOW });
  assert(fresh.template.content === '' && fresh.template.created_at === NOW && deepEq(fresh.template.tags, FRESH), 'AC-3: no Map → today\'s template');
});

/* ── U: fetching the current Map ───────────────────────────── */

function deps(over = {}) {
  const calls = { scanLocal: [], fetchFromRelays: [] };
  const d = {
    scanLocal: async (filter) => { calls.scanLocal.push(filter); return []; },
    fetchFromRelays: async (filter, urls) => { calls.fetchFromRelays.push({ filter, urls }); return []; },
    relays: [RELAY, 'wss://relay.damus.io'],
    ...over,
  };
  return { d, calls };
}

test('U8: fetchCurrentMap — local first (relays not asked), then relays only when absent locally, newest wins, none is not an error', async () => {
  const { fetchCurrentMap } = currentMap();
  const local = oldMap([['30392', PK_PROVIDER, RELAY]]);
  const a = deps({ scanLocal: async (f) => { a_calls.push(f); return [local]; } });
  const a_calls = [];
  const ra = await fetchCurrentMap(PK_USER, a.d);
  assert(ra.event === local && ra.where === 'local', `AC-5: local hit → where local; got ${JSON.stringify(ra.where)}`);
  assert(a.calls.fetchFromRelays.length === 0, 'AC-5: relays not asked when local has the Map');
  assert(a_calls.some((f) => deepEq(f.kinds, [10040]) && deepEq(f.authors, [PK_USER])), 'AC-5: the local filter is kinds [10040], authors [pubkey]');

  const older = oldMap([], { id: '1'.repeat(64), created_at: 1700000000 });
  const newer = oldMap([['30392', PK_PROVIDER, RELAY]], { id: '2'.repeat(64), created_at: 1700009999 });
  const b = deps({ fetchFromRelays: async (f, urls) => { b.calls.fetchFromRelays.push({ filter: f, urls }); return [older, newer]; } });
  const rb = await fetchCurrentMap(PK_USER, b.d);
  assert(rb.event === newer && rb.where === 'relay', 'AC-5: local miss → relays; the newest copy wins');
  assert(b.calls.fetchFromRelays.length === 1 && deepEq(b.calls.fetchFromRelays[0].urls, [RELAY, 'wss://relay.damus.io']) && deepEq(b.calls.fetchFromRelays[0].filter.authors, [PK_USER]), 'AC-5: one relay fetch over the configured relays with the same filter');

  const c = deps();
  const rc = await fetchCurrentMap(PK_USER, c.d);
  assert(rc.event === null && rc.where === 'none', 'AC-3/AC-5: nothing anywhere → { event: null, where: "none" } — not an error');
});

test('U9: fetchCurrentMap — a lookup ERROR rejects with a plain message (never regenerate blind)', async () => {
  const { fetchCurrentMap } = currentMap();
  for (const [name, over] of [
    ['scanLocal', { scanLocal: async () => { throw new Error('strfry scan timed out'); } }],
    ['fetchFromRelays', { fetchFromRelays: async () => { throw new Error('relay fetch failed'); } }],
  ]) {
    let err = null;
    try { await fetchCurrentMap(PK_USER, deps(over).d); } catch (e) { err = e; }
    assert(err && /current Treasure Map/i.test(err.message) && /(timed out|failed)/.test(err.message), `AC-5: a ${name} error rejects with a message naming the lookup and the cause; got ${err && err.message}`);
  }
});

/* ── S: the two generators route through the shared modules ── */

test('S1: the API generator fetches the current Map, builds through the shared template, reports the merge, and refuses on a lookup error', () => {
  const src = safeRead(API_GEN);
  assert(/require\(['"][^'"]*treasureMapMerge['"]\)/.test(src) && /require\(['"][^'"]*currentMap['"]\)/.test(src), 'AC-6: the API generator requires the shared lib and the current-Map fetch');
  assert(/fetchCurrentMap\s*\(/.test(src) && /buildTreasureMapTemplate\s*\(/.test(src) && /trustAssertionRows\s*\(/.test(src), 'AC-6: … and calls them');
  assert(!/["']30382:rank["']/.test(src), 'AC-6/Design note: the eleven-row literal no longer lives in the generator');
  assert(/preserved/.test(src) && /regenerated/.test(src) && /currentMap/.test(src), 'AC-7: the response reports preserved / regenerated / where the current Map was found');
  assert(/status\(503\)/.test(src), 'AC-5: a lookup error answers 503, never a blind regeneration');
});

test('S2: the CLI generator does the same and exits non-zero on a lookup error', () => {
  const src = safeRead(CLI_GEN);
  assert(/require\(['"][^'"]*treasureMapMerge['"]\)/.test(src) && /require\(['"][^'"]*currentMap['"]\)/.test(src), 'AC-6: the CLI requires the shared lib and the current-Map fetch');
  assert(/fetchCurrentMap\s*\(/.test(src) && /buildTreasureMapTemplate\s*\(/.test(src) && /trustAssertionRows\s*\(/.test(src), 'AC-6: … and calls them');
  assert(!/["']30382:rank["']/.test(src), 'AC-6: the eleven-row literal no longer lives in the CLI');
  assert(/preserved/.test(src) && /regenerated/.test(src), 'AC-7: the CLI prints the counts');
  assert(/process\.exit\(1\)/.test(src) && /catch/.test(src), 'AC-5: a lookup error exits non-zero');
});

test('S3: the current-Map fetch defaults to story 4\'s exported seams and the export flow\'s relays', () => {
  const src = safeRead(CURRENT);
  assert(/require\(['"]\.\.\/\.\.\/dlist-curation['"]\)/.test(src), 'Design note: default seams = src/api/dlist-curation scanLocal / fetchFromRelays');
  assert(/scanLocal/.test(src) && /fetchFromRelays/.test(src), 'Design note: both seams used');
  assert(/BRAINSTORM_NIP85_HOME_RELAY|nip85HomeRelay/.test(src) && /aRelays/.test(src), 'AC-5: the NIP-85 home relay plus the configured relay groups');
});

/* ── R: sentinels (pass before and after) ──────────────────── */

test('R1: the publish half is untouched — it forwards an already-signed event and never merges', () => {
  for (const [name, p] of [['publish-signed-kind10040.js', API_PUBLISH], ['brainstorm-create-and-publish-kind10040.js', CLI_PUBLISH]]) {
    const src = safeRead(p);
    assert(src.length > 0 && !/mergeTreasureMapTags|buildTreasureMapTemplate|fetchCurrentMap/.test(src), `AC-8: ${name} does not merge (too late — the event is already signed)`);
  }
  assert(/verifyEvent|signature/i.test(safeRead(CLI_PUBLISH)), 'AC-8: the CLI publisher still verifies the signature');
});

test('R2: story 4\'s module still exports the two seams', () => {
  const mod = require(ENDPOINT_MODULE);
  assert(typeof mod.scanLocal === 'function' && typeof mod.fetchFromRelays === 'function', 'R: scanLocal + fetchFromRelays exported from src/api/dlist-curation');
});

test('R3: the three NIP-85 routes are still registered', () => {
  const src = safeRead(API_INDEX);
  for (const route of ['/api/create-unsigned-kind10040', '/api/publish-signed-kind10040', '/api/create-kind10040']) {
    assert(src.includes(`'${route}'`), `AC-8: ${route} registered`);
  }
});

test('R4: the eleven metric names are unchanged wherever they are defined (generator before, library after)', () => {
  const libSrc = safeRead(LIB);
  const src = libSrc.length > 0 ? libSrc : safeRead(CLI_GEN);
  const found = METRICS.filter((m) => src.includes(m));
  assert(found.length === METRICS.length, `AC-2/AC-8: all eleven metric names present in ${libSrc.length > 0 ? 'the library' : 'the CLI generator'}; missing ${JSON.stringify(METRICS.filter((m) => !found.includes(m)))}`);
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail, skipped: 0 };
}

module.exports = { run };
