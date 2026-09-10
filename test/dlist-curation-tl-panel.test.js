/**
 * dlist-curation #1: Trusted Lists panel — new prompt copy, collapsed-by-default status line.
 *
 * Story: engineering-team/stories/dlist-curation/1-tl-panel-copy-and-collapse.md
 * ADR:   engineering-team/decisions/dlist-curation/0001-tl-panel-disclosure-and-copy.md
 *
 * Three classes (house pattern — canonical rationale in test/in-app-badged-ta-avatar.test.js;
 * ESM behavioral import per test/tl-treasure-map-optin-publish.test.js):
 *   U (behavioral) — describeTlDelegation imported from ui/src/utils/treasureMap.js and
 *                    exercised directly, alone and composed with findGenericTlDelegation.
 *                    FAIL now: the export does not exist.
 *   S (structure)  — the card folds (a real disclosure control whose expanded state gates the
 *                    body, initialised closed), carries the four-sentence copy verbatim, owns a
 *                    single title, and takes its labels from the helper. FAIL now.
 *   R (sentinel)   — the publish chain, the per-user-assistant baseline, the page wiring, the
 *                    neighbouring panels, and the util's existing exports. PASS before and after.
 *
 * What this file cannot prove: that a click or a key press actually folds the panel on a
 * screen. The card renders only for a signed-in user with a provisioned assistant, which the
 * automated browser cannot supply (no NIP-07 signer) — so the fold's live behaviour is the
 * operator's check at review, the same boundary tl-treasure-map #3 drew.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const UI = path.resolve(__dirname, '../ui/src');
const CARD = path.join(UI, 'pages/grapevine/TlOptInCard.jsx');
const PAGE = path.join(UI, 'pages/grapevine/TrustedAssertions.jsx');
const PRESENCE = path.join(UI, 'pages/grapevine/TreasureMapRelayPresence.jsx');
const MANUAL = path.join(UI, 'pages/grapevine/TreasureMapManualEdit.jsx');
const UTIL = path.join(UI, 'utils/treasureMap.js');

const PK_ASSISTANT = 'a'.repeat(64);
const PK_OTHER = '0123456789abcdef'.repeat(4);

// AC-1, verbatim (the old two-sentence prompt is the suffix — the tl-treasure-map #3 sentinel
// keeps passing by construction).
const COPY = 'Tags of pubkeys greatly enrich Vespa search on brainstorm.world. For this to work, a kind 30392 Trusted List should be published for each Tag. Would you like the local Tapestry instance to publish your Trusted Lists for pubkeys on your behalf? If so, you will need to update your Treasure Map so external clients can find your Trusted Lists.';
const TITLE = 'Trusted Lists for Pubkeys';

// AC-3 labels (operator-approved at the story gate, 2026-09-10).
const LABEL_LOCAL = '✅ Your Tapestry Assistant';
const LABEL_ABSENT = '○ Not set';
const labelExternal = (pk) => `⚠️ Another publisher · ${pk.slice(0, 8)}…${pk.slice(-4)}`;

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

async function helpers() {
  const mod = await loadEsm(UTIL);
  assert(mod && typeof mod.describeTlDelegation === 'function',
    'ui/src/utils/treasureMap.js must export describeTlDelegation(delegation, assistantPubkey) (ADR 0001 §1)');
  return mod;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── U: the three-state descriptor ─────────────────────────── */

test('U1: describeTlDelegation is exported from the treasure-map util', async () => {
  await helpers();
});

test('U2: no baseline, no judgment — a missing assistant pubkey yields null in every state', async () => {
  const { describeTlDelegation } = await helpers();
  const del = { kind: 30392, name: null, pubkey: PK_OTHER, relay: null };
  for (const baseline of [null, undefined, '']) {
    assert(describeTlDelegation(del, baseline) === null, 'AC-3/AC-5: no state renders before the assistant resolves (delegation present)');
    assert(describeTlDelegation(null, baseline) === null, 'AC-3/AC-5: no state renders before the assistant resolves (delegation absent)');
  }
});

test('U3: absent — no delegation reads "○ Not set"', async () => {
  const { describeTlDelegation } = await helpers();
  const d = describeTlDelegation(null, PK_ASSISTANT);
  assert(d && d.status === 'absent', 'AC-3: status "absent" when the Map carries no generic 30392 entry');
  assert(d.label === LABEL_ABSENT, `AC-3: label must be exactly "${LABEL_ABSENT}", got "${d.label}"`);
  assert(d.tone === 'none', 'ADR 0001 §1: absent carries the muted tone');
});

test('U4: local — the delegate IS the signed-in user\'s assistant', async () => {
  const { describeTlDelegation } = await helpers();
  const d = describeTlDelegation({ kind: 30392, name: null, pubkey: PK_ASSISTANT, relay: 'wss://tl' }, PK_ASSISTANT);
  assert(d && d.status === 'local', 'AC-3: status "local" when the delegate equals the assistant');
  assert(d.label === LABEL_LOCAL, `AC-3: label must be exactly "${LABEL_LOCAL}", got "${d.label}"`);
  assert(d.tone === 'ok', 'ADR 0001 §1: local carries the ok tone');
});

test('U5: external — another delegate is named in short form', async () => {
  const { describeTlDelegation } = await helpers();
  const d = describeTlDelegation({ kind: 30392, name: null, pubkey: PK_OTHER, relay: null }, PK_ASSISTANT);
  assert(d && d.status === 'external', 'AC-3: status "external" when the delegate differs from the assistant');
  assert(d.label === labelExternal(PK_OTHER), `AC-3: label must be exactly "${labelExternal(PK_OTHER)}", got "${d.label}"`);
  assert(d.tone === 'warn', 'ADR 0001 §1: external carries the warn tone');
});

test('U6: never throws — a delegate-less row and garbage inputs read as absent', async () => {
  const { describeTlDelegation } = await helpers();
  for (const junk of [{ pubkey: null }, {}, 'nope', 42, [], { pubkey: 7 }]) {
    let d;
    try { d = describeTlDelegation(junk, PK_ASSISTANT); } catch (e) { throw new Error(`E1: must not throw on ${JSON.stringify(junk)}: ${e.message}`); }
    assert(d && d.status === 'absent' && d.label === LABEL_ABSENT, `E1: ${JSON.stringify(junk)} is no delegation — reads absent`);
  }
});

test('U7: composed with findGenericTlDelegation the way the card composes them', async () => {
  const { describeTlDelegation, findGenericTlDelegation } = await helpers();
  assert(typeof findGenericTlDelegation === 'function', 'R: findGenericTlDelegation still exported');
  const local = [['30382:rank', PK_OTHER, 'wss://r'], ['30392', PK_ASSISTANT, 'wss://tl']];
  const external = [['30392', PK_OTHER, 'wss://ext']];
  const named = [['30392:some-list', PK_OTHER, 'wss://ext']];          // named entries are inert (ADR tl-treasure-map/0001 §4)
  const dupes = [['30392', PK_OTHER, 'wss://a'], ['30392', PK_ASSISTANT, 'wss://b']]; // first occurrence wins
  assert(describeTlDelegation(findGenericTlDelegation(local, 30392), PK_ASSISTANT).status === 'local', 'AC-3: generic entry → local');
  assert(describeTlDelegation(findGenericTlDelegation(external, 30392), PK_ASSISTANT).status === 'external', 'AC-3: generic entry to another → external');
  assert(describeTlDelegation(findGenericTlDelegation([], 30392), PK_ASSISTANT).status === 'absent', 'AC-3: no entry → absent');
  assert(describeTlDelegation(findGenericTlDelegation(named, 30392), PK_ASSISTANT).status === 'absent', 'E3: a named-only 30392 entry is inert → absent');
  const d = describeTlDelegation(findGenericTlDelegation(dupes, 30392), PK_ASSISTANT);
  assert(d.status === 'external' && d.label === labelExternal(PK_OTHER), 'E3: wild duplicates — first occurrence wins, label names it');
});

/* ── S: the card folds, and says the right things ──────────── */

/** The identifier bound to aria-expanded on the card's disclosure control, or null. */
function foldState(card) {
  const m = card.match(/aria-expanded=\{\s*([A-Za-z_$][\w$]*)\s*\}/);
  return m ? m[1] : null;
}

test('S1: the card takes its verdict from describeTlDelegation, imported from the shared util', () => {
  const card = safeRead(CARD);
  assert(/from\s+'\.\.\/\.\.\/utils\/treasureMap'/.test(card), 'ADR 0001 §2: the card imports from the shared util');
  assert(/describeTlDelegation\s*\(/.test(card), 'AC-3: the card calls describeTlDelegation for the status line');
});

test('S2: a real disclosure control whose expanded state gates the body', () => {
  const card = safeRead(CARD);
  const id = foldState(card);
  assert(id, 'AC-4: the header carries aria-expanded={<state>} (a control, not a clickable div)');
  assert(/role=["']button["']/.test(card), 'AC-4: the header is role="button"');
  assert(/tabIndex=\{0\}/.test(card), 'AC-4: the header is focusable (tabIndex={0})');
  assert(new RegExp(`\\{\\s*${id}\\s*&&`).test(card), `AC-2/AC-4: the body renders only under {${id} && …}`);
});

test('S3: collapsed by default — the fold state is initialised false', () => {
  const card = safeRead(CARD);
  const id = foldState(card);
  assert(id, 'AC-2: needs the disclosure control first (S2)');
  assert(new RegExp(`const\\s*\\[\\s*${id}\\s*,\\s*[A-Za-z_$][\\w$]*\\s*\\]\\s*=\\s*useState\\(\\s*false\\s*\\)`).test(card),
    `AC-2: [${id}, …] = useState(false) — every load starts folded, in every state`);
});

test('S4: keyboard — Enter and Space toggle, and Space does not scroll the page', () => {
  const card = safeRead(CARD);
  assert(/onKeyDown/.test(card), 'AC-4: the control handles keyboard activation');
  assert(/['"]Enter['"]/.test(card) && /['"] ['"]/.test(card), 'AC-4: Enter and Space both toggle');
  assert(/preventDefault\s*\(/.test(card), 'AC-4: Space is prevented from scrolling (the settled idiom, TreasureMapRelayPresence)');
});

test('S5: one title, in the header, with the disclosure glyph beside it', () => {
  const card = safeRead(CARD);
  const h4s = (card.match(/<h4\b/g) || []).length;
  assert(h4s === 1, `AC-2: exactly one <h4> (the header owns the title); found ${h4s}`);
  const at = card.indexOf(TITLE);
  assert(at > 0, 'AC-2: the title "Trusted Lists for Pubkeys" is present');
  const before = card.slice(Math.max(0, at - 120), at);
  assert(before.includes('▾') && before.includes('▸'), 'AC-2/AC-4: the title line shows ▾ when open and ▸ when closed');
  assert(/aria-label=/.test(card), 'AC-3: the control names the panel and its state for assistive tech');
});

test('S6: the status labels come from the helper — none is hard-coded in the card', () => {
  const card = safeRead(CARD);
  for (const label of [LABEL_LOCAL, LABEL_ABSENT, 'Another publisher']) {
    assert(!card.includes(label), `ADR 0001 §1: "${label}" belongs to describeTlDelegation, not the card`);
  }
});

test('S7: the prompt reads the operator\'s four sentences, verbatim', () => {
  const card = safeRead(CARD);
  assert(card.includes(COPY), 'AC-1: the four-sentence prompt, verbatim, as one string');
});

/* ── R: regression sentinels (pass before and after) ───────── */

test('R1: the page still mounts the card once, refreshes via onPublished={search}, in the same position', () => {
  const page = safeRead(PAGE);
  assert(/import\s+TlOptInCard/.test(page) && (page.match(/<TlOptInCard/g) || []).length === 1, 'AC-6: single mount');
  assert(/<TlOptInCard[^>]*onPublished=\{search\}/.test(page), 'AC-6: success still re-runs the page search');
  const at = (needle) => page.indexOf(needle);
  assert(at('<TreasureMapTagsPanel') < at('Show raw event') && at('Show raw event') < at('<TlOptInCard') && at('<TlOptInCard') < at('<TreasureMapManualEdit'),
    'AC-6: page order entries → raw event → Trusted Lists panel → hand edit');
});

test('R2: the publish chain and the body\'s affordances survive the fold', () => {
  const card = safeRead(CARD);
  for (const needle of ['getActiveSignerOrThrow', 'publishOrThrow', 'upsertGenericTlTag', 'findGenericTlDelegation',
    'aTrustedListRelays', 'JSON.stringify', 'Preview updated event', 'Hide preview', 'Yes — update my Treasure Map',
    'Published by your Tapestry Assistant', 'does not yet delegate', 'Currently delegated to an external publisher']) {
    assert(card.includes(needle), `AC-4: expanded body unchanged — "${needle}" must remain`);
  }
  assert(/catch/.test(card) && /[Ee]rror/.test(card), 'AC-4: failures still surface inside the card');
});

test('R3: the baseline is the signed-in user\'s assistant, guarded while unresolved; no owner TA, no hex literal', () => {
  const card = safeRead(CARD);
  assert(/useAuth\s*\(/.test(card) && /assistantPubkey/.test(card), 'AC-3: useAuth().user.assistantPubkey is the baseline');
  assert(/!assistantPubkey/.test(card) && /return null/.test(card), 'AC-5: no assistant → the card renders nothing');
  assert(!/taPubkey/.test(card), 'OPEN.md 188 pin: ConfigContext.taPubkey (the owner) must not appear in the card');
  for (const [name, src] of [['TlOptInCard.jsx', card], ['treasureMap.js', safeRead(UTIL)]]) {
    assert(!/[0-9a-fA-F]{64}/.test(src), `CLAUDE.md § per-deployment TA pubkey: ${name} carries no 64-hex literal`);
  }
});

test('R4: the neighbouring panels are untouched', () => {
  const presence = safeRead(PRESENCE);
  assert(/aria-expanded=\{open\}/.test(presence) && presence.includes('Where this Map lives'), 'AC-6: relay-presence panel keeps its own disclosure');
  assert(safeRead(MANUAL).includes('Update your kind 10040 event Treasure Map by hand'), 'AC-6: hand-edit panel intact');
  const page = safeRead(PAGE);
  assert(/<TreasureMapTagsPanel/.test(page) && page.includes('Show raw event') && page.includes('No Trusted Assertions event found'),
    'AC-6: Map Entries, raw toggle, no-Map path intact');
});

test('R5: the util\'s existing exports are all still there', async () => {
  const mod = await loadEsm(UTIL);
  assert(mod, 'ui/src/utils/treasureMap.js must import');
  for (const name of ['classifyEntry', 'findGenericTlDelegation', 'upsertGenericTlTag', 'composeManualUpdate',
    'buildPresenceTargets', 'compareMapVersions', 'summarizePresence', 'planRelaySync']) {
    assert(typeof mod[name] === 'function', `AC-6: ${name} still exported`);
  }
  const ev = { kind: 10040, created_at: 1700000000, content: '', tags: [['30392', PK_OTHER, 'wss://x']] };
  const out = mod.upsertGenericTlTag(ev, 30392, PK_ASSISTANT, 'wss://tl');
  assert(deepEq(out.tags, [['30392', PK_ASSISTANT, 'wss://tl']]) && out.created_at > ev.created_at, 'AC-6: upsert semantics unchanged');
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
