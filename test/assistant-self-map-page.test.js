'use strict';
/**
 * assistant-self-map #1: the Your Assistant's Treasure Map page — the duties your Map gives your Assistant and which
 * are live, what its self-Map should say, what it says now, one status line, the links, the Owner's line and the public
 * line — read from the hub's one answer.
 *
 * Story: engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.md (AC-6, AC-7, § Copy)
 * ADR:   engineering-team/decisions/assistant-self-map/0001-a-self-map-check-from-what-has-landed.md (sub-decision 9)
 * Plan:  engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.test-plan.md
 * Check half: test/assistant-self-map-check.test.js. Browser half: tests/brainstorm/assistant-self-map.spec.js (what a
 * viewer sees in each state). Words and canned answers: test/helpers/selfMapFixtures.js.
 *
 * Classes (all stack-free):
 *   P — the page's words and pure helpers, ui/src/pages/assistant/assistantTreasureMapCopy.js, loaded in Node: the
 *       story's § Copy with the three reasons added at Architecture, statusLine(answer) and reasonLine(line), as
 *       dutyMenuCopy.js has them ("built as DutyMenu.jsx is", ADR sub-decision 9).                           [AC-6]
 *   D — source sentinels on what this runner cannot execute: the route in App.jsx, and the page's states, its one shared
 *       answer, its words' one home, its links, and that it never fetches, refreshes, polls or publishes. [AC-6, AC-7]
 *
 * Everything FAILS against the current code: assistantTreasureMapCopy.js and AssistantTreasureMap.jsx do not exist,
 * and /assistant/treasure-map routes to the placeholder page.
 *
 * assistant-self-map #2 (story 2 AC-2, § Copy; ADR assistant-self-map/0002 sub-decision 7): the page gains a state
 * line, three buttons, a report and a refresh after a press, through one client helper.
 *   Q — the copy module's story-2 words, selfMapStateLine(answer) and selfMapButtons(answer).        [AC-2]
 *   H — the client helper, ui/src/utils/setAssistantSelfMap.js, loaded in Node with fetch stubbed.   [AC-2, AC-3]
 *   D4 is re-aimed (the page now has buttons and one network call, through the helper); D7–D8 pin the wiring and the
 *   words' one home. These FAIL until the helper, the two pure helpers and the page's buttons exist.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const SM = require('./helpers/selfMapFixtures');

const REPO = path.resolve(__dirname, '..');
const COPY_MOD = path.join(REPO, 'ui/src/pages/assistant/assistantTreasureMapCopy.js');
const CLIENT_UTIL = path.join(REPO, 'ui/src/utils/setAssistantSelfMap.js');
const PAGE = path.join(REPO, 'ui/src/pages/assistant/AssistantTreasureMap.jsx');
const APP = path.join(REPO, 'ui/src/App.jsx');
const NL = String.fromCharCode(10);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);

function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}
async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { return await import(pathToFileURL(absPath).href); } catch (err) { throw new Error(`${rel(absPath)} must load in Node as ESM: ${err.message}`); }
}
const copyModule = () => esm(COPY_MOD, 'ADR 0001 sub-decision 9 creates it: the story\'s words, statusLine(answer) and reasonLine(line).');
function needFn(mod, name) {
  assert(typeof mod[name] === 'function', `${rel(COPY_MOD)} must export ${name}() (ADR 0001 sub-decision 9, as dutyMenuCopy.js does)`);
  return mod[name];
}
/** Every string a module exports, however its words are arranged (the ADR leaves their shape to the Implementer). */
function stringsOf(value, out = new Set(), seen = new Set()) {
  if (typeof value === 'string') out.add(value);
  else if (value && typeof value === 'object' && !seen.has(value)) {
    seen.add(value);
    for (const v of Object.values(value)) stringsOf(v, out, seen);
  }
  return out;
}

/* ───────────────────────── P — the page's words and helpers ───────────────────────── */

test('P1: the copy module loads in Node and holds every sentence § Copy gives this page — the three reasons added at Architecture included — Checking…, the three status words and the three category names (AC-6; § Copy)', async () => {
  const mod = await copyModule();
  const strings = [...stringsOf(Object.fromEntries(Object.entries(mod).filter(([, v]) => typeof v !== 'function')))];
  // A sentence with a value in it (the Owner's count, a date) may live in a template function: then its words are in the
  // module's source.
  const source = safeRead(COPY_MOD);
  const want = [...SM.PAGE_SENTENCES, SM.PAGE.checking, ...Object.values(SM.CATEGORY_NAMES)];
  const missing = want.filter((s) => !strings.some((x) => x.includes(s)) && !source.includes(s));
  assert(missing.length === 0, `missing, word for word: ${missing.map(show).join('; ')}`);
});

test('P2: statusLine gives the one status line — up to date when current; not published yet when nothing is claimed; out of date when the self-Map found claims something else (AC-5, AC-6 "One status line")', async () => {
  const statusLine = needFn(await copyModule(), 'statusLine');
  const wrong = [];
  const cases = [
    ['done', SM.ANSWERS.DONE, SM.PAGE.status.upToDate],
    ['nothing to claim, nothing claimed', SM.ANSWERS.NO_DUTIES, SM.PAGE.status.upToDate],
    ['none published', SM.ANSWERS.NOT_PUBLISHED, SM.PAGE.status.notPublished],
    ['published with no self-entries', SM.action({ done: false, pending: true, current: false, published: SM.published([]) }), SM.PAGE.status.notPublished],
    ['claims something else', SM.ANSWERS.STALE, SM.PAGE.status.outOfDate],
  ];
  for (const [label, a, want] of cases) {
    const got = statusLine(a);
    if (got !== want) wrong.push(`${label}: want ${show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P3: no status line when the check did not finish — statusLine gives none for an unfinished answer, a check-failed one, or no answer at all (as the Duty Menu page, ADR assistant-duty-menu/0001 Amendment 1 item 1)', async () => {
  const statusLine = needFn(await copyModule(), 'statusLine');
  const got = [SM.ANSWERS.UNFINISHED, SM.ANSWERS.CHECK_FAILED, null, undefined].map((a) => statusLine(a));
  assert(got.every((x) => x === null || x === undefined || x === ''), `want no line, got ${show(got)}`);
});

test('P4: reasonLine gives each reason\'s sentence, word for word; upkeep-stopped carries its date, shown as a date and never as raw seconds; an active line has none', async () => {
  const reasonLine = needFn(await copyModule(), 'reasonLine');
  const wrong = [];
  for (const [code, sentence] of Object.entries(SM.PAGE.reasons)) {
    if (code === 'upkeep-stopped') continue;
    const got = reasonLine(SM.line({ key: '30382', status: 'offered', reason: code }));
    if (got !== sentence) wrong.push(`${code}: want ${show(sentence)}, got ${show(got)}`);
  }
  const at = 1_780_870_800;
  const stopped = reasonLine(SM.line({ key: '30382', status: 'offered', reason: 'upkeep-stopped', lastLandedAt: at }));
  if (typeof stopped !== 'string' || !stopped.startsWith(`${SM.PAGE.upkeepStoppedLead} `) || !stopped.endsWith('.') || stopped.includes('<date>') || stopped.includes(String(at)) || !/\d/.test(stopped)) {
    wrong.push(`upkeep-stopped: "${SM.PAGE.upkeepStoppedLead} <a date>.", got ${show(stopped)}`);
  }
  const active = reasonLine(SM.line({ key: '30382', status: 'active', reason: null }));
  if (active) wrong.push(`an active line has no reason, got ${show(active)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('P5 (ADR 0001 A2 item 7, review N4): no date, no upkeep-stopped sentence — reasonLine gives no line for upkeep-stopped without a lastLandedAt, and the copy module carries no words § Copy lacks for an unknown date', async () => {
  const reasonLine = needFn(await copyModule(), 'reasonLine');
  const wrong = [];
  for (const lastLandedAt of [null, undefined, 0]) {
    const got = reasonLine(SM.line({ key: '30382', status: 'offered', reason: 'upkeep-stopped', lastLandedAt }));
    if (got) wrong.push(`lastLandedAt ${show(lastLandedAt)}: no line (got ${show(got)})`);
  }
  if (/unknown date/i.test(codeOnly(safeRead(COPY_MOD)))) wrong.push(`${rel(COPY_MOD)} still has "an unknown date", which § Copy does not give`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── D — the page's source ───────────────────────── */

test('D1: App.jsx serves /assistant/treasure-map with the page — AssistantTreasureMapPage imported from ./pages/assistant/AssistantTreasureMap and given to ACTION_PAGES under treasure-map (AC-6; ADR 0001 sub-decision 9)', () => {
  const app = codeOnly(safeRead(APP));
  const wrong = [];
  if (!/import\s+AssistantTreasureMapPage\s+from\s+['"]\.\/pages\/assistant\/AssistantTreasureMap(?:\.jsx)?['"]/.test(app)) wrong.push("no `import AssistantTreasureMapPage from './pages/assistant/AssistantTreasureMap'`");
  const pages = (app.match(/const\s+ACTION_PAGES\s*=\s*\{([\s\S]*?)\};/) || [])[1];
  if (pages === undefined) wrong.push('App.jsx has no `const ACTION_PAGES = { … };`');
  else if (!/['"]treasure-map['"]\s*:\s*<AssistantTreasureMapPage\s*\/>/.test(pages)) wrong.push("ACTION_PAGES has no 'treasure-map': <AssistantTreasureMapPage />");
  assert(wrong.length === 0, wrong.join('; '));
});

test('D2: the page reads the one shared answer — useAuth, useAssistantAttention, the hub\'s assistantAttention reading for its mark, its own ASSISTANT_ACTIONS entry — and takes its words and helpers from ./assistantTreasureMapCopy (AC-6, AC-7)', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist — ADR 0001 sub-decision 9 creates it`);
  const wrong = [];
  for (const [re, what] of [
    [/export\s+default\s+function\s+\w+\s*\(/, 'a default-exported page component'],
    [/\buseAuth\s*\(/, 'useAuth()'],
    [/\buseAssistantAttention\s*\(/, 'useAssistantAttention() — the one answer'],
    [/\bassistantAttention\s*\(/, "assistantAttention(user, attention) — the hub's mark for this action"],
    [/\bASSISTANT_ACTIONS\b/, "the action's own entry (its title and description from actions.js)"],
    [/['"]treasure-map['"]/, "the action's key, 'treasure-map'"],
    [/from\s*['"]\.\/assistantTreasureMapCopy(?:\.js)?['"]/, "the words from './assistantTreasureMapCopy'"],
    [/\bstatusLine\s*\(/, 'statusLine(answer) for the status line'],
    [/\breasonLine\s*\(/, 'reasonLine(line) for each line\'s reason'],
  ]) if (!re.test(src)) wrong.push(`no ${what}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('D3: the page has the hub\'s frame and states — TopBar, the back link, the title and description, the sign-in line and button, the no-assistant line and its link to Account Setup, Checking… and the failed line by phase, the Needs attention / Done mark with its screen-reader prefixes, styled like the hub\'s built pages (AC-6; § Copy "From the card and the hub")', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  const wrong = [];
  for (const [re, what] of [
    [/<TopBar\s*\/>/, '<TopBar />'],
    [/ASSISTANT_COPY\.backToHub\b/, 'the back link (ASSISTANT_COPY.backToHub)'],
    [/ASSISTANT_MANAGEMENT_PATH\b/, 'the back link to ASSISTANT_MANAGEMENT_PATH'],
    [/<ActionText\b/, 'the description through <ActionText />'],
    [/ASSISTANT_COPY\.signInButton\b/, "the hub's sign-in button"],
    [/\blogin\s*\(/, 'the sign-in button calls login()'],
    [/ASSISTANT_COPY\.noAssistantLine\b/, "the hub's no-assistant line"],
    [/ASSISTANT_COPY\.noAssistantLink\b/, 'its link to Account Setup'],
    [/['"]\/setup['"]/, 'the link goes to /setup'],
    [/['"]checking['"]/, "Checking… while phase is 'checking'"],
    [/['"]failed['"]/, "the could-not-check line when phase is 'failed'"],
    [/ASSISTANT_COPY\.needsAttention\b/, 'the Needs attention mark'],
    [/ASSISTANT_COPY\.needsAttentionSrPrefix\b/, 'its screen-reader prefix'],
    [/ASSISTANT_COPY\.done\b/, 'the Done badge'],
    [/ASSISTANT_COPY\.doneSrPrefix\b/, 'its screen-reader prefix'],
  ]) if (!re.test(src)) wrong.push(`no ${what}`);
  for (const cls of ['bs-setup-main', 'bs-setup-back', 'bs-setup-title', 'bs-idtags-card', 'bs-setup-step-badge']) if (!src.includes(cls)) wrong.push(`the page uses ${cls}, as the hub's built pages do`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('D4 (AC-7; re-aimed by assistant-self-map #2, ADR 0002 sub-decision 7): one request per load, and one per press — the page never fetches itself or names an /api/ address, never polls, stores nothing and signs nothing; its one network call is setAssistantSelfMap from ../../utils/setAssistantSelfMap; besides sign-in, its buttons are the self-Map\'s three', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src && /\buseAssistantAttention\s*\(/.test(src), `${rel(PAGE)} ${src ? 'does not read the shared answer' : 'does not exist'} — these refusals need a real page to mean anything`);
  const hits = [
    [/\bfetch\s*\(/, 'fetch('], [/setInterval\s*\(|setTimeout\s*\(/, 'a timer (polling)'],
    [/localStorage|sessionStorage/, 'browser storage'], [/['"`]\/api\//, 'an /api/ address'],
    [/finalizeEvent|signEvent|window\.nostr/i, 'a signature'],
  ].filter(([re]) => re.test(src)).map(([, what]) => what);
  if (!/import\s*\{\s*setAssistantSelfMap\s*\}\s*from\s*['"]\.\.\/\.\.\/utils\/setAssistantSelfMap(?:\.js)?['"]/.test(src)) hits.push("no `import { setAssistantSelfMap } from '../../utils/setAssistantSelfMap'`");
  if (!/\bsetAssistantSelfMap\s*\(/.test(src)) hits.push('no setAssistantSelfMap(…) call');
  const buttons = (src.match(/<button\b/g) || []).length;
  if (buttons > 4) hits.push(`${buttons} buttons; sign-in and the self-Map's three at most`);
  assert(hits.length === 0, `the page: ${hits.join('; ')}`);
});

test('D5: the page\'s own words have one home — none of § Copy\'s sentences is typed into AssistantTreasureMap.jsx; it shows them from ./assistantTreasureMapCopy (AC-6)', () => {
  const raw = safeRead(PAGE);
  assert(raw && /from\s*['"]\.\/assistantTreasureMapCopy(?:\.js)?['"]/.test(raw), `${rel(PAGE)} ${raw ? 'does not import ./assistantTreasureMapCopy' : 'does not exist'} — the words must come from there`);
  const retyped = [...SM.PAGE_SENTENCES, SM.PAGE.checking].filter((s) => raw.includes(s));
  assert(retyped.length === 0, `retyped in the page: ${retyped.map(show).join('; ')}`);
});

test('D6 (AC-6 "The three pages, linked"): the page links to the Duty Menu page and to /treasure-map through their path constants, never retyped', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  const wrong = [];
  if (!/\bMANAGE_TREASURE_MAP_PATH\b/.test(src)) wrong.push('/treasure-map through MANAGE_TREASURE_MAP_PATH (ui/src/config/avatarMenuLinks.js)');
  if (!/ASSISTANT_MANAGEMENT_PATH\s*\}\s*\/duty-menu|['"]duty-menu['"]/.test(src)) wrong.push('the Duty Menu page through its action entry or `${ASSISTANT_MANAGEMENT_PATH}/duty-menu`');
  if (/['"]\/treasure-map['"]|['"]\/assistant\/duty-menu['"]/.test(src)) wrong.push('a path typed out');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── Q — story 2's words and helpers (ADR 0002 sub-decision 7) ───────────────────────── */

test('Q1: the copy module holds every sentence story 2\'s § Copy gives the page — the three buttons, Publishing…, the three state lines, the Owner\'s note and "now claims no duties" (AC-2; story 2 § Copy)', async () => {
  const mod = await copyModule();
  const strings = [...stringsOf(Object.fromEntries(Object.entries(mod).filter(([, v]) => typeof v !== 'function')))];
  const want = [...SM.PRESS_PAGE_SENTENCES, SM.PRESS.buttons.publishing];
  const missing = want.filter((x) => !strings.includes(x));
  assert(missing.length === 0, `missing, word for word: ${missing.map(show).join('; ')}`);
});

const offStale = () => SM.offOf(SM.ANSWERS.STALE);
const offUnfinished = () => SM.offOf(SM.ANSWERS.UNFINISHED);

test('Q2: selfMapStateLine gives the one state line — on; off; off while the version found still claims duties; none when the choice is unknown or there is no answer (AC-2 "One state line"; § Copy)', async () => {
  const stateLine = (await copyModule()).selfMapStateLine;
  assert(typeof stateLine === 'function', `${rel(COPY_MOD)} must export selfMapStateLine() (ADR 0002 sub-decision 7)`);
  const wrong = [];
  const cases = [
    ['on, up to date', SM.ANSWERS.DONE, SM.PRESS.state.on],
    ['on, out of date', SM.ANSWERS.STALE, SM.PRESS.state.on],
    ['on, the check did not finish', SM.ANSWERS.UNFINISHED, SM.PRESS.state.on],
    ['on, nothing published yet', SM.ANSWERS.NOT_PUBLISHED, SM.PRESS.state.on],
    ['off, nothing found', SM.offOf(SM.ANSWERS.NOT_PUBLISHED), SM.PRESS.state.off],
    ['off, nothing to claim', SM.offOf(SM.ANSWERS.NO_DUTIES), SM.PRESS.state.off],
    ['off, self-entries still found', offStale(), SM.PRESS.state.offStillClaims],
    ['off, the check did not finish', offUnfinished(), SM.PRESS.state.off],
    ['unknown (check failed)', SM.ANSWERS.CHECK_FAILED, null],
    ['no answer', null, null],
  ];
  for (const [label, a, want] of cases) {
    const got = stateLine(a);
    if ((got || null) !== want) wrong.push(`${label}: want ${show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('Q3: selfMapButtons says which buttons show — off or unknown: Turn on, plus Turn off only when a finished check found self-entries; on: Update now (enabled unless up to date) and Turn off; no answer: none (AC-2; ADR 0002 sub-decision 7)', async () => {
  const buttons = (await copyModule()).selfMapButtons;
  assert(typeof buttons === 'function', `${rel(COPY_MOD)} must export selfMapButtons() (ADR 0002 sub-decision 7)`);
  const view = (b) => ({ turnOn: Boolean(b && b.turnOn), update: Boolean(b && b.update && b.update.shown), updateEnabled: Boolean(b && b.update && b.update.shown && b.update.enabled), turnOff: Boolean(b && b.turnOff) });
  const wrong = [];
  const cases = [
    ['on, up to date', SM.ANSWERS.DONE, { turnOn: false, update: true, updateEnabled: false, turnOff: true }],
    ['on, out of date', SM.ANSWERS.STALE, { turnOn: false, update: true, updateEnabled: true, turnOff: true }],
    ['on, the check did not finish', SM.ANSWERS.UNFINISHED, { turnOn: false, update: true, updateEnabled: true, turnOff: true }],
    ['on, nothing published yet', SM.ANSWERS.NOT_PUBLISHED, { turnOn: false, update: true, updateEnabled: true, turnOff: true }],
    ['off, nothing found', SM.offOf(SM.ANSWERS.NOT_PUBLISHED), { turnOn: true, update: false, updateEnabled: false, turnOff: false }],
    ['off, nothing to claim', SM.offOf(SM.ANSWERS.NO_DUTIES), { turnOn: true, update: false, updateEnabled: false, turnOff: false }],
    ['off, self-entries still found', offStale(), { turnOn: true, update: false, updateEnabled: false, turnOff: true }],
    ['off, the check did not finish', offUnfinished(), { turnOn: true, update: false, updateEnabled: false, turnOff: false }],
    ['unknown (check failed)', SM.ANSWERS.CHECK_FAILED, { turnOn: true, update: false, updateEnabled: false, turnOff: false }],
    ['no answer', null, { turnOn: false, update: false, updateEnabled: false, turnOff: false }],
  ];
  for (const [label, a, want] of cases) {
    const got = view(buttons(a));
    if (show(got) !== show(want)) wrong.push(`${label}: want ${show(want)}, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── H — the client helper (ADR 0002 sub-decision 7) ───────────────────────── */

async function withFetch(answer, fn) {
  const saved = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init: init || {} }); return answer(); };
  try { return await fn(calls); } finally { globalThis.fetch = saved; }
}
const headerOf = (init, name) => {
  const h = init && init.headers;
  if (!h) return undefined;
  if (typeof h.get === 'function') return h.get(name);
  const k = Object.keys(h).find((x) => x.toLowerCase() === name.toLowerCase());
  return k ? h[k] : undefined;
};

test('H1: setAssistantSelfMap(on) posts { on } as JSON to /api/assistant/self-map — one request, nothing else in the body — and answers the status with the instance\'s JSON (AC-2, AC-3)', async () => {
  const mod = await esm(CLIENT_UTIL, 'ADR 0002 sub-decision 7 creates it: setAssistantSelfMap(on).');
  assert(typeof mod.setAssistantSelfMap === 'function', `${rel(CLIENT_UTIL)} must export setAssistantSelfMap()`);
  const wrong = [];
  for (const on of [true, false]) {
    const data = { success: true, result: { ok: true, on, published: false } };
    await withFetch(() => ({ status: 200, json: async () => data }), async (calls) => {
      const got = await mod.setAssistantSelfMap(on);
      if (calls.length !== 1) { wrong.push(`on ${on}: one request, got ${calls.length}`); return; }
      const { url, init } = calls[0];
      if (url !== SM.PRESS.route) wrong.push(`on ${on}: to ${SM.PRESS.route}, got ${url}`);
      if (String(init.method || '').toUpperCase() !== 'POST') wrong.push(`on ${on}: POST, got ${show(init.method)}`);
      if (!/^application\/json/i.test(String(headerOf(init, 'Content-Type') || ''))) wrong.push(`on ${on}: Content-Type application/json, got ${show(headerOf(init, 'Content-Type'))}`);
      let body = null;
      try { body = JSON.parse(init.body); } catch { body = init.body; }
      if (show(body) !== show({ on })) wrong.push(`on ${on}: body ${show({ on })}, got ${show(init.body)}`);
      if (!got || got.status !== 200 || got.success !== true || !got.result || got.result.on !== on) wrong.push(`on ${on}: answers { status, ...data }, got ${show(got)}`);
    });
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('H2: setAssistantSelfMap throws when the instance does not answer with JSON, and passes a refusal through with its status (AC-2: "a request that never answers is one line saying nothing was published")', async () => {
  const mod = await esm(CLIENT_UTIL, 'ADR 0002 sub-decision 7 creates it.');
  const wrong = [];
  await withFetch(() => ({ status: 502, json: async () => { throw new Error('not json'); } }), async () => {
    let threw = false;
    try { await mod.setAssistantSelfMap(true); } catch { threw = true; }
    if (!threw) wrong.push('a non-JSON answer throws');
  });
  await withFetch(() => ({ status: 503, json: async () => ({ success: false, code: SM.PRESS.codes.notRead, error: SM.PRESS.refusals['not-read'] }) }), async () => {
    const got = await mod.setAssistantSelfMap(true);
    if (!got || got.status !== 503 || got.code !== SM.PRESS.codes.notRead || got.error !== SM.PRESS.refusals['not-read']) wrong.push(`a refusal passes through, got ${show(got)}`);
  });
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── D — story 2's wiring ───────────────────────── */

test('D7 (story 2 AC-2; ADR 0002 sub-decision 7): the page draws the state line and the buttons from the copy module\'s helpers, the report through describeServerPublish and relayLine, and asks for the answer again after a press', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  const wrong = [];
  for (const [re, what] of [
    [/\bselfMapStateLine\s*\(/, 'selfMapStateLine(answer) for the state line'],
    [/\bselfMapButtons\s*\(/, 'selfMapButtons(answer) for which buttons show'],
    [/\bdescribeServerPublish\s*\(/, 'describeServerPublish(…) for the report, as the Duty Menu page draws it'],
    [/\brelayLine\s*\(/, 'relayLine(row) for each relay line'],
    [/attention\.refresh\s*\(\s*\)/, 'attention.refresh() after a press'],
    [/\bdisabled=\{/, 'buttons disabled while a press is under way (disabled={…})'],
  ]) if (!re.test(src)) wrong.push(`no ${what}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('D8 (story 2 § Copy): story 2\'s words have one home too — none of its page sentences, nor Publishing…, is typed into AssistantTreasureMap.jsx', () => {
  const raw = safeRead(PAGE);
  assert(raw, `${rel(PAGE)} does not exist`);
  const retyped = [...SM.PRESS_PAGE_SENTENCES, SM.PRESS.buttons.publishing].filter((x) => raw.includes(x));
  assert(retyped.length === 0, `retyped in the page: ${retyped.map(show).join('; ')}`);
});

async function run() {
  console.log(`${NL}=== assistant-self-map-page (assistant-self-map #1) ===`);
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
  console.log(`${NL}assistant-self-map-page: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
