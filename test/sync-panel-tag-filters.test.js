/**
 * Story relay-management #1 (single-letter tag filters in the Negentropy Sync
 * panel). ADR relay-management/0001. See the .test-plan.md alongside the story.
 *
 * ADR 0001 chose Option A: a pure ui/src/utils/tagFilterValidation.js
 * (validateTagLetter / normalizeTagValue / parseTagValues / mergeTagFilter,
 * nip19-based), a TagFilterEditor sub-panel owned by NegentropySync in
 * ui/src/pages/settings/RelaySettings.jsx contributing to the single filterObj
 * composition point, and a regex-guarded extension of buildFilterObj() in
 * src/api/strfry/negentropySync.js (helpers exported for direct execution).
 *
 * TEST LEVEL (event-page/0002 precedent): the pure ESM util is EXECUTED via
 * dynamic import in the Node runner; the backend CJS helpers are EXECUTED via
 * require; the React surface is asserted at the SOURCE level (no JSX transpile
 * in the harness). The util / editor / whitelist extension do not exist
 * pre-implementation, so the U-, B- and S-tests FAIL now and PASS once built.
 * R* are regression sentinels (additive change) — they PASS before AND after.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { nip19, generateSecretKey, getPublicKey } = require('nostr-tools');

const VALIDATION = path.resolve(__dirname, '../ui/src/utils/tagFilterValidation.js');
const RELAY_SETTINGS = path.resolve(__dirname, '../ui/src/pages/settings/RelaySettings.jsx');
const BACKEND = path.resolve(__dirname, '../src/api/strfry/negentropySync.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function loadBackend() { try { return require(BACKEND); } catch { return null; } }
function eq(a, b, msg) {
  assert(JSON.stringify(a) === JSON.stringify(b), `${msg}\n      expected: ${JSON.stringify(b)}\n      actual:   ${JSON.stringify(a)}`);
}

// nip19-minted, self-validating fixtures (event-page-ui.test.js pattern).
const PK = getPublicKey(generateSecretKey());
const HEX_PK = PK.toLowerCase();
const EVENT_ID = 'b'.repeat(64);
const UPPER_HEX = 'A'.repeat(64);
const NPUB = nip19.npubEncode(PK);
const NPROFILE = nip19.nprofileEncode({ pubkey: PK, relays: ['wss://hint.example'] });
const NOTE = nip19.noteEncode(EVENT_ID);
const NEVENT = nip19.neventEncode({ id: EVENT_ID });
const NADDR = nip19.naddrEncode({ kind: 30023, pubkey: PK, identifier: 'my-post' });

const NOT_IMPL = (what) =>
  `${what} — feature not implemented yet (ADR relay-management/0001).`;

// ===========================================================================
// U: ui/src/utils/tagFilterValidation.js — EXECUTED (the pure validation core)
// ===========================================================================

test('U1: validateTagLetter accepts exactly one ASCII letter, case-sensitively; rejects everything else (AC-4)', async () => {
  const mod = await loadEsm(VALIDATION);
  assert(mod && typeof mod.validateTagLetter === 'function',
    NOT_IMPL('ui/src/utils/tagFilterValidation.js must export validateTagLetter'));
  for (const good of ['x', 'p', 'Z', 'P', 'a', 'E']) {
    const r = mod.validateTagLetter(good);
    assert(r.ok === true && r.letter === good, `validateTagLetter('${good}') must accept and echo the letter.`);
  }
  assert(mod.validateTagLetter(' x ').ok === true, 'validateTagLetter must trim surrounding whitespace before judging.');
  for (const bad of ['', 'xx', '1', '#', '#x', ' ', 'é', 'x1']) {
    const r = mod.validateTagLetter(bad);
    assert(r.ok === false && typeof r.error === 'string' && r.error.length > 0,
      `validateTagLetter(${JSON.stringify(bad)}) must reject with a human-readable error (AC-4: exactly one ASCII letter).`);
  }
});

test('U2: parseTagValues splits on commas, trims, drops empties, dedupes, requires ≥1 value; free letters take values verbatim (AC-1, AC-7)', async () => {
  const mod = await loadEsm(VALIDATION);
  assert(mod && typeof mod.parseTagValues === 'function',
    NOT_IMPL('ui/src/utils/tagFilterValidation.js must export parseTagValues'));
  const r1 = mod.parseTagValues('x', ' foo1, foo2 ');
  assert(r1.ok === true, `parseTagValues('x', ' foo1, foo2 ') must succeed, got error: ${r1.error}`);
  eq(r1.values, ['foo1', 'foo2'], 'AC-1: comma-separated values are split and trimmed.');
  const r2 = mod.parseTagValues('t', 'foo,, ,foo,bar');
  assert(r2.ok === true, 'empties are dropped, not fatal');
  eq(r2.values, ['foo', 'bar'], 'AC-7: empty entries dropped, duplicates deduped (first occurrence wins).');
  const r3 = mod.parseTagValues('t', ' ,, ');
  assert(r3.ok === false && /value/i.test(r3.error || ''),
    'AC-7: an entry with zero usable values must be rejected with an error mentioning values.');
  const r4 = mod.parseTagValues('t', ' Foo Bar ');
  assert(r4.ok && r4.values[0] === 'Foo Bar',
    'AC-7: free-letter values are verbatim after trimming — no case-folding, inner spaces kept.');
});

test('U3: p-values must be 64-hex (lowercased) or npub/nprofile (decoded); wrong/malformed forms error naming the value (AC-5)', async () => {
  const mod = await loadEsm(VALIDATION);
  assert(mod && typeof mod.parseTagValues === 'function',
    NOT_IMPL('ui/src/utils/tagFilterValidation.js must export parseTagValues'));
  const r1 = mod.parseTagValues('p', `${HEX_PK}, ${UPPER_HEX}`);
  assert(r1.ok === true, `two hex pubkeys must be accepted, got: ${r1.error}`);
  eq(r1.values, [HEX_PK, UPPER_HEX.toLowerCase()], 'AC-5: hex accepted case-insensitively, normalized to lowercase.');
  const r2 = mod.parseTagValues('p', NPUB);
  assert(r2.ok === true && r2.values[0] === HEX_PK, 'AC-5: npub decodes to the hex pubkey.');
  const r3 = mod.parseTagValues('p', NPROFILE);
  assert(r3.ok === true && r3.values[0] === HEX_PK, 'AC-5: nprofile decodes to the hex pubkey.');
  for (const bad of ['deadbeef', 'z'.repeat(64), NOTE, 'npub1malformed']) {
    const r = mod.parseTagValues('p', bad);
    assert(r.ok === false && (r.error || '').includes(bad.slice(0, 8)),
      `AC-5: parseTagValues('p', '${bad.slice(0, 16)}…') must fail with an error identifying the offending value.`);
  }
  const mixed = mod.parseTagValues('p', `${HEX_PK}, deadbeef`);
  assert(mixed.ok === false, 'AC-5: one invalid value blocks the whole add (filter unchanged).');
});

test('U4: e-values must be 64-hex or note/nevent (decoded); npub is the wrong type (AC-5)', async () => {
  const mod = await loadEsm(VALIDATION);
  assert(mod && typeof mod.parseTagValues === 'function',
    NOT_IMPL('ui/src/utils/tagFilterValidation.js must export parseTagValues'));
  const r1 = mod.parseTagValues('e', EVENT_ID);
  assert(r1.ok === true && r1.values[0] === EVENT_ID, 'AC-5: hex event id accepted.');
  const r2 = mod.parseTagValues('e', NOTE);
  assert(r2.ok === true && r2.values[0] === EVENT_ID, 'AC-5: note1… decodes to the hex event id.');
  const r3 = mod.parseTagValues('e', NEVENT);
  assert(r3.ok === true && r3.values[0] === EVENT_ID, 'AC-5: nevent1… decodes to the hex event id.');
  const r4 = mod.parseTagValues('e', NPUB);
  assert(r4.ok === false, 'AC-5: an npub is not a valid e-value (wrong bech32 type must be rejected).');
});

test('U5: uppercase P and E validate exactly like p and e (AC-5, story open-question default #1)', async () => {
  const mod = await loadEsm(VALIDATION);
  assert(mod && typeof mod.parseTagValues === 'function',
    NOT_IMPL('ui/src/utils/tagFilterValidation.js must export parseTagValues'));
  assert(mod.parseTagValues('P', NPUB).ok === true, 'AC-5: #P takes npub → hex like #p.');
  assert(mod.parseTagValues('E', NEVENT).ok === true, 'AC-5: #E takes nevent → hex like #e.');
  assert(mod.parseTagValues('P', 'nothex').ok === false, 'AC-5: #P rejects junk like #p.');
  assert(mod.parseTagValues('E', NPUB).ok === false, 'AC-5: #E rejects an npub like #e.');
});

test('U6: a-values must be kind:pubkey:identifier (identifier may be empty / contain colons; hex lowercased) or naddr (decoded); A likewise (AC-6)', async () => {
  const mod = await loadEsm(VALIDATION);
  assert(mod && typeof mod.parseTagValues === 'function',
    NOT_IMPL('ui/src/utils/tagFilterValidation.js must export parseTagValues'));
  const r1 = mod.parseTagValues('a', `30023:${HEX_PK}:my-post`);
  assert(r1.ok === true && r1.values[0] === `30023:${HEX_PK}:my-post`, 'AC-6: well-formed coordinate accepted verbatim.');
  const r2 = mod.parseTagValues('a', `0:${UPPER_HEX}:`);
  assert(r2.ok === true && r2.values[0] === `0:${UPPER_HEX.toLowerCase()}:`,
    'AC-6: empty identifier is legal; hex segment is normalized to lowercase.');
  const r3 = mod.parseTagValues('a', `30023:${HEX_PK}:a:b:c`);
  assert(r3.ok === true && r3.values[0] === `30023:${HEX_PK}:a:b:c`, 'AC-6: identifier may itself contain colons.');
  const r4 = mod.parseTagValues('a', NADDR);
  assert(r4.ok === true && r4.values[0] === `30023:${HEX_PK}:my-post`, 'AC-6: naddr decodes to the kind:pubkey:identifier coordinate.');
  for (const bad of [`x:${HEX_PK}:d`, `30023:deadbeef:d`, HEX_PK, NPUB]) {
    const r = mod.parseTagValues('a', bad);
    assert(r.ok === false, `AC-6: '${String(bad).slice(0, 24)}…' is not a valid a-value and must be rejected.`);
  }
  assert(mod.parseTagValues('A', NADDR).ok === true, 'AC-6: #A validates like #a.');
});

test('U7: mergeTagFilter merges same-letter entries (append + dedupe, order kept), appends new letters, is case-sensitive and pure (AC-4)', async () => {
  const mod = await loadEsm(VALIDATION);
  assert(mod && typeof mod.mergeTagFilter === 'function',
    NOT_IMPL('ui/src/utils/tagFilterValidation.js must export mergeTagFilter'));
  const r1 = mod.mergeTagFilter([], 'x', ['a']);
  eq(r1, [{ letter: 'x', values: ['a'] }], 'first add creates the entry.');
  const base = [{ letter: 'x', values: ['a', 'b'] }];
  const frozen = JSON.stringify(base);
  const r2 = mod.mergeTagFilter(base, 'x', ['b', 'c']);
  eq(r2, [{ letter: 'x', values: ['a', 'b', 'c'] }],
    'AC-4: re-adding a letter merges values — existing order kept, new appended, duplicates dropped.');
  assert(JSON.stringify(base) === frozen, 'mergeTagFilter must not mutate its input (pure).');
  const r3 = mod.mergeTagFilter(base, 'X', ['q']);
  eq(r3, [{ letter: 'x', values: ['a', 'b'] }, { letter: 'X', values: ['q'] }],
    'AC-4: letters are case-sensitive — #x and #X are distinct filter keys.');
});

// ===========================================================================
// B: src/api/strfry/negentropySync.js — EXECUTED (the whitelist extension)
// ===========================================================================

test('B1: negentropySync.js exports its pure helpers for direct execution (ADR §Implementation 3)', () => {
  const be = loadBackend();
  assert(be, 'src/api/strfry/negentropySync.js must load.');
  for (const name of ['buildFilterObj', 'buildCommand', 'buildPreviewCommand']) {
    assert(typeof be[name] === 'function',
      NOT_IMPL(`src/api/strfry/negentropySync.js must export ${name}`));
  }
});

test('B2: buildFilterObj passes "#<letter>" keys through alongside the existing four fields (AC-8)', () => {
  const be = loadBackend();
  assert(be && typeof be.buildFilterObj === 'function', NOT_IMPL('buildFilterObj must be exported'));
  const out = be.buildFilterObj({ kinds: [39999], '#z': [`39998:${HEX_PK}:tag`] });
  eq(out, { kinds: [39999], '#z': [`39998:${HEX_PK}:tag`] },
    'AC-8: a single-letter tag key must survive buildFilterObj next to kinds.');
});

test('B3: buildFilterObj keeps multiple tag keys with their value arrays intact (AC-2, AC-8)', () => {
  const be = loadBackend();
  assert(be && typeof be.buildFilterObj === 'function', NOT_IMPL('buildFilterObj must be exported'));
  const out = be.buildFilterObj({ authors: [HEX_PK], since: 1, until: 2, '#x': ['foo1', 'foo2'], '#y': ['bar'] });
  eq(out, { authors: [HEX_PK], since: 1, until: 2, '#x': ['foo1', 'foo2'], '#y': ['bar'] },
    'AC-2/AC-8: tag filters compose with authors/since/until; both letters and all values survive.');
});

test('B4: buildFilterObj still drops unknown non-tag keys and malformed tag-like keys (AC-8 regression guard)', () => {
  const be = loadBackend();
  assert(be && typeof be.buildFilterObj === 'function', NOT_IMPL('buildFilterObj must be exported'));
  const out = be.buildFilterObj({
    kinds: [1], ids: [EVENT_ID], limit: 10, foo: 'bar',
    '#xx': ['a'], '#1': ['a'], '#': ['a'], 'x': ['a'], '#é': ['a'],
  });
  eq(out, { kinds: [1] },
    'AC-8 guard: ids/limit/arbitrary keys and non-single-letter tag keys (#xx, #1, #, bare x, #é) must all be dropped.');
});

test('B5: buildFilterObj enforces tag-value shape — arrays of non-empty strings only (AC-8)', () => {
  const be = loadBackend();
  assert(be && typeof be.buildFilterObj === 'function', NOT_IMPL('buildFilterObj must be exported'));
  const out = be.buildFilterObj({ '#x': 'not-an-array', '#y': [], '#z': ['', 42, 'ok', null] });
  eq(out, { '#z': ['ok'] },
    'AC-8: non-array values dropped; empty arrays dropped; non-string/empty members filtered out.');
});

test('B6: buildCommand and buildPreviewCommand carry tag filters into the strfry argv/preview (AC-8)', () => {
  const be = loadBackend();
  assert(be && typeof be.buildCommand === 'function' && typeof be.buildPreviewCommand === 'function',
    NOT_IMPL('buildCommand/buildPreviewCommand must be exported'));
  const { cmd, args } = be.buildCommand('wss://relay.example', 'down', { kinds: [39999], '#z': ['v1'] });
  assert(cmd === 'strfry' && args[0] === 'sync', 'buildCommand still builds a strfry sync argv.');
  const filterArg = args[args.indexOf('--filter') + 1];
  const parsed = JSON.parse(filterArg);
  eq(parsed['#z'], ['v1'], 'AC-8: the --filter argv JSON must contain the tag filter.');
  const preview = be.buildPreviewCommand('wss://relay.example', 'down', { '#z': ['v1'] });
  assert(preview.includes('"#z"'), 'AC-8: the preview string must contain the tag filter key.');
});

// ===========================================================================
// S: ui/src/pages/settings/RelaySettings.jsx — SOURCE level (no JSX transpile)
// ===========================================================================

test('S1: RelaySettings.jsx declares TagFilterEditor and NegentropySync renders it with the running-disabled wiring (AC-1)', () => {
  const src = safeRead(RELAY_SETTINGS);
  assert(src.length > 0, 'ui/src/pages/settings/RelaySettings.jsx missing — unexpected.');
  assert(/function\s+TagFilterEditor\s*\(/.test(src),
    NOT_IMPL('RelaySettings.jsx must declare function TagFilterEditor (ADR §Implementation 2)'));
  const usage = src.match(/<TagFilterEditor[\s\S]*?\/>/);
  assert(usage, NOT_IMPL('NegentropySync must render <TagFilterEditor …/>'));
  assert(/disabled=\{running\}/.test(usage[0]),
    'TagFilterEditor must be disabled while a sync is running, like every other sub-panel input.');
});

test('S2: NegentropySync owns tagFilters state and contributes it to the filterObj composition point (AC-1, AC-2)', () => {
  const src = safeRead(RELAY_SETTINGS);
  assert(/\[\s*tagFilters\s*,\s*setTagFilters\s*\]\s*=\s*useState\(/.test(src),
    NOT_IMPL('NegentropySync must hold const [tagFilters, setTagFilters] = useState([…])'));
  assert(/filterObj\[\s*['"`]#['"`]\s*\+/.test(src),
    NOT_IMPL("the composition point must gain filterObj['#' + letter] = values so preview/Count/Start all pick tag filters up"));
});

test('S3: the Tag Filters group renders between Authors and Time Range (AC-1, story UI placement)', () => {
  const src = safeRead(RELAY_SETTINGS);
  const authorsIdx = src.indexOf('Authors');
  const tagIdx = src.indexOf('Tag Filters');
  const timeIdx = src.indexOf('Time Range');
  assert(tagIdx !== -1, NOT_IMPL("RelaySettings.jsx must render a 'Tag Filters' group label"));
  assert(authorsIdx !== -1 && timeIdx !== -1, 'Authors / Time Range labels vanished — unexpected regression.');
  assert(authorsIdx < tagIdx && tagIdx < timeIdx,
    'The Tag Filters group must sit between the Authors and Time Range groups (ADR §Implementation 2).');
});

test('S4: the editor is wired to the pure validation core, with Add and per-row Remove affordances (AC-3, AC-4, AC-5, AC-6)', () => {
  const src = safeRead(RELAY_SETTINGS);
  assert(/from\s+['"][./]*\.\.\/\.\.\/utils\/tagFilterValidation(\.js)?['"]/.test(src),
    NOT_IMPL('RelaySettings.jsx must import from ../../utils/tagFilterValidation'));
  for (const name of ['validateTagLetter', 'parseTagValues', 'mergeTagFilter']) {
    assert(src.includes(name), NOT_IMPL(`RelaySettings.jsx must use ${name} from the validation core`));
  }
  const editorIdx = src.search(/function\s+TagFilterEditor\s*\(/);
  assert(editorIdx !== -1, NOT_IMPL('TagFilterEditor must exist'));
  const body = src.slice(editorIdx);
  assert(/Add/.test(body), NOT_IMPL('TagFilterEditor must offer an Add affordance'));
  assert(/✕|Remove/i.test(body), NOT_IMPL('TagFilterEditor must offer a per-row remove affordance'));
});

test('S5: validation failures surface as an inline error and never mutate the filter list (AC-5, AC-6 blocking behavior)', () => {
  const src = safeRead(RELAY_SETTINGS);
  const editorIdx = src.search(/function\s+TagFilterEditor\s*\(/);
  assert(editorIdx !== -1, NOT_IMPL('TagFilterEditor must exist'));
  const nextFn = src.slice(editorIdx + 10).search(/\nfunction\s+\w+\s*\(/);
  const body = nextFn === -1 ? src.slice(editorIdx) : src.slice(editorIdx, editorIdx + 10 + nextFn);
  assert(/[eE]rror/.test(body),
    NOT_IMPL('TagFilterEditor must hold and render an inline error for rejected letters/values'));
  assert(!/fetch\s*\(/.test(body),
    'Validation is client-side and synchronous — the editor itself must not call the network.');
});

// ===========================================================================
// R: regression sentinels — PASS before AND after (additive change)
// ===========================================================================

test('R1: negentropySync.js still exports registerNegentropySyncRoutes and registers the four routes', () => {
  const be = loadBackend();
  assert(be && typeof be.registerNegentropySyncRoutes === 'function',
    'registerNegentropySyncRoutes must remain the route-registration entry point.');
  const src = safeRead(BACKEND);
  for (const route of ['/api/strfry/negentropy-sync', '/api/strfry/negentropy-sync/stream', '/api/strfry/negentropy-sync/status', '/api/strfry/negentropy-sync/count']) {
    assert(src.includes(`'${route}'`), `route ${route} must remain registered.`);
  }
});

test('R2: the panel still serializes the one filterObj into both Start and Count requests', () => {
  const src = safeRead(RELAY_SETTINGS);
  const hits = src.match(/filter:\s*JSON\.stringify\(filterObj\)/g) || [];
  assert(hits.length >= 2,
    'handleStart and handleCount must keep sending JSON.stringify(filterObj) — the single composition point is the contract tag filters ride on.');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail };
}

module.exports = { run };
