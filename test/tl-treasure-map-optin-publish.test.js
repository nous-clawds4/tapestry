/**
 * tl-treasure-map #3: TL opt-in, preview, and publish.
 *
 * Story: engineering-team/stories/tl-treasure-map/3-tl-opt-in-preview-publish.md
 * ADR consumed (not authored): engineering-team/decisions/tl-treasure-map/0001-treasure-map-tl-advertisement-convention.md
 *
 * Three classes (house pattern — canonical rationale in test/in-app-badged-ta-avatar.test.js;
 * ESM behavioral import per test/event-page-ui.test.js):
 *   U (behavioral) — findGenericTlDelegation / upsertGenericTlTag imported and exercised
 *                    directly. FAIL now: the exports don't exist yet.
 *   S (structure)  — the opt-in card and page wiring exist as source text. FAIL now.
 *   R (sentinel)   — the story-2 panel, the no-Map path, the publish gate hook, and the
 *                    publishOrThrow contract. PASS before and after.
 *
 * The story's scoped gate runs this suite plus the three guard suites named at Gate A
 * (global-publish-gate, strfry-write-assertion-bracket, treasure-maps-router-preset).
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const UTIL = path.resolve(__dirname, '../ui/src/utils/treasureMap.js');
const CARD = path.resolve(__dirname, '../ui/src/pages/grapevine/TlOptInCard.jsx');
const PAGE = path.resolve(__dirname, '../ui/src/pages/grapevine/TrustedAssertions.jsx');
const NOSTR_PUBLISH = path.resolve(__dirname, '../ui/src/utils/nostrPublish.js');
const PUBLISH_PROFILE_TAG = path.resolve(__dirname, '../ui/src/utils/publishProfileTag.js');

const PK_A = 'a'.repeat(64); // stands in for the local TA
const PK_B = 'b'.repeat(64); // an external delegate

// Copy amended at the operator's pre-close cosmetic pass (2026-08-27).
const PROMPT = 'Would you like the local Tapestry instance to publish your Trusted Lists for pubkeys on your behalf? If so, you will need to update your Treasure Map so external clients can find your Trusted Lists.';

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

async function helpers() {
  const mod = await loadEsm(UTIL);
  assert(mod && typeof mod.findGenericTlDelegation === 'function' && typeof mod.upsertGenericTlTag === 'function',
    'ui/src/utils/treasureMap.js must export findGenericTlDelegation and upsertGenericTlTag (Design note)');
  return mod;
}

function baseEvent(tags, created_at = 1700000000) {
  return { kind: 10040, created_at, content: '', tags };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── U: upsert + salient-check behavior ────────────────────── */

test('U1: no generic entry → the new entry is appended, everything else verbatim', async () => {
  const { upsertGenericTlTag } = await helpers();
  const orig = [['30382:rank', PK_B, 'wss://r1'], ['d', 'x'], ['30382:followers', PK_B, 'wss://r1']];
  const ev = baseEvent(orig.map((t) => [...t]));
  const out = upsertGenericTlTag(ev, 30392, PK_A, 'wss://tl');
  assert(out.tags.length === orig.length + 1, 'AC-3: appended when absent');
  assert(deepEq(out.tags.slice(0, orig.length), orig), 'AC-3: original tags preserved verbatim, in order');
  assert(deepEq(out.tags[out.tags.length - 1], ['30392', PK_A, 'wss://tl']), 'AC-3: exact ADR §1 shape appended');
  assert(out.kind === 10040, 'kind stays 10040');
});

test('U2: an external generic entry is replaced in place, length unchanged', async () => {
  const { upsertGenericTlTag } = await helpers();
  const orig = [['30382:rank', PK_B, 'wss://r1'], ['30392', PK_B, 'wss://ext'], ['d', 'x']];
  const ev = baseEvent(orig.map((t) => [...t]));
  const out = upsertGenericTlTag(ev, 30392, PK_A, 'wss://tl');
  assert(out.tags.length === orig.length, 'AC-3: replace, not append');
  assert(deepEq(out.tags[1], ['30392', PK_A, 'wss://tl']), 'AC-3: replaced at the original index');
  assert(deepEq(out.tags[0], orig[0]) && deepEq(out.tags[2], orig[2]), 'AC-3: neighbors verbatim');
});

test('U3: wild duplicate generic entries normalize to exactly one, at the first position', async () => {
  const { upsertGenericTlTag } = await helpers();
  const orig = [['d', 'x'], ['30392', PK_B, 'wss://e1'], ['30382:rank', PK_B, 'wss://r1'], ['30392', PK_B, 'wss://e2']];
  const ev = baseEvent(orig.map((t) => [...t]));
  const out = upsertGenericTlTag(ev, 30392, PK_A, 'wss://tl');
  const generics = out.tags.filter((t) => t[0] === '30392');
  assert(generics.length === 1, 'E2/ADR §3: writer normalizes to at most one generic entry');
  assert(deepEq(out.tags[1], ['30392', PK_A, 'wss://tl']), 'E2: kept at the first occurrence’s position');
  assert(out.tags.length === orig.length - 1, 'E2: the later duplicate is dropped');
});

test('U4: created_at is strictly greater than the old event’s even under future clock skew', async () => {
  const { upsertGenericTlTag } = await helpers();
  const skewed = Math.floor(Date.now() / 1000) + 10000;
  const out = upsertGenericTlTag(baseEvent([['d', 'x']], skewed), 30392, PK_A, 'wss://tl');
  assert(out.created_at > skewed,
    'E1: a replacement stamped ≤ the old created_at would be silently ignored by every relay');
});

test('U5: unconfigured relay → empty-string hint; content and kind preserved', async () => {
  const { upsertGenericTlTag } = await helpers();
  const ev = { kind: 10040, created_at: 1700000000, content: 'hello', tags: [['d', 'x']] };
  const out = upsertGenericTlTag(ev, 30392, PK_A, undefined);
  const entry = out.tags.find((t) => t[0] === '30392');
  assert(deepEq(entry, ['30392', PK_A, '']), 'E5/ADR §5: empty-string hint keeps the three-element shape');
  assert(out.content === 'hello', 'AC-3: content preserved');
});

test('U6: salient check — absent, local-vs-external, named-only inert, delegate-less inert', async () => {
  const { findGenericTlDelegation } = await helpers();
  assert(findGenericTlDelegation([['30382:rank', PK_B, 'r']]) === null, 'AC-1: no generic entry → absent');
  const found = findGenericTlDelegation([['30392', PK_A, 'wss://tl']]);
  assert(found && found.pubkey === PK_A, 'AC-1: generic entry found with its delegate');
  assert(findGenericTlDelegation([['30392:mylist', PK_B, 'r']]) === null, 'E3: named entries are inert for the check');
  assert(findGenericTlDelegation([['30392']]) === null, 'E4: delegate-less bare entry is inert (story-2 demotion rule)');
  assert(findGenericTlDelegation([['30392', 'nothex', 'r']]) === null, 'E4: malformed delegate is inert');
});

test('U7: first occurrence wins when wild duplicates disagree', async () => {
  const { findGenericTlDelegation } = await helpers();
  const row = findGenericTlDelegation([['30392', PK_A, 'r1'], ['30392', PK_B, 'r2']]);
  assert(row && row.pubkey === PK_A, 'AC-1/ADR §4: the first generic entry is the one that counts');
});

/* ── S: card + page structure ──────────────────────────────── */

test('S1: TlOptInCard exists, wires the guard/publish chain, and carries the verbatim prompt', () => {
  const card = safeRead(CARD);
  assert(card.length > 0, 'ui/src/pages/grapevine/TlOptInCard.jsx must exist (Design note)');
  assert(/from\s+'\.\.\/\.\.\/utils\/treasureMap'/.test(card) && /findGenericTlDelegation/.test(card) && /upsertGenericTlTag/.test(card),
    'AC-1/AC-3: card uses the shared helpers');
  assert(/getActiveSignerOrThrow/.test(card), 'AC-4: drift-guarded signing (signerGuard)');
  assert(/publishOrThrow/.test(card), 'AC-4: publish via the both-fail-throws contract');
  assert(card.includes(PROMPT), 'AC-2: the operator’s prompt sentence, verbatim');
  assert(/aTrustedListRelays/.test(card), 'AC-3/ADR §5: relay hint from aRelays.aTrustedListRelays');
});

test('S2: the preview renders the exact updated unsigned event as JSON', () => {
  const card = safeRead(CARD);
  assert(/JSON\.stringify/.test(card), 'AC-3: preview serializes the upsert result');
  assert(/[Pp]review/.test(card), 'AC-3: a preview affordance exists wherever publish is visible');
});

test('S3: the page mounts the card and refreshes via onPublished={search}', () => {
  const page = safeRead(PAGE);
  assert(/import\s+TlOptInCard/.test(page) && /<TlOptInCard/.test(page), 'AC-4: page mounts the card');
  assert(/onPublished=\{search\}/.test(page), 'AC-4: success re-runs the page’s search');
});

test('R5: no 64-hex pubkey literal in the card or the util (passes on the empty tree; binds once the files exist)', () => {
  for (const [name, src] of [['TlOptInCard.jsx', safeRead(CARD)], ['treasureMap.js', safeRead(UTIL)]]) {
    assert(!/[0-9a-fA-F]{64}/.test(src),
      `AC-1 / CLAUDE.md § per-deployment TA pubkey: ${name} must not carry a 64-hex literal`);
  }
});

test('S5: no judgment renders while taPubkey is unresolved', () => {
  const card = safeRead(CARD);
  assert(/taPubkey/.test(card) && /(!taPubkey|taPubkey\s*(\?|&&))/.test(card),
    'AC-1: the card must not judge local/external before the runtime TA pubkey resolves');
});

test('S6: failures surface in the card without corrupting page state', () => {
  const card = safeRead(CARD);
  assert(/[Ee]rror/.test(card) && /catch/.test(card),
    'AC-5: signer/publish failures are caught and rendered, not thrown at the page');
});

/* ── R: regression sentinels (pass before and after) ───────── */

test('R1: story-2 panel still mounted; no-Map path intact', () => {
  const page = safeRead(PAGE);
  assert(/<TreasureMapTagsPanel/.test(page), 'AC-6: Map Entries panel untouched');
  assert(page.includes('No Trusted Assertions event found'), 'AC-6: no-Map headline intact');
});

test('R2: the raw-event toggle is untouched', () => {
  assert(safeRead(PAGE).includes('Show raw event'), 'AC-6: raw toggle intact');
});

test('R3: the local-only publish gate hook is untouched in nostrPublish', () => {
  const np = safeRead(NOSTR_PUBLISH);
  assert(/skippedByGate/.test(np) && /isExternalPublishAllowed/.test(np),
    'AC-4: publishing through publishEverywhere inherits the deployment gate — the hook must stay');
});

test('R4: publishOrThrow still throws only when BOTH local and external fail', () => {
  assert(/!localOk\s*&&\s*!externalOk/.test(safeRead(PUBLISH_PROFILE_TAG)),
    'E7: partial success (local OK, external failing) stays acceptable — the router redistributes');
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
