/**
 * dlist-item-tagging #3: Tag a DList item.
 *
 * Story (Light profile — Design note + edge cases + AC→handle lines all live in the story file):
 *   engineering-team/stories/dlist-item-tagging/3-tag-a-dlist-item.md
 *
 * Three classes (house pattern — see test/dlist-browse.test.js):
 *   U (behavioral) — the three new pure exports of ui/src/utils/dlistFields.js (`itemCoord`,
 *                    `itemTarget`, `parseItemRef`) dynamically imported and exercised against
 *                    inline fixtures mirroring the live `github-accounts` item shape. FAIL now:
 *                    the exports do not exist yet.
 *   S (structure)  — the target-aware read hook, the `target`/`subject` props on NoteTags, the
 *                    DListItemTags wrapper, the List.jsx renderExtra wiring, the TagANoteModal
 *                    item branch, and the /lists menu entry exist as source text and carry the
 *                    Design-note contract. FAIL now.
 *   R (sentinel)   — what the Design note promised not to disturb: NoteCard's <NoteTags item=…>
 *                    mount, every key string the five existing NoteTags sentinel suites pin,
 *                    eventParam.js, the story-1 files, the write hook's guards. PASS before and
 *                    after; they fail only on collateral damage (AC-6 teeth).
 *
 * No stack dependency: nothing here talks to strfry, Neo4j, or the control panel. The server
 * `for-event` address= branch is covered by test/event-tagging-read-api.test.js; the story-2
 * d-rule bytes by test/event-tagging-a-target-dtag.test.js; the strfry write guard is the
 * scoped-gate sibling test/strfry-write-assertion-bracket.test.js (carve-out: Phase 4 does
 * not edit it).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { nip19 } = require('nostr-tools');

const UI = path.resolve(__dirname, '../ui/src');
const UTIL = path.join(UI, 'utils/dlistFields.js');
const HOOK = path.join(UI, 'hooks/useEventTags.js');
const WRITE_HOOK = path.join(UI, 'hooks/useEventTagging.js');
const NOTE_TAGS = path.join(UI, 'components/NoteTags.jsx');
const NOTE_CARD = path.join(UI, 'components/NoteCard.jsx');
const ITEM_TAGS = path.join(UI, 'components/dlist/DListItemTags.jsx');
const LIST_PAGE = path.join(UI, 'pages/List.jsx');
const MODAL = path.join(UI, 'components/TagANoteModal.jsx');
const MENU_LINKS = path.join(UI, 'config/avatarMenuLinks.js');
const EVENT_PARAM = path.join(UI, 'utils/eventParam.js');
const HEADER = path.join(UI, 'components/Header.jsx');
const APP = path.join(UI, 'App.jsx');
// Story-1 files the Design note reuses unchanged.
const TABLE = path.join(UI, 'components/dlist/DListItemsTable.jsx');
const ROW = path.join(UI, 'components/dlist/DListItemRow.jsx');
const LISTS_PAGE = path.join(UI, 'pages/Lists.jsx');
const RELAY_API = path.join(UI, 'api/relay.js');

/* ── Fixtures: the live github-accounts item shape (relay probe 2026-09-09) ── */

const HEADER_PK = 'b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450';
const ITEM_PK_A = '1111111111111111111111111111111111111111111111111111111111111111';
const ITEM_PK_B = '2222222222222222222222222222222222222222222222222222222222222222';
const HEADER_COORD = `39998:${HEADER_PK}:github-accounts`;
const ITEM_D = 'vcavallo-1i6dn0p';
const ITEM_COORD = `39999:${HEADER_PK}:${ITEM_D}`;

function item(overrides = {}) {
  return {
    id: 'b'.repeat(64),
    kind: 39999,
    pubkey: HEADER_PK,
    created_at: 1757000100,
    content: '',
    tags: [
      ['d', ITEM_D],
      ['z', HEADER_COORD],
      ['github-username', 'vcavallo'],
    ],
    ...overrides,
  };
}

/** A kind-9999 (non-addressable) list item: no `d`, membership via `z`. */
function item9999() {
  return item({ id: 'c'.repeat(64), kind: 9999, tags: [['z', HEADER_COORD], ['github-username', 'other']] });
}

function naddrFor(kind, pubkey, identifier) {
  return nip19.naddrEncode({ kind, pubkey, identifier });
}

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function stripComments(src) { return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function util() {
  const mod = await loadEsm(UTIL);
  assert(mod, 'ui/src/utils/dlistFields.js must exist and be importable as ESM');
  for (const fn of ['itemCoord', 'itemTarget', 'parseItemRef']) {
    assert(typeof mod[fn] === 'function', `dlistFields.js must export ${fn}() (Design note §1)`);
  }
  return mod;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── U: pure item-target rules ─────────────────────────────── */

test('U1 (AC-1): itemCoord composes 39999:<pubkey>:<d> for an addressable item, mirroring the live github-accounts shape', async () => {
  const { itemCoord } = await util();
  assert(itemCoord(item()) === ITEM_COORD, `AC-1: itemCoord must be "${ITEM_COORD}", got ${JSON.stringify(itemCoord(item()))}`);
  const b = itemCoord(item({ pubkey: ITEM_PK_B }));
  assert(b === `39999:${ITEM_PK_B}:${ITEM_D}`, 'E3: the author pubkey is part of the coordinate');
});

test('U2 (AC-1, E4): itemTarget is { address } for an addressable item and { id } for a kind-9999 item — never both', async () => {
  const { itemTarget } = await util();
  const a = itemTarget(item());
  assert(a && a.address === ITEM_COORD, `AC-1: addressable item → { address: "${ITEM_COORD}" }, got ${JSON.stringify(a)}`);
  assert(!('id' in a) || a.id === undefined, 'AC-1: an addressable item\'s target carries NO id (the assertion must be an a, never an e)');
  const n = itemTarget(item9999());
  assert(n && n.id === 'c'.repeat(64), `E4: kind-9999 item → { id }, got ${JSON.stringify(n)}`);
  assert(!('address' in n) || n.address == null, 'E4: a non-addressable item\'s target carries no address');
});

test('U3 (E1, not derivable): a kind-39999 item with NO d tag → itemCoord null, itemTarget falls back to { id } (never "39999:pk:")', async () => {
  const { itemCoord, itemTarget } = await util();
  const noD = item({ tags: [['z', HEADER_COORD], ['github-username', 'vcavallo']] });
  assert(itemCoord(noD) === null, `E1: itemCoord on a d-less 39999 item must be null, got ${JSON.stringify(itemCoord(noD))}`);
  const t = itemTarget(noD);
  assert(t && t.id === noD.id && t.address == null, `E1: itemTarget falls back to { id }, got ${JSON.stringify(t)}`);
  const emptyD = item({ tags: [['d'], ['z', HEADER_COORD]] });
  assert(itemCoord(emptyD) === null, 'E1: a bare ["d"] tag (no value) is treated as missing');
});

test('U4 (E2, not derivable): a d containing colons is emitted verbatim by itemCoord and round-trips through parseItemRef', async () => {
  const { itemCoord, parseItemRef } = await util();
  const it = item({ tags: [['d', 'a:b:c'], ['z', HEADER_COORD]] });
  const coord = itemCoord(it);
  assert(coord === `39999:${HEADER_PK}:a:b:c`, `E2: colons in d kept verbatim, got ${coord}`);
  const p = parseItemRef(coord);
  assert(p && p.d === 'a:b:c' && p.address === coord,
    `E2: parseItemRef joins everything after the 2nd colon (parts.slice(2).join(':')), got ${JSON.stringify(p)}`);
});

test('U5 (E3, not derivable): two items by different authors sharing a d get distinct coordinates', async () => {
  const { itemTarget } = await util();
  const a = itemTarget(item({ pubkey: ITEM_PK_A }));
  const b = itemTarget(item({ pubkey: ITEM_PK_B }));
  assert(a.address !== b.address, 'E3: same d, different author → different address (tags never bleed across rows)');
  assert(a.address.includes(ITEM_PK_A) && b.address.includes(ITEM_PK_B), 'E3: each address names its own author');
});

test('U6 (AC-5): parseItemRef resolves a 39999 coordinate and an naddr of kind 39999 to { kind, pubkey, d, address }', async () => {
  const { parseItemRef } = await util();
  const c = parseItemRef(ITEM_COORD);
  assert(c && c.kind === 39999 && c.pubkey === HEADER_PK && c.d === ITEM_D && c.address === ITEM_COORD,
    `AC-5: "${ITEM_COORD}" → {kind:39999,pubkey,d,address}, got ${JSON.stringify(c)}`);
  const n = parseItemRef(naddrFor(39999, HEADER_PK, ITEM_D));
  assert(n && n.kind === 39999 && n.pubkey === HEADER_PK && n.d === ITEM_D && n.address === ITEM_COORD,
    `AC-5: naddr1… of kind 39999 decodes to the same address, got ${JSON.stringify(n)}`);
  assert(parseItemRef(`  ${ITEM_COORD}  `) && parseItemRef(`  ${ITEM_COORD}  `).address === ITEM_COORD, 'AC-5: surrounding whitespace is trimmed');
});

test('U7 (E5): parseItemRef returns null for header kinds, other naddr kinds, notes, npubs, bare hex, and garbage — never throws', async () => {
  const { parseItemRef } = await util();
  const cases = [
    naddrFor(39998, HEADER_PK, 'github-accounts'),   // header naddr → note path's existing naddr copy
    naddrFor(30023, HEADER_PK, 'an-article'),         // article naddr
    HEADER_COORD,                                     // 39998 coordinate → invalid on the note path
    `9998:${HEADER_PK}:x`,
    `9999:${HEADER_PK}:x`,                            // kind-9999 items are non-addressable (Design note §5)
    'b'.repeat(64),                                   // bare hex is a note id by precedence
    nip19.npubEncode(HEADER_PK),
    nip19.noteEncode('b'.repeat(64)),
    `39999:notahexpubkey:${ITEM_D}`,
    '39999:abc',
    'naddr1notvalid',
    '', '   ', null, undefined, 42, {},
  ];
  for (const bad of cases) {
    let out;
    try { out = parseItemRef(bad); } catch (e) { throw new Error(`E5: parseItemRef(${JSON.stringify(bad)}) threw: ${e.message}`); }
    assert(out === null, `E5: parseItemRef(${JSON.stringify(bad)}) must be null so the caller falls through to the note path, got ${JSON.stringify(out)}`);
  }
});

/* ── S: wiring ─────────────────────────────────────────────── */

test('S1 (AC-1, AC-2, E4): useEventTags takes a target — hex string normalised to { id }; { id } → eventId=, { address } → address= on for-event', () => {
  const src = stripComments(safeRead(HOOK));
  assert(src.length > 0, 'ui/src/hooks/useEventTags.js must exist');
  assert(/export function useEventTags\s*\(\s*target/.test(src),
    'Design note §2: the first argument is named `target` (hex string or { id } | { address })');
  assert(/typeof\s+\w+\s*===\s*['"]string['"]/.test(src) && /\{\s*id\b/.test(src),
    'Design note §2: a hex-string argument is normalised to { id } so NoteTags\' existing call convention still works');
  assert(/['"]address['"]|\baddress\b/.test(src) && /\.address\b/.test(src),
    'AC-1/AC-2: the fetch branches on target.address');
  assert(/address(=|\s*[:,])/.test(src) && /eventId/.test(src),
    'AC-2 / E4: sets `address=` for { address } and keeps `eventId=` for { id } on GET /api/event-tags/for-event');
  assert(/\/api\/event-tags\/for-event/.test(src), 'AC-2: still reads the existing for-event endpoint (no new read path)');
  assert(/target\.id/.test(src) && /target\.address/.test(src),
    'Design note §2: effect deps include target.id and target.address so switching target refetches');
  assert(/\bmine\b/.test(src) && /rawEvents/.test(src) && /povResolution/.test(src),
    'AC-2: mine / rawEvents / povResolution channels unchanged for either target');
});

test('S2 (AC-1, AC-4, AC-6): NoteTags gains optional target (default { id: item?.id }) and subject (default "note") props and threads target to the read hook and every write', () => {
  const src = stripComments(safeRead(NOTE_TAGS));
  assert(/export default function NoteTags\s*\(\s*\{[^}]*\btarget\b[^}]*\}/.test(src),
    'Design note §3: NoteTags accepts a `target` prop');
  assert(/subject\s*=\s*['"]note['"]/.test(src), 'Design note §3: `subject` prop defaults to "note"');
  assert(/const target = (targetProp|props\.target|target)\s*\|\|\s*\{\s*id:\s*item\?\.id\s*\}/.test(src)
    || /target\s*=\s*\{\s*id:\s*item\?\.id\s*\}/.test(src),
    'Design note §3: the target falls back to { id: item?.id } when the prop is absent (note surfaces unchanged)');
  assert(/useEventTags\(\s*target\b/.test(src),
    'AC-2: the read hook receives the SAME target the writes use (address for an item, id for a note)');
  assert(!/useEventTags\(\s*item\?\.id/.test(src),
    'Design note §3: the read is no longer hard-wired to item?.id');
  const applyCalls = (src.match(/applyTag\([^)]*,\s*target\)/g) || []).length;
  const disputeCalls = (src.match(/disputeTag\([^)]*,\s*target\)/g) || []).length;
  assert(applyCalls >= 3 && disputeCalls >= 1,
    `AC-1/AC-3: apply (chip / select-existing / create-new) and dispute all pass \`target\` — found apply×${applyCalls}, dispute×${disputeCalls}`);
  assert(/aria-label=\{`Tags on this \$\{subject\}`\}/.test(src) && /aria-label=\{`Add a tag to this \$\{subject\}`\}/.test(src),
    'Design note §3: the two aria-labels are parameterised by `subject` ("Tags on this note" / "Add a tag to this note" render byte-identically for the default)');
  assert(/!hasTags\s*&&\s*!viewerPubkey/.test(src) && /viewerPubkey\s*&&\s*\(/.test(src),
    'AC-4: signed-out → chips read-only, add button absent, nothing when there is nothing to show (existing branches kept)');
});

test('S3 (AC-1, AC-2): DListItemTags wraps NoteTags with target={itemTarget(item)} and subject="list item" — the single place the item-target rule applies', () => {
  const src = stripComments(safeRead(ITEM_TAGS));
  assert(src.length > 0, 'ui/src/components/dlist/DListItemTags.jsx must exist (Design note §4)');
  assert(/from\s+['"]\.\.\/NoteTags['"]/.test(src), 'Design note §4: reuses NoteTags (no forked ItemTags)');
  assert(/itemTarget/.test(src) && /from\s+['"]\.\.\/\.\.\/utils\/dlistFields['"]/.test(src),
    'Design note §4: target computed by the shared itemTarget util');
  assert(/<NoteTags\b[^>]*target=\{\s*itemTarget\(\s*item\s*\)\s*\}/.test(src),
    'AC-1: <NoteTags target={itemTarget(item)} …/> — the assertion targets the a coordinate');
  assert(/subject=["']list item["']/.test(src), 'Design note §4: subject="list item" for the aria-labels');
  assert(/showScores/.test(src), 'Design note §4: showScores passthrough (story 4 reuses the wrapper)');
  assert(!/useEventTags|useEventTagging|fetch\(|publish/.test(src),
    'Design note §4: a thin wrapper — no read/write/publish path of its own');
});

test('S4 (AC-1): List.jsx mounts DListItemTags in the story-1 renderExtra slot of the existing DListItemsTable', () => {
  const src = stripComments(safeRead(LIST_PAGE));
  assert(/import\s+DListItemTags\s+from\s+['"]\.\.\/components\/dlist\/DListItemTags['"]/.test(src),
    'Design note §4: List.jsx imports the wrapper');
  assert(/<DListItemsTable[\s\S]*?renderExtra=\{\s*\(\s*\w+\s*\)\s*=>\s*<DListItemTags\s+item=\{\s*\w+\s*\}/.test(src),
    'AC-1: renderExtra={(it) => <DListItemTags item={it} />} passed to DListItemsTable (DListItemRow renders it in .bs-dlist-extra-slot)');
  assert(!/<NoteTags\b/.test(src) && !/useEventTags/.test(src),
    'Design note §4: the page does not bypass the wrapper');
});

test('S5 (AC-5, E5, E6, E7): TagANoteModal runs parseItemRef BEFORE classifyEventInput, resolves the item via queryRelay, tags it as { address }, and keeps the note path', () => {
  const src = stripComments(safeRead(MODAL));
  assert(/parseItemRef/.test(src) && /from\s+['"]\.\.\/utils\/dlistFields['"]/.test(src),
    'AC-5: the modal imports parseItemRef from dlistFields (NOT via eventParam.js — ADR event-page/0002 precedence stays)');
  const pi = src.indexOf('parseItemRef(');
  const ci = src.indexOf('classifyEventInput(');
  assert(pi !== -1 && ci !== -1 && pi < ci,
    `AC-5: parseItemRef(input) must run before classifyEventInput(input) in submit() (found parseItemRef@${pi}, classifyEventInput@${ci})`);
  assert(/classifyEventInput/.test(src) && /resolveEventParams/.test(src) && /naddrUnsupported/.test(src),
    'AC-6 / E5: a non-hit falls through to today\'s note path (classifyEventInput → resolveEventParams, naddrUnsupported → the existing naddr copy)');
  assert(/queryRelay\s*\(/.test(src) && /kinds:\s*\[\s*39999\s*\]/.test(src) && /authors/.test(src) && /['"]#d['"]/.test(src),
    'AC-5: the item is resolved client-side with queryRelay({ kinds:[39999], authors:[pubkey], "#d":[d] }) (the List.jsx header pattern)');
  assert(/parseListRef/.test(src) && /['"]z['"]/.test(src) && /parseFieldDecls/.test(src),
    'E7: the header is resolved best-effort through the item\'s z tag + parseListRef; fieldDecls via parseFieldDecls');
  assert(/DListItemsTable/.test(src) && /DListItemTags/.test(src) && /renderExtra=/.test(src),
    'AC-5: the resolved item renders as a one-row DListItemsTable with the DListItemTags renderExtra');
  assert(/\{\s*address\b[^}]*\}/.test(src),
    'AC-5: the modal\'s own Apply/Dispute passes { address } as the target for an item hit');
  assert(/address(=|\s*[:,])/.test(src),
    'AC-5: the post-tag count read uses address= (not eventId=) for an item');
  assert(/eventId/.test(src) && /\{\s*id:\s*resolveArg\.id/.test(src),
    'AC-6: the note branch still tags { id } and reads eventId=');
  assert(/Couldn.t load that list item/.test(src),
    'E6: an item coordinate that resolves to nothing shows "Couldn’t load that list item"; nothing is published');
  assert(/naddr1… \/ 39999:…:d \(list item\)/.test(src) || /39999:…:d \(list item\)/.test(src),
    'Design note §5: placeholder gains "· naddr1… / 39999:…:d (list item)"');
  assert(/nevent1… · note1… · 64-hex id/.test(src),
    'AC-6: the existing note placeholder prefix is kept');
  assert(/invalid: 'That isn’t a recognized note\. Paste an nevent, note1, or 64-char hex id\.'/.test(src)
    && /naddr: 'That’s an addressable event \(naddr\), not a kind-1 note\.'/.test(src),
    'AC-6 / E5: REASON_COPY for notes and other-kind naddr is byte-identical');
});

test('S6 (AC-7, E12): avatarMenuLinks destinationLinks gains an in-router /lists entry (no external flag)', () => {
  const src = stripComments(safeRead(MENU_LINKS));
  const m = src.match(/\{\s*key:\s*'lists'[^}]*\}/);
  assert(m, 'AC-7: destinationLinks must carry a { key: "lists", … } entry');
  assert(/to:\s*'\/lists'/.test(m[0]), `AC-7: the entry points to "/lists", got ${m[0]}`);
  assert(/label:\s*'Lists'/.test(m[0]), 'AC-7: label "Lists"');
  assert(!/external/.test(m[0]), 'E12: /lists is a router route (App.jsx) — no external flag, so Header.jsx navigates in-router');
  const destStart = src.indexOf('export const destinationLinks');
  assert(destStart !== -1 && src.indexOf("key: 'lists'") > destStart,
    'AC-7: the entry lives in destinationLinks (rendered by all three menus), not personalLinks');
});

test('S7 (CLAUDE.md § TA pubkey): no 64-hex literal in the new/changed UI files (the ADR-0015 legacy literal lives only in the untouched write hook)', () => {
  for (const [name, p] of [['DListItemTags.jsx', ITEM_TAGS], ['dlistFields.js', UTIL], ['useEventTags.js', HOOK], ['NoteTags.jsx', NOTE_TAGS], ['List.jsx', LIST_PAGE], ['TagANoteModal.jsx', MODAL], ['avatarMenuLinks.js', MENU_LINKS]]) {
    const src = safeRead(p);
    assert(src.length > 0, `${name} must exist`);
    assert(!/[0-9a-fA-F]{64}/.test(src), `${name} must not carry a 64-hex literal`);
  }
});

/* ── R: regression sentinels (pass before and after) ───────── */

test('R1 (AC-6): NoteCard still mounts <NoteTags item={item} showScores=…/> with no target/subject — note surfaces unchanged', () => {
  const src = safeRead(NOTE_CARD);
  assert(/import\s+NoteTags\s+from\s+['"]\.\/NoteTags['"]/.test(src), 'NoteCard imports NoteTags');
  assert(/<NoteTags item=\{item\} showScores=\{showTagScores\} \/>/.test(src),
    'NoteCard.jsx:85 mount is byte-identical: <NoteTags item={item} showScores={showTagScores} />');
  assert(!/<NoteTags[^>]*(target=|subject=)/.test(src), 'NoteCard passes neither target nor subject (defaults = today\'s behaviour)');
});

test('R2 (AC-6): the key strings the five existing NoteTags sentinel suites pin are intact', () => {
  const raw = safeRead(NOTE_TAGS);
  const src = stripComments(raw);
  // event-tag-note-affordance-ui
  for (const re of [/useEventTags/, /useEventTagging/, /applyTag|disputeTag/, /TagChip/, /AddTagDialog/, /authorPubkey/, /slug/, /onSelectExisting/, /onCreateNew/, /\bname\b/, /description/, /useAuth/, /!viewerPubkey/, /\bmine\b/, /failedAt/]) {
    assert(re.test(raw), `event-tag-note-affordance-ui sentinel ${re} must still match NoteTags.jsx`);
  }
  assert(!/publishEverywhere|PUBLISH_RELAYS/.test(raw), 'NoteTags must not reach an external publish path');
  // note-tagging-raw-events-inspector-ui
  assert(/openRaw/.test(src) && /new Set\(\)/.test(src) && /openRaw\.has\(/.test(src), 'inspector U10: openRaw Set');
  const notice = src.lastIndexOf('<PovStatusNotice'); const panel = src.indexOf('bsp-note-tags-raw'); const row = src.indexOf('"bsp-note-tags-row"');
  assert(notice !== -1 && panel !== -1 && row !== -1 && notice < panel && panel < row, 'inspector U11: PovStatusNotice < raw panel < chips row');
  assert(/displayedTags\s*\.\s*filter\([^)]*openRaw\.has/.test(src), 'inspector U12: panels from displayedTags.filter(openRaw.has)');
  assert(/bsp-note-tags-raw-caption/.test(src) && /\{t\.name\}/.test(src), 'inspector U13: caption with {t.name}');
  for (const prop of ['rawOpen={', 'onToggleRaw={', 'rawNotice={']) assert(src.includes(prop), `inspector U14: ${prop} threaded to TagChip`);
  assert(/counted:\s*true/.test(src) && /counted:\s*false/.test(src) && /mineEventId/.test(src) && /\.some\(/.test(src), 'inspector U15: composition rules');
  assert(/'apply'/.test(src) && /created_at/.test(src) && /localeCompare/.test(src), 'inspector U16: total order');
  assert(/\.some\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*!\s*\1\.event\s*\)/.test(src), 'inspector U17: all-or-nothing guard');
  assert(/import\s+RawTaggingEvents/.test(raw) && /<RawTaggingEvents/.test(raw), 'inspector U5: RawTaggingEvents consumed');
  // tag-applicability-picker U6
  assert(/useTagApplicability\s*\(\s*['"]event['"]/.test(raw) && /applicableKeys=/.test(raw) && /contextsByKey=/.test(raw),
    'applicability U6: useTagApplicability("event", …) + applicableKeys/contextsByKey (a dedicated list-item context is NOT in this book)');
  // pov-resolution-status S7
  assert(/PovStatusNotice/.test(raw), 'pov-resolution-status S7: PovStatusNotice rendered');
  // profile-tag-consume-by-a-coordinate S7
  assert(/appliedTagKeys=\{/.test(raw) && !/appliedTagEventIds=\{/.test(raw), 'a-coordinate S7: appliedTagKeys prop contract');
  // the hook keeps its channels (pov-resolution-status S6, inspector server side)
  const hook = safeRead(HOOK);
  assert(/povResolution/.test(hook) && /rawEvents/.test(hook) && /\bmine\b/.test(hook), 'useEventTags still exposes povResolution / rawEvents / mine');
});

test('R3 (AC-6): eventParam.js is untouched — naddr precedence still yields naddrUnsupported and no item rule lives there', () => {
  const src = safeRead(EVENT_PARAM);
  assert(src.length > 0, 'ui/src/utils/eventParam.js present');
  assert(/return \{ mode: 'naddrUnsupported', kind: d\.data\.kind \};/.test(src), 'ADR event-page/0002: naddr → naddrUnsupported');
  assert(/const ORDER = \['nevent', 'note', 'id', 'naddr', 'pubkey', 'npub', 'nprofile'\];/.test(src), 'precedence order intact');
  assert(!/parseItemRef|39999|dlistFields/.test(src), 'Design note (rejected alternative): the item rule does NOT live in eventParam.js');
});

test('R4 (AC-1, E9, E10, E11): the write hook keeps its guards — assertSignerMatches, publishOrThrow, injected hash8, target passthrough', () => {
  const src = safeRead(WRITE_HOOK);
  assert(/assertSignerMatches\(asserterPubkey, user\?\.pubkey\)/.test(src), 'E11: signer/session mismatch throws before any publish');
  assert(/publish:\s*publishOrThrow/.test(src), 'AC-1: publishes through the guarded publishOrThrow (local strfry only during the build)');
  assert(/import \{ hash8 \} from '\.\.\/utils\/dtag'/.test(src) && /hash8,/.test(src), 'story 2: hash8 injected for the a-target d');
  assert(/const applyTag = useCallback\(async \(tagInput, target\)/.test(src) && /const disputeTag = useCallback\(\(tagInput, target\) => run\(tagInput, target, -1\)/.test(src),
    'E9: applyTag/disputeTag take (tagInput, target) — target { id } | { address } passes straight to the core');
  assert(!/publishEverywhere|PUBLISH_RELAYS/.test(src), 'local-only publish path retained');
});

test('R5: story-1 files reused unchanged — DListItemsTable/DListItemRow keep the renderExtra slot, Lists.jsx + relay.js intact, routes present', () => {
  const table = safeRead(TABLE);
  assert(/renderExtra=\{renderExtra\}/.test(table) && /\{renderExtra && <th \/>\}/.test(table), 'DListItemsTable passes renderExtra through and adds the header cell');
  const row = safeRead(ROW);
  assert(/\{renderExtra && <td className="bs-dlist-extra-slot">\{renderExtra\(item\)\}<\/td>\}/.test(row), 'DListItemRow renders renderExtra(item) in .bs-dlist-extra-slot');
  assert(!/NoteTags|DListItemTags|useEventTags/.test(table + row), 'the table/row stay ignorant of tagging (the page injects it)');
  assert(/matchesListQuery/.test(safeRead(LISTS_PAGE)) && /parseListRef/.test(safeRead(LISTS_PAGE)), 'Lists.jsx intact');
  assert(/export async function queryRelay\s*\(/.test(safeRead(RELAY_API)), 'relay.js queryRelay still exported (the modal\'s item resolve reuses it)');
  const app = safeRead(APP);
  assert(/path:\s*'\/lists'/.test(app) && /path:\s*'\/list\/:ref'/.test(app), 'AC-7 precondition: /lists and /list/:ref are router routes');
});

test('R6 (E12): Header.jsx navigates in-router unless link.external, and the existing three destinationLinks remain', () => {
  const header = safeRead(HEADER);
  assert(/destinationLinks\.map/.test(header) && /if \(link\.external\)/.test(header), 'Header.jsx branches on link.external for full-page loads only');
  const links = safeRead(MENU_LINKS);
  for (const key of ['brainstorm-landing', 'tapestry-dashboard', 'legacy-dashboard']) {
    assert(links.includes(`key: '${key}'`), `existing destination "${key}" remains`);
  }
  assert(/key: 'legacy-dashboard'[^}]*external: true/.test(links), 'legacy-dashboard keeps external: true');
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
