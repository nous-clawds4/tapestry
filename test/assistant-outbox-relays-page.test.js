'use strict';
/**
 * assistant-outbox-relays #2: the Outbox Relays page — your Assistant's outbox relays, adding by hand, suggestions,
 * removing.
 *
 * Story: engineering-team/stories/assistant-outbox-relays/2-the-outbox-relays-page.md
 * ADR:   engineering-team/decisions/assistant-outbox-relays/0002-the-outbox-relays-page-reads-the-one-answer.md
 * Plan:  engineering-team/stories/assistant-outbox-relays/2-the-outbox-relays-page.test-plan.md
 * Browser half: tests/brainstorm/assistant-outbox-relays.spec.js (B3–B6: what a viewer sees and does on the page).
 * Words and shapes: test/helpers/outboxRelaysFixtures.js.
 *
 * Classes:
 *   L — the draft rules in src/lib/relay-list: addRelay, removeRelay, visibleSuggestions, addAll, sameRelayList.
 *                                                                                                        [AC-2 … AC-5]
 *   G — the suggestions, computed by src/api/assistant/outboxRelays.js (outboxSuggestions) and carried in the
 *       attention answer. Stack-free, dependency-injected.                                                [AC-4]
 *   C — the page's words and pure helpers, ui/src/pages/assistant/outboxRelaysCopy.js, loaded in Node.     [AC-1, AC-2]
 *   D — source sentinels on the page this runner cannot execute (JSX), its route and its styles.           [AC-1 … AC-5]
 *
 * Everything FAILS against the current code: the library, the server module, the copy module and the page do not
 * exist, and /assistant/outbox-relays is not an action yet.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const O = require('./helpers/outboxRelaysFixtures');

const REPO = path.resolve(__dirname, '..');
const LIB = path.join(REPO, 'src/lib/relay-list/index.js');
const OUTBOX_MODULE = path.join(REPO, 'src/api/assistant/outboxRelays.js');
const COPY_MOD = path.join(REPO, 'ui/src/pages/assistant/outboxRelaysCopy.js');
const PAGE = path.join(REPO, 'ui/src/pages/assistant/OutboxRelays.jsx');
const APP = path.join(REPO, 'ui/src/App.jsx');
const STYLES = path.join(REPO, 'ui/src/styles.css');
const NL = String.fromCharCode(10);

const ASSISTANT = 'a2'.repeat(32);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
const sameJson = (a, b) => show(a) === show(b);

function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

function load(abs, what) {
  if (!fs.existsSync(abs)) throw new Error(`${rel(abs)} does not exist. ${what}`);
  delete require.cache[require.resolve(abs)];
  return require(abs);
}
const libModule = () => load(LIB, 'ADR 0001 sub-decision 1 / ADR 0002 sub-decision 2: the NIP-65 library with the draft rules.');
const outboxModule = () => load(OUTBOX_MODULE, 'ADR 0001 § Implementation notes 3 / ADR 0002 sub-decision 1: checkOutboxRelays and outboxSuggestions.');
function need(mod, name, file) {
  assert(typeof mod[name] === 'function', `${file} must export ${name}() (ADR 0002).`);
  return mod[name];
}
async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { return await import(pathToFileURL(absPath).href); } catch (err) { throw new Error(`${rel(absPath)} must load in Node as ESM: ${err.message}`); }
}
const copyModule = () => esm(COPY_MOD, 'ADR 0002 sub-decision 3 creates it: OUTBOX_RELAYS_COPY, checkLine, inboxLine — no imports.');

const relaysOf = (n, prefix = 'r') => Array.from({ length: n }, (_, i) => `wss://${prefix}${i}.example`);

/* ───────────────────────── L — the draft rules ───────────────────────── */

test('L1: addRelay appends a relay in its one spelling and trims it; refuses not-a-relay, already-listed (host case and one trailing slash apart) and too-many at 50, leaving the draft as it was (AC-3; ADR 0002 sub-decision 2)', () => {
  const addRelay = need(libModule(), 'addRelay', 'src/lib/relay-list');
  const wrong = [];
  const ok = addRelay([O.OUT_A], '  WSS://Relay.Beta.Example/ ');
  if (!sameJson(ok, { draft: [O.OUT_A, O.OUT_B], error: null })) wrong.push(`append: ${show(ok)}`);
  for (const [input, error] of [['https://relay.example', 'not-a-relay'], ['', 'not-a-relay'], ['relay.example', 'not-a-relay'], ['wss://RELAY.alpha.example/', 'already-listed']]) {
    const got = addRelay([O.OUT_A], input);
    if (!sameJson(got, { draft: [O.OUT_A], error })) wrong.push(`${show(input)}: want ${error}, got ${show(got)}`);
  }
  const full = relaysOf(O.MAX_RELAYS);
  const over = addRelay(full, 'wss://one-more.example');
  if (over.error !== 'too-many' || over.draft.length !== O.MAX_RELAYS) wrong.push(`at ${O.MAX_RELAYS}: ${show({ error: over.error, length: over.draft.length })}`);
  const input = [O.OUT_A];
  addRelay(input, O.OUT_B);
  if (!sameJson(input, [O.OUT_A])) wrong.push('addRelay must not change the draft it was given');
  assert(wrong.length === 0, wrong.join('; '));
});

test('L2: removeRelay takes a relay off by its one spelling, and leaves the rest in order (AC-5)', () => {
  const removeRelay = need(libModule(), 'removeRelay', 'src/lib/relay-list');
  const got = removeRelay([O.OUT_A, O.OUT_B, O.IN_C], 'wss://RELAY.beta.example/');
  assert(sameJson(got, [O.OUT_A, O.IN_C]), `want ${show([O.OUT_A, O.IN_C])}, got ${show(got)}`);
  assert(sameJson(removeRelay([O.OUT_A], 'wss://absent.example'), [O.OUT_A]), 'removing an absent relay changes nothing');
});

test('L3: visibleSuggestions leaves out every suggestion already in the draft (by its one spelling), in the suggestions\' order (AC-4, AC-5)', () => {
  const visible = need(libModule(), 'visibleSuggestions', 'src/lib/relay-list');
  const got = visible(['wss://s1.example', 'wss://s2.example', 'wss://s3.example'], ['wss://S2.example/']);
  assert(sameJson(got, ['wss://s1.example', 'wss://s3.example']), `got ${show(got)}`);
  assert(sameJson(visible([], [O.OUT_A]), []) && sameJson(visible(['wss://s1.example'], []), ['wss://s1.example']), 'empty inputs');
});

test('L4: addAll appends every visible suggestion in order, skips the ones already listed, and stops at 50 (AC-4)', () => {
  const addAll = need(libModule(), 'addAll', 'src/lib/relay-list');
  const got = addAll([O.OUT_A], ['wss://s1.example', O.OUT_A, 'wss://s2.example']);
  assert(sameJson(got, [O.OUT_A, 'wss://s1.example', 'wss://s2.example']), `got ${show(got)}`);
  const capped = addAll(relaysOf(48), relaysOf(5, 's'));
  assert(capped.length === O.MAX_RELAYS && capped[49] === 'wss://s1.example', `stops at ${O.MAX_RELAYS}: ${capped.length}, last ${show(capped[capped.length - 1])}`);
});

test('L5: sameRelayList — same length and the same relay at each position, by its one spelling; order matters (AC-2)', () => {
  const same = need(libModule(), 'sameRelayList', 'src/lib/relay-list');
  const wrong = [];
  if (!same([O.OUT_A, O.OUT_B], ['WSS://relay.alpha.example/', O.OUT_B])) wrong.push('spelling apart is the same');
  if (same([O.OUT_A, O.OUT_B], [O.OUT_B, O.OUT_A])) wrong.push('order matters');
  if (same([O.OUT_A], [O.OUT_A, O.OUT_B])) wrong.push('length matters');
  if (!same([], [])) wrong.push('two empty lists are the same');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── G — the suggestions ───────────────────────── */

function suggestionDeps(opts = {}) {
  const calls = { readConfiguredRelays: [] };
  const deps = {
    getConfigFromFile: (key, dflt) => (opts.config && Object.prototype.hasOwnProperty.call(opts.config, key) ? opts.config[key] : dflt),
    readConfiguredRelays: (categories) => {
      calls.readConfiguredRelays.push(categories);
      const s = opts.settings || {};
      return (Array.isArray(categories) ? categories : []).flatMap((c) => s[c] || []);
    },
  };
  return { deps, calls };
}
const SETTINGS = {
  aPopularGeneralPurposeRelays: ['wss://relay.damus.io', 'wss://nos.lol'],
  aTrustedAssertionRelays: ['wss://nip85.example', 'wss://Relay.Damus.io/'],
  aTrustedListRelays: ['wss://lists.example'],
  aDListRelays: ['wss://dcosl.example'],
  aOutboxRelays: ['wss://outbox.example'],
  aProfileRelays: ['wss://purplepag.es'],
  aWotRelays: ['wss://wot.example'],
};

test('G1: the suggestions — this instance\'s relay at its public address first, then the General Purpose, Trusted Assertion, Trusted List, DList and Outbox lists in that order, each relay once in its one spelling; never the profile or WoT lists (AC-4; ADR 0002 sub-decision 1)', () => {
  const outboxSuggestions = need(outboxModule(), 'outboxSuggestions', 'src/api/assistant/outboxRelays.js');
  const { deps, calls } = suggestionDeps({ config: { BRAINSTORM_RELAY_URL: 'wss://Staging.Example/relay' }, settings: SETTINGS });
  const got = outboxSuggestions(deps);
  const want = ['wss://staging.example/relay', 'wss://relay.damus.io', 'wss://nos.lol', 'wss://nip85.example', 'wss://lists.example', 'wss://dcosl.example', 'wss://outbox.example'];
  assert(sameJson(got, want), `want ${show(want)}, got ${show(got)}`);
  const asked = calls.readConfiguredRelays.flat();
  assert(sameJson(asked, O.SUGGESTION_RELAY_CATEGORIES), `the five categories, in order: want ${show(O.SUGGESTION_RELAY_CATEGORIES)}, got ${show(asked)}`);
  assert(sameJson(outboxModule().SUGGESTION_RELAY_CATEGORIES, O.SUGGESTION_RELAY_CATEGORIES), 'exports SUGGESTION_RELAY_CATEGORIES');
});

test('G2: this instance\'s relay is suggested only at a public address — a loopback, a private address, a .local name, a non-relay value or nothing leaves it out (AC-4)', () => {
  const outboxSuggestions = need(outboxModule(), 'outboxSuggestions', 'src/api/assistant/outboxRelays.js');
  const wrong = [];
  for (const url of ['ws://localhost:7777', 'ws://127.0.0.1:7777', 'ws://192.168.1.20/relay', 'ws://tapestry.local/relay', 'https://staging.example', '']) {
    const { deps } = suggestionDeps({ config: { BRAINSTORM_RELAY_URL: url }, settings: { aPopularGeneralPurposeRelays: ['wss://nos.lol'] } });
    const got = outboxSuggestions(deps);
    if (!sameJson(got, ['wss://nos.lol'])) wrong.push(`${show(url)}: ${show(got)}`);
  }
  assert(wrong.length === 0, `this instance's relay must be left out: ${wrong.join('; ')}`);
});

test('G3: entries that are not relay addresses are skipped, and the list stops at 50; no relays at all is an empty list (AC-4)', () => {
  const outboxSuggestions = need(outboxModule(), 'outboxSuggestions', 'src/api/assistant/outboxRelays.js');
  const messy = { aPopularGeneralPurposeRelays: ['https://web.example', 'not a relay', 'wss://ok.example', 42], aDListRelays: relaysOf(60, 'd') };
  const got = outboxSuggestions(suggestionDeps({ settings: messy }).deps);
  assert(got[0] === 'wss://ok.example' && got.length === O.MAX_RELAYS, `want wss://ok.example first and ${O.MAX_RELAYS} in all, got ${got.length}: ${show(got.slice(0, 3))}`);
  assert(sameJson(outboxSuggestions(suggestionDeps({}).deps), []), 'no relays at all → []');
});

test('G4: the attention answer carries the suggestions even when the check did not finish, unfiltered by the published list; a check-failed action carries [] (AC-4; ADR 0002 sub-decision 1)', async () => {
  const check = need(outboxModule(), 'checkOutboxRelays', 'src/api/assistant/outboxRelays.js');
  const base = {
    getConfigFromFile: (key, dflt) => (key === 'BRAINSTORM_RELAY_URL' ? 'wss://staging.example/relay' : dflt),
    readConfiguredRelays: (cats) => cats.flatMap((c) => SETTINGS[c] || []),
    getConfiguredPublishRelays: () => [],
    readRelay: async () => ({ status: 'unreachable', events: [], error: 'fixture' }),
  };
  const unfinished = await check({ assistantPubkey: ASSISTANT }, { ...base, scanLocal: async () => { throw new Error('fixture'); } });
  assert(unfinished && unfinished.finished === false && Array.isArray(unfinished.suggestions) && unfinished.suggestions[0] === 'wss://staging.example/relay',
    `an unfinished check still carries the suggestions: ${show(unfinished)}`);
  const list = { id: '1'.repeat(64), pubkey: ASSISTANT, kind: 10002, created_at: 5, tags: [['r', 'wss://nos.lol']], content: '', sig: '0'.repeat(128) };
  const done = await check({ assistantPubkey: ASSISTANT }, { ...base, scanLocal: async () => [list] });
  assert(done && done.done === true && done.suggestions.includes('wss://nos.lol'), `a published relay stays among the suggestions (the page filters by its draft): ${show(done)}`);
});

/* ───────────────────────── C — the page's words ───────────────────────── */

test('C1: the copy module is pure — no imports — and holds the approved words (story 2 § Copy; ADR 0002 § Consequences for the 50-relay line)', async () => {
  const src = safeRead(COPY_MOD);
  assert(src && !/^\s*import\b/m.test(src), `${rel(COPY_MOD)} exists and imports nothing (Node suites load it)`);
  const copy = (await copyModule()).OUTBOX_RELAYS_COPY || {};
  const wrong = [];
  for (const k of ['signedOutLine', 'panelHeading', 'noneYet', 'checking', 'unpublished', 'fieldLabel', 'placeholder', 'add', 'suggestionsHeading', 'suggestionsExplainer', 'addAll', 'remove', 'allListed', 'noneToSuggest']) {
    if (copy[k] !== O.PAGE[k]) wrong.push(`${k}: want ${show(O.PAGE[k])}, got ${show(copy[k])}`);
  }
  for (const [k, v] of Object.entries(O.PAGE.refusals)) if (!copy.refusals || copy.refusals[k] !== v) wrong.push(`refusals.${k}: want ${show(v)}, got ${show(copy.refusals && copy.refusals[k])}`);
  for (const [k, v] of Object.entries(O.PAGE.couldNotCheck)) if (!copy.couldNotCheck || copy.couldNotCheck[k] !== v) wrong.push(`couldNotCheck.${k}: want ${show(v)}, got ${show(copy.couldNotCheck && copy.couldNotCheck[k])}`);
  if (typeof copy.srAdd !== 'function' || copy.srAdd(O.OUT_A) !== O.PAGE.srAdd(O.OUT_A)) wrong.push(`srAdd(relay): want ${show(O.PAGE.srAdd(O.OUT_A))}`);
  if (typeof copy.srRemove !== 'function' || copy.srRemove(O.OUT_A) !== O.PAGE.srRemove(O.OUT_A)) wrong.push(`srRemove(relay): want ${show(O.PAGE.srRemove(O.OUT_A))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('C2: checkLine — Checking… while the answer is on its way; nothing once finished; a reason\'s words when not; the request-failed line when the request failed or the check failed (AC-1)', async () => {
  const { checkLine } = await copyModule();
  assert(typeof checkLine === 'function', 'outboxRelaysCopy.js exports checkLine(phase, action)');
  const wrong = [];
  const cases = [
    ['checking', null, O.PAGE.checking],
    ['answered', O.OUTBOX.DONE, null],
    ['answered', O.OUTBOX.PENDING, null],
    ['answered', O.outboxAction({ finished: false, done: false, pending: false, reason: 'local-unreadable', outbox: [] }), O.PAGE.couldNotCheck['local-unreadable']],
    ['answered', O.OUTBOX.UNFINISHED, O.PAGE.couldNotCheck['no-outside-relays']],
    ['answered', O.outboxAction({ finished: false, done: false, pending: false, reason: 'outside-unreachable', outbox: [] }), O.PAGE.couldNotCheck['outside-unreachable']],
    ['answered', O.OUTBOX.CHECK_FAILED, O.PAGE.couldNotCheck['request-failed']],
    ['answered', undefined, O.PAGE.couldNotCheck['request-failed']],
    ['failed', null, O.PAGE.couldNotCheck['request-failed']],
  ];
  for (const [phase, action, want] of cases) {
    const got = checkLine(phase, action);
    if (got !== want) wrong.push(`${phase} ${show(action && action.reason)}: want ${show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('C3: inboxLine says how many inbox relays the list also names, in the singular for one; nothing for none (AC-1)', async () => {
  const { inboxLine } = await copyModule();
  assert(typeof inboxLine === 'function', 'outboxRelaysCopy.js exports inboxLine(n)');
  assert(inboxLine(1) === O.PAGE.inboxLine(1) && inboxLine(3) === O.PAGE.inboxLine(3), `got ${show([inboxLine(1), inboxLine(3)])}`);
  assert(inboxLine(0) === null, `none → null, got ${show(inboxLine(0))}`);
});

/* ───────────────────────── D — the page's source ───────────────────────── */

test('D1: the page exists and reads only the shared answers — useAuth, useAssistantAttention, the hub\'s assistantAttention reading — never fetches for its state, and stores nothing (AC-1, AC-2; ADR 0002 sub-decision 3)', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist — ADR 0002 sub-decision 3 creates it`);
  const wrong = [];
  for (const [re, what] of [
    [/export\s+default\s+function\s+OutboxRelaysPage\s*\(/, 'export default function OutboxRelaysPage()'],
    [/\buseAuth\s*\(/, 'useAuth()'], [/\buseAssistantAttention\s*\(/, 'useAssistantAttention() — the one answer'],
    [/\bassistantAttention\s*\(/, "assistantAttention(user, attention) — the hub's mark for the panel"],
    [/\bASSISTANT_ACTIONS\b/, "the action's own entry (title and description from actions.js)"],
    [/\bOUTBOX_RELAYS_COPY\b/, 'OUTBOX_RELAYS_COPY'],
    [/from\s*['"]\.\/outboxRelaysCopy['"]/, "the words from './outboxRelaysCopy' (named apart from the page)"],
    [/from\s*['"]@tapestry\/relay-list['"]/, "the draft rules through the '@tapestry/relay-list' alias"],
  ]) if (!re.test(src)) wrong.push(`no ${what}`);
  for (const [re, what] of [[/\bfetch\s*\(/, 'fetch('], [/localStorage|sessionStorage/, 'browser storage']]) {
    if (re.test(src)) wrong.push(`uses ${what} — the page reads the shared answer and stores nothing`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('D2: the draft — component state rebuilt from each new answer, edited only through the library\'s rules, compared with sameRelayList for the unpublished line (AC-2 … AC-5)', () => {
  const src = codeOnly(safeRead(PAGE));
  const wrong = [];
  for (const name of ['addRelay', 'removeRelay', 'visibleSuggestions', 'addAll', 'sameRelayList']) if (!new RegExp(`\\b${name}\\s*\\(`).test(src)) wrong.push(`${name}(…)`);
  if (!/useEffect\s*\([\s\S]{0,200}?setDraft\s*\(/.test(src)) wrong.push('a useEffect that rebuilds the draft (setDraft) from each new answer');
  assert(wrong.length === 0, `missing: ${wrong.join('; ')}`);
});

test('D3: the controls — a labelled field inside a form (so Enter adds), Add and Remove buttons that name their relay to a screen reader, and Add all (AC-3 … AC-5)', () => {
  const src = codeOnly(safeRead(PAGE));
  const wrong = [];
  for (const [re, what] of [
    [/<form\b[^>]*onSubmit=/, '<form onSubmit=…> around the field'],
    [/<label\b/, 'a <label> for the field'],
    [/placeholder=\{?\s*OUTBOX_RELAYS_COPY\.placeholder/, 'the field placeholder from the copy'],
    [/aria-label=\{\s*OUTBOX_RELAYS_COPY\.srRemove\s*\(/, 'aria-label={OUTBOX_RELAYS_COPY.srRemove(relay)} on Remove'],
    [/aria-label=\{\s*OUTBOX_RELAYS_COPY\.srAdd\s*\(/, 'aria-label={OUTBOX_RELAYS_COPY.srAdd(relay)} on Add'],
    [/OUTBOX_RELAYS_COPY\.addAll/, 'the Add all button'],
    [/OUTBOX_RELAYS_COPY\.refusals\s*\[/, 'the refusal line from OUTBOX_RELAYS_COPY.refusals[error]'],
    [/\binboxLine\s*\(/, 'inboxLine(…)'], [/\bcheckLine\s*\(/, 'checkLine(…)'],
  ]) if (!re.test(src)) wrong.push(what);
  assert(wrong.length === 0, `missing: ${wrong.join('; ')}`);
});

test('D4: the route — App.jsx serves /assistant/outbox-relays with the page through ACTION_PAGES, not the placeholder (ADR 0002 sub-decision 4)', () => {
  const src = codeOnly(safeRead(APP));
  assert(/import\s+OutboxRelaysPage\s+from\s+['"]\.\/pages\/assistant\/OutboxRelays['"]/.test(src), "App.jsx imports OutboxRelaysPage from './pages/assistant/OutboxRelays'");
  assert(/['"]outbox-relays['"]\s*:\s*<OutboxRelaysPage\s*\/>/.test(src), "ACTION_PAGES maps 'outbox-relays' to <OutboxRelaysPage />");
});

test('D5: the page wears the Identification Tags frame and cards, and the stylesheet carries the new relay-row and field rules (AC-1; ADR 0002 sub-decision 3)', () => {
  const src = codeOnly(safeRead(PAGE));
  const wrong = [];
  for (const cls of ['bs-setup-main', 'bs-setup-back', 'bs-setup-title', 'bs-idtags-card', 'bs-setup-step-badge']) if (!src.includes(cls)) wrong.push(`the page uses ${cls}`);
  if (!/<TopBar\s*\/>/.test(src)) wrong.push('the page wears <TopBar />');
  const css = safeRead(STYLES);
  for (const cls of ['.bs-outbox-relays', '.bs-outbox-relay', '.bs-outbox-add', '.bs-outbox-note']) if (!css.includes(cls)) wrong.push(`styles.css defines ${cls}`);
  assert(wrong.length === 0, wrong.join('; '));
});

async function run() {
  console.log(`${NL}=== assistant-outbox-relays-page (assistant-outbox-relays #2) ===`);
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}assistant-outbox-relays-page: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
