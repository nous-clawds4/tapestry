/**
 * dlist-curation #6: Map Entries — classify, label, verify, and link per-DList curation entries.
 *
 * Story: engineering-team/stories/dlist-curation/6-map-entries-dlist-class.md
 * ADR:   engineering-team/decisions/dlist-curation/0006-map-entries-dlist-class.md
 *
 * Three classes (house pattern; ESM behavioral import per test/dlist-curation-panel.test.js):
 *   U (behavioral) — classifyEntry's two new classes with the story-2 expectations restated
 *                    inline (they must keep holding), markDuplicateEntries, communityPointerOf,
 *                    describeHeaderLookup. FAIL now: the classes and the exports do not exist.
 *   S (structure)  — the panel's labels, the batched two-step lookup, the details line and link,
 *                    the inline short pubkey on curated rows, the route's four prefixes. FAIL now.
 *   R (sentinel)   — TA/TL labels, the two neighbouring panels, the page order, the util's exports.
 *                    PASS before and after.
 *
 * Not covered here: the rendered details line in a browser (the reviewer's Playwright-with-mocks
 * method covers it), the real strfry scan and relay fetch (their own lanes).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const UI = path.resolve(__dirname, '../ui/src');
const PANEL = path.join(UI, 'pages/grapevine/TreasureMapTagsPanel.jsx');
const CARD = path.join(UI, 'pages/grapevine/TlOptInCard.jsx');
const CURATION = path.join(UI, 'pages/grapevine/DListCurationPanel.jsx');
const PAGE = path.join(UI, 'pages/grapevine/TrustedAssertions.jsx');
const DETAIL = path.join(UI, 'pages/lists/DListDetail.jsx');
const UTIL = path.join(UI, 'utils/treasureMap.js');

const PK = 'a'.repeat(64);
const PK_B = '0123456789abcdef'.repeat(4);
const PK_UP = PK_B.toUpperCase();
const RELAY = 'wss://dcosl.brainstorm.world';
const COMMUNITY = `39998:${PK_B}:dogs`;

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
async function util() {
  const mod = await loadEsm(UTIL);
  assert(mod && typeof mod.classifyEntry === 'function', 'ui/src/utils/treasureMap.js must export classifyEntry');
  return mod;
}
async function helpers() {
  const mod = await util();
  for (const name of ['markDuplicateEntries', 'communityPointerOf', 'describeHeaderLookup']) {
    assert(typeof mod[name] === 'function', `ui/src/utils/treasureMap.js must export ${name} (ADR 0006 §Implementation 1)`);
  }
  return mod;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── U: the classifier ──────────────────────────────────────── */

test('U1: classifyEntry — a named 39998/39999 entry with a valid delegate is a Curated DList', async () => {
  const { classifyEntry } = await util();
  const a = classifyEntry(['39998:dogs', PK, RELAY]);
  assert(a.cls === 'dlist' && a.kind === 39998 && a.name === 'dogs' && a.pubkey === PK && a.relay === RELAY, `AC-1: 39998:dogs → dlist; got ${JSON.stringify(a)}`);
  const b = classifyEntry(['39999:cats', PK_UP, '']);
  assert(b.cls === 'dlist' && b.kind === 39999 && b.name === 'cats' && b.pubkey === PK_B && b.relay === null, `AC-1: 39999:cats → dlist, pubkey lowercased, empty relay → null; got ${JSON.stringify(b)}`);
  const c = classifyEntry(['39998:a:b', PK]);
  assert(c.cls === 'dlist' && c.name === 'a:b', 'AC-1 / ADR 0002 §1: the d-tag keeps its colons (split at the first colon only)');
});

test('U2: classifyEntry — 39998:dlist-header is the TA designation, never a Curated DList', async () => {
  const { classifyEntry } = await util();
  const d = classifyEntry(['39998:dlist-header', PK, RELAY]);
  assert(d.cls === 'designation' && d.name === 'dlist-header' && d.pubkey === PK, `AC-1: the blanket designation entry → designation; got ${JSON.stringify(d)}`);
  assert(classifyEntry(['39999:dlist-header', PK, '']).cls === 'dlist', 'ADR 0006 §Impl 1: the reserved word is reserved for kind 39998 only');
});

test('U3: classifyEntry — bare kinds, delegate-less rows, and every other kind classify exactly as before (story-2 pins)', async () => {
  const { classifyEntry } = await util();
  assert(classifyEntry(['39998', PK, '']).cls === 'other' && classifyEntry(['39999', PK, '']).cls === 'other', 'AC-1: a bare 39998/39999 (no d-tag) stays other (story-2 U3)');
  const noDelegate = classifyEntry(['39998:dogs', 'not-a-pubkey', RELAY]);
  assert(noDelegate.cls === 'other' && noDelegate.pubkey === null, 'AC-1: no valid delegate → other with pubkey null (story-2 U6 demotion rule)');
  assert(classifyEntry(['39998:dlist-header', 'nope', RELAY]).cls === 'other', 'AC-1: a delegate-less designation row is no designation');
  const ta = classifyEntry(['30382:rank', PK, 'wss://r']);
  assert(ta.cls === 'ta' && ta.name === 'rank', 'story-2 U1: NIP-85 kind:metric → ta');
  const tl = classifyEntry(['30392', PK, '']);
  assert(tl.cls === 'tl' && tl.name === null, 'story-2 U2: generic bare-kind TL → tl');
  assert(classifyEntry(['30392:mylist', PK, '']).cls === 'tl', 'story-2 U3: named TL → tl');
  assert(classifyEntry(['30389', PK, '']).cls === 'ta' && classifyEntry(['30390', PK, '']).cls === 'tl' && classifyEntry(['30399', PK, '']).cls === 'tl', 'story-2 U3: range edges');
  assert(classifyEntry(['d', 'x']).cls === 'other' && classifyEntry(['39998:x', PK_UP, RELAY]).pubkey === PK_B, 'story-2 U6/U8: non-delegation → other; uppercase hex normalized');
  for (const junk of [null, undefined, 42, 'str', [], [42], [null, PK]]) {
    let r; try { r = classifyEntry(junk); } catch (e) { throw new Error(`story-2 U7: never throws — ${JSON.stringify(junk)}: ${e.message}`); }
    assert(r.cls === 'other', `story-2 U7: ${JSON.stringify(junk)} → other`);
  }
});

/* ── U: the three new helpers ───────────────────────────────── */

test('U4: markDuplicateEntries — first occurrence of a Curated DList entry is effective; later same-raw ones are duplicates; other classes untouched', async () => {
  const { classifyEntry, markDuplicateEntries } = await helpers();
  const rows = [
    ['39998:dogs', PK, RELAY], ['30392', PK, 'wss://tl'], ['39998:dogs', PK_B, ''], ['39999:dogs', PK, ''], ['30392', PK_B, ''], ['39998:dogs', PK, RELAY],
  ].map(classifyEntry);
  const out = markDuplicateEntries(rows);
  assert(out.length === rows.length && deepEq(out.map((r) => r.raw), rows.map((r) => r.raw)), 'AC-4: same rows, same order');
  assert(deepEq(out.map((r) => r.duplicate), [false, false, true, false, false, true]), `AC-4 / ADR 0002 §5: first occurrence wins across dlist rows; 39999:dogs is a different entry; TL duplicates are not this story's; got ${JSON.stringify(out.map((r) => r.duplicate))}`);
  assert(out[0].cls === 'dlist' && out[0].pubkey === PK, 'AC-4: fields preserved');
  assert(deepEq(markDuplicateEntries([]), []) && deepEq(markDuplicateEntries(undefined), []), 'E: empty / non-array → []');
});

test('U5: communityPointerOf — the first a-tag-form b wins; type defaults to pointer; sentinel-only, event-id-only, malformed, or none → null', async () => {
  const { communityPointerOf } = await helpers();
  const ev = (tags) => ({ kind: 39998, pubkey: PK, tags });
  assert(deepEq(communityPointerOf(ev([['d', 'dogs'], ['b', COMMUNITY, 'inherit-items']])), { coord: COMMUNITY, type: 'inherit-items' }), 'AC-3: the inherit-items pointer');
  assert(deepEq(communityPointerOf(ev([['b', COMMUNITY]])), { coord: COMMUNITY, type: 'pointer' }), 'AC-3 / Inherit-From: absent type reads as pointer');
  assert(deepEq(communityPointerOf(ev([['b', 'b-tag-deferred'], ['b', COMMUNITY, 'pointer']])), { coord: COMMUNITY, type: 'pointer' }), 'ADR sub-decision 3: the sentinel is skipped, the a-tag b found');
  assert(communityPointerOf(ev([['b', 'b-tag-deferred']])) === null, 'ADR sub-decision 3: sentinel-only → null');
  assert(communityPointerOf(ev([['b', 'f'.repeat(64), 'pointer']])) === null, 'ADR sub-decision 3: an event-id b is not a community pointer');
  assert(communityPointerOf(ev([['b', 'garbage'], ['d', 'x']])) === null && communityPointerOf(ev([])) === null && communityPointerOf(null) === null, 'E: malformed / none / null → null, never throws');
});

test('U6: describeHeaderLookup — found locally, found on the relay, missing with the two warning texts', async () => {
  const { describeHeaderLookup } = await helpers();
  const header = { kind: 39998, pubkey: PK, tags: [['d', 'dogs']] };
  assert(deepEq(describeHeaderLookup({ relay: RELAY }, header, null), { status: 'found', where: 'local' }), 'AC-3: found locally');
  assert(deepEq(describeHeaderLookup({ relay: RELAY }, header, RELAY), { status: 'found', where: 'relay' }), 'AC-3: found on the hinted relay');
  const m1 = describeHeaderLookup({ relay: RELAY }, null, RELAY);
  assert(m1.status === 'missing' && m1.text === `Header not found locally or on ${RELAY}`, `AC-3: the warning names where it looked; got ${JSON.stringify(m1)}`);
  const m2 = describeHeaderLookup({ relay: null }, null, null);
  assert(m2.status === 'missing' && m2.text === 'Header not found locally; no relay hint', `AC-3: no hint → says so; got ${JSON.stringify(m2)}`);
});

/* ── S: the panel and the route ─────────────────────────────── */

test('S1: the panel labels the two classes, uses the three helpers, and keeps the per-user baseline', () => {
  const src = safeRead(PANEL);
  assert(/dlist:\s*['"]Curated DList['"]/.test(src) && /designation:\s*['"]TA designation['"]/.test(src), 'AC-2: CLS_LABEL gains "Curated DList" and "TA designation"');
  for (const name of ['markDuplicateEntries', 'communityPointerOf', 'describeHeaderLookup']) {
    assert(new RegExp(`${name}\\s*\\(`).test(src), `ADR §Impl 2: the panel calls ${name}`);
  }
  assert(/useAuth\s*\(/.test(src) && /assistantPubkey/.test(src) && !/taPubkey/.test(src), 'AC-5: badges judged against useAuth().user.assistantPubkey; no owner TA');
  assert(!/[0-9a-fA-F]{64}/.test(src), 'CLAUDE.md § per-deployment TA pubkey: no 64-hex literal');
});

test('S2: the batched two-step lookup — local strfry first, the row\'s relay hint only when missing', () => {
  const src = safeRead(PANEL);
  assert(/queryRelay\s*\(/.test(src) && /from\s+'\.\.\/\.\.\/api\/relay'/.test(src), 'AC-3 / ADR sub-decision 2: local lookup via queryRelay');
  assert(/\/api\/relay\/external\?/.test(src) && /relays=/.test(src), 'AC-3 / ADR sub-decision 2: the hinted relay via /api/relay/external');
  assert(/useEffect\s*\(/.test(src), 'ADR Option A: one effect runs the lookup for the effective rows');
});

test('S3: the details line — name linked by coordinate, the community pointer, the warning, the duplicate pill, the inline short pubkey', () => {
  const src = safeRead(PANEL);
  assert(/\/tapestry\/lists\//.test(src) && /encodeURIComponent/.test(src), 'AC-3: link to the DList page by encoded coordinate');
  assert(/inherits from/i.test(src), 'AC-3: the community pointer is labeled');
  assert(src.includes('duplicate — ignored'), 'AC-4: later duplicates carry the pill');
  assert(/row\.duplicate/.test(src), 'AC-4: effective rows are the ones looked up');
  assert(/external · /.test(src), 'AC-2 / review #5 NB-3: the external badge on curated rows carries the short pubkey inline ("external · <8>…<4>")');
});

test('S4: the DList detail route resolves kind-39999 (and 9999) coordinates while keeping its 39998/9998 and event-id branches', () => {
  const src = safeRead(DETAIL);
  assert(/39999:/.test(src) && /9999:/.test(src), 'ADR sub-decision 1: the a-tag condition accepts 39999: and 9999:');
  assert(/39998:/.test(src) && /9998:/.test(src), 'AC-6: 39998: and 9998: still accepted');
  assert(/ids:\s*\[\s*decodedId\s*\]/.test(src), 'AC-6: the event-id branch remains');
  assert(/parts\.slice\(2\)\.join\(':'\)/.test(src), 'AC-6: colons inside the d-tag still rejoined');
});

/* ── R: sentinels (pass before and after) ───────────────────── */

test('R1: Trusted Assertion / Trusted List / other labels are unchanged', () => {
  const src = safeRead(PANEL);
  assert(/ta:\s*['"]Trusted Assertion['"]/.test(src) && /tl:\s*['"]Trusted List['"]/.test(src) && /other:\s*['"]other['"]/.test(src), 'AC-6: existing labels intact');
  assert(/\/api\/profiles\?pubkeys=/.test(src), 'AC-6: the profile fetch for delegates intact');
});

test('R2: the two neighbouring panels are untouched', () => {
  assert(safeRead(CARD).includes('Would you like the local Tapestry instance to publish your Trusted Lists for pubkeys on your behalf?'), 'AC-6: TlOptInCard intact');
  assert(safeRead(CURATION).includes('Empower your Tapestry Assistant to curate a community DList on your behalf.'), 'AC-6: DListCurationPanel intact');
});

test('R3: the page order is intact', () => {
  const page = safeRead(PAGE); const at = (n) => page.indexOf(n);
  assert(at('<TreasureMapTagsPanel') < at('Show raw event') && at('Show raw event') < at('<TlOptInCard') && at('<TlOptInCard') < at('<DListCurationPanel') && at('<DListCurationPanel') < at('<TreasureMapManualEdit'), 'AC-6: entries → raw → Trusted Lists → DList Curation → hand edit');
});

test('R4: the util\'s existing exports are unchanged', async () => {
  const mod = await util();
  for (const name of ['findGenericTlDelegation', 'upsertGenericTlTag', 'composeManualUpdate', 'describeTlDelegation', 'findDListEntries', 'upsertDListEntry', 'removeDListEntry', 'describeDListCuration', 'buildPresenceTargets', 'compareMapVersions', 'summarizePresence', 'planRelaySync']) {
    assert(typeof mod[name] === 'function', `R: ${name} still exported`);
  }
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
