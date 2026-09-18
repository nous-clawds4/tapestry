/**
 * search-index-selection #1 — Tag a list header.
 *
 * "Header" and "item" are roles, not kinds. This story makes a kind-39998 DList header a
 * taggable target (the list page's header block), makes a tagged header resolve for
 * display server-side (OPEN 306), and gives tagged headers their own leading "Lists"
 * group in both Items views.
 *
 * Three classes (house pattern):
 *   U (behavioral, relay-free) — `groupItemsByList` (ui/src/utils/dlistHeaders.js) via
 *       dynamic import(); the two pure functions the server resolution loop must be
 *       refactored onto (`bucketMembersByKindAndAuthor`, `addressOf`, exported from
 *       src/api/event-tags/index.js); and the ADR dlist-item-tagging/0001 d-tag
 *       composition for a 39998 target (E7 distinctness).
 *   S (source sentinels) — the affordance on List.jsx, the headers-group render in
 *       TagItemsView + PinnedListPanel, and the server's kind-derived resolution.
 *   R (regression) — the deliberate 39999 guard in `itemCoord`, an untouched NoteTags,
 *       untouched `listCoordOf` / `toTableItem`, the existing note-card and item-row
 *       tagging call sites, and the /for-tag response keys.
 *
 * Guard suites NOT touched by this story's Phase 4: test/dlist-tagged-items.test.js,
 * test/dlist-browse.test.js, test/trusted-list-raw-view.test.js (its U12 pins
 * `groupItemsByList`'s current output for non-header rows — E8 keeps it green).
 *
 * Not covered here: the rendered pages in a browser, the relay round-trip, the affordance
 * on /lists or concept pages, headers declaring a parent concept, per-header
 * applicability, and the `worth-indexing-for-search` tag's naming.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const UI = path.join(REPO, 'ui/src');
const HEADERS_UTIL = path.join(UI, 'utils/dlistHeaders.js');
const FIELDS_UTIL = path.join(UI, 'utils/dlistFields.js');
const LIST_PAGE = path.join(UI, 'pages/List.jsx');
const TAG_ITEMS = path.join(UI, 'components/TagItemsView.jsx');
const PINNED_PANEL = path.join(UI, 'components/PinnedListPanel.jsx');
const NOTE_TAGS = path.join(UI, 'components/NoteTags.jsx');
const NOTE_CARD = path.join(UI, 'components/NoteCard.jsx');
const PROFILE_TAG = path.join(UI, 'utils/publishProfileTag.js');
const SERVER = path.join(REPO, 'src/api/event-tags/index.js');
const BUILDERS = path.join(REPO, 'src/lib/event-tagging/builders.js');

const AUTHOR = 'b'.repeat(64);
const AUTHOR_B = 'c'.repeat(64);
const ASSERTER = 'd'.repeat(64);
const TA = 'f'.repeat(64);

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
/** Never crash the suite on a missing module — report it as a failure instead. */
function safeRequire(absPath) { try { return require(absPath); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

/** The ADR dlist-item-tagging/0001 injected dep: first 8 hex of SHA-256 over the string. */
function hash8(str) { return crypto.createHash('sha256').update(String(str), 'utf8').digest('hex').slice(0, 8); }

/** A kind-39998 list header row as the /for-tag items[] array carries it. */
function headerRow(overrides = {}) {
  return {
    address: `39998:${AUTHOR}:github-accounts`,
    id: 'a'.repeat(64),
    kind: 39998,
    pubkey: AUTHOR,
    tags: [['d', 'github-accounts'], ['names', 'GitHub Account', 'GitHub Accounts']],
    listCoord: null,
    applications: 2,
    disputes: 0,
    ...overrides,
  };
}

/** A kind-39999 DList item row belonging to a parent list. */
function itemRow(d, listCoord, overrides = {}) {
  return {
    address: `39999:${AUTHOR}:${d}`,
    id: null,
    kind: 39999,
    pubkey: AUTHOR,
    tags: [['d', d], ['z', listCoord]],
    listCoord,
    applications: 1,
    disputes: 0,
    ...overrides,
  };
}

async function headersUtil() {
  const mod = await loadEsm(HEADERS_UTIL);
  assert(mod, 'ui/src/utils/dlistHeaders.js must exist and be importable as ESM');
  assert(typeof mod.groupItemsByList === 'function', 'dlistHeaders.js must export groupItemsByList()');
  return mod;
}

function serverModule() {
  const mod = safeRequire(SERVER);
  assert(mod, 'src/api/event-tags/index.js must be requirable');
  return mod;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── U: grouping (AC-6, ruling 2, E2, E5, E8) ───────────────────────────── */

test('U1 (AC-6): a tagged list header gets its own leading group, never the orphan bucket', async () => {
  const { groupItemsByList } = await headersUtil();
  const groups = groupItemsByList([headerRow()]);
  assert(groups.length === 1, `expected one group for a lone header, got ${groups.length}`);
  assert(groups[0].headers === true,
    'ruling 2: a kind-39998 row must land in a group flagged `headers: true`, not in the "Items with no list" bucket');
  assert(groups[0].listCoord === null, 'the headers group has no parent list coordinate');
  assert(groups[0].items.length === 1 && groups[0].items[0].kind === 39998,
    'the headers group carries the 39998 row itself');
});

test('U2 (AC-6, E5): the headers group comes FIRST, before every per-list group', async () => {
  const { groupItemsByList } = await headersUtil();
  const parent = `39998:${AUTHOR}:github-accounts`;
  // Header arrives LAST in the input; it must still lead the output.
  const groups = groupItemsByList([itemRow('gh-1', parent), itemRow('gh-2', parent), headerRow()]);
  assert(groups.length === 2, `expected a headers group plus one per-list group, got ${groups.length}`);
  assert(groups[0].headers === true, 'ruling 2: "Lists" first — the headers group leads');
  assert(!groups[1].headers, 'the second group is the ordinary per-list group');
  assert(groups[1].listCoord === parent, `the per-list group keeps its coordinate, got ${groups[1].listCoord}`);
  assert(groups[1].items.length === 2, 'the two items stay together under their parent list');
});

test('U3 (AC-6): several tagged headers share one headers group, in first-seen order', async () => {
  const { groupItemsByList } = await headersUtil();
  const second = headerRow({ address: `39998:${AUTHOR_B}:nostr-clients`, pubkey: AUTHOR_B, id: 'e'.repeat(64) });
  const groups = groupItemsByList([headerRow(), second]);
  const hdr = groups.find((g) => g.headers);
  assert(hdr, 'both headers must land in a headers group');
  assert(hdr.items.length === 2, `both headers belong to ONE group, got ${hdr.items.length}`);
  assert(hdr.items[0].address.endsWith('github-accounts') && hdr.items[1].address.endsWith('nostr-clients'),
    'published order survives into the headers group');
});

test('U4 (E2): a header that carries a parent `z` still groups under "Lists", not under that parent', async () => {
  const { groupItemsByList } = await headersUtil();
  const parent = `39998:${TA}:curated-dlist`;
  const withParent = headerRow({ listCoord: parent, tags: [['d', 'github-accounts'], ['z', parent]] });
  const groups = groupItemsByList([withParent]);
  assert(groups.length === 1, `the kind rule wins: one group, got ${groups.length}`);
  assert(groups[0].headers === true,
    'E2: kind 39998 beats a present listCoord — a header never renders as an item of its parent');
  assert(groups[0].listCoord === null, 'the headers group is still parentless');
});

test('U5 (E8): with no headers in the input, the output is byte-identical to the legacy grouping', async () => {
  const { groupItemsByList } = await headersUtil();
  const a = `39998:${AUTHOR}:github-accounts`;
  const rows = [itemRow('gh-1', a), itemRow('gh-2', a), itemRow('loose', null, { listCoord: null })];
  const got = groupItemsByList(rows);
  const expected = [
    { listCoord: a, items: [rows[0], rows[1]] },
    { listCoord: null, items: [rows[2]] },
  ];
  assert(JSON.stringify(got) === JSON.stringify(expected),
    `E8: existing callers must see byte-identical output — no headers group, no new keys.\n  got:      ${JSON.stringify(got)}\n  expected: ${JSON.stringify(expected)}`);
});

test('U6 (E8): an empty input still yields an empty array of groups', async () => {
  const { groupItemsByList } = await headersUtil();
  assert(JSON.stringify(groupItemsByList([])) === '[]', 'no rows ⇒ no groups');
  assert(JSON.stringify(groupItemsByList(null)) === '[]', 'a null input degrades to no groups, as today');
});

/* ── U: the server resolution contract (AC-3, OPEN 306) ─────────────────── */
/*
 * `handleForTag`'s item-resolution loop has no injectable scan seam, so the NEW
 * behaviour is specified as two pure functions the Implementer extracts and exports
 * from src/api/event-tags/index.js. They are the whole of the kind-derivation change:
 * bucket by (kind, author) instead of author, key by the event's real address.
 */

test('U7 (AC-3): bucketMembersByKindAndAuthor buckets a 39998 and a 39999 by the same author SEPARATELY', async () => {
  const { bucketMembersByKindAndAuthor } = serverModule();
  assert(typeof bucketMembersByKindAndAuthor === 'function',
    'src/api/event-tags/index.js must export bucketMembersByKindAndAuthor(members) — the (kind, author) bucketing the resolution loop scans from');
  const out = bucketMembersByKindAndAuthor([
    { address: `39999:${AUTHOR}:gh-1` },
    { address: `39998:${AUTHOR}:github-accounts` },
  ]);
  assert(out instanceof Map, 'it returns a Map keyed `${kind}|${author}`');
  assert(out.size === 2, `a 39998 and a 39999 by one author are TWO scans, got ${out.size} bucket(s)`);
  assert(out.has(`39999|${AUTHOR}`) && out.has(`39998|${AUTHOR}`),
    `keys must be \`\${kind}|\${author}\`, got ${JSON.stringify([...out.keys()])}`);
  const hdrSet = out.get(`39998|${AUTHOR}`);
  assert(hdrSet instanceof Set && hdrSet.has('github-accounts'),
    'each bucket is a Set of the d-tags to batch into one `#d` scan');
});

test('U8 (AC-3): bucketMembersByKindAndAuthor dedupes d-tags, keeps colons in `d`, and skips unusable members', async () => {
  const { bucketMembersByKindAndAuthor } = serverModule();
  assert(typeof bucketMembersByKindAndAuthor === 'function',
    'src/api/event-tags/index.js must export bucketMembersByKindAndAuthor(members)');
  const out = bucketMembersByKindAndAuthor([
    { address: `39999:${AUTHOR}:gh-1` },
    { address: `39999:${AUTHOR}:gh-1` },
    { address: `30023:${AUTHOR}:https://example.com/x:y` },
    { id: 'f'.repeat(64) },                        // an `e` target — no coordinate to scan
    { address: 'not-a-coordinate' },               // malformed
    { address: '39999:NOTHEX:gh-2' },              // non-hex author
    null,
  ]);
  assert(out.get(`39999|${AUTHOR}`).size === 1, 'a repeated coordinate is scanned once');
  assert(out.get(`30023|${AUTHOR}`).has('https://example.com/x:y'),
    'the `d` segment is everything after the second colon, verbatim (colons included)');
  assert(out.size === 2, `unusable members contribute no bucket, got ${JSON.stringify([...out.keys()])}`);
});

test('U9 (AC-3): addressOf keys a resolved event by its REAL kind, closing OPEN 306', async () => {
  const { addressOf } = serverModule();
  assert(typeof addressOf === 'function',
    'src/api/event-tags/index.js must export addressOf(event) — the `${kind}:${pubkey}:${d}` map key replacing the literal `39999:` prefix');
  const header = { kind: 39998, pubkey: AUTHOR, tags: [['d', 'github-accounts']] };
  assert(addressOf(header) === `39998:${AUTHOR}:github-accounts`,
    `a header event must key as its own coordinate, got ${JSON.stringify(addressOf(header))}`);
  const item = { kind: 39999, pubkey: AUTHOR, tags: [['d', 'gh-1']] };
  assert(addressOf(item) === `39999:${AUTHOR}:gh-1`, 'a kind-39999 item keys exactly as it does today');
  assert(addressOf({ kind: 39998, pubkey: AUTHOR, tags: [] }) === null, 'an event with no `d` has no address');
  assert(addressOf(null) === null, 'a missing event has no address');
});

/* ── U: d-tag composition for a header target (AC-2, E7) ────────────────── */

test('U10 (AC-2): tagging a header targets its COORDINATE — an `a` tag, never an event id', async () => {
  const { buildEventTaggingAssertion } = safeRequire(BUILDERS) || {};
  assert(typeof buildEventTaggingAssertion === 'function', 'src/lib/event-tagging/builders.js must export buildEventTaggingAssertion');
  const ev = buildEventTaggingAssertion({
    headerAuthorPubkey: TA, slug: 'worth-indexing-for-search',
    target: { address: `39998:${AUTHOR}:github-accounts` },
    polarity: 1, asserterPubkey: ASSERTER, taPubkeys: [TA], hash8,
  });
  const a = ev.tags.find((t) => t[0] === 'a');
  assert(a && a[1] === `39998:${AUTHOR}:github-accounts`,
    `AC-2: the assertion must carry ['a', '39998:<author>:<d>'], got ${JSON.stringify(ev.tags)}`);
  assert(!ev.tags.some((t) => t[0] === 'e'),
    'AC-2: no `e` tag — a header edit replaces the event and must not orphan the tagging');
});

test('U11 (E7): a header and an item whose `d` shares the first 16 chars get DIFFERENT d-tags', async () => {
  const { buildEventTaggingAssertion } = safeRequire(BUILDERS) || {};
  assert(typeof buildEventTaggingAssertion === 'function', 'src/lib/event-tagging/builders.js must export buildEventTaggingAssertion');
  // Same author, same asserter, same tag; `d` segments agreeing on their first 16 chars,
  // so only the hash8-over-the-full-coordinate segment can distinguish them (ADR
  // dlist-item-tagging/0001). hash8 here is the real SHA-256 closure the ADR specifies —
  // a constant stub would make this assertion vacuous.
  const base = {
    headerAuthorPubkey: TA, slug: 'worth-indexing-for-search',
    polarity: 1, asserterPubkey: ASSERTER, taPubkeys: [TA], hash8,
  };
  const dOf = (address) => buildEventTaggingAssertion({ ...base, target: { address } }).tags.find((t) => t[0] === 'd')[1];
  const headerD = dOf(`39998:${AUTHOR}:github-accounts-aaa`);
  const itemD = dOf(`39999:${AUTHOR}:github-accounts-bbb`);
  assert(headerD.slice(0, 16) !== undefined && itemD, 'both must compose a d-tag');
  assert(headerD !== itemD,
    `E7: the hash is over the FULL coordinate, so a 39998 and a 39999 sharing d16 must not collide.\n  header: ${headerD}\n  item:   ${itemD}`);
  assert(dOf(`39998:${AUTHOR}:github-accounts-aaa`) === headerD,
    'and the composition stays deterministic — republishing replaces the same address');
});

/* ── S: the affordance and the render (AC-1..AC-4, E3, E4, E5) ──────────── */

test('S1 (AC-1, AC-2): the list page header block mounts NoteTags targeting the header coordinate', async () => {
  const src = stripComments(read(LIST_PAGE));
  assert(src.includes('<NoteTags'), 'AC-1: List.jsx must mount <NoteTags …> on the header block');
  assert(/target=\{\{\s*address:\s*headerCoord\(header\)\s*\}\}/.test(src),
    'AC-2 / ruling 3: the CALLER passes target={{ address: headerCoord(header) }} — itemCoord stays untouched');
  assert(/import\s*\{[^}]*headerCoord[^}]*\}\s*from\s*'\.\.\/utils\/dlistFields'/.test(src),
    'headerCoord comes from the existing dlistFields util');
});

test('S2 (AC-1): the header affordance declares subject="list", distinguishing it from an item or a note', async () => {
  const src = stripComments(read(LIST_PAGE));
  const mount = /<NoteTags[\s\S]{0,260}?\/>/g;
  const headerMount = (src.match(mount) || []).find((m) => m.includes('headerCoord(header)'));
  assert(headerMount, 'AC-1: no <NoteTags … headerCoord(header) …> mount found in List.jsx');
  assert(/subject="list"/.test(headerMount),
    `AC-1: the header mount must carry subject="list", got: ${headerMount}`);
});

test('S3 (AC-3, E5): the tag page Items view branches on the headers group', async () => {
  const src = stripComments(read(TAG_ITEMS));
  assert(/group\.headers/.test(src),
    'AC-3: TagItemsView must branch on group.headers to render the "Lists" group differently');
});

test('S4 (AC-3): the tag page renders a tagged header as a link CARD (name + /list/ link), not a table row', async () => {
  const src = stripComments(read(TAG_ITEMS));
  const branch = src.slice(src.indexOf('group.headers'));
  assert(src.includes('headerNames'), 'AC-3: the card names the list via headerNames, not a bare coordinate');
  assert(/\/list\//.test(branch), 'the card links to /list/<coord> so the header stays reachable');
  assert(/group\.headers\s*\?[\s\S]{0,900}?:/.test(src) || /if\s*\(group\.headers\)/.test(src),
    'the headers group must take its own render branch');
  assert(!/group\.headers[\s\S]{0,400}?<DListItemsTable/.test(src),
    'a header has no item fields to tabulate — the headers branch must NOT render DListItemsTable');
});

test('S5 (E3): a tagged header that is not on this relay still renders, with a legible notice', async () => {
  const src = stripComments(read(TAG_ITEMS));
  assert(/not on this relay/.test(src), 'E3: the unresolved-header case keeps its "list not on this relay" notice');
  const branch = src.slice(src.indexOf('group.headers'));
  assert(/not on this relay/.test(branch),
    'E3: the notice must be reachable from the headers branch — an unresolved header shows its coordinate and a working link, not a blank card');
});

test('S6 (E4, AC-3): the Pinned tab Items leaf renders the headers group the same way', async () => {
  const src = stripComments(read(PINNED_PANEL));
  assert(/group\.headers/.test(src),
    'E4: PinnedListPanel must branch on group.headers — parity with the tag page for a 30394 whose member is a header coordinate');
  assert(/group\.headers[\s\S]{0,900}?\/list\//.test(src), 'the pinned header card links to /list/<coord>');
  assert(src.includes('headerNames'), 'the pinned header card names the list via headerNames');
  assert(!/group\.headers[\s\S]{0,400}?<DListItemsTable/.test(src),
    'the pinned headers branch must not route headers through DListItemsTable');
});

test('S7 (AC-3): the server resolution loop derives the kind from the coordinate instead of assuming 39999', async () => {
  const src = stripComments(read(SERVER));
  const loop = src.slice(src.indexOf('itemEventByAddress'), src.indexOf('const items = itemMembers.map'));
  assert(loop, 'the /for-tag item-resolution loop must still exist');
  assert(!/kinds:\s*\[39999\]/.test(loop),
    'AC-3 / OPEN 306: the item-resolution scan must use the coordinate\'s own kind, not a literal kinds: [39999]');
  assert(!/39999:\$\{ev\.pubkey\}/.test(loop),
    'AC-3: the map key must be the event\'s real ${kind}:${pubkey}:${d}, not a literal 39999: prefix');
  assert(/bucketMembersByKindAndAuthor/.test(src) && /addressOf/.test(src),
    'the loop must be expressed through the two extracted pure functions this plan pins');
});

test('S8 (E2, server): the server-side listCoordOf returns null for a kind-39998 header', async () => {
  const src = stripComments(read(SERVER));
  const fn = src.slice(src.indexOf('const listCoordOf'), src.indexOf('const items = itemMembers.map'));
  assert(fn, 'handleForTag must still define listCoordOf');
  assert(/kind\s*===\s*39998/.test(fn),
    'E2: listCoordOf must short-circuit kind 39998 to null — a header has no parent list, so it can never be grouped under one');
});

test('S9 (AC-4): a header tagging goes through the same NoteTags stance machinery as an item tagging', async () => {
  const noteTags = stripComments(read(NOTE_TAGS));
  assert(/applyTag/.test(noteTags) && /disputeTag/.test(noteTags),
    'AC-4: apply/dispute parity comes from NoteTags itself');
  const list = stripComments(read(LIST_PAGE));
  assert(/<NoteTags[\s\S]{0,260}?headerCoord\(header\)/.test(list),
    'AC-4: the header uses the SAME component, so "mine", retract and dispute arrive with no new code');
});

/* ── R: regression sentinels (AC-5, ruling 3) ───────────────────────────── */

test('R1 (AC-5, ruling 3): itemCoord keeps its deliberate 39999 guard and its carried-address short-circuit', async () => {
  const mod = await loadEsm(FIELDS_UTIL);
  assert(mod && typeof mod.itemCoord === 'function', 'dlistFields.js must still export itemCoord()');
  const carried = mod.itemCoord({ address: `39998:${AUTHOR}:github-accounts`, kind: 39998, pubkey: AUTHOR });
  assert(carried === `39998:${AUTHOR}:github-accounts`,
    'an already-carried address is returned verbatim — the branch that already serves this story\'s case');
  const derived = mod.itemCoord({ kind: 39998, pubkey: AUTHOR, tags: [['d', 'github-accounts']] });
  assert(derived === null,
    'ruling 3: re-derivation for a non-39999 kind still returns null — itemCoord must be byte-identical after this story');
  assert(mod.itemCoord({ kind: 39999, pubkey: AUTHOR, tags: [['d', 'gh-1']] }) === `39999:${AUTHOR}:gh-1`,
    'and the 39999 derivation is unchanged');
  const src = stripComments(read(FIELDS_UTIL));
  assert(/item\?\.kind\s*!==\s*39999/.test(src), 'the literal `kind !== 39999` guard must remain in the source');
});

test('R2 (AC-5): NoteTags.jsx is untouched — same signature, same event-context applicability', async () => {
  const src = read(NOTE_TAGS);
  assert(src.includes("export default function NoteTags({ item, showScores = false, target: targetProp, subject = 'note' }) {"),
    'AC-5: the NoteTags signature line must be unchanged — the story adds a call site, not a component change');
  assert(/useTagApplicability\('event'/.test(src),
    'ruling 4: applicability stays agnostic — a header gets the same event-context tag list, with no new entry');
});

test('R3 (AC-5): listCoordOf in dlistHeaders.js is unchanged (39999 → z, otherwise e, first tag wins)', async () => {
  const { listCoordOf } = await headersUtil();
  assert(typeof listCoordOf === 'function', 'dlistHeaders.js must still export listCoordOf()');
  const parent = `39998:${AUTHOR}:github-accounts`;
  assert(listCoordOf({ kind: 39999, tags: [['z', parent], ['z', 'other']] }) === parent,
    'a kind-39999 item still belongs to the FIRST z');
  assert(listCoordOf({ kind: 9999, tags: [['e', 'a'.repeat(64)]] }) === 'a'.repeat(64),
    'a kind-9999 item still belongs via its e tag');
  assert(listCoordOf(null) === null, 'and a missing event still has no parent');
});

test('R4 (AC-5): toTableItem is unchanged — a display `d` is synthesized for kind-39999 rows alone', async () => {
  const { toTableItem } = await headersUtil();
  assert(typeof toTableItem === 'function', 'dlistHeaders.js must still export toTableItem()');
  const row = toTableItem({ kind: 39999, address: `39999:${AUTHOR}:gh-1`, tags: [] });
  assert(row.tags[0][0] === 'd' && row.tags[0][1] === 'gh-1', 'the 39999 display fallback still fires');
  const hdr = toTableItem({ kind: 39998, address: `39998:${AUTHOR}:github-accounts`, tags: [] });
  assert(hdr.tags.length === 0, 'a 39998 gets no synthesized `d` — it never reaches the table');
});

test('R5 (AC-5): the note-card and DList item-row tagging call sites are untouched', async () => {
  assert(read(NOTE_CARD).includes('<NoteTags item={item} showScores={showTagScores} />'),
    'AC-5: note tagging keeps its exact call site');
  assert(read(path.join(UI, 'components/dlist/DListItemTags.jsx'))
    .includes('<NoteTags item={item} target={itemTarget(item)} subject="list item" showScores={showScores} />'),
    'AC-5: item tagging keeps its exact target and subject');
  assert(/renderExtra=\{\(it\) => <DListItemTags item=\{it\} \/>\}/.test(read(LIST_PAGE)),
    'AC-5: the list page item rows keep their per-item tagging affordance');
});

test('R6 (AC-5): profile tagging composes its d-tag exactly as before', async () => {
  const src = stripComments(read(PROFILE_TAG));
  assert(/profile-tag-/.test(src), 'AC-5: profile tagging is out of this story\'s blast radius entirely');
});

test('R7 (AC-5): the /for-tag response keys are unchanged', async () => {
  const src = stripComments(read(SERVER));
  const body = (src.match(/const body = \{ success: true[\s\S]{0,400}?\};/) || [])[0];
  assert(body, 'the /for-tag response body literal must still be findable');
  for (const key of ['items', 'itemTotal', 'itemTruncated', 'notes', 'members', 'mine', 'total', 'truncated']) {
    assert(new RegExp(`\\b${key}\\b`).test(body), `AC-5: /for-tag must still return \`${key}\` — the response shape does not change`);
  }
});

let passed = 0;
let failed = 0;
const failures = [];

async function run() {
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') continue;
      passed++;
      console.log(`  ✓ ${t.name}`);
    } catch (err) {
      failed++;
      failures.push({ name: t.name, error: err.message });
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
    }
  }
  console.log(`tag-a-list-header: ${passed} passed, ${failed} failed`);
  return { pass: passed, fail: failed, skipped: 0, failures };
}

module.exports = { run };
