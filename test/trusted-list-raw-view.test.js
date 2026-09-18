/**
 * Trusted Lists dashboard — raw-event view and `z` membership rendering.
 *
 * Operator request 2026-09-17: a way to see a Trusted List's raw event from the Trusted
 * Lists admin pages, so the ADR dlist-item-tagging/0002 `z` discovery tags can be
 * validated by eye; plus "is a member of <list>" for each `z`.
 *
 * Two classes (house pattern):
 *   U (behavioral) — ui/src/utils/trustedListView.js via dynamic import(): the member
 *                    letter is a function of the kind, the tag split, coordinate parsing,
 *                    the single batched header filter, name resolution, and the positional
 *                    member fields.
 *   S (structure)  — the two pages consume the util, the detail page has the raw toggle and
 *                    the memberships section, and the index reports a z column.
 *   R (regression) — the detail page keeps its metadata card and items table; the index
 *                    keeps its dedupe-by-uuid and its link to the detail route.
 *
 * Not covered here: the rendered pages in a browser, and the relay round-trip (the util is
 * driven with literals; queryRelay has its own lane).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const UI = path.join(REPO, 'ui/src');
const UTIL = path.join(UI, 'utils/trustedListView.js');
const DETAIL = path.join(UI, 'pages/grapevine/TrustedListDetail.jsx');
const INDEX = path.join(UI, 'pages/grapevine/TrustedLists.jsx');
const PANEL = path.join(UI, 'components/PinnedListPanel.jsx');

const TA = 'f'.repeat(64);
const OBS = 'a'.repeat(64);
const AUTHOR = 'b'.repeat(64);

function read(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

let passed = 0;
let failed = 0;
const failures = [];
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

/** A kind-30394 item Trusted List as story 5 publishes it. */
function itemTL() {
  return {
    id: 'e'.repeat(64),
    kind: 30394,
    pubkey: TA,
    created_at: 1000,
    content: '{"items":[]}',
    tags: [
      ['d', `tl-pin-items-${OBS.slice(0, 8)}-${AUTHOR.slice(0, 8)}-white-hat`],
      ['title', 'White Hat'],
      ['metric', 'pinned-tag-items'],
      ['a', `39999:${AUTHOR}:github-account-1`],
      ['a', `39999:${AUTHOR}:github-account-2`],
      ['observer', OBS],
      ['source-tag', 'c'.repeat(64), AUTHOR, 'white-hat'],
      ['p', OBS],
      ['z', `39998:${TA}:trusted-list`],
      ['z', `39999:${TA}:tl:white-hat-tls`],
    ],
  };
}

/** A kind-30393 note Trusted List: members are `e`; the `a` and `p` are discovery. */
function noteTL() {
  return {
    id: 'd'.repeat(64),
    kind: 30393,
    pubkey: TA,
    created_at: 1000,
    content: '{}',
    tags: [
      ['d', 'tl-pin-notes-aaaaaaaa-bbbbbbbb-white-hat'],
      ['e', '1'.repeat(64), '', '', '75'],
      ['e', '2'.repeat(64)],
      ['a', `39999:${AUTHOR}:white-hat`],
      ['p', OBS],
      ['z', `39998:${TA}:trusted-list`],
    ],
  };
}

// ── U — the pure view model ──────────────────────────────────────────────────

test('U1: the member letter is a function of the kind, not of the letter alone', async () => {
  const m = await import(pathToFileURL(UTIL).href);
  assert(m.memberLetterOf(30392) === 'p', 'kind 30392 members are p tags.');
  assert(m.memberLetterOf(30393) === 'e', 'kind 30393 members are e tags.');
  assert(m.memberLetterOf(30394) === 'a', 'kind 30394 members are a tags.');
  assert(m.memberLetterOf(30395) === 'i', 'kind 30395 members are i tags.');
  assert(m.memberLetterOf(39999) === null, 'a non-TL kind has no member letter.');
});

test('U2: a 30394 item list reports its a-coordinate members (the old p+e count said zero)', async () => {
  const m = await import(pathToFileURL(UTIL).href);
  const { members } = m.splitTLTags(itemTL());
  assert(members.length === 2, `a 30394 has 2 a-members; got ${members.length}.`);
  assert(members.every((x) => x.type === 'a'), 'every member of a 30394 is an a tag.');
  assert(members[0].value === `39999:${AUTHOR}:github-account-1`, 'the member value is the coordinate.');
  assert(members[0].idx === 1 && members[1].idx === 2, 'member indices are 1-based and in event order.');
});

test('U3: a 30393\'s p observer and a back-ref are discovery, not members', async () => {
  const m = await import(pathToFileURL(UTIL).href);
  const { members, otherRefs } = m.splitTLTags(noteTL());
  assert(members.length === 2, `a 30393 has 2 e-members; got ${members.length}.`);
  assert(!members.some((x) => x.value === OBS), 'the observer p tag must never count as a member.');
  const kinds = otherRefs.map((r) => r.type).sort();
  assert(JSON.stringify(kinds) === JSON.stringify(['a', 'p']), `the a back-ref and p observer are otherRefs; got ${JSON.stringify(kinds)}.`);
});

test('U4: z tags are collected as memberships, separate from members and metadata', async () => {
  const m = await import(pathToFileURL(UTIL).href);
  const { memberships, metadata } = m.splitTLTags(itemTL());
  assert(memberships.length === 2, `the item TL carries 2 z tags; got ${memberships.length}.`);
  assert(memberships.includes(`39998:${TA}:trusted-list`), 'the concept z must be present.');
  assert(memberships.includes(`39999:${TA}:tl:white-hat-tls`), 'the per-tag TL-header z must be present.');
  const names = metadata.map((x) => x.name);
  assert(names.includes('observer') && names.includes('source-tag') && names.includes('metric'),
    `multi-letter tags are metadata; got ${JSON.stringify(names)}.`);
});

test('U5: a list with no z tags reports zero memberships rather than failing', async () => {
  const m = await import(pathToFileURL(UTIL).href);
  const ev = itemTL();
  ev.tags = ev.tags.filter((t) => t[0] !== 'z');
  assert(m.splitTLTags(ev).memberships.length === 0, 'a pre-ADR-0002 list has no memberships.');
  assert(m.memberCountOf(ev) === 2, 'its members are unaffected by the missing z tags.');
});

test('U6: a null or tagless event yields empty buckets, never a throw', async () => {
  const m = await import(pathToFileURL(UTIL).href);
  for (const ev of [null, undefined, {}, { kind: 30394 }, { kind: 30394, tags: null }]) {
    const out = m.splitTLTags(ev);
    assert(out.members.length === 0 && out.memberships.length === 0,
      `a degenerate event must split to empty buckets; got ${JSON.stringify(out)}.`);
  }
});

test('U7: coordinates parse into kind/pubkey/d, and a malformed z returns null', async () => {
  const m = await import(pathToFileURL(UTIL).href);
  const p = m.parseCoord(`39999:${TA.toUpperCase()}:tl:white-hat-tls`);
  assert(p && p.kind === 39999, 'the kind is numeric.');
  assert(p.pubkey === TA, 'the pubkey is lowercased.');
  assert(p.dTag === 'tl:white-hat-tls', `the d-tag keeps its own colons; got ${p && p.dTag}.`);
  assert(m.parseCoord('not-a-coord') === null, 'a non-coordinate parses to null.');
  assert(m.parseCoord('39999:tooshort:x') === null, 'a short pubkey parses to null.');
});

test('U8: distinct coordinates collapse into ONE bounded header filter', async () => {
  const m = await import(pathToFileURL(UTIL).href);
  // The shape a 200-row dashboard produces: the concept z repeated on every list, a
  // handful of per-tag headers. Cost tracks distinct coordinates, not tag count.
  const coords = [];
  for (let i = 0; i < 200; i++) {
    coords.push(`39998:${TA}:trusted-list`);
    coords.push(`39999:${TA}:tl:tag-${i % 5}-tls`);
  }
  const f = m.zHeaderFilter(coords);
  assert(JSON.stringify(f.kinds.sort()) === JSON.stringify([39998, 39999]), `two kinds; got ${JSON.stringify(f.kinds)}.`);
  assert(f.authors.length === 1, `one author; got ${f.authors.length}.`);
  assert(f['#d'].length === 6, `400 z tags reduce to 6 distinct d-tags; got ${f['#d'].length}.`);
  assert(m.zHeaderFilter([]) === null && m.zHeaderFilter(['garbage']) === null,
    'nothing addressable means no query at all.');
});

test('U9: a header resolves to its title, then names, then its d-tag', async () => {
  const m = await import(pathToFileURL(UTIL).href);
  assert(m.headerName({ tags: [['d', 'x'], ['title', 'Trusted Lists']] }) === 'Trusted Lists', 'title wins.');
  assert(m.headerName({ tags: [['d', 'x'], ['names', 'Trusted List', 'Trusted Lists']] }) === 'Trusted List', 'names is the fallback.');
  assert(m.headerName({ tags: [['d', 'trusted-list']] }) === 'trusted-list', 'the d-tag is the last resort.');
  assert(m.headerName(null) === null, 'no event resolves to no name.');
});

test('U10: memberships render "is a member of <name>" once the header is indexed', async () => {
  const m = await import(pathToFileURL(UTIL).href);
  const headers = m.indexHeaders([
    { kind: 39998, pubkey: TA, created_at: 5, tags: [['d', 'trusted-list'], ['title', 'Trusted Lists']] },
    { kind: 39998, pubkey: TA, created_at: 1, tags: [['d', 'trusted-list'], ['title', 'STALE']] },
  ]);
  const row = m.describeMembership(`39998:${TA}:trusted-list`, headers);
  assert(row.resolved === true && row.name === 'Trusted Lists', `newest header wins; got ${JSON.stringify(row)}.`);
  const unresolved = m.describeMembership(`39999:${TA}:tl:white-hat-tls`, headers);
  assert(unresolved.malformed === false && unresolved.resolved === false,
    'an unfetched header is unresolved, never malformed.');
  assert(unresolved.coord === `39999:${TA}:tl:white-hat-tls`, 'the raw coordinate is always available to render.');
  const bad = m.describeMembership('garbage', headers);
  assert(bad.malformed === true, 'a malformed z is flagged, not dropped.');
});

test('U11: member positional fields differ per letter (p score, e author+score, a bare)', async () => {
  const m = await import(pathToFileURL(UTIL).href);
  const noteMembers = m.splitTLTags(noteTL()).members;
  assert(m.memberDetail(noteMembers[0]).score === '75', 'an e member reads its score at index 4.');
  assert(m.memberDetail(noteMembers[1]).score === null, 'a bare e member has no score.');
  const pMember = { type: 'p', value: OBS, rest: ['', '50'] };
  assert(m.memberDetail(pMember).score === '50', 'a p member reads its score at index 3.');
  assert(m.memberDetail(pMember).relay === null, 'an empty-string relay placeholder reads as absent.');
  const aMember = m.splitTLTags(itemTL()).members[0];
  assert(m.memberDetail(aMember).score === null && m.memberDetail(aMember).relay === null,
    'an a member is a bare coordinate in v1.');
});

// ── S — the pages consume it ─────────────────────────────────────────────────

test('S1: the detail page renders the raw event behind a toggle', async () => {
  const src = read(DETAIL);
  assert(src.includes('JsonView'), 'the detail page must reuse the house JsonView component.');
  assert(/showRaw/.test(src), 'a toggle state must gate the raw view.');
  assert(/Raw event/.test(src), 'the section must be labelled Raw event.');
  assert(/aria-expanded/.test(src), 'the toggle must expose its expanded state.');
  assert(src.includes('JSON.stringify(data, null, 2)'), 'the Raw JSON mode must pretty-print the event.');
});

test('S2: the detail page names each z tag as a membership', async () => {
  const src = read(DETAIL);
  assert(src.includes('describeMembership'), 'membership rows come from the util.');
  assert(src.includes('zHeaderFilter') && src.includes('indexHeaders'), 'names resolve through the batched filter.');
  assert(/is a member of/.test(src), 'each z must read as a membership.');
  assert(!/await\s+queryRelay\(\{\s*\.\.\.filter/.test(src), 'the name lookup must not block the first render.');
});

test('S3: both pages take their member/membership split from the util', async () => {
  const detail = read(DETAIL);
  const index = read(INDEX);
  assert(detail.includes("from '../../utils/trustedListView'"), 'the detail page imports the util.');
  assert(index.includes("from '../../utils/trustedListView'"), 'the index imports the util.');
  assert(index.includes('splitTLTags'), 'the index counts members through the util.');
  assert(!/t\[0\] === 'p'\).length/.test(index), 'the index must no longer count every p tag as a member.');
});

test('S4: the index reports a z column so the corpus can be scanned at a glance', async () => {
  const src = read(INDEX);
  assert(/zCount/.test(src), 'the index must carry a per-row z count.');
  assert(/memberLetterOf/.test(src), 'the Tags column must derive from the kind.');
  assert(/'a' \? '🔗 a-tags'/.test(src) || /a-tags/.test(src), 'a-member lists must render a Tags label.');
});

// ── R — what must not move ───────────────────────────────────────────────────

test('R1: the detail page keeps its metadata card and items table', async () => {
  const src = read(DETAIL);
  for (const needle of ['d-tag:', 'Author:', 'Published:', 'Event ID:', 'DataTable', 'Items (']) {
    assert(src.includes(needle), `the detail page must keep "${needle}".`);
  }
});

test('R2: the index keeps its dedupe-by-uuid and its link to the detail route', async () => {
  const src = read(INDEX);
  assert(src.includes('byUuid'), 'the newest-wins dedupe must stay.');
  assert(src.includes('grapevine/trusted-lists/'), 'rows must still link to the detail page.');
  assert(src.includes('kinds: [30392, 30393, 30394, 30395]'), 'the scan must still cover the whole family.');
});

test('R3: the util is read-only — it publishes nothing and holds no pubkey literal', async () => {
  const src = read(UTIL);
  assert(!/publish|signEvent|nostr\.sign/i.test(src), 'a view model must never publish or sign.');
  assert(!/[0-9a-f]{64}/.test(src), 'no 64-hex literal belongs in shared code (CLAUDE.md).');
});


// ── Pinned tab Items leaf (operator report 2026-09-17: list published, no tab) ──

test('U12: the shared header util groups items by their parent list, first-seen order', async () => {
  const m = await import(pathToFileURL(path.join(UI, 'utils/dlistHeaders.js')).href);
  const groups = m.groupItemsByList([
    { address: 'a1', listCoord: 'L1' },
    { address: 'a2', listCoord: 'L2' },
    { address: 'a3', listCoord: 'L1' },
    { address: 'a4', listCoord: null },
  ]);
  assert(groups.length === 3, `three groups (L1, L2, orphans); got ${groups.length}.`);
  assert(groups[0].listCoord === 'L1' && groups[0].items.length === 2, 'L1 comes first and keeps both items.');
  assert(groups[2].listCoord === null, 'an item with no parent groups under null, never dropped.');
});

test('U13: a kind-39999 item names its list with z, a kind-9999 item with e', async () => {
  const m = await import(pathToFileURL(path.join(UI, 'utils/dlistHeaders.js')).href);
  assert(m.listCoordOf({ kind: 39999, tags: [['z', 'L1'], ['e', 'nope']] }) === 'L1', 'a 39999 uses its z.');
  assert(m.listCoordOf({ kind: 9999, tags: [['e', 'H1'], ['z', 'nope']] }) === 'H1', 'a 9999 uses its e.');
  assert(m.listCoordOf({ kind: 39999, tags: [['z', 'first'], ['z', 'second']] }) === 'first', 'the FIRST parent wins (E5).');
  assert(m.listCoordOf(null) === null, 'an unresolved item has no parent.');
});

test('U14: an unresolved item still renders — its d is re-derived from the coordinate', async () => {
  const m = await import(pathToFileURL(path.join(UI, 'utils/dlistHeaders.js')).href);
  const row = m.toTableItem({ address: '39999:' + AUTHOR + ':github-account-1', kind: 39999, tags: [] });
  assert(row.tags[0][0] === 'd' && row.tags[0][1] === 'github-account-1', `the d is synthesized for display; got ${JSON.stringify(row.tags)}.`);
  assert(row.id === '39999:' + AUTHOR + ':github-account-1', 'the address stands in for a missing event id.');
  const resolved = m.toTableItem({ address: 'x', kind: 39999, tags: [['d', 'real']] });
  assert(resolved.tags.length === 1, 'an item that already has a d is left alone.');
});

test('U15: the Items leaf reads a 30394 through the member letter, not every a tag', async () => {
  const m = await import(pathToFileURL(UTIL).href);
  // The published list carries member a-tags AND z discovery tags; only the members
  // may become item rows, or the tab would list the concept header as an item.
  const addresses = m.splitTLTags(itemTL()).members.map((x) => x.value);
  assert(addresses.length === 2, `two item coordinates; got ${addresses.length}.`);
  assert(!addresses.some((a) => a.includes('trusted-list')), 'a z target must never become an item row.');
});

test('S5: the Pinned panel has an Items leaf fed by the published list', async () => {
  const src = read(PANEL);
  assert(src.includes('usePinnedItems'), 'the panel must read the published 30394 through the hook.');
  assert(/pinnedView === 'items'/.test(src), 'an items leaf must exist in the sub-switch.');
  assert(/Items \(\{pinnedItems\.length\}\)/.test(src), 'the leaf must be labelled with its count.');
  assert(src.includes('DListItemsTable'), 'items must render through the house table.');
  assert(/showPinnedSwitch/.test(src), 'the switch must appear for an item list even with no note set.');
});

test('S6: the hook reads the PUBLISHED list, and never publishes', async () => {
  const src = read(path.join(UI, 'hooks/usePinnedItems.js'));
  assert(/kinds: \[30394\]/.test(src), 'it must query the 30394 by kind.');
  assert(src.includes("'#d': [itemDTag]"), 'it must address the list by its d-tag.');
  // Match real write paths, not the word "published" in prose.
  assert(!/signEvent|publishToStrfry|method:\s*'POST'/.test(src), 'a read hook must never publish or sign.');
  assert(!/[0-9a-f]{64}/.test(src), 'no pubkey literal belongs in the hook.');
});

test('R4: the tag page Items view keeps its behavior on the shared helpers', async () => {
  const src = read(path.join(UI, 'components/TagItemsView.jsx'));
  assert(src.includes('fetchListHeaders'), 'it must use the shared header fetcher.');
  assert(src.includes('groupItemsByList') && src.includes('toTableItem'), 'and the shared grouping/row helpers.');
  assert(!/^function fetchHeaders/m.test(src) && !/^function toTableItem/m.test(src),
    'the local copies must be gone — one implementation only.');
  assert(src.includes('useNotesForTag'), 'its live aggregation source is unchanged.');
});

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
  console.log(`trusted-list-raw-view: ${passed} passed, ${failed} failed`);
  return { pass: passed, fail: failed, skipped: 0, failures };
}

module.exports = { run };
