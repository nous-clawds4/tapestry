/**
 * tl-treasure-map #2: Treasure-Map tags panel.
 *
 * Story: engineering-team/stories/tl-treasure-map/2-treasure-map-tags-panel.md
 * ADR consumed (not authored): engineering-team/decisions/tl-treasure-map/0001-treasure-map-tl-advertisement-convention.md
 *
 * Three classes (house pattern — see test/in-app-badged-ta-avatar.test.js's header for the
 * canonical rationale; ESM behavioral import per test/event-page-ui.test.js):
 *   U (behavioral) — classifyEntry() dynamically imported and exercised directly. FAIL now:
 *                    ui/src/utils/treasureMap.js does not exist yet.
 *   S (structure)  — the panel component and page wiring exist as source text. FAIL now.
 *   R (sentinel)   — what the Design note promised not to disturb. PASS before and after;
 *                    they fail only on collateral damage.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const UTIL = path.resolve(__dirname, '../ui/src/utils/treasureMap.js');
const PANEL = path.resolve(__dirname, '../ui/src/pages/grapevine/TreasureMapTagsPanel.jsx');
const PAGE = path.resolve(__dirname, '../ui/src/pages/grapevine/TrustedAssertions.jsx');
const SEARCH_PREFS = path.resolve(__dirname, '../ui/src/pages/grapevine/SearchPreferences.jsx');

const PK = 'e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f';

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function classifier() {
  const mod = await loadEsm(UTIL);
  assert(mod && typeof mod.classifyEntry === 'function',
    'ui/src/utils/treasureMap.js must exist and export classifyEntry(tag) (Design note; ADR 0001 consumer guidance)');
  return mod.classifyEntry;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── U: classifyEntry behavior ─────────────────────────────── */

test('U1: NIP-85 kind:metric entry classifies as Trusted Assertion with its name', async () => {
  const classifyEntry = await classifier();
  const r = classifyEntry(['30382:rank', PK, 'wss://nip85.brainstorm.world']);
  assert(r.cls === 'ta', `AC-2: "30382:rank" must classify ta, got ${r.cls}`);
  assert(r.kind === 30382, `kind must be 30382, got ${r.kind}`);
  assert(r.name === 'rank', `name must be "rank", got ${r.name}`);
  assert(r.pubkey === PK, 'pubkey must be extracted');
});

test('U2: generic bare-kind TL entry classifies as Trusted List with no name', async () => {
  const classifyEntry = await classifier();
  const r = classifyEntry(['30392', PK, 'wss://nip85.brainstorm.world']);
  assert(r.cls === 'tl', `AC-2/ADR §1: bare "30392" must classify tl, got ${r.cls}`);
  assert(r.kind === 30392, `kind must be 30392, got ${r.kind}`);
  assert(r.name === null, `generic entry has no name, got ${r.name}`);
  assert(r.relay === 'wss://nip85.brainstorm.world', 'relay hint must be extracted');
});

test('U3: named TL entry (reserved), range edges, and out-of-family kinds', async () => {
  const classifyEntry = await classifier();
  const named = classifyEntry(['30392:mylist', PK, '']);
  assert(named.cls === 'tl' && named.name === 'mylist',
    'E2/ADR reservation: "30392:mylist" classifies tl with name shown');
  assert(classifyEntry(['30389', PK, '']).cls === 'ta', 'range edge: 30389 is ta');
  assert(classifyEntry(['30390', PK, '']).cls === 'tl', 'range edge: 30390 is tl');
  assert(classifyEntry(['30399', PK, '']).cls === 'tl', 'range edge: 30399 is tl');
  assert(classifyEntry(['39999', PK, '']).cls === 'other', 'out-of-family numeric kind is other');
});

test('U4: classifying a whole tag list preserves length and order', async () => {
  const classifyEntry = await classifier();
  const tags = [
    ['30382:rank', PK, 'wss://a'],
    ['d', 'something'],
    ['30392', PK, 'wss://b'],
    ['alt', 'a treasure map'],
  ];
  const rows = tags.map(classifyEntry);
  assert(rows.length === tags.length, 'AC-1: one row per tag, none omitted');
  assert(rows[0].cls === 'ta' && rows[2].cls === 'tl', 'order preserved');
  assert(rows[1].cls === 'other' && rows[3].cls === 'other', 'non-delegation tags are other');
});

test('U5: relay hint extracted when present, null when absent', async () => {
  const classifyEntry = await classifier();
  assert(classifyEntry(['30382:rank', PK, 'wss://r']).relay === 'wss://r', 'AC-5: relay extracted');
  assert(classifyEntry(['30382:rank', PK]).relay === null, 'missing third element → relay null');
});

test('U6: non-delegation tag has no pubkey and classifies other', async () => {
  const classifyEntry = await classifier();
  const r = classifyEntry(['d', 'xyz']);
  assert(r.cls === 'other', 'AC-6: ["d", …] is other');
  assert(r.pubkey === null, 'AC-6: no avatar pubkey for non-hex second element');
});

test('U7: malformed tags never throw', async () => {
  const classifyEntry = await classifier();
  for (const bad of [[], ['30392'], ['p'], ['30382:rank', 'nothex'], [null], [42, 7]]) {
    const r = classifyEntry(bad);
    assert(r && typeof r === 'object', `AC-6: classifyEntry(${JSON.stringify(bad)}) must return a row object`);
    assert(r.pubkey === null, `malformed/short tag yields pubkey null (${JSON.stringify(bad)})`);
  }
});

test('U8: uppercase-hex pubkey accepted case-insensitively, normalized lowercase', async () => {
  const classifyEntry = await classifier();
  const r = classifyEntry(['30392', PK.toUpperCase(), 'wss://r']);
  assert(r.pubkey === PK, 'E3: wild uppercase hex must normalize to lowercase for links/compare');
});

/* ── S: panel + page structure ─────────────────────────────── */

test('S2: TreasureMapTagsPanel exists, uses the classifier + Avatar, links profiles, and the page mounts it', () => {
  const panel = safeRead(PANEL);
  assert(panel.length > 0, 'ui/src/pages/grapevine/TreasureMapTagsPanel.jsx must exist (Design note)');
  assert(/from\s+'\.\.\/\.\.\/utils\/treasureMap'/.test(panel), 'panel imports the shared classifier (Design note: story 3 reuses it)');
  assert(/from\s+'\.\.\/\.\.\/components\/Avatar'/.test(panel), 'AC-3: panel reuses components/Avatar.jsx');
  assert(panel.includes('/tapestry/users/'), 'AC-3: avatar/pubkey links to /tapestry/users/<pubkey>');
  const page = safeRead(PAGE);
  assert(/import\s+TreasureMapTagsPanel/.test(page) && /<TreasureMapTagsPanel/.test(page),
    'AC-1: TrustedAssertions.jsx imports and renders the panel');
});

test('S3: panel batch-fetches kind-0 profiles and tolerates fetch failure', () => {
  const panel = safeRead(PANEL);
  assert(panel.includes('/api/profiles?pubkeys='), 'AC-3: batch profile fetch via /api/profiles?pubkeys=');
  assert(/\.catch\s*\(/.test(panel) || /catch\s*\{/.test(panel) || /catch\s*\(/.test(panel),
    'edge (not-covered boundary): profile-fetch failure must not throw — a catch is present');
});

test('S4: panel judges delegation against the SIGNED-IN USER\'S assistant, never the owner TA', () => {
  const panel = safeRead(PANEL);
  assert(/useAuth\s*\(/.test(panel) && /assistantPubkey/.test(panel),
    'AC-4 (as amended, treasure-map-user-assistant #1): baseline = useAuth().user.assistantPubkey');
  assert(!/taPubkey/.test(panel),
    'escaped-defect pin (OPEN.md 188): ConfigContext.taPubkey is the OWNER assistant — it must not appear in the panel');
});

test('S5: badge logic is guarded while the user assistant is still unresolved', () => {
  const panel = safeRead(PANEL);
  assert(/external/i.test(panel) && /Your assistant/i.test(panel), 'AC-4: both labels exist');
  assert(/(!assistantPubkey|assistantPubkey\s*(\?|&&))/.test(panel),
    'E1: the badge must not flash "external" before the user\'s assistantPubkey resolves (null ⇒ no badge)');
});

test('S6: zero-tag Map renders an explicit empty state', () => {
  const panel = safeRead(PANEL);
  assert(/tags\.length/.test(panel) && /no tags/i.test(panel),
    'E4: a zero-tag Map shows an explicit empty state, not a blank region');
});

test('S7: profile fetch dedupes pubkeys', () => {
  const panel = safeRead(PANEL);
  assert(/new Set\s*\(/.test(panel), 'E5: duplicate pubkeys across rows fetch once (Set-dedup)');
});

/* ── R: regression sentinels (pass before and after) ───────── */

test('R1: the no-Map-found path is untouched', () => {
  const page = safeRead(PAGE);
  assert(page.includes('No Trusted Assertions event found'), 'AC-7: not-found headline intact');
  assert(page.includes('https://brainstorm.nosfabrica.com'), 'AC-7: WoT-provider pointer intact');
});

test('R2: the raw-event toggle is untouched', () => {
  const page = safeRead(PAGE);
  assert(page.includes('Show raw event'), 'AC-7: raw toggle intact');
});

test('R3: no 64-hex pubkey literal in the changed/new UI files', () => {
  for (const [name, src] of [['treasureMap.js', safeRead(UTIL)], ['TreasureMapTagsPanel.jsx', safeRead(PANEL)], ['TrustedAssertions.jsx', safeRead(PAGE)]]) {
    assert(!/[0-9a-fA-F]{64}/.test(src),
      `AC-4 / CLAUDE.md § per-deployment TA pubkey: ${name} must not carry a 64-hex literal`);
  }
});

test('R4: SearchPreferences keeps its own 30382: prefix filter (ADR blast-radius row)', () => {
  const sp = safeRead(SEARCH_PREFS);
  assert(sp.includes("startsWith('30382:')"),
    'Design-note non-consumer claim: parseMetrics is untouched and still filters 30382:-prefixed entries');
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
