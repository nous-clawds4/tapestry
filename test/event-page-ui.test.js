/**
 * Stories event-page #2 (param render) + #3 (search fallback). ADR event-page/0002.
 * See the two .test-plan.md files alongside the stories.
 *
 * ADR 0002 chose Option A: a pure ui/src/utils/eventParam.js (resolveEventParams +
 * classifyEventInput, nip19-based), a ui/src/hooks/useEventResolve.js, a reworked
 * ui/src/pages/BrainstormEvent.jsx (pure exported renderResolvedEvent + EVENT_COPY),
 * and an EventSearch field that resolves by navigating to the canonical /event?<type>=<v>.
 * The /event route already exists in App.jsx (no routing change).
 *
 * TEST LEVEL: the pure eventParam.js is EXECUTED (plain JS + nip19, runs in the Node
 * runner via dynamic import — like nostrEntities in live-feed-feed-page.test.js); the
 * React page/hook/component are asserted at the SOURCE level (no JSX transpile in the
 * harness). eventParam.js / the page / hook do not exist pre-implementation, so the
 * U-tests FAIL now and PASS once built. R* are regression sentinels (additive — the
 * /event route already exists), PASS before AND after.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { nip19, generateSecretKey, getPublicKey } = require('nostr-tools');

const PARAM = path.resolve(__dirname, '../ui/src/utils/eventParam.js');
const HOOK = path.resolve(__dirname, '../ui/src/hooks/useEventResolve.js');
const PAGE = path.resolve(__dirname, '../ui/src/pages/BrainstormEvent.jsx');
const APP = path.resolve(__dirname, '../ui/src/App.jsx');
const NOTE_CARD = path.resolve(__dirname, '../ui/src/components/NoteCard.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
async function loadEsm(absPath) { try { return await import(pathToFileURL(absPath).href); } catch { return null; } }
function helperBody(src, names) {
  const m = src.match(new RegExp('function\\s+(' + names.join('|') + ')\\s*\\('));
  return m ? src.slice(m.index) : src;
}

// nip19-minted, self-validating fixtures.
const PK = getPublicKey(generateSecretKey());
const HEX = 'a'.repeat(64);
const EVENT_ID = 'b'.repeat(64);
const NEVENT = nip19.neventEncode({ id: EVENT_ID, author: PK, relays: ['wss://hint.example'] });
const NPUB = nip19.npubEncode(PK);
const NPROFILE = nip19.nprofileEncode({ pubkey: PK, relays: ['wss://p.example'] });
const NADDR = nip19.naddrEncode({ identifier: 'slug', pubkey: PK, kind: 30023 });

// ===========================================================================
// eventParam.js — EXECUTED (the pure decode/precedence/classify core)
// ===========================================================================

test('U1 (#2 precedence): resolveEventParams picks the first valid param by precedence (nevent > id)', async () => {
  const mod = await loadEsm(PARAM);
  assert(mod && typeof mod.resolveEventParams === 'function',
    'ui/src/utils/eventParam.js must export resolveEventParams — feature not implemented yet (ADR event-page/0002).');
  const sp = new URLSearchParams(`nevent=${NEVENT}&id=${EVENT_ID}`);
  const { target, invalidParams } = mod.resolveEventParams(sp);
  assert(target && target.mode === 'id' && target.id === EVENT_ID,
    `with both nevent and id valid, nevent wins (precedence) → mode 'id' with the nevent's id; got ${JSON.stringify(target)}.`);
  assert(Array.isArray(invalidParams) && invalidParams.length === 0, `no invalid params here; got ${JSON.stringify(invalidParams)}.`);
});

test('U2 (#2 invalid vs unsupported): malformed supported params are flagged; unknown names ignored; first VALID still wins', async () => {
  const mod = await loadEsm(PARAM);
  assert(mod && typeof mod.resolveEventParams === 'function', 'eventParam.js must export resolveEventParams.');
  // All-invalid + an unsupported name → no target, nevent flagged, foo ignored.
  const a = mod.resolveEventParams(new URLSearchParams('nevent=garbage&foo=bar'));
  assert(a.target === null, `all supported params malformed → no target; got ${JSON.stringify(a.target)}.`);
  assert(a.invalidParams.includes('nevent'), `a malformed supported param must be flagged invalid; got ${JSON.stringify(a.invalidParams)}.`);
  assert(!a.invalidParams.includes('foo'), `an UNSUPPORTED param name must be ignored, not flagged; got ${JSON.stringify(a.invalidParams)}.`);
  // Higher-precedence invalid + lower-precedence valid → the valid one wins, the invalid one is flagged.
  const b = mod.resolveEventParams(new URLSearchParams(`nevent=garbage&id=${EVENT_ID}`));
  assert(b.target && b.target.mode === 'id' && b.target.id === EVENT_ID, `a malformed higher-precedence param is skipped for the first VALID one; got ${JSON.stringify(b.target)}.`);
  assert(b.invalidParams.includes('nevent'), `the malformed param must still be reported invalid; got ${JSON.stringify(b.invalidParams)}.`);
});

test('U3 (#2 decode): each of the 6 params decodes to the right target (nevent/id/pubkey/npub/nprofile → fetch; naddr → unsupported kind)', async () => {
  const mod = await loadEsm(PARAM);
  assert(mod && typeof mod.resolveEventParams === 'function', 'eventParam.js must export resolveEventParams.');
  const one = (qs) => mod.resolveEventParams(new URLSearchParams(qs)).target;

  const ne = one(`nevent=${NEVENT}`);
  assert(ne && ne.mode === 'id' && ne.id === EVENT_ID && ne.author === PK && Array.isArray(ne.relays) && ne.relays.includes('wss://hint.example'),
    `nevent → { mode:'id', id, author, relays(hint) }; got ${JSON.stringify(ne)}.`);
  assert(one(`id=${EVENT_ID}`)?.mode === 'id', 'a 64-hex id → mode id.');
  assert(one(`pubkey=${HEX}`)?.mode === 'author', 'a 64-hex pubkey → mode author.');
  assert(one(`npub=${NPUB}`)?.mode === 'author' && one(`npub=${NPUB}`).author === PK, 'npub → mode author with the decoded pubkey.');
  const np = one(`nprofile=${NPROFILE}`);
  assert(np && np.mode === 'author' && np.author === PK && Array.isArray(np.relays) && np.relays.includes('wss://p.example'), `nprofile → author + relay hints; got ${JSON.stringify(np)}.`);
  const na = one(`naddr=${NADDR}`);
  assert(na && na.mode === 'naddrUnsupported' && na.kind === 30023, `naddr → { mode:'naddrUnsupported', kind } (no fetch); got ${JSON.stringify(na)}.`);
});

test('U4 (#3 classify): classifyEventInput maps a pasted string to the canonical URL param; bare hex → id (precedence); junk → null', async () => {
  const mod = await loadEsm(PARAM);
  assert(mod && typeof mod.classifyEventInput === 'function',
    'ui/src/utils/eventParam.js must export classifyEventInput — the search-field classifier (ADR event-page/0002).');
  const c = (s) => mod.classifyEventInput(s);
  assert(c(NEVENT)?.paramName === 'nevent' && c(NEVENT).value === NEVENT, `nevent → { paramName:'nevent', value }; got ${JSON.stringify(c(NEVENT))}.`);
  assert(c(NPUB)?.paramName === 'npub', 'npub → paramName npub.');
  assert(c(NPROFILE)?.paramName === 'nprofile', 'nprofile → paramName nprofile.');
  assert(c(NADDR)?.paramName === 'naddr', 'naddr → paramName naddr.');
  assert(c(HEX)?.paramName === 'id', `a bare 64-hex must classify as 'id' (precedence id>pubkey, since the bech32 prefix is what disambiguates otherwise); got ${JSON.stringify(c(HEX))}.`);
  assert(c('definitely not a nostr identifier') === null, 'a non-matching string → null (drives the "not a recognized format" notice).');
  assert(c('') === null, 'empty input → null.');
});

// ===========================================================================
// BrainstormEvent.jsx — SOURCE sentinels (#2 render + naddr + search wiring)
// ===========================================================================

test('U5 (#2 render): BrainstormEvent renders the resolved kind-1 via NoteCard and branches every read-path status', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'ui/src/pages/BrainstormEvent.jsx must be reworked from the placeholder (ADR event-page/0002).');
  assert(/import NoteCard/.test(src) && /<NoteCard\b[^>]*\bitem=\{/.test(src), 'the page must render the resolved kind-1 via the shared <NoteCard item={…} />.');
  assert(/EVENT_COPY/.test(src), 'the page must define exported EVENT_COPY copy constants.');
  const body = helperBody(src, ['renderResolvedEvent']);
  for (const status of ['OK', 'UNSUPPORTED_KIND', 'INVALID_EVENT', 'NOT_FOUND', 'NO_AUTHOR_NOTE']) {
    assert(new RegExp("['\"]" + status + "['\"]").test(body), `renderResolvedEvent must branch on the '${status}' read-path status.`);
  }
});

test('U6 (#2 naddr + search wiring): naddr → "unsupported kind" branch; no valid target → <EventSearch>', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormEvent.jsx does not exist yet.');
  assert(/naddrUnsupported/.test(src), "the page must handle the 'naddrUnsupported' target (kind from the coordinate → not-yet-supported, no fetch).");
  assert(/<EventSearch\b/.test(src), 'the page must render <EventSearch /> when there is no valid target (story #3 fallback).');
  assert(/resolveEventParams/.test(src) && /useEventResolve/.test(src), 'the page must use resolveEventParams (decode) + useEventResolve (fetch id/author).');
});

test('U7 (#2 testability): renderResolvedEvent is a named-exported PURE function (no fetch/hook/router/globals)', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormEvent.jsx does not exist yet.');
  assert(/export\s+(function\s+renderResolvedEvent|const\s+renderResolvedEvent\s*=)/.test(src),
    'BrainstormEvent.jsx must NAMED-export a pure renderResolvedEvent({ data, loading, error }) (the testable state→view unit).');
  const body = helperBody(src, ['renderResolvedEvent']);
  for (const banned of ['fetch(', 'useEventResolve(', 'useAuth(', 'useSearchParams(', 'window.', 'document.']) {
    assert(!body.includes(banned), `the pure renderResolvedEvent must not call ${banned} — it is a pure function of { data, loading, error }.`);
  }
});

test('U8 (#3 search): EventSearch classifies input → navigates to the canonical param on valid, shows the notice on invalid', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormEvent.jsx does not exist yet.');
  const body = helperBody(src, ['EventSearch']);
  assert(/classifyEventInput/.test(body), 'EventSearch must use classifyEventInput to validate/route the pasted string.');
  assert(/setParams|navigate\(/.test(body), 'on a valid format, EventSearch must navigate to the canonical /event?<type>=<value> (setParams / navigate).');
  assert(/SEARCH_INVALID/.test(body), 'on a non-matching string, EventSearch must show the EVENT_COPY.SEARCH_INVALID notice.');
  assert(/<input\b/.test(body), 'EventSearch must render an input field.');
});

test('U9 (copy): EVENT_COPY carries the operator-delegated outcome + search messages', () => {
  const src = safeRead(PAGE);
  assert(src.length > 0, 'BrainstormEvent.jsx does not exist yet.');
  // Meaning tokens (punctuation non-binding).
  assert(/not yet supported/i.test(src), 'EVENT_COPY must include the "kind not yet supported" message.');
  assert(/not found/i.test(src), 'EVENT_COPY must include the "event not found" message.');
  assert(/no kind[\s-]?1 note/i.test(src) || /no .*note .*author/i.test(src), 'EVENT_COPY must include the "no kind-1 note for this author" message.');
  assert(/validate|verif/i.test(src), 'EVENT_COPY must include the "does not validate / could not verify" message.');
  assert(/recogni[sz]ed/i.test(src) || /not a .*(nevent|format)/i.test(src), 'EVENT_COPY must include the search "not a recognized format" message.');
});

// ===========================================================================
// useEventResolve.js — SOURCE sentinels
// ===========================================================================

test('U10 (#2 hook): useEventResolve fetches /api/event and returns { data, loading, error }, aborting on unmount', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0, 'ui/src/hooks/useEventResolve.js does not exist yet (ADR event-page/0002).');
  assert(/fetch\(\s*[`'"]\/api\/event/.test(src) || (/fetch\(/.test(src) && /\/api\/event/.test(src)),
    "useEventResolve must call fetch('/api/event…') — the ADR 0001 endpoint.");
  assert(/return\s*\{[\s\S]{0,120}data[\s\S]{0,120}loading[\s\S]{0,120}error[\s\S]{0,40}\}/.test(src), 'useEventResolve must return { data, loading, error }.');
  assert(/AbortController/.test(src) && /\.abort\(\)/.test(src), 'useEventResolve must abort the fetch on unmount.');
  assert(/success/.test(src), 'useEventResolve must gate on the response `success` flag.');
});

// ===========================================================================
// REGRESSION
// ===========================================================================

test('R1: App.jsx still registers the /event route → BrainstormEvent (additive — no routing change)', () => {
  const src = safeRead(APP);
  assert(src.length > 0, 'ui/src/App.jsx missing — unexpected.');
  assert(/path:\s*['"]\/event['"]/.test(src) && /BrainstormEvent/.test(src),
    'App.jsx must still register /event → BrainstormEvent (the rework is in-place; the route is unchanged).');
});

test('R2: NoteCard is reused as-is — single { item } prop, bsp-note-card markup (no fork)', () => {
  const src = safeRead(NOTE_CARD);
  assert(/export\s+default\s+function\s+NoteCard\s*\(\s*\{\s*item\s*\}/.test(src) && /bsp-note-card/.test(src),
    'NoteCard must keep its { item } presentational contract — the event page reuses it unchanged.');
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
