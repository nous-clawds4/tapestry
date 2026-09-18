/**
 * curated-dlist-update #3: another assistant's curation opens read-only, with an offer to curate it here.
 *
 * Story: engineering-team/stories/curated-dlist-update/3-another-assistants-curation-read-only.md
 * ADR:   engineering-team/decisions/curated-dlist-update/0003-read-only-curation-and-curate-here.md
 *
 * Four classes (house pattern; ESM behavioral import per test/my-curated-dlists-headers.test.js):
 *   U (behavioral) — curatedDListAccess's read-only state (no-assistant and other-pubkey retired);
 *                    the new pure exports curateHereOffer and replacementSentences; itemsEmptySentence
 *                    seen from another assistant's side. FAIL now.
 *   S (structure)  — the list page links every row; the detail page's read-only mode; the headers and
 *                    items modules' curator variants; the new CurateHereOffer component; the DList
 *                    Curation panel's Replace confirmation (ADR §7). User-facing phrases are pinned as
 *                    literals, on whitespace-flattened source. FAIL now.
 *   D (docs)       — the two superseded-in-part annotations (ADR §8). FAIL now.
 *   R (sentinel)   — my own lists' words and the header endpoint's exports. PASS before and after.
 *
 * Amendment 1 (ADR 0003; story 3's review, Non-blocking 1 and 2): U2 adds the offer's target check — the
 * curating header must point at a kind-39998 header with the Map entry's own d-tag; S5 its sentence; D1
 * my-curated-dlists ADR 0002's note.
 *
 * Re-aimed in their own suites (the test plan lists each): the front-door statuses and the list page's
 * links (test/my-curated-dlists-page.test.js U6, S3, S4), and story 1's front door as story 2 pinned it
 * (test/my-curated-dlists-headers.test.js R1).
 *
 * Not covered here: the rendered pages in a browser and a real "curate it here instead", which signs a
 * header and the Map — the local check with the fetch stub (ADR note 9).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const UI = path.join(ROOT, 'ui/src');
const UTIL = path.join(UI, 'utils/treasureMap.js');
const LIST_PAGE = path.join(UI, 'pages/grapevine/MyCuratedDLists.jsx');
const DETAIL = path.join(UI, 'pages/grapevine/CuratedDListDetail.jsx');
const HEADERS = path.join(UI, 'pages/grapevine/CuratedDListHeaders.jsx');
const ITEMS = path.join(UI, 'pages/grapevine/CuratedDListItems.jsx');
const OFFER = path.join(UI, 'pages/grapevine/CurateHereOffer.jsx');
const PANEL = path.join(UI, 'pages/grapevine/DListCurationPanel.jsx');
const ENDPOINT = path.join(ROOT, 'src/api/dlist-curation/index.js');
const MCD_ADR_1 = path.join(ROOT, 'engineering-team/decisions/done/my-curated-dlists/0001-my-curated-dlists-page.md');
const DC_ADR_5 = path.join(ROOT, 'engineering-team/decisions/done/dlist-curation/0005-dlist-curation-panel.md');
const MCD_ADR_2 = path.join(ROOT, 'engineering-team/decisions/done/my-curated-dlists/0002-the-two-headers.md');

const ME = 'a'.repeat(64);                    // my assistant on this instance
const OTHER = '0123456789abcdef'.repeat(4);   // the assistant my Map names — elsewhere
const AUTHOR = 'c'.repeat(64);                // the shared list's author
const RELAY = 'wss://dcosl.brainstorm.world';
const OTHER_RELAY = 'wss://relay.elsewhere.example';
const SHARED = `39998:${AUTHOR}:dog-breed`;
const TAGS = [
  ['39998:dog-breed', OTHER, OTHER_RELAY],    // curated by another assistant
  ['39998:cats', ME, RELAY],                  // curated by mine
  ['39999:birds', OTHER, RELAY],              // another assistant's kind-39999 list
];
const APOS = "(?:'|’|&apos;|&#39;)";          // an apostrophe as JSX may spell it

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function rel(p) { return path.relative(ROOT, p); }
const flat = (s) => s.replace(/\s+/g, ' ');
async function fn(name) {
  const mod = await loadEsm(UTIL);
  assert(mod && typeof mod.classifyEntry === 'function', 'ui/src/utils/treasureMap.js must load and export classifyEntry');
  assert(typeof mod[name] === 'function', `ui/src/utils/treasureMap.js must export ${name} (ADR 0003 §Implementation 1)`);
  return mod[name];
}
function src(p) {
  const s = safeRead(p);
  assert(s.length > 0, `${rel(p)} must exist (ADR 0003 §Implementation notes)`);
  return s;
}
/** The first `<Name …/>` element in a JSX source, whatever its line breaks. */
function element(s, name) {
  const m = s.match(new RegExp(`<${name}\\b[\\s\\S]*?\\/>`));
  return m ? m[0] : '';
}

const tests = [];
function test(name, f) { tests.push({ name, fn: f }); }

/* ── U: the pure functions ─────────────────────────────────── */

test('U1: curatedDListAccess — a list on my Map opens as mine when it names my assistant here, read-only otherwise (every list, with no assistant here); no-assistant and other-pubkey are retired', async () => {
  const access = await fn('curatedDListAccess');
  const base = { signedIn: true, authLoading: false, assistantPubkey: ME, mapStatus: 'found', tags: TAGS, id: '39998:dog-breed' };
  const acc = (over) => access({ ...base, ...over });
  let r = acc({});
  assert(r && r.status === 'read-only' && r.row && r.row.pubkey === OTHER && r.row.mine === false,
    `AC-2 / ADR §1: a list my Map names for another pubkey opens read-only, with its row; got ${JSON.stringify(r)}`);
  r = acc({ id: '39998:cats' });
  assert(r.status === 'ok' && r.row && r.row.mine === true, `AC-5: my assistant's list still opens as mine; got ${JSON.stringify(r)}`);
  assert(acc({ id: '39999:birds' }).status === 'read-only', 'AC-2: another pubkey\'s kind-39999 list opens read-only too');
  for (const none of [null, undefined, '']) {
    r = acc({ assistantPubkey: none, id: '39998:cats' });
    assert(r.status === 'read-only' && r.row && r.row.routeId === '39998:cats',
      `AC-1 / gate decision 2: with no assistant here (${JSON.stringify(none)}) a list on my Map opens read-only; got ${JSON.stringify(r)}`);
  }
  // With no assistant, every other case still decides first (ADR §1).
  const noA = (over) => acc({ assistantPubkey: null, ...over });
  assert(noA({ id: 'garbage' }).status === 'bad-id', 'ADR §1: with no assistant, a bad address is still bad-id');
  assert(noA({ mapStatus: 'loading', tags: [] }).status === 'checking', 'ADR §1: with no assistant, a Map still loading is checking');
  assert(noA({ mapStatus: 'error', tags: [] }).status === 'map-error', 'ADR §1: with no assistant, a failed Map lookup is map-error');
  assert(noA({ mapStatus: 'none', tags: [] }).status === 'no-map', 'ADR §1: with no assistant, no Map is no-map');
  assert(noA({ id: '39998:unknown' }).status === 'not-on-map', 'ADR §1: with no assistant, a list not on my Map is not-on-map');
  assert(noA({ signedIn: false }).status === 'signed-out', 'ADR §1: signed out outranks everything');
  assert(acc({ authLoading: true, signedIn: false }).status === 'checking', 'ADR §1: auth still loading → checking');
  assert(acc({ tags: [['39998:x', OTHER, RELAY], ['39998:x', ME, RELAY]], id: '39998:x' }).status === 'read-only',
    'ADR §1: the first entry decides — a later entry naming my assistant does not make it mine');
  const seen = new Set();
  for (const assistantPubkey of [ME, OTHER, null, undefined, '']) {
    for (const id of ['39998:dog-breed', '39998:cats', '39999:birds', '39998:unknown', 'garbage', undefined]) {
      for (const mapStatus of ['found', 'loading', 'idle', 'error', 'none']) {
        for (const signedIn of [true, false]) seen.add(access({ signedIn, authLoading: false, assistantPubkey, mapStatus, tags: TAGS, id }).status);
      }
    }
  }
  assert(!seen.has('no-assistant') && !seen.has('other-pubkey'), `ADR §1: no-assistant and other-pubkey are retired; saw ${JSON.stringify([...seen])}`);
});

test('U2: curateHereOffer — offered when I have an assistant here, the list is kind 39998, and its assistant\'s header points at a kind-39998 header with the same d-tag (Amendment 1); otherwise the reason, in precedence order', async () => {
  const offer = await fn('curateHereOffer');
  const row = { kind: 39998, d: 'dog-breed', pubkey: OTHER, relay: OTHER_RELAY, coord: `39998:${OTHER}:dog-breed`, routeId: '39998:dog-breed', mine: false };
  const header = { id: 'h'.repeat(64), kind: 39998, pubkey: OTHER, created_at: 1, content: '', tags: [['d', 'dog-breed'], ['b', SHARED, 'pointer']] };
  const found = { event: header, where: 'relay', checkedRelay: OTHER_RELAY };
  // The pointer as describeCurationHeader reports it: the coordinate, its type, and its parsed parts.
  const info = { authoredByAssistant: true, pointer: { coord: SHARED, type: 'pointer', kind: 39998, pubkey: AUTHOR, d: 'dog-breed' }, deferred: false, problems: [], notes: [] };
  const o = (over) => offer({ assistantPubkey: ME, row, assistantLookup: found, info, ...over });
  assert(deepEq(o({}), { status: 'available', target: SHARED }),
    `AC-4 / ADR §5: available, targeting the shared header this curation follows; got ${JSON.stringify(o({}))}`);
  for (const none of [null, undefined, '']) {
    assert(deepEq(o({ assistantPubkey: none, row: { ...row, kind: 39999 }, assistantLookup: undefined }), { status: 'unavailable', reason: 'no-assistant' }),
      `ADR §5: no assistant here (${JSON.stringify(none)}) is the first reason`);
  }
  assert(deepEq(o({ row: { ...row, kind: 39999 }, assistantLookup: { missing: true, failed: true, checkedRelay: null } }), { status: 'unavailable', reason: 'kind' }),
    'gate decision 3 / ADR §5: a kind-39999 list is not offered — before any header state');
  assert(deepEq(o({ assistantLookup: undefined, info: null }), { status: 'checking' }), 'ADR §5: its header not looked up yet → checking');
  assert(deepEq(o({ assistantLookup: { missing: true, failed: true, checkedRelay: OTHER_RELAY }, info: null }), { status: 'unavailable', reason: 'failed' }),
    'ADR §5: its header couldn\'t be checked → failed');
  assert(deepEq(o({ assistantLookup: { missing: true, failed: false, checkedRelay: OTHER_RELAY }, info: null }), { status: 'unavailable', reason: 'missing' }),
    'ADR §5: its header was not found → missing');
  assert(deepEq(o({ info: { ...info, pointer: null, deferred: true } }), { status: 'unavailable', reason: 'deferred' }), 'ADR §5: deliberately unaffiliated → deferred');
  assert(deepEq(o({ info: { ...info, pointer: null, deferred: false } }), { status: 'unavailable', reason: 'no-pointer' }), 'ADR §5: names no shared header → no-pointer');
  // Amendment 1 (review NB1): the target must be a kind-39998 header with the Map entry's own d-tag.
  const ptr = (coord, kind, d) => ({ ...info, pointer: { coord, type: 'pointer', kind, pubkey: AUTHOR, d } });
  assert(deepEq(o({ info: ptr(`39999:${AUTHOR}:dog-breed`, 39999, 'dog-breed') }), { status: 'unavailable', reason: 'target' }),
    'ADR 0003 Amendment 1: a pointer at another kind of header is not offered (the endpoint takes kind-39998 targets only)');
  assert(deepEq(o({ info: ptr(`39998:${AUTHOR}:dogs`, 39998, 'dogs') }), { status: 'unavailable', reason: 'target' }),
    'ADR 0003 Amendment 1: a pointer at another d-tag is not offered (the Map entry would address a header that does not exist)');
  assert(deepEq(o({ assistantLookup: { missing: true, failed: false, checkedRelay: OTHER_RELAY }, info: ptr(`39998:${AUTHOR}:dogs`, 39998, 'dogs') }), { status: 'unavailable', reason: 'missing' }),
    'ADR 0003 Amendment 1: the header\'s own states still come before the target check');
  assert(deepEq(o({ info: ptr(SHARED, 39998, 'dog-breed') }), { status: 'available', target: SHARED }),
    'ADR 0003 Amendment 1: a conforming pointer — a kind-39998 header with the same d-tag — is still offered');
  for (const g of [undefined, null, {}, { row: null }, { assistantPubkey: ME, row: 'x' }]) {
    let out;
    try { out = offer(g); } catch (e) { throw new Error(`ADR §5: never throws — threw on ${JSON.stringify(g)}: ${e.message}`); }
    assert(out && typeof out.status === 'string' && out.status !== 'available', `ADR §5: garbage is never available; got ${JSON.stringify(out)} for ${JSON.stringify(g)}`);
  }
});

test('U3: replacementSentences — the two sentences said before any replacement: one curating assistant per list; the other assistant\'s header and copies stay', async () => {
  const sentences = await fn('replacementSentences');
  const out = sentences('0123abcd…cdef');
  assert(Array.isArray(out) && out.length === 2, `ADR §6: two sentences; got ${JSON.stringify(out)}`);
  assert(out[0] === 'Your Treasure Map names one curating assistant per list: after this, your assistant here curates it, and 0123abcd…cdef no longer does.',
    `ADR §6: the first sentence, exact; got ${JSON.stringify(out[0])}`);
  assert(out[1] === "That assistant's header and copies stay where they are.", `ADR §6: the second sentence, exact; got ${JSON.stringify(out[1])}`);
  for (const g of [undefined, null, 42]) {
    let o;
    try { o = sentences(g); } catch (e) { throw new Error(`ADR §6: never throws — threw on ${JSON.stringify(g)}: ${e.message}`); }
    assert(Array.isArray(o) && o.length === 2 && o.every((x) => typeof x === 'string'), `ADR §6: two strings even for ${JSON.stringify(g)}; got ${JSON.stringify(o)}`);
  }
});

test('U4: itemsEmptySentence — seen from another assistant\'s side it says "Its assistant"; my own view is unchanged', async () => {
  const f = await fn('itemsEmptySentence');
  const clean = { items: [], local: 'ok', relay: 'ok', truncated: false, total: 0 };
  const cases = [
    [{ showOthers: false, shared: undefined, curator: 'other' }, "Its assistant hasn't added any items to this list yet."],
    [{ showOthers: true, shared: undefined, curator: 'other' }, "Its assistant hasn't added any items to this list yet. No one else has either."],
    [{ showOthers: false, shared: clean, curator: 'other' }, "Its assistant hasn't added any items to this list yet. The shared list offers no candidates to copy."],
    [{ showOthers: false, shared: undefined }, "Your assistant hasn't added any items to this list yet."],
    [{ showOthers: false, shared: undefined, curator: 'mine' }, "Your assistant hasn't added any items to this list yet."],
  ];
  for (const [input, want] of cases) {
    const got = f(input);
    assert(got === want, `ADR §3 (AC-2) / AC-5: ${JSON.stringify(input)} → ${JSON.stringify(want)}; got ${JSON.stringify(got)}`);
  }
});

/* ── S: structure ──────────────────────────────────────────── */

test('S1: the list page — every row links to its detail page; another pubkey\'s row says it opens read-only; with no assistant here the line says I can view but not curate', () => {
  const s = src(LIST_PAGE); const f = flat(s);
  assert(/<Link\s+to=\{\s*curatedDListPath\(\s*row\.routeId\s*\)\s*\}/.test(s), 'AC-1 / ADR §2: rows link to curatedDListPath(row.routeId)');
  assert(!/mine\s*\?\s*\(?\s*<Link\b/.test(s), 'AC-1 / ADR §2: the link is no longer reserved for my assistant\'s rows');
  assert(/Opens read-only here\./.test(f), 'AC-1 / ADR §2: "Opens read-only here." on a row not mine');
  assert(!/own assistant curates open here/i.test(f), 'AC-1: "Only lists your own assistant curates open here." is gone');
  assert(new RegExp(`You don${APOS}t have a Tapestry Assistant on this instance, so you can view these lists here but not curate them\\.`).test(f),
    'AC-1 / ADR §2: the no-assistant line, exact');
  assert(/another pubkey/.test(f), 'ADR §2: a row not mine keeps its badge ("another pubkey · <short>")');
});

test('S2: the detail page — read-only is an open state seen through the curator\'s pubkey: lookups, subtitle and read-only line, curator on the sections, no method panel, the offer', () => {
  const s = src(DETAIL); const f = flat(s);
  assert(!/['"]no-assistant['"]/.test(s) && !/['"]other-pubkey['"]/.test(s), 'ADR §1 / note 3: SENTENCES drops no-assistant and other-pubkey');
  assert(/['"]read-only['"]/.test(s), 'ADR §3: the page handles read-only');
  assert(!/status\s*===\s*['"]ok['"]\s*\?\s*\[\s*access\.row\s*\]/.test(s), 'ADR §3 / note 3: the header lookup runs for both open states, not only ok');
  assert(!/describeCurationHeader\(\s*lookup\??\.event\s*,\s*assistantPubkey\s*\)/.test(s)
    && /describeCurationHeader\(\s*lookup\??\.event\s*,\s*(?:(?:access\.)?row\??\.pubkey|curatorPubkey)\s*\)/.test(s),
  'ADR §3 / note 3: authorship is checked against the curator — describeCurationHeader(lookup.event, row.pubkey)');
  assert(/curated by another assistant/.test(f) && /curated by your assistant/.test(f), 'AC-2 / AC-5: "curated by another assistant" when read-only; mine unchanged');
  assert(/Read-only here: your Treasure Map names this assistant for the list, not your assistant on this instance\./.test(f), 'AC-2 / ADR §3: the read-only line, exact');
  assert(new RegExp(`Read-only here: your Treasure Map names this assistant for the list, and you don${APOS}t have a Tapestry Assistant on this instance\\.`).test(f),
    'AC-2 / ADR §3: the read-only line with no assistant here, exact');
  for (const name of ['AssistantHeaderSection', 'SharedHeaderSection', 'ItemsSection']) {
    assert(/\bcurator=/.test(element(s, name)), `ADR §3 / note 3: <${name} …> gets curator`);
  }
  const items = element(s, 'ItemsSection');
  assert(/assistantPubkey=\{/.test(items) && !/assistantPubkey=\{\s*assistantPubkey\s*\}/.test(items), 'ADR §3: ItemsSection judges items from the curator\'s side (assistantPubkey={row.pubkey})');
  assert(/\blistRelay=/.test(items) && /\bcanCurateHere=/.test(items), 'ADR §3–§4 / note 3: ItemsSection gets listRelay and canCurateHere');
  assert(/wss\?:/.test(s), 'ADR §4 / note 3: a read-only list\'s items are read at the entry\'s ws/wss hint');
  assert(new RegExp(`The curation method is set where this list${APOS}s assistant lives\\.`).test(f), 'AC-3 / ADR §3: the one line in place of the method panel');
  assert(/(?:\?|&&|:)\s*\(?\s*<CurationMethodPanel\b/.test(s), 'AC-3 / ADR §3: the method panel renders only for my own lists (a conditional branch)');
  assert(/import\s+CurateHereOffer\s+from\s+['"]\.\/CurateHereOffer['"]/.test(s), 'ADR note 3: the offer component is imported');
  const offer = element(s, 'CurateHereOffer');
  assert(/onPublished=\{\s*map\.refresh\s*\}/.test(offer) && /mapEvent=\{\s*map\.event\s*\}/.test(offer), 'ADR §5 / note 3: <CurateHereOffer mapEvent={map.event} onPublished={map.refresh} …/>');
  assert(/curateHereOffer\(/.test(s), 'ADR §5 / note 3: the page asks curateHereOffer whether to offer');
});

test('S3: the headers module — both sections take curator; another assistant\'s header is titled and credited to it, and its older-link note promises nothing this page cannot do; my words unchanged', () => {
  const s = src(HEADERS); const f = flat(s);
  assert(/export\s+function\s+AssistantHeaderSection\s*\(\s*\{[^}]*\bcurator\b/.test(s) && /export\s+function\s+SharedHeaderSection\s*\(\s*\{[^}]*\bcurator\b/.test(s),
    'ADR note 4: both sections take curator');
  assert(new RegExp(`Its assistant${APOS}s DList header`).test(f), 'AC-2 / ADR §3: the read-only section title');
  assert(/Authored by the curating assistant/.test(f) && /Not authored by the curating assistant/.test(f),
    'AC-2 / ADR §3: authorship credited to the curating assistant — no "not authored by your assistant" on a read-only page');
  assert(new RegExp(`its assistant${APOS}s header`).test(f), 'ADR §3: the shared section\'s can\'t-tell sentences, read-only');
  assert(/It uses the older link type; only its own assistant can upgrade it\./.test(f), 'AC-3 / ADR §3: the read-only older-link note, exact — no "Update list"');
  assert(/It uses the older link type; Update list will upgrade it to “pointer”\./.test(f), 'AC-5 / curated-dlist-update ADR 0002 §5: my own older-link note unchanged');
});

test('S4: the items module — ItemsSection and UpdateListButton take curator; another assistant\'s list is read at listRelay and labelled "its assistant"; Update says where it runs', () => {
  const s = src(ITEMS); const f = flat(s);
  const sig = (name) => (s.match(new RegExp(`export\\s+function\\s+${name}\\s*\\(\\s*\\{[^}]*\\}`)) || [''])[0];
  const items = sig('ItemsSection');
  assert(/\bcurator\b/.test(items) && /\blistRelay\b/.test(items) && /\bcanCurateHere\b/.test(items), `ADR note 5: ItemsSection({ …, curator, listRelay, canCurateHere }); got ${JSON.stringify(items)}`);
  const upd = sig('UpdateListButton');
  assert(/\bcurator\b/.test(upd) && /\bcanCurateHere\b/.test(upd), `ADR note 5: UpdateListButton({ curator, canCurateHere }); got ${JSON.stringify(upd)}`);
  assert(/useListItems\(\s*\[\s*myCoord\s*\]\s*,\s*listRelay\b/.test(s), 'ADR §4: the curated list\'s own read uses listRelay');
  assert(/useListItems\([^;]*showCandidates[^;]*communityRelay/.test(s), 'ADR §4: the shared list\'s read stays at the community relay');
  assert((s.match(/\blistRelay\b/g) || []).length >= 3, 'ADR §4: the source notes and relay-only markers name the relay the list was read at');
  assert(/its assistant/.test(f), 'ADR §3: "its assistant" labels another assistant\'s items');
  assert(new RegExp(`its assistant${APOS}s header`).test(f), 'ADR §3: the candidates box\'s reasons, read-only');
  assert(new RegExp(`Update list runs only on the instance where this list${APOS}s assistant lives\\.`).test(f), 'AC-3 / ADR §3: Update\'s read-only line, exact');
  assert(/You can curate it here instead\./.test(f), 'AC-3 / ADR §3: the Update line mentions the offer when it applies');
  // Re-aimed by curated-dlist-update #5 (ADR 0005 §8): on my own lists Update list now opens the preview.
  assert(!new RegExp(`Update list isn${APOS}t built yet`).test(f), 'Re-aimed by curated-dlist-update #5: on my own lists Update list opens the preview — the "isn\'t built yet" line is gone; the read-only line above is unchanged');
});

test('S5: CurateHereOffer — words first, then the panel\'s endpoint call, the Map composed for kind 39998, and the drift-guarded sign-and-publish; the reasons and the 409 sentence', () => {
  const s = src(OFFER); const f = flat(s);
  assert(/export\s+default\s+function\s+CurateHereOffer\b/.test(s), 'ADR note 6: default export CurateHereOffer');
  const fromUtil = (name) => new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"]\\.\\.\\/\\.\\.\\/utils\\/treasureMap['"]`).test(s);
  assert(fromUtil('upsertDListEntry') && fromUtil('replacementSentences'), 'ADR note 6: upsertDListEntry and replacementSentences from the util');
  assert(/import\s*\{[^}]*\bgetActiveSignerOrThrow\b[^}]*\}\s*from\s*['"]\.\.\/\.\.\/utils\/signerGuard['"]/.test(s), 'ADR note 6: the drift-guarded signer');
  assert(/import\s*\{[^}]*\bpublishOrThrow\b[^}]*\}\s*from\s*['"]\.\.\/\.\.\/utils\/publishProfileTag['"]/.test(s), 'ADR note 6: publishOrThrow');
  assert(/useConfig\(/.test(s) && /aDListRelays/.test(s), 'ADR §5: the relay hint from aRelays.aDListRelays, as the panel reads it');
  for (const label of ['Curate it here instead', 'Continue', 'Cancel', 'Sign & publish']) assert(f.includes(label), `ADR §5: "${label}"`);
  assert(/replacementSentences\(/.test(s), 'ADR §6: the words before a replacement');
  assert(f.includes('Continuing has your assistant here write its own header for this list, if it has none; your Treasure Map changes only when you sign.'),
    'ADR §6: the third sentence, exact');
  assert(f.includes('Your assistant already has a header for this list with a different link; it was not changed.') && /409/.test(s), 'ADR §5: the 409 sentence, exact');
  assert(/Map update: replaces/.test(f), 'ADR §5: the review line names the replacement');
  const effects = [...s.matchAll(/useEffect\(/g)].map((m) => s.slice(m.index, m.index + 600));
  assert(effects.every((e) => !/dlist-curation\/header/.test(e)), 'AC-4 / ADR §5: no request on mount — the endpoint waits for Continue');
  assert(/['"]\/api\/dlist-curation\/header['"]/.test(s) && /method:\s*['"]POST['"]/.test(s) && /JSON\.stringify\(\s*\{\s*target/.test(s),
    'ADR §5: POST /api/dlist-curation/header { target } — the panel\'s call');
  assert(/upsertDListEntry\(\s*[\w.?]+\s*,\s*39998\s*,/.test(s), 'ADR §5: the Map update composed by upsertDListEntry for kind 39998');
  const at = [s.search(/getActiveSignerOrThrow\(/), s.search(/window\.nostr\.signEvent\(/), s.search(/publishOrThrow\(/), s.search(/onPublished\(/)];
  assert(at.every((x) => x > 0) && at[0] < at[1] && at[1] < at[2] && at[2] < at[3], 'ADR §5: getActiveSignerOrThrow → window.nostr.signEvent → publishOrThrow → onPublished');
  assert(new RegExp(`You can${APOS}t curate it here`).test(f), 'ADR §5: the reasons begin "You can\'t curate it here"');
  for (const tail of [`: you don${APOS}t have a Tapestry Assistant on this instance\\.`, ': this instance curates only kind-39998 lists\\.',
    ` yet: its assistant${APOS}s header couldn${APOS}t be checked\\.`, `: its assistant${APOS}s header was not found, so the shared list it curates is unknown\\.`,
    `: its assistant${APOS}s header names no shared list\\.`, `: its assistant${APOS}s header is marked deliberately unaffiliated\\.`,
    `: its assistant${APOS}s header doesn${APOS}t point at a kind-39998 list with the same d-tag\\.`]) {
    assert(new RegExp(tail).test(f), `ADR §5: a reason ends "${tail.replace(/\\\./g, '.').replace(/\(\?:[^)]*\)/g, "'")}"`);
  }
  assert(!/\/api\/strfry\/publish/.test(s) && !/taPubkey/.test(s) && !/[0-9a-fA-F]{64}/.test(s), 'ADR note 6: publishes only through publishOrThrow; no taPubkey, no pubkey literal');
});

test('S6: the DList Curation panel — a Replace confirmation says "replaces", with the one-assistant-per-list sentences; a plain Add still says "adds"', () => {
  const s = src(PANEL); const f = flat(s);
  assert(/Map update: replaces/.test(f), 'ADR §7: the Replace confirmation names the replacement');
  assert(/import\s*\{[^}]*\breplacementSentences\b[^}]*\}\s*from\s*['"]\.\.\/\.\.\/utils\/treasureMap['"]/.test(s) && /replacementSentences\(/.test(s),
    'ADR §7: the same sentences as the offer, from the util');
  assert(/\breplaces\s*[:,}]/.test(s) && /pending\??\.replaces\b/.test(s), 'ADR §7: handleAdd records the replaced pubkey in pending, and the confirmation reads it');
  assert(/Map update: adds/.test(f), 'ADR §7: a plain Add still says "adds"');
});

/* ── D: the superseded-in-part notes (ADR §8) ─────────────── */

test('D1: my-curated-dlists ADRs 0001 and 0002 and dlist-curation ADR 0005 each carry a Status parenthetical and a one-line note citing curated-dlist-update ADR 0003 by short name (0002 by Amendment 1)', () => {
  for (const p of [MCD_ADR_1, DC_ADR_5, MCD_ADR_2]) {
    const s = src(p);
    const status = (s.match(/^\*\*Status:\*\*[^\n]*/m) || [''])[0];
    assert(/^\*\*Status:\*\* Accepted \(.+`curated-dlist-update` ADR 0003\)/.test(status), `ADR §8: ${rel(p)}'s Status line carries the parenthetical; got ${JSON.stringify(status)}`);
    assert(/^> \*\*Superseded in part \(\d{4}-\d{2}-\d{2}\):\*\*[^\n]*`curated-dlist-update` ADR 0003/m.test(s), `ADR §8: ${rel(p)} has a one-line "Superseded in part" note citing \`curated-dlist-update\` ADR 0003`);
    assert(!/decisions\/curated-dlist-update\/0003/.test(s), `ADR §8: ${rel(p)} cites ADR 0003 by short name, not by path`);
  }
});

/* ── R: sentinels (pass before and after) ──────────────────── */

// Re-aimed by curated-dlist-update #5 (ADR 0005 §8): the Update placeholder line left when Update list began opening the
// preview; my labels and the Update list button stay.
test('R1: my own lists keep their words — the header section, my older-link note, my labels, the subtitle', () => {
  const h = flat(safeRead(HEADERS)); const i = flat(safeRead(ITEMS)); const d = flat(safeRead(DETAIL));
  assert(new RegExp(`Your assistant${APOS}s DList header`).test(h) && /Authored by your assistant/.test(h), 'AC-5: my header section\'s title and authorship');
  assert(/Update list will upgrade it to “pointer”/.test(h), 'AC-5 / curated-dlist-update ADR 0002 §5: my older-link note');
  assert(/your assistant/.test(i) && /Update list/.test(i), 'AC-5: my labels, and the Update list button');
  assert(/curated by your assistant/.test(d), 'AC-5: my subtitle');
});

test('R2: the header endpoint keeps its exports (AC-5 — no endpoint change)', () => {
  const m = require(ENDPOINT);
  for (const name of ['createAuthorCurationHeaderHandler', 'parseATag', 'classifyExisting', 'composeCurationHeader']) {
    assert(typeof m[name] === 'function', `AC-5: ${name} still exported`);
  }
});

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log(`  ✅ ${t.name}`);
    } catch (e) {
      fail++;
      failures.push({ name: t.name, error: e.message });
      console.log(`  ❌ ${t.name}\n      ${e.message}`);
    }
  }
  console.log(`curated-dlist-update-read-only-curation: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
