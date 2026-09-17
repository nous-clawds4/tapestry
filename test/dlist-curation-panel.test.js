/**
 * dlist-curation #5: the DList Curation panel.
 *
 * Story: engineering-team/stories/dlist-curation/5-dlist-curation-panel.md
 * ADR:   engineering-team/decisions/dlist-curation/0005-dlist-curation-panel.md
 *
 * Three classes (house pattern; ESM behavioral import per test/dlist-curation-tl-panel.test.js):
 *   U (behavioral) — findDListEntries / upsertDListEntry / removeDListEntry / describeDListCuration
 *                    imported from ui/src/utils/treasureMap.js and exercised directly. FAIL now:
 *                    the exports do not exist.
 *   S (structure)  — the panel exists, folds by the settled idiom, fetches the community list only
 *                    when opened, calls the story-4 endpoint, composes the Map through the helpers,
 *                    signs and publishes through the page's chain, and is mounted in order. FAIL now.
 *   R (sentinel)   — story 1's card and page order, the community-shares hook, the publish gate
 *                    hook, the util's existing exports. PASS before and after.
 *
 * Not covered here: the live search / add / sign / revoke flow in a browser (needs a NIP-07 signer
 * and a real session; the reviewer's Playwright-with-mocks method is the option), and the endpoint
 * itself (story 4's suite).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const UI = path.resolve(__dirname, '../ui/src');
const PANEL = path.join(UI, 'pages/grapevine/DListCurationPanel.jsx');
const CARD = path.join(UI, 'pages/grapevine/TlOptInCard.jsx');
const PAGE = path.join(UI, 'pages/grapevine/TrustedAssertions.jsx');
const HOOK = path.join(UI, 'hooks/useCommunitySharedConcepts.js');
const UTIL = path.join(UI, 'utils/treasureMap.js');
const NOSTR_PUBLISH = path.join(UI, 'utils/nostrPublish.js');
const PUBLISH_PROFILE_TAG = path.join(UI, 'utils/publishProfileTag.js');

const PK_A = 'a'.repeat(64);       // my assistant
const PK_B = '0123456789abcdef'.repeat(4); // another assistant
const PK_UP = PK_B.toUpperCase();
const RELAY = 'wss://dcosl.brainstorm.world';
const COPY = 'Empower your Tapestry Assistant to curate a community DList on your behalf. Your assistant authors its own header for the list — inheriting the community\'s items, never duplicating them — and your Treasure Map records that you empowered it.';

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function baseEvent(tags, created_at = 1700000000, content = '') { return { kind: 10040, created_at, content, tags }; }
async function helpers() {
  const mod = await loadEsm(UTIL);
  for (const name of ['findDListEntries', 'upsertDListEntry', 'removeDListEntry', 'describeDListCuration']) {
    assert(mod && typeof mod[name] === 'function', `ui/src/utils/treasureMap.js must export ${name} (ADR 0005 §Implementation 1)`);
  }
  return mod;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── U: the helpers ─────────────────────────────────────────── */

test('U1: the four helpers are exported from the treasure-map util', async () => { await helpers(); });

test('U2: findDListEntries — both kinds, reserved word excluded, invalid delegates excluded, order and colons preserved, never throws', async () => {
  const { findDListEntries } = await helpers();
  const tags = [
    ['30382:rank', PK_B, 'wss://r'],
    ['39998:dogs', PK_A, RELAY],
    ['30392', PK_A, 'wss://tl'],
    ['39998:dlist-header', PK_A, RELAY],   // the blanket designation — reserved, not a per-DList entry
    ['39999:cats', PK_UP, ''],              // 39999-declared header; uppercase hex normalizes
    ['39998:bad', 'not-a-pubkey', RELAY],   // no valid delegate → not an entry
    ['39998:a:b', PK_B, RELAY],             // d-tag with a colon
    ['d', 'x'], 'junk', 42, null, ['39998:'],
  ];
  const rows = findDListEntries(tags);
  assert(rows.length === 3, `AC-7: three per-DList entries, got ${rows.length}: ${JSON.stringify(rows)}`);
  assert(deepEq(rows.map((r) => [r.kind, r.d, r.pubkey, r.relay, r.index]), [
    [39998, 'dogs', PK_A, RELAY, 1],
    [39999, 'cats', PK_B, null, 4],
    [39998, 'a:b', PK_B, RELAY, 6],
  ]), `AC-7: kind / d / lowercased pubkey / relay (null when empty) / index, in order; got ${JSON.stringify(rows)}`);
  assert(rows[0].raw === '39998:dogs', 'AC-7: raw first element kept');
  assert(deepEq(findDListEntries(undefined), []) && deepEq(findDListEntries('nope'), []), 'E: non-arrays → []');
});

test('U3: upsertDListEntry — appends when absent; everything else verbatim; content kept; created_at skew-proof', async () => {
  const { upsertDListEntry } = await helpers();
  const orig = [['30382:rank', PK_B, 'wss://r'], ['30392', PK_A, 'wss://tl']];
  const ev = baseEvent(orig.map((t) => [...t]), 1700000000, 'keep me');
  const out = upsertDListEntry(ev, 39998, 'dogs', PK_A, RELAY);
  assert(out.kind === 10040 && out.content === 'keep me', 'AC-6: kind 10040, content preserved');
  assert(deepEq(out.tags.slice(0, 2), orig) && deepEq(out.tags[2], ['39998:dogs', PK_A, RELAY]) && out.tags.length === 3, 'AC-6: appended, others verbatim');
  assert(out.created_at >= Math.floor(Date.now() / 1000), 'AC-6: fresh created_at');
  const future = baseEvent(orig.map((t) => [...t]), Math.floor(Date.now() / 1000) + 9000);
  assert(upsertDListEntry(future, 39998, 'dogs', PK_A, RELAY).created_at === future.created_at + 1, 'E4: max(now, old + 1) under clock skew');
  assert(deepEq(ev.tags, orig), 'AC-6: the input event is not mutated');
});

test('U4: upsertDListEntry — replaces the exact entry in place, drops later duplicates, leaves other kinds and other d-tags alone', async () => {
  const { upsertDListEntry } = await helpers();
  const tags = [['30382:rank', PK_B, 'wss://r'], ['39998:dogs', PK_B, 'wss://old'], ['39999:dogs', PK_B, 'wss://x'], ['39998:dogs-2', PK_B, 'wss://y'], ['39998:dogs', PK_B, 'wss://dup']];
  const out = upsertDListEntry(baseEvent(tags.map((t) => [...t])), 39998, 'dogs', PK_A, RELAY);
  assert(deepEq(out.tags, [tags[0], ['39998:dogs', PK_A, RELAY], tags[2], tags[3]]), `AC-4/AC-6: replaced at index 1, duplicate dropped, 39999:dogs and 39998:dogs-2 untouched; got ${JSON.stringify(out.tags)}`);
});

test('U5: upsertDListEntry — a missing relay hint ships as the empty string (three-element shape preserved)', async () => {
  const { upsertDListEntry } = await helpers();
  const out = upsertDListEntry(baseEvent([]), 39998, 'dogs', PK_A, undefined);
  assert(deepEq(out.tags, [['39998:dogs', PK_A, '']]), 'ADR 0002 §6: empty-string hint, shape preserved');
});

test('U6: removeDListEntry — drops every matching entry, keeps everything else verbatim, skew-proof, no-op safe', async () => {
  const { removeDListEntry } = await helpers();
  const tags = [['30382:rank', PK_B, 'wss://r'], ['39998:dogs', PK_A, RELAY], ['39999:dogs', PK_B, 'wss://x'], ['39998:dogs', PK_B, 'wss://dup'], ['d', 'x']];
  const out = removeDListEntry(baseEvent(tags.map((t) => [...t]), 1700000000, 'c'), 39998, 'dogs');
  assert(deepEq(out.tags, [tags[0], tags[2], tags[4]]) && out.content === 'c' && out.kind === 10040, `AC-8: both 39998:dogs entries gone, the rest verbatim; got ${JSON.stringify(out.tags)}`);
  assert(out.created_at >= Math.floor(Date.now() / 1000), 'AC-8: fresh created_at');
  const none = removeDListEntry(baseEvent(tags.map((t) => [...t])), 39998, 'absent');
  assert(deepEq(none.tags, tags), 'E: removing an absent entry keeps every tag');
  const future = baseEvent([['39998:dogs', PK_A, RELAY]], Math.floor(Date.now() / 1000) + 9000);
  assert(removeDListEntry(future, 39998, 'dogs').created_at === future.created_at + 1, 'E4: skew rule on revoke too');
});

test('U7: describeDListCuration — the collapsed label: None yet / 1 DList curated / N DLists curated', async () => {
  const { describeDListCuration, findDListEntries } = await helpers();
  assert(deepEq(describeDListCuration([]), { count: 0, label: 'None yet' }), 'AC-1: empty → None yet');
  assert(deepEq(describeDListCuration([{}]), { count: 1, label: '1 DList curated' }), 'AC-1: singular');
  assert(deepEq(describeDListCuration([{}, {}, {}]), { count: 3, label: '3 DLists curated' }), 'AC-1: plural');
  assert(describeDListCuration(undefined).count === 0 && describeDListCuration('x').label === 'None yet', 'E: non-arrays read as none');
  const entries = findDListEntries([['39998:dogs', PK_A, RELAY], ['39999:cats', PK_B, '']]);
  assert(describeDListCuration(entries).label === '2 DLists curated', 'ADR sub-decision 2: counts every per-DList entry, mine or another assistant\'s');
});

/* ── S: the panel and its wiring ───────────────────────────── */

function foldState(src) { const m = src.match(/aria-expanded=\{\s*([A-Za-z_$][\w$]*)\s*\}/); return m ? m[1] : null; }

test('S1: the panel exists, takes its baseline from the signed-in user\'s assistant, and imports the four helpers', () => {
  const src = safeRead(PANEL);
  assert(src.length > 0, 'ADR §Implementation 2: ui/src/pages/grapevine/DListCurationPanel.jsx must exist');
  assert(/from\s+'\.\.\/\.\.\/utils\/treasureMap'/.test(src), 'ADR: helpers imported from the shared util');
  for (const name of ['findDListEntries', 'upsertDListEntry', 'removeDListEntry', 'describeDListCuration']) {
    assert(new RegExp(`${name}\\s*\\(`).test(src), `ADR: the panel calls ${name}`);
  }
  assert(/useAuth\s*\(/.test(src) && /assistantPubkey/.test(src) && /!assistantPubkey/.test(src) && /return null/.test(src), 'AC-1: no panel without a provisioned assistant (useAuth().user.assistantPubkey baseline)');
  assert(!/taPubkey/.test(src), 'OPEN.md 188 pin: the owner TA must not appear');
  assert(!/[0-9a-fA-F]{64}/.test(src), 'CLAUDE.md § per-deployment TA pubkey: no 64-hex literal');
});

test('S2: folded by the settled idiom — control, initial false, keyboard, gated body, one <h4> titled DList Curation with the glyphs', () => {
  const src = safeRead(PANEL);
  const id = foldState(src);
  assert(id, 'AC-1: aria-expanded={<state>} on the header control');
  assert(/role=["']button["']/.test(src) && /tabIndex=\{0\}/.test(src), 'AC-1: a real control');
  assert(new RegExp(`const\\s*\\[\\s*${id}\\s*,\\s*[A-Za-z_$][\\w$]*\\s*\\]\\s*=\\s*useState\\(\\s*false\\s*\\)`).test(src), `AC-1: [${id}, …] = useState(false)`);
  assert(new RegExp(`\\{\\s*${id}\\s*&&`).test(src), 'AC-1: body only under the fold');
  assert(/onKeyDown/.test(src) && /['"]Enter['"]/.test(src) && /['"] ['"]/.test(src) && /preventDefault\s*\(/.test(src), 'AC-1: Enter and Space toggle, Space does not scroll');
  const h4 = src.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/g) || [];
  assert(h4.length === 1 && /DList Curation/.test(h4[0]) && /▾/.test(h4[0]) && /▸/.test(h4[0]), `AC-1: exactly one <h4>, "DList Curation", with ▾/▸; found ${h4.length}`);
  assert(/aria-label=/.test(src), 'AC-1: an accessible name carrying the label');
  assert(!/DLists curated|None yet/.test(src), 'ADR sub-decision 2: the label text lives in describeDListCuration, not the panel');
});

test('S3: the community list is fetched only when opened — the hook lives in a body component mounted under the fold', () => {
  const src = safeRead(PANEL);
  assert(/from\s+'\.\.\/\.\.\/hooks\/useCommunitySharedConcepts'/.test(src) && /useCommunitySharedConcepts\s*\(/.test(src), 'AC-3: the same source as the Shared Concepts pages');
  const bodyDecl = src.search(/function\s+DListCurationBody\b/);
  assert(bodyDecl > 0, 'ADR §Implementation 2: a DListCurationBody component');
  assert(src.indexOf('useCommunitySharedConcepts(') > bodyDecl, 'ADR Option A: the hook is called inside the body component, so the relay fetch starts on first open');
  const id = foldState(src);
  const gate = src.search(new RegExp(`\\{\\s*${id}\\s*&&`));
  const mount = src.indexOf('<DListCurationBody');
  assert(gate > 0 && mount > gate, 'ADR Option A: <DListCurationBody …/> is rendered under the fold');
  assert(/useProfiles/.test(src) && /AuthorCell/.test(src), 'AC-3: authors rendered the Shared Concepts way');
  assert(/\.author\s*!==/.test(src) && /assistantPubkey/.test(src), 'AC-3: own- and assistant-authored headers excluded');
});

test('S4: explains itself, and the add / replace / in-your-map / revoke controls exist with the ratified copy', () => {
  const src = safeRead(PANEL);
  assert(src.includes(COPY), 'AC-2: the approved sentence, verbatim');
  for (const needle of ['In your Map', 'Replace', 'Sign & publish', 'Revoke', 'stays on relays']) {
    assert(src.includes(needle), `AC-4/AC-6/AC-8: "${needle}" present`);
  }
  assert(/JSON\.stringify/.test(src) && /[Pp]review/.test(src), 'AC-6: the exact unsigned event is previewable');
});

test('S5: Add calls the story-4 endpoint and handles its outcomes; the Map is composed through the helpers with the DList relay hint', () => {
  const src = safeRead(PANEL);
  assert(/['"]\/api\/dlist-curation\/header['"]/.test(src) && /method:\s*['"]POST['"]/.test(src) && /JSON\.stringify\(\s*\{\s*target/.test(src), 'AC-5: POST /api/dlist-curation/header { target }');
  assert(/409/.test(src) && /existing/.test(src), 'AC-5: the 409 payload (existing.b) is surfaced, not swallowed');
  assert(/aDListRelays/.test(src), 'AC-6 / ADR 0002 §6: relay hint from aRelays.aDListRelays');
  assert(/upsertDListEntry\s*\(\s*event\s*,\s*39998/.test(src), 'AC-6: the Map update is composed by upsertDListEntry for kind 39998');
  assert(/removeDListEntry\s*\(\s*event/.test(src), 'AC-8: revoke composes through removeDListEntry');
});

test('S6: the page\'s own chain — drift-guarded NIP-07 signing, publishOrThrow, re-search on success', () => {
  const src = safeRead(PANEL);
  assert(/getActiveSignerOrThrow/.test(src) && /window\.nostr\.signEvent/.test(src) && /publishOrThrow/.test(src), 'AC-6/AC-8: getActiveSignerOrThrow → signEvent → publishOrThrow');
  assert(/onPublished/.test(src), 'AC-6: success re-runs the page search via onPublished');
  assert(/catch/.test(src) && /[Ee]rror/.test(src), 'AC-9: failures surface inline');
  assert(/\/tapestry\/lists\//.test(src) && /encodeURIComponent/.test(src), 'AC-7: the empowered list links to the DList page by coordinate');
});

test('S7: the page mounts the panel once, between the Trusted Lists panel and the hand-edit panel, with onPublished={search}', () => {
  const page = safeRead(PAGE);
  assert(/import\s+DListCurationPanel/.test(page) && (page.match(/<DListCurationPanel/g) || []).length === 1, 'ADR §Implementation 3: single mount');
  assert(/<DListCurationPanel[^>]*onPublished=\{search\}/.test(page), 'AC-6: the page search is the refresh');
  const at = (n) => page.indexOf(n);
  assert(at('<TlOptInCard') < at('<DListCurationPanel') && at('<DListCurationPanel') < at('<TreasureMapManualEdit'), 'AC-10: order Trusted Lists panel → DList Curation → hand edit (keeps story 3\'s S10 pin)');
});

/* ── R: sentinels (pass before and after) ─────────────────── */

test('R1: story 1\'s card is untouched and the page order around it holds', () => {
  const card = safeRead(CARD); const page = safeRead(PAGE);
  assert(/describeTlDelegation\s*\(/.test(card) && card.includes('Would you like the local Tapestry instance to publish your Trusted Lists for pubkeys on your behalf?'), 'AC-10: TlOptInCard intact');
  const at = (n) => page.indexOf(n);
  assert(at('<TreasureMapTagsPanel') < at('Show raw event') && at('Show raw event') < at('<TlOptInCard') && at('<TlOptInCard') < at('<TreasureMapManualEdit'), 'AC-10: page order intact');
  assert((page.match(/<TlOptInCard/g) || []).length === 1 && page.includes('No Trusted Assertions event found'), 'AC-10: card mounted once; no-Map path intact');
});

test('R2: the community-shares hook is consumed, not modified', () => {
  const hook = safeRead(HOOK);
  assert(/export default function useCommunitySharedConcepts/.test(hook) && /export const COMMUNITY_RELAYS/.test(hook) && /selfDeclared/.test(hook), 'AC-3: hook contract intact (self-declared filter, COMMUNITY_RELAYS)');
});

test('R3: the publish gate hook and the both-fail contract are untouched', () => {
  assert(/skippedByGate/.test(safeRead(NOSTR_PUBLISH)) && /isExternalPublishAllowed/.test(safeRead(NOSTR_PUBLISH)), 'AC-6: publishEverywhere inherits the deployment gate');
  assert(/!localOk\s*&&\s*!externalOk/.test(safeRead(PUBLISH_PROFILE_TAG)), 'AC-6: publishOrThrow throws only when both local and external fail');
});

test('R4: the util\'s existing exports and TL upsert semantics are unchanged', async () => {
  const mod = await loadEsm(UTIL);
  assert(mod, 'ui/src/utils/treasureMap.js must import');
  for (const name of ['classifyEntry', 'findGenericTlDelegation', 'upsertGenericTlTag', 'composeManualUpdate', 'describeTlDelegation', 'buildPresenceTargets', 'compareMapVersions', 'summarizePresence', 'planRelaySync']) {
    assert(typeof mod[name] === 'function', `R: ${name} still exported`);
  }
  const out = mod.upsertGenericTlTag(baseEvent([['30392', PK_B, 'wss://x']]), 30392, PK_A, 'wss://tl');
  assert(deepEq(out.tags, [['30392', PK_A, 'wss://tl']]), 'R: TL upsert semantics unchanged');
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
