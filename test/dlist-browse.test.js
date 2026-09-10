/**
 * dlist-item-tagging #1: Browse a DList with header-driven item fields.
 *
 * Story (Light profile — Design note + edge cases + AC→handle lines all live in the story file):
 *   engineering-team/stories/dlist-item-tagging/1-browse-a-dlist-with-header-driven-fields.md
 *
 * Three classes (house pattern — see test/tl-treasure-map-panel.test.js):
 *   U (behavioral) — ui/src/utils/dlistFields.js dynamically imported and exercised against
 *                    inline fixture events that mirror the live `github-accounts` shape. FAIL
 *                    now: the util does not exist yet (missing module counts as fail, not skip).
 *   S (structure)  — the table/row components, the two pages, the two routes and the styles
 *                    exist as source text and carry the Design-note contract. FAIL now.
 *   R (sentinel)   — what the Design note promised not to disturb (the operator browser and
 *                    its siblings, the relay API contract, the existing user routes). PASS
 *                    before and after; they fail only on collateral damage.
 *
 * No stack dependency: nothing here talks to strfry, Neo4j, or the control panel.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { nip19 } = require('nostr-tools');

const UI = path.resolve(__dirname, '../ui/src');
const UTIL = path.join(UI, 'utils/dlistFields.js');
const TABLE = path.join(UI, 'components/dlist/DListItemsTable.jsx');
const ROW = path.join(UI, 'components/dlist/DListItemRow.jsx');
const LISTS_PAGE = path.join(UI, 'pages/Lists.jsx');
const LIST_PAGE = path.join(UI, 'pages/List.jsx');
const APP = path.join(UI, 'App.jsx');
const STYLES = path.join(UI, 'styles.css');
const RELAY_API = path.join(UI, 'api/relay.js');
// Operator-side files the Design note leaves byte-identical.
const OP_ITEMS = path.join(UI, 'pages/lists/DListItems.jsx');
const OP_DETAIL = path.join(UI, 'pages/lists/DListDetail.jsx');
const OP_INDEX = path.join(UI, 'pages/lists/Index.jsx');
const OP_NEW_ITEM = path.join(UI, 'pages/lists/NewDListItem.jsx');

/* ── Fixtures: mirror the live github-accounts header + items (relay probes 2026-09-09) ── */

// The header author on local strfry. Not the TA; a plain list-author pubkey.
const HEADER_PK = 'b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450';
const ITEM_PK_A = '1111111111111111111111111111111111111111111111111111111111111111';
const ITEM_PK_B = '2222222222222222222222222222222222222222222222222222222222222222';
const HEADER_COORD = `39998:${HEADER_PK}:github-accounts`;

function header(extraTags = [], overrides = {}) {
  return {
    id: 'a'.repeat(64),
    kind: 39998,
    pubkey: HEADER_PK,
    created_at: 1757000000,
    content: '',
    tags: [
      ['d', 'github-accounts'],
      ['names', 'GitHub Account', 'GitHub Accounts'],
      ['description', 'GitHub accounts of nostr developers'],
      ['required', 'github-username'],
      ['field-type', 'github-username', 'text'],
      ...extraTags,
    ],
    ...overrides,
  };
}

function item(username, pubkey = ITEM_PK_A, extraTags = [], overrides = {}) {
  return {
    id: 'b'.repeat(64),
    kind: 39999,
    pubkey,
    created_at: 1757000100,
    content: '',
    tags: [
      ['d', `gh-${username}`],
      ['z', HEADER_COORD],
      ...(username == null ? [] : [['github-username', username]]),
      ['description', 'Vinney Cavallo'],
      ...extraTags,
    ],
    ...overrides,
  };
}

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function util() {
  const mod = await loadEsm(UTIL);
  assert(mod, 'ui/src/utils/dlistFields.js must exist and be importable as ESM (Design note)');
  for (const fn of ['parseListRef', 'headerCoord', 'headerNames', 'parseFieldDecls', 'fieldCellModel', 'httpUrl', 'undeclaredFields', 'matchesListQuery', 'reactionPolarity']) {
    assert(typeof mod[fn] === 'function', `dlistFields.js must export ${fn}() (Design note)`);
  }
  return mod;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── U: dlistFields behavior ───────────────────────────────── */

test('U1: parseListRef resolves 39998/9998 coordinates, 64-hex ids and naddr; malformed → null', async () => {
  const { parseListRef } = await util();
  const a = parseListRef(HEADER_COORD);
  assert(a && a.kind === 39998 && a.pubkey === HEADER_PK && a.d === 'github-accounts',
    `AC-1: "${HEADER_COORD}" must parse to {kind:39998,pubkey,d}, got ${JSON.stringify(a)}`);
  assert(a.coord === HEADER_COORD, 'AC-1: coord is echoed back for the #z filter');
  const colon = parseListRef(`39998:${HEADER_PK}:with:colons`);
  assert(colon && colon.d === 'with:colons', 'AC-1: a d-tag containing colons survives (DListDetail pattern)');
  const nine = parseListRef(`9998:${HEADER_PK}:x`);
  assert(nine && nine.kind === 9998, 'E7: 9998:<pk>:<d> resolves as a kind-9998 coordinate');
  const id = parseListRef('c'.repeat(64));
  assert(id && id.id === 'c'.repeat(64), 'E7: a 64-hex event id resolves to { id }');
  const naddr = nip19.naddrEncode({ kind: 39998, pubkey: HEADER_PK, identifier: 'github-accounts' });
  const n = parseListRef(naddr);
  assert(n && n.kind === 39998 && n.pubkey === HEADER_PK && n.d === 'github-accounts' && n.coord === HEADER_COORD,
    `E7: naddr1… resolves via nip19.decode to the same coordinate, got ${JSON.stringify(n)}`);
  for (const bad of ['39998:abc', '', null, undefined, 'naddr1notvalid', '12345:zz', `40000:${HEADER_PK}:d`, 'nprofile1abc']) {
    assert(parseListRef(bad) === null, `E7: parseListRef(${JSON.stringify(bad)}) must be null, never throw`);
  }
});

test('U2: headerCoord composes kind:pubkey:d for 39998 headers and falls back to id for 9998', async () => {
  const { headerCoord } = await util();
  assert(headerCoord(header()) === HEADER_COORD, 'AC-2: #z membership key is the header coordinate');
  const h9998 = header([], { kind: 9998 });
  assert(headerCoord(h9998) === h9998.id, 'E7: a kind-9998 header is referenced by event id');
});

test('U3: headerNames reads names/description; plural falls back to singular; then name, then d', async () => {
  const { headerNames } = await util();
  const full = headerNames(header());
  assert(full.singular === 'GitHub Account' && full.plural === 'GitHub Accounts',
    `AC-1: singular/plural from the names tag, got ${JSON.stringify(full)}`);
  assert(full.description === 'GitHub accounts of nostr developers', 'AC-1: description read from the description tag');
  const singularOnly = headerNames(header([], { tags: [['d', 'x'], ['names', 'Thing']] }));
  assert(singularOnly.singular === 'Thing' && singularOnly.plural === 'Thing', 'E5: plural = singular when names has one element');
  const nameOnly = headerNames(header([], { tags: [['d', 'x'], ['name', 'Legacy Name']] }));
  assert(nameOnly.singular === 'Legacy Name', 'E5: no names → name tag');
  const dOnly = headerNames(header([], { tags: [['d', 'just-a-d']] }));
  assert(dOnly.singular === 'just-a-d' && dOnly.plural === 'just-a-d', 'E5: no names/name → d tag, never "(unnamed)"');
  assert(dOnly.description === null || dOnly.description === '' || dOnly.description === undefined,
    'AC-1: absent description is empty/null, not a placeholder string');
});

test('U4: parseFieldDecls orders required → recommended → optional (header order within group), allowed counts as optional, type from field-type defaulting to text', async () => {
  const { parseFieldDecls } = await util();
  const h = header([
    ['optional', 'website'],
    ['recommended', 'nickname'],
    ['required', 'p'],
    ['allowed', 'avatar-url'],
    ['field-type', 'website', 'url'],
    ['optional', 'bio', 'A short self-description'],
  ]);
  const decls = parseFieldDecls(h);
  const names = decls.map(d => d.name);
  assert(JSON.stringify(names) === JSON.stringify(['github-username', 'p', 'nickname', 'website', 'avatar-url', 'bio']),
    `AC-3: columns are required→recommended→optional in header order, got ${JSON.stringify(names)}`);
  const by = Object.fromEntries(decls.map(d => [d.name, d]));
  assert(by.bio.description === 'A short self-description',
    'N-1 (NIP line 35): the optional third element of a declaration tag is the field description');
  assert(by['github-username'].description === null, 'N-1: no third element → description null');
  assert(by['github-username'].requirement === 'required' && by.p.requirement === 'required', 'AC-3: required fields carry requirement=required');
  assert(by.nickname.requirement === 'recommended', 'AC-3: recommended fields carry requirement=recommended');
  assert(by.website.requirement === 'optional' && by.bio.requirement === 'optional', 'AC-3: optional fields carry requirement=optional');
  assert(by['avatar-url'].requirement === 'optional', 'Design note: `allowed` counts as optional per the DCoSL spec');
  assert(by['github-username'].type === 'text', 'AC-4: type read from ["field-type", name, type]');
  assert(by.website.type === 'url', 'AC-4: field-type applies to the matching declared name');
  assert(by.p.type === 'text' && by.nickname.type === 'text', 'AC-4: no field-type → type defaults to text');
});

test('U5 (E1, not derivable): a field-type for an undeclared name adds no column', async () => {
  const { parseFieldDecls } = await util();
  const decls = parseFieldDecls(header([['field-type', 'avatar', 'url']]));
  assert(decls.length === 1 && decls[0].name === 'github-username',
    `E1: ["field-type","avatar","url"] must not invent a column, got ${JSON.stringify(decls.map(d => d.name))}`);
});

test('U6 (E2, not derivable): a name declared at two levels yields one column and required wins', async () => {
  const { parseFieldDecls } = await util();
  const decls = parseFieldDecls(header([['optional', 'github-username'], ['recommended', 'github-username']]));
  const hits = decls.filter(d => d.name === 'github-username');
  assert(hits.length === 1, `E2: exactly one column for a twice-declared name, got ${hits.length}`);
  assert(hits[0].requirement === 'required', 'E2: required wins over optional/recommended');
  // Order is preserved even when the lower-level declaration comes first in the header.
  const declsRev = parseFieldDecls(header([], { tags: [['d', 'x'], ['optional', 'a'], ['required', 'a'], ['required', 'b']] }));
  assert(JSON.stringify(declsRev.map(d => `${d.name}:${d.requirement}`)) === JSON.stringify(['a:required', 'b:required']),
    `E2: optional-then-required collapses to one required column in required order, got ${JSON.stringify(declsRev)}`);
});

test('U7: fieldCellModel — value from the first top-level tag, missing only for required, text-typed github-username has no href', async () => {
  const { parseFieldDecls, fieldCellModel } = await util();
  const decls = parseFieldDecls(header([['optional', 'website']]));
  const gh = decls.find(d => d.name === 'github-username');
  const web = decls.find(d => d.name === 'website');
  const ok = fieldCellModel(item('vcavallo'), gh);
  assert(ok.value === 'vcavallo', `AC-3: value read from ["github-username","vcavallo"], got ${JSON.stringify(ok)}`);
  assert(ok.missing === false, 'AC-3: present required field is not missing');
  assert(ok.extra === 0, 'E3: single tag → extra = 0');
  assert(ok.href === null, 'AC-4 (Gate B): the github-accounts header says field-type text, so the username is plain text — no link');
  const gone = fieldCellModel(item(null), gh);
  assert(gone.missing === true, 'AC-3: an item lacking a required field is flagged missing, not blank');
  assert(gone.value == null && gone.href == null, 'AC-3: missing cell has no value and no href');
  const optGone = fieldCellModel(item('vcavallo'), web);
  assert(optGone.missing === false && optGone.value == null,
    'AC-3: an absent optional field is empty but NOT marked missing');
  const empty = fieldCellModel(item(''), gh);
  assert(empty.href === null, 'E4: empty string value → no link');
});

test('U8 (E3, not derivable): two same-name tags → first value is the cell with extra = 1, one row', async () => {
  const { parseFieldDecls, fieldCellModel } = await util();
  const gh = parseFieldDecls(header()).find(d => d.name === 'github-username');
  const cell = fieldCellModel(item('vcavallo', ITEM_PK_A, [['github-username', 'second']]), gh);
  assert(cell.value === 'vcavallo', `E3: first same-name tag is the cell value, got ${cell.value}`);
  assert(cell.extra === 1, `E3: further same-name tags are counted as extra (+1 more), got ${cell.extra}`);
  assert(cell.href === null, 'E3: no href for a text-typed field');
});

test('U9 (E4): httpUrl accepts only values that parse as http(s) URLs', async () => {
  const { httpUrl } = await util();
  assert(httpUrl('https://github.com/vcavallo') === 'https://github.com/vcavallo', 'AC-4: https URL accepted verbatim');
  assert(httpUrl('http://example.org/a?b=c') === 'http://example.org/a?b=c', 'AC-4: http URL accepted');
  assert(httpUrl('  https://example.org  ') === 'https://example.org', 'E4: surrounding whitespace trimmed');
  for (const bad of ['vcavallo', 'github.com/vcavallo', 'ftp://example.org', 'javascript:alert(1)', 'mailto:a@b.c', '', ' ', null, undefined, 42]) {
    assert(httpUrl(bad) === null, `E4: httpUrl(${JSON.stringify(bad)}) must be null (plain text, no link)`);
  }
});

test('U10 (AC-4): rendering is driven by field-type alone — text/unknown/absent → text; url → link only when the value is an http(s) URL', async () => {
  const { parseFieldDecls, fieldCellModel } = await util();
  const h = header([
    ['optional', 'website'], ['field-type', 'website', 'url'],
    ['optional', 'weird'], ['field-type', 'weird', 'hologram'],
    ['optional', 'plain'],
    ['optional', 'gh'], ['field-type', 'gh', 'github-username'],
  ]);
  const decls = parseFieldDecls(h);
  const by = Object.fromEntries(decls.map(d => [d.name, d]));
  assert(by.weird.type === 'hologram', 'AC-4: unknown type is carried through unchanged');
  const it = item('vcavallo', ITEM_PK_A, [
    ['website', 'https://vinneycavallo.com'], ['weird', 'zzz'], ['plain', 'ppp'], ['gh', 'octocat'],
  ]);
  const weird = fieldCellModel(it, by.weird);
  assert(weird.value === 'zzz' && weird.href === null, 'AC-4: unknown field-type renders as text (no href)');
  const plain = fieldCellModel(it, by.plain);
  assert(plain.value === 'ppp' && plain.href === null, 'AC-4: absent field-type renders as text');
  const site = fieldCellModel(it, by.website);
  assert(site.href === 'https://vinneycavallo.com', `AC-4: url field-type with an http(s) value links, got ${JSON.stringify(site)}`);
  const notUrl = fieldCellModel(item('vcavallo', ITEM_PK_A, [['website', 'vinneycavallo.com']]), by.website);
  assert(notUrl.value === 'vinneycavallo.com' && notUrl.href === null, 'AC-4: url field-type with a non-URL value degrades to text');
  const gh = fieldCellModel(it, by.gh);
  assert(gh.value === 'octocat' && gh.href === null,
    'AC-4 (Gate B): no name- or alias-based rules — a github-username type is just an unknown type → text');
  const named = fieldCellModel(it, { name: 'github-username', requirement: 'required', type: 'text' });
  assert(named.href === null, 'AC-4 (Gate B): the field NAME github-username carries no link rule either');
});

test('U13 (AC-9): undeclaredFields lists item tags the header did not declare, skipping 1-char tags and declared columns', async () => {
  const { parseFieldDecls, undeclaredFields } = await util();
  const decls = parseFieldDecls(header([['optional', 'website']]));
  const it = item('vcavallo', ITEM_PK_A, [
    ['website', 'https://x.example'], ['comments', 'first'], ['a', '39998:x:y'], ['t', 'topic'], ['comments', 'second'], ['q'], ['nickname', ''],
  ]);
  const fields = undeclaredFields(it, decls);
  assert(Array.isArray(fields), 'AC-9: returns an array');
  const names = fields.map(f => f.name);
  assert(!names.some(n => n.length === 1), `AC-9: single-letter tags (d, z, e, p, a, t, q…) are excluded, got ${JSON.stringify(names)}`);
  assert(!names.includes('github-username') && !names.includes('website'), 'AC-9: declared columns are not repeated in the other-fields cell');
  assert(names.includes('description'), 'AC-9 / N-5: the NIP-level optional item tag `description` is simply an undeclared field and appears here');
  assert(JSON.stringify(fields.find(f => f.name === 'description')) === JSON.stringify({ name: 'description', value: 'Vinney Cavallo' }),
    'AC-9: entries are { name, value }');
  const comments = fields.filter(f => f.name === 'comments').map(f => f.value);
  assert(JSON.stringify(comments) === JSON.stringify(['first', 'second']), `E11: repeated undeclared names keep every value in tag order, got ${JSON.stringify(comments)}`);
  assert(!names.includes('nickname'), 'AC-9: a tag with an empty value is not listed');
  const bare = undeclaredFields(item('vcavallo', ITEM_PK_A, [], { tags: [['d', 'x'], ['z', HEADER_COORD], ['github-username', 'vcavallo']] }), decls);
  assert(bare.length === 0, `E10: an item with no undeclared tags yields [] (no toggle), got ${JSON.stringify(bare)}`);
  for (const bad of [{}, { tags: null }, { tags: [[], [null], ['x']] }]) {
    assert(Array.isArray(undeclaredFields(bad, decls)) && undeclaredFields(bad, decls).length === 0, `E7: undeclaredFields(${JSON.stringify(bad)}) → [] never throws`);
  }
});

test('U14 (AC-10): matchesListQuery — case-insensitive substring over singular, plural and description; empty query matches all', async () => {
  const { matchesListQuery } = await util();
  const h = header();
  assert(matchesListQuery(h, '') === true && matchesListQuery(h, '   ') === true && matchesListQuery(h, null) === true && matchesListQuery(h, undefined) === true,
    'AC-10: an empty/blank/absent query matches every header (clearing the input restores the full index)');
  assert(matchesListQuery(h, 'github') === true, 'AC-10: matches the singular name, case-insensitively');
  assert(matchesListQuery(h, 'ACCOUNTS') === true, 'AC-10: matches the plural name, case-insensitively');
  assert(matchesListQuery(h, 'nostr dev') === true, 'AC-10: matches the description');
  assert(matchesListQuery(h, 'hub acc') === true, 'AC-10: plain substring, not word-anchored');
  assert(matchesListQuery(h, 'bitcoin') === false, 'AC-10: no hit → false');
  assert(matchesListQuery(header([], { tags: [['d', 'just-a-d']] }), 'just-a') === true, 'AC-10: falls through headerNames (d-tag fallback) when names is absent');
  assert(matchesListQuery(header([], { tags: [['d', 'x'], ['names', 'Thing']] }), 'nostr') === false, 'AC-10: a header without a description does not throw and does not match');
  for (const bad of [{}, { tags: null }, null]) {
    assert(matchesListQuery(bad, 'x') === false && matchesListQuery(bad, '') === true, `E7: matchesListQuery(${JSON.stringify(bad)}) never throws`);
  }
});

test('U11 (AC-8): reactionPolarity mirrors the operator page\'s +/-/emoji rules and is null-safe', async () => {
  const { reactionPolarity } = await util();
  assert(reactionPolarity('+') === 1 && reactionPolarity(' + ') === 1, 'AC-8: "+" is an upvote (trimmed)');
  assert(reactionPolarity('👍') === 1 && reactionPolarity('🤙') === 1, 'AC-8: 👍 / 🤙 are upvotes (DListItems.jsx:32-35)');
  assert(reactionPolarity('-') === -1 && reactionPolarity('👎') === -1, 'AC-8: "-" / 👎 are downvotes (DListItems.jsx:37-40)');
  for (const neutral of ['', 'hello', '++', '❤️', null, undefined]) {
    assert(reactionPolarity(neutral) === 0, `AC-8: reactionPolarity(${JSON.stringify(neutral)}) is 0`);
  }
});

test('U12: malformed headers/items never throw — no tags, non-array tags, short tags', async () => {
  const { headerNames, parseFieldDecls, fieldCellModel, headerCoord } = await util();
  const decl = { name: 'github-username', requirement: 'required', type: 'text' };
  for (const bad of [{}, { tags: null }, { tags: 'nope' }, { kind: 39998, pubkey: HEADER_PK, tags: [['required'], ['names'], ['field-type', 'x'], [], [null]] }]) {
    const names = headerNames(bad);
    assert(names && typeof names === 'object', `E7: headerNames(${JSON.stringify(bad)}) returns an object`);
    const decls = parseFieldDecls(bad);
    assert(Array.isArray(decls), `E7: parseFieldDecls(${JSON.stringify(bad)}) returns an array`);
    assert(decls.every(d => typeof d.name === 'string' && d.name.length > 0), 'E7: a bare ["required"] tag declares no nameless column');
    const cell = fieldCellModel(bad, decl);
    assert(cell && cell.missing === true, `E7: fieldCellModel on a tagless item marks the required field missing`);
    assert(typeof headerCoord(bad) === 'string' || headerCoord(bad) === null, 'E7: headerCoord degrades to null/string, never throws');
  }
});

/* ── S: components, pages, routes, styles ─────────────────── */

test('S1: DListItemsTable exists, builds its thead from fieldDecls, marks required headers, and exposes the renderExtra slot', () => {
  const src = safeRead(TABLE);
  assert(src.length > 0, 'ui/src/components/dlist/DListItemsTable.jsx must exist (Design note)');
  assert(/fieldDecls/.test(src) && /<thead/.test(src), 'AC-3: thead is generated from the fieldDecls prop');
  assert(/is-required/.test(src) && /\*/.test(src), 'AC-3: required column headers carry class is-required and a *');
  assert(/renderExtra/.test(src), 'Design note: trailing renderExtra(item) slot for stories 2–3');
  assert(/DListItemRow/.test(src) && /from\s+'\.\/DListItemRow'/.test(src), 'Design note: one DListItemRow per item from the same folder');
  assert(/profiles/.test(src) && /voteCounts/.test(src), 'Design note: profiles and voteCounts are props, not fetched here');
  assert(!/queryRelay|fetch\(|useNavigate|useParams/.test(src), 'Design note: the table knows nothing about routes or fetching');
  assert(/title=\{[^}]*decl\.description/.test(src), 'N-1: the <th title> carries the declaration\'s description (NIP line 35)');
  assert(/[Oo]ther fields/.test(src), 'AC-9: a trailing "Other fields" column header follows the declared columns');
});

test('S2: DListItemRow renders author (Avatar + /user link), age, missing mark, external link, "+N more", and a read-only vote cell', () => {
  const src = safeRead(ROW);
  assert(src.length > 0, 'ui/src/components/dlist/DListItemRow.jsx must exist (Design note)');
  assert(/from\s+'\.\.\/Avatar'/.test(src) || /from\s+'\.\.\/\.\.\/components\/Avatar'/.test(src), 'AC-2: author cell reuses components/Avatar');
  assert(/\/user\//.test(src), 'AC-2: author links to /user/<pubkey>');
  assert(/created_at/.test(src), 'AC-2: age derived from created_at');
  assert(/bs-dlist-missing/.test(src) && /missing/.test(src), 'AC-3: missing required field renders <span class="bs-dlist-missing">missing</span>');
  assert(/target=["']_blank["']/.test(src) && /rel=["']noreferrer["']/.test(src), 'AC-4: href cells open in a new tab with rel=noreferrer');
  assert(/more/.test(src) && /extra/.test(src), 'E3: extra same-name tags render as "+N more"');
  assert(/fieldCellModel/.test(src), 'Design note: cells are computed by the shared util, not re-derived in JSX');
  assert(!/(publish|signEvent|kind:\s*7\b)/.test(src), 'AC-8 / Gate A: votes are read-only — no publish path in the row');
  assert(/undeclaredFields/.test(src), 'AC-9: the other-fields cell is computed by the shared util');
  assert(/<details/.test(src) && /<summary/.test(src), 'AC-9: other fields are collapsed behind a details/summary toggle');
  assert(/other field/.test(src), 'AC-9: the toggle reads "N other field(s)"');
  assert(/bs-dlist-other/.test(src), 'AC-9: the cell carries the bs-dlist-other class');
  assert(/length\s*(===|>)\s*0|\.length\s*\?/.test(src), 'E10: no toggle when the item has no undeclared tags');
  assert(!/githubProfileUrl|github\.com/.test(src), 'AC-4 (Gate B): no GitHub special case in the row');
});

test('S3: Lists.jsx (/lists index) scans both header kinds, joins item-counts with a — fallback, links each header, and has a paste box', () => {
  const src = safeRead(LISTS_PAGE);
  assert(src.length > 0, 'ui/src/pages/Lists.jsx must exist (Design note)');
  assert(/queryRelay\s*\(/.test(src) && /9998/.test(src) && /39998/.test(src), 'AC-6: index scans kinds 9998 and 39998');
  assert(src.includes('/api/dlists/item-counts'), 'AC-6: item counts from /api/dlists/item-counts');
  assert(/\.catch\s*\(/.test(src) || /catch\s*[\({]/.test(src), 'E8: item-counts failure is caught — the index still lists headers');
  assert(/—/.test(src), 'E8: absent count renders — not 0');
  assert(/\/list\//.test(src) && /encodeURIComponent/.test(src), 'AC-6: each header links to /list/<encodeURIComponent(ref)>');
  assert(/parseListRef/.test(src) && /useNavigate/.test(src), 'AC-1: paste box runs parseListRef and navigates');
  assert(/headerNames/.test(src), 'AC-6: names via the shared util');
  assert(/TopBar/.test(src) && /bsp-page/.test(src), 'Gate A: user-facing surface with the Tags.jsx layout');
  assert(!/useOutletContext|Breadcrumbs/.test(src), 'Design note: not wired into the operator Layout chain');
  assert(/matchesListQuery/.test(src), 'AC-10: the index filters through the shared matchesListQuery util');
  assert(/bs-dlist-filter/.test(src) && /aria-label=["']Filter lists["']/.test(src), 'AC-10: a filter input at the top of the index');
  assert(/No lists match/.test(src), 'AC-10: "No lists match" empty state when the query excludes every header');
  assert(!/(queryRelay|fetch)\s*\([^)]*query/.test(src), 'AC-10: filtering is client-side over the already-loaded headers, not a new relay/API call');
});

test('S4: List.jsx (/list/:ref) resolves the header, pages items with a bounded #z scan of 50, prints unknown totals, de-dupes, and batches kind-7', () => {
  const src = safeRead(LIST_PAGE);
  assert(src.length > 0, 'ui/src/pages/List.jsx must exist (Design note)');
  assert(/parseListRef/.test(src) && /useParams/.test(src), 'E7: :ref parsed by parseListRef');
  assert(/'#d'/.test(src) && /authors/.test(src) && /ids/.test(src), 'AC-1/E7: header resolved by kind+author+#d, or by id');
  assert(/queryRelayBounded\s*\(/.test(src), 'AC-5: items fetched via queryRelayBounded');
  assert(/'#z'/.test(src) && /39999/.test(src) && /9999/.test(src), 'AC-2: items are kinds 9999/39999 whose #z equals the header coordinate');
  assert(/limit:\s*50/.test(src), 'Gate A: page size 50');
  assert(/truncated/.test(src) && /total/.test(src), 'AC-5: renders "showing N of M" from {count,total,truncated}');
  assert(/unknown/i.test(src), 'AC-5: total === null prints "unknown", not 0');
  assert(/until/.test(src) && /created_at/.test(src), 'E6: next page uses until = oldest created_at on the page');
  assert(/new Set\s*\(|new Map\s*\(|\.id\b/.test(src), 'E6: client-side id de-dupe across pages');
  assert(/kinds:\s*\[\s*7\s*\]/.test(src) && /'#e'/.test(src), 'AC-8: one batched kind-7 scan per page keyed by #e');
  assert(/reactionPolarity/.test(src), 'AC-8: reactions folded through reactionPolarity');
  assert(/not on this relay|not found on this relay|not on local strfry/i.test(src), 'AC-7: missing header renders a plain "not on this relay" message');
  const catches = (src.match(/catch\s*[\({]/g) || []).length;
  assert(catches >= 2, `E7/E9: header/items scan failure AND kind-7 scan failure are each caught (found ${catches} catch sites, need ≥ 2)`);
  assert(/DListItemsTable/.test(src), 'AC-2: page mounts the shared table');
  assert(/useProfiles/.test(src), 'AC-2: profiles via useProfiles for author names/avatars');
  assert(/TopBar/.test(src) && /bsp-page/.test(src), 'Gate A: user-facing surface with the Tags.jsx layout');
  assert(/fresh\.length\s*===\s*0/.test(src), 'N-3: a next page with zero fresh ids marks the list exhausted (no paging stall)');
  assert(/setVotesFailed\(false\)/.test(src), 'N-4: a successful kind-7 scan resets votesFailed');
  assert(/voteToken|votesToken|cancelled/.test(src) && /loadVotes\([^)]*(token|cancelled)/i.test(src), 'N-4: loadVotes honors a request token / cancelled flag');
  assert(/Each item is a/.test(src) && !/One item is a/.test(src), 'N-6: subtitle reads "Each item is a <singular> — <description>"');
});

test('S5: App.jsx registers /lists and /list/:ref next to /tags and /pins', () => {
  const src = safeRead(APP);
  assert(/import\s+Lists\s+from\s+'\.\/pages\/Lists'/.test(src), 'AC-6: Lists page imported');
  assert(/import\s+List\s+from\s+'\.\/pages\/List'/.test(src), 'AC-1: List page imported');
  assert(/path:\s*'\/lists'/.test(src) && /<Lists\s*\/>/.test(src), 'AC-6: /lists route');
  assert(/path:\s*'\/list\/:ref'/.test(src) && /<List\s*\/>/.test(src), 'AC-1: /list/:ref route');
  const tagsIdx = src.indexOf("path: '/tags'");
  const listsIdx = src.indexOf("path: '/lists'");
  const operatorIdx = src.indexOf("path: '/tapestry'");
  assert(tagsIdx > 0 && listsIdx > 0 && (operatorIdx < 0 || listsIdx < operatorIdx),
    'Gate A: the new routes sit with the user-facing /tags,/pins entries, not under the operator /tapestry tree');
});

test('S6: bs-dlist-* styles appended and no 64-hex literal in any new UI file', () => {
  const css = safeRead(STYLES);
  assert(/\.bs-dlist-missing/.test(css), 'AC-3: .bs-dlist-missing style exists');
  assert(/\.is-required/.test(css), 'AC-3: required header styling exists');
  assert(/\.bs-dlist-other/.test(css), 'AC-9: other-fields cell style exists');
  assert(/\.bs-dlist-filter/.test(css), 'AC-10: filter input style exists');
  for (const [name, p] of [['dlistFields.js', UTIL], ['DListItemsTable.jsx', TABLE], ['DListItemRow.jsx', ROW], ['Lists.jsx', LISTS_PAGE], ['List.jsx', LIST_PAGE]]) {
    const src = safeRead(p);
    assert(src.length > 0, `${name} must exist`);
    assert(!/[0-9a-fA-F]{64}/.test(src), `CLAUDE.md § per-deployment TA pubkey: ${name} must not carry a 64-hex literal`);
  }
});

/* ── R: regression sentinels (pass before and after) ───────── */

test('R1: operator DListItems.jsx keeps its own vote rules and per-item kind-7 fan-out, and does not import the new util', () => {
  const src = safeRead(OP_ITEMS);
  assert(src.length > 0, 'ui/src/pages/lists/DListItems.jsx present');
  assert(/function isUpvote\(/.test(src) && /function isDownvote\(/.test(src), 'AC-8: operator up/down rules untouched');
  assert(src.includes("itemIds.map(id => queryRelay({ kinds: [7], '#e': [id] }))"), 'AC-8: operator page still counts votes its own way (byte-identical claim)');
  assert(/useOutletContext/.test(src) && /useCypher/.test(src), 'Design note: operator page keeps its Layout chain and Neo4j import');
  assert(!/dlistFields|components\/dlist/.test(src), 'Design note: operator browser is not refactored onto the new util/table');
});

test('R2: NewDListItem.jsx keeps its own required/recommended/optional reader', () => {
  const src = safeRead(OP_NEW_ITEM);
  assert(src.includes("getAllTags(parentEvent, 'required')") && src.includes("getAllTags(parentEvent, 'recommended')") && src.includes("getAllTags(parentEvent, 'optional')"),
    'Design note non-consumer claim: the authoring form keeps its own field reader');
  assert(!/dlistFields/.test(src), 'Design note: NewDListItem not refactored onto the util this story');
});

test('R3: DListDetail.jsx and lists/Index.jsx keep their coordinate and item-counts patterns', () => {
  const detail = safeRead(OP_DETAIL);
  assert(detail.includes("decodedId.startsWith('39998:') || decodedId.startsWith('9998:')"), 'Design note: DListDetail coordinate branch intact');
  assert(detail.includes("setError('Event not found')"), 'Design note: DListDetail not-found path intact');
  const index = safeRead(OP_INDEX);
  assert(index.includes("fetch('/api/dlists/item-counts')"), 'Design note: operator index still reads item-counts');
  assert(!/dlistFields|components\/dlist/.test(detail + index), 'Design note: operator pages untouched');
});

test('R4: relay.js queryRelayBounded still returns {events,count,total,truncated,limit} with total null-when-unknown', () => {
  const src = safeRead(RELAY_API);
  assert(/export async function queryRelay\s*\(/.test(src) && /export async function queryRelayBounded\s*\(/.test(src), 'both readers exported');
  assert(src.includes('total: data.total === undefined ? null : data.total'), 'AC-5 contract: total is null when the scan was bounded and the count unknown');
  assert(src.includes('truncated: Boolean(data.truncated)'), 'AC-5 contract: truncated flag');
});

test('R5: existing user-facing /tags and /pins routes remain', () => {
  const src = safeRead(APP);
  assert(/path:\s*'\/tags'/.test(src) && /<Tags\s*\/>/.test(src), '/tags route intact');
  assert(/path:\s*'\/pins'/.test(src) && /<Pins\s*\/>/.test(src), '/pins route intact');
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
