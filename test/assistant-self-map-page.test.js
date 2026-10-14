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
 * Round 2 (ADR 0002 Amendment 1): Q3's off-or-unknown cases with an unfinished check now show Turn off (item 4); D9 pins
 * the Owner's note to the session (item 5).
 *
 * assistant-self-map #3 (one name for your Assistant's Treasure Map; story 3 § Copy, no ADR): the fixtures' words are
 * re-aimed to § Copy, so P1, P2, Q1 and Q2 now check the new lines.
 *   N — no line says "self-Map" or "self-entries" (N1, N2), and only words change: the copy module's keys, kinds and
 *       exports are as before (N3).                                                                [AC-1, AC-4]
 *
 * assistant-self-map #4 (show your Assistant's raw Treasure Map; story 4 AC-1 … AC-5, § Copy; ADR assistant-self-map/0003
 * sub-decisions 2–6):
 *   W — the copy module's raw words, word for word as § Copy (W1); rawTreasureMap(answer), the found event or null
 *       (W2, W3); rawTreasureMapText(event) (W4).                                                  [AC-1 … AC-3]
 *   D — the page's toggle: its place in the published card (D10), closed by default with aria-expanded and the named,
 *       focusable box (D11), the event read from the current answer and never kept (D12), its words' one home (D13),
 *       the box's styles wrap and cap its height (D14).                                            [AC-1, AC-2, AC-4]
 *   N3 and D4 are re-aimed: story 4 adds `raw` words and two helpers to the copy module, and the toggle is a fifth
 *   button. These FAIL until the helpers, the words and the toggle exist.
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

test('D4 (AC-7; re-aimed by assistant-self-map #2, ADR 0002 sub-decision 7, and #4, ADR 0003 sub-decision 5): one request per load, and one per press — the page never fetches itself or names an /api/ address, never polls, stores nothing and signs nothing; its one network call is setAssistantSelfMap from ../../utils/setAssistantSelfMap; besides sign-in, its buttons are the self-Map\'s three and the raw toggle', () => {
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
  if (buttons > 5) hits.push(`${buttons} buttons; sign-in, the self-Map's three and the raw toggle at most`);
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

test('Q3: selfMapButtons says which buttons show — off or unknown: Turn on, plus Turn off when a finished check found self-entries or the check did not finish (ADR 0002 A1 item 4); on: Update now (enabled unless up to date) and Turn off; no answer: none (AC-2; ADR 0002 sub-decision 7)', async () => {
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
    // Re-aimed by ADR 0002 Amendment 1 item 4: the self-Map found is unknown, so Turn off shows.
    ['off, the check did not finish', offUnfinished(), { turnOn: true, update: false, updateEnabled: false, turnOff: true }],
    ['unknown (check failed)', SM.ANSWERS.CHECK_FAILED, { turnOn: true, update: false, updateEnabled: false, turnOff: true }],
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

test('D9 (ADR 0002 A1 item 5): the Owner\'s note reads the session — the page tests user.classification === \'owner\' for it, so a check that threw (instanceMap false) does not hide it', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  const wrong = [];
  if (!/user\.classification\s*===\s*['"]owner['"]/.test(src)) wrong.push("no user.classification === 'owner'");
  const noteLine = src.split(NL).find((l) => /ownerNote/.test(l)) || '';
  if (/instanceMap/.test(noteLine)) wrong.push(`the note's line still reads instanceMap: ${noteLine.trim()}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── N — one name for your Assistant's Treasure Map (assistant-self-map #3) ───────────────────────── */

/** The old name and its parts, as a person would read them (story 3 AC-1). */
const OLD_NAME = /self-map|self-entr/i;
/** The copy module's shape before story 3 (stories 1 and 2): each key path and the kind of value at it (story 3 AC-4). */
const COPY_SHAPE = [
  'signedOutLine:string', 'dutiesHeading:string', 'dutiesExplainer:string', 'statusWords.active:string', 'statusWords.offered:string',
  'statusWords.not-offered:string', 'reasons.live-unclaimed:string', 'reasons.not-published-here:string', 'reasons.nothing-to-publish:string',
  'reasons.not-landed:string', 'reasons.older-form:string', 'reasons.not-scheduled:string', 'reasons.unchecked:string', 'upkeepStoppedLead:string',
  'elsewhere:string', 'falseClaim:string', 'noDuties:string', 'yourTreasureMap:string', 'shouldHeading:string', 'shouldExplainer:string',
  'shouldEmpty:string', 'publishedHeading:string', 'checking:string', 'none:string', 'couldNotCheck.no-relay-answered:string',
  'couldNotCheck.request-failed:string', 'status.upToDate:string', 'status.notPublished:string', 'status.outOfDate:string',
  'links.dutyMenuLead:string', 'links.dutyMenu:string', 'links.treasureMapLead:string', 'links.treasureMap:string', 'ownerLine:function',
  'publicLine:string', 'categories.scores:string', 'categories.lists:string', 'categories.concepts:string', 'press.turnOn:string',
  'press.update:string', 'press.turnOff:string', 'press.publishing:string', 'press.subject:string', 'press.claimsNone:string',
  'press.requestFailed:string', 'state.on:string', 'state.off:string', 'state.offStillClaims:string', 'ownerNote:string',
  // Re-aimed by assistant-self-map #4 (ADR 0003 sub-decision 4): the raw toggle's words and the box's accessible name.
  'raw.show:string', 'raw.hide:string', 'raw.closedMark:string', 'raw.openMark:string', 'raw.boxLabel:string',
];
// Re-aimed by assistant-self-map #4 (ADR 0003 sub-decisions 2–3): rawTreasureMap and rawTreasureMapText.
const COPY_EXPORTS = ['SELF_MAP_COPY', 'couldNotCheckLine', 'rawTreasureMap', 'rawTreasureMapText', 'reasonLine', 'selfMapButtons', 'selfMapStateLine', 'statusLine'];

test('N1 (story 3 AC-1): no word the copy module gives the page says "self-Map" or "self-entries" — every sentence, the Owner\'s line with its count, and every line the helpers return', async () => {
  const mod = await copyModule();
  const words = mod.SELF_MAP_COPY || {};
  const lines = [...stringsOf(words)];
  if (typeof words.ownerLine === 'function') lines.push(words.ownerLine(3));
  const helpers = [
    ...[SM.ANSWERS.DONE, SM.ANSWERS.NO_DUTIES, SM.ANSWERS.NOT_PUBLISHED, SM.ANSWERS.STALE, SM.ANSWERS.UNFINISHED].map((a) => (typeof mod.statusLine === 'function' ? mod.statusLine(a) : null)),
    ...[SM.ANSWERS.DONE, SM.offOf(SM.ANSWERS.STALE), SM.offOf(SM.ANSWERS.NOT_PUBLISHED)].map((a) => (typeof mod.selfMapStateLine === 'function' ? mod.selfMapStateLine(a) : null)),
    ...SM.REASONS.map((reason) => (typeof mod.reasonLine === 'function' ? mod.reasonLine({ reason, lastLandedAt: 1780868418 }) : null)),
    ...['no-relay-answered', 'instance-unanswered', 'check-failed'].map((r) => (typeof mod.couldNotCheckLine === 'function' ? mod.couldNotCheckLine(r) : null)),
  ].filter((x) => typeof x === 'string');
  const old = [...lines, ...helpers].filter((x) => OLD_NAME.test(x));
  assert(old.length === 0, `still says the old name (story 3 § Copy gives each line's new words): ${[...new Set(old)].map(show).join('; ')}`);
});

test('N2 (story 3 AC-1): the page itself writes no "self-Map" a person could read — outside its comments, AssistantTreasureMap.jsx and the copy module carry no "self-Map" or "self-entries" at all', () => {
  const wrong = [];
  for (const file of [PAGE, COPY_MOD]) {
    const src = codeOnly(safeRead(file));
    if (!src) { wrong.push(`${rel(file)} does not exist`); continue; }
    const hits = src.split(NL).map((l, i) => [i + 1, l]).filter(([, l]) => OLD_NAME.test(l));
    for (const [n, l] of hits) wrong.push(`${rel(file)}:${n}: ${l.trim().slice(0, 140)}`);
  }
  assert(wrong.length === 0, `the old name outside comments: ${wrong.join(' | ')}`);
});

test('N3 (story 3 AC-4; re-aimed by story 4): only words change — the copy module keeps every key, every kind of value and every export it had before story 3, plus story 4\'s raw words and two helpers, and nothing else', async () => {
  const mod = await copyModule();
  const paths = [];
  const walk = (o, at) => { for (const [k, v] of Object.entries(o)) { const q = at ? `${at}.${k}` : k; if (v && typeof v === 'object') walk(v, q); else paths.push(`${q}:${typeof v}`); } };
  walk(mod.SELF_MAP_COPY || {}, '');
  const wrong = [];
  const missing = COPY_SHAPE.filter((x) => !paths.includes(x));
  const added = paths.filter((x) => !COPY_SHAPE.includes(x));
  if (missing.length) wrong.push(`missing: ${missing.join(', ')}`);
  if (added.length) wrong.push(`added: ${added.join(', ')}`);
  const exportsNow = Object.keys(mod).sort();
  if (show(exportsNow) !== show(COPY_EXPORTS)) wrong.push(`exports: want ${show(COPY_EXPORTS)}, got ${show(exportsNow)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── W — story 4's raw view: words and helpers (ADR 0003 sub-decisions 2–4) ───────────────────────── */

const STYLES = path.join(REPO, 'ui/src/styles.css');
const rawHelpers = async () => {
  const mod = await copyModule();
  const wrong = [];
  for (const name of ['rawTreasureMap', 'rawTreasureMapText']) if (typeof mod[name] !== 'function') wrong.push(`${rel(COPY_MOD)} must export ${name}() (ADR 0003 sub-decisions 2–3)`);
  assert(wrong.length === 0, wrong.join('; '));
  return mod;
};
/** A finished answer whose found version is `event` (the canned one unless given). */
const withEvent = (event, over = {}) => SM.action({ published: SM.published(SM.SHOULD_LIVE.slice(), { event, ...over }) });

test('W1 (story 4 § Copy; ADR 0003 sub-decision 4): SELF_MAP_COPY.raw holds the toggle\'s words and marks and the box\'s name, word for word, and the marks before the words read as § Copy — "▸ Show your Assistant\'s raw Treasure Map" closed, "▾ Hide your Assistant\'s raw Treasure Map" open', async () => {
  const mod = await copyModule();
  const raw = (mod.SELF_MAP_COPY || {}).raw;
  assert(raw && typeof raw === 'object', `${rel(COPY_MOD)}: SELF_MAP_COPY.raw is missing (ADR 0003 sub-decision 4)`);
  const wrong = [];
  for (const k of ['show', 'hide', 'closedMark', 'openMark', 'boxLabel']) if (raw[k] !== SM.RAW[k]) wrong.push(`raw.${k}: want ${show(SM.RAW[k])}, got ${show(raw[k])}`);
  if (`${raw.closedMark} ${raw.show}` !== SM.RAW.closedLabel) wrong.push(`closed, as seen: want ${show(SM.RAW.closedLabel)}, got ${show(`${raw.closedMark} ${raw.show}`)}`);
  if (`${raw.openMark} ${raw.hide}` !== SM.RAW.openLabel) wrong.push(`open, as seen: want ${show(SM.RAW.openLabel)}, got ${show(`${raw.openMark} ${raw.hide}`)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('W2 (story 4 AC-1; ADR 0003 sub-decision 2): rawTreasureMap gives the found event whenever a finished check found a version — up to date, out of date, listing none of the Assistant\'s duties, found on another relay, the Owner\'s or a customer\'s — the very object the answer carries', async () => {
  const { rawTreasureMap } = await rawHelpers();
  const wrong = [];
  const cases = [
    ['up to date', SM.ANSWERS.DONE],
    ['out of date', SM.ANSWERS.STALE],
    ['listing none of its duties', SM.ANSWERS.LISTS_NONE],
    ['found on another relay', SM.action({ published: SM.published(SM.SHOULD_LIVE.slice(), { source: 'relay', eventId: 'f'.repeat(64) }) })],
    ['a customer\'s', SM.action({ instanceMap: false, published: SM.published([{ key: '39998', relay: SM.OWN }], { otherEntries: 0 }) })],
    ['off, still listing', SM.offOf(SM.ANSWERS.STALE)],
  ];
  for (const [label, a] of cases) {
    const got = rawTreasureMap(a);
    if (got !== a.published.event) wrong.push(`${label}: want the answer's published.event (id ${a.published.event.id.slice(0, 8)}…), got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('W3 (story 4 AC-3; ADR 0003 sub-decision 2): rawTreasureMap gives null when there is nothing to show — no answer (checking, failed), a check that did not finish (even one carrying a stray published), check-failed, nothing found, no duties, and a published whose event is missing, null, an array or not an object', async () => {
  const { rawTreasureMap } = await rawHelpers();
  const wrong = [];
  const stray = { ...SM.ANSWERS.UNFINISHED, published: SM.published(SM.SHOULD_LIVE.slice()) };
  const noEvent = SM.action({ published: SM.published(SM.SHOULD_LIVE.slice(), { event: undefined }) });
  delete noEvent.published.event;
  const cases = [
    ['no answer (null)', null],
    ['no answer (undefined)', undefined],
    ['unfinished', SM.ANSWERS.UNFINISHED],
    ['unfinished, with a stray published', stray],
    ['check failed', SM.ANSWERS.CHECK_FAILED],
    ['nothing found', SM.ANSWERS.NOT_PUBLISHED],
    ['no duties, nothing found', SM.ANSWERS.NO_DUTIES],
    ['published without event', noEvent],
    ['event null', withEvent(null)],
    ['event an array', withEvent([])],
    ['event a string', withEvent('{"id":"x"}')],
  ];
  // The path under test ran: the same helper gives an event for a found version.
  if (!rawTreasureMap(SM.ANSWERS.DONE)) wrong.push('control: a found version gives its event');
  for (const [label, a] of cases) {
    const got = rawTreasureMap(a);
    if (got !== null) wrong.push(`${label}: want null, got ${show(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('W4 (story 4 AC-2; ADR 0003 sub-decision 3): rawTreasureMapText shows the event as indented JSON — JSON.stringify(event, null, 2), so it reads back to the same event with every field — and \'\' for none', async () => {
  const { rawTreasureMapText } = await rawHelpers();
  const event = SM.ANSWERS.DONE.published.event;
  const wrong = [];
  const text = rawTreasureMapText(event);
  if (text !== JSON.stringify(event, null, 2)) wrong.push(`want JSON.stringify(event, null, 2), got ${show(String(text).slice(0, 80))}…`);
  let back = null;
  try { back = JSON.parse(text); } catch { back = null; }
  for (const k of ['id', 'pubkey', 'created_at', 'kind', 'tags', 'content', 'sig']) if (!back || show(back[k]) !== show(event[k])) wrong.push(`reads back ${k}`);
  if (!/\n  "id": /.test(String(text))) wrong.push('indented by two spaces, one field per line');
  for (const none of [null, undefined]) if (rawTreasureMapText(none) !== '') wrong.push(`${show(none)}: want '', got ${show(rawTreasureMapText(none))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── D — story 4's toggle in the page (ADR 0003 sub-decisions 5–6) ───────────────────────── */

/** The opening tag that starts at `at`, through its `>` outside any {…} expression (so `=>` inside one never ends it). */
function openTagAt(src, at) {
  let depth = 0;
  for (let i = at; i < src.length; i += 1) {
    const c = src[i];
    if (c === '{') depth += 1;
    else if (c === '}') depth -= 1;
    else if (c === '>' && depth === 0) return src.slice(at, i + 1);
  }
  return '';
}
/** The first <tag …> opening tag in `src` whose text contains `needle`, or ''. */
function tagWith(src, tag, needle) {
  const re = new RegExp(`<${tag}\\b`, 'g');
  let m;
  while ((m = re.exec(src))) {
    const t = openTagAt(src, m.index);
    if (t.includes(needle)) return t;
  }
  return '';
}
/** An attribute's {…} expression in an opening tag, braces balanced, or ''. */
function attrExpr(tagText, name) {
  const at = tagText.indexOf(`${name}={`);
  if (at < 0) return '';
  let depth = 0;
  for (let i = at + name.length + 1; i < tagText.length; i += 1) {
    if (tagText[i] === '{') depth += 1;
    else if (tagText[i] === '}') { depth -= 1; if (depth === 0) return tagText.slice(at + name.length + 2, i); }
  }
  return '';
}

/** The published card's source: from its aria-labelledby to the end of its <section>. */
function publishedCard(src) {
  const at = src.indexOf('aria-labelledby="bs-selfmap-published"');
  if (at < 0) return '';
  const end = src.indexOf('</section>', at);
  return end < 0 ? '' : src.slice(at, end);
}

test('D10 (story 4 AC-1; ADR 0003 sub-decision 5): the toggle sits in the published card, after what the card lists as found and before the state line and the buttons, and shows only for rawTreasureMap(answer)\'s event', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  const card = publishedCard(src);
  assert(card, 'the page has no published card (aria-labelledby="bs-selfmap-published" … </section>)');
  const wrong = [];
  if (!/\brawTreasureMap\s*\(\s*answer\s*\)/.test(src)) wrong.push('no rawTreasureMap(answer): the toggle shows only for the found event');
  const toggle = card.indexOf('bs-selfmap-raw-toggle');
  const entries = card.search(/<Entries\s+entries=\{selfEntries\}/);
  const state = card.search(/\{\s*stateLine\s*&&/);
  const actions = card.indexOf('bs-selfmap-actions');
  if (toggle < 0) wrong.push('no element with class bs-selfmap-raw-toggle in the published card');
  else {
    if (entries < 0 || toggle < entries) wrong.push('the toggle comes after <Entries entries={selfEntries} />');
    if (state < 0 || toggle > state) wrong.push('the toggle comes before {stateLine && …}');
    if (actions < 0 || toggle > actions) wrong.push('the toggle comes before the buttons (bs-selfmap-actions)');
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('D11 (story 4 AC-2, AC-4; ADR 0003 sub-decisions 4–5): closed on every load — useState(false) — and a real toggle: a <button type="button"> with aria-expanded and aria-controls naming the box; the marks in an aria-hidden span; the box a <pre> with that id, tabIndex={0}, role="region" and aria-label from SELF_MAP_COPY.raw.boxLabel, drawn through rawTreasureMapText', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  const card = publishedCard(src);
  const wrong = [];
  if (!/useState\(\s*false\s*\)/.test(src)) wrong.push('the toggle starts closed: useState(false)');
  const btn = tagWith(card, 'button', 'bs-selfmap-raw-toggle');
  if (!btn) wrong.push('no <button … className="bs-selfmap-raw-toggle"> in the published card');
  else {
    if (!/type="button"/.test(btn)) wrong.push('the toggle is type="button"');
    if (!/aria-expanded=\{/.test(btn)) wrong.push('the toggle carries aria-expanded={…}');
    if (!/aria-controls="bs-selfmap-raw-box"/.test(btn)) wrong.push('the toggle names its box: aria-controls="bs-selfmap-raw-box"');
  }
  if (!/<span\s+aria-hidden="true">\s*\{[^}]*(?:closedMark|openMark)/.test(card)) wrong.push('the marks are drawn in <span aria-hidden="true">, so a screen reader hears only the words');
  const pre = tagWith(card, 'pre', '');
  if (!pre) wrong.push('no <pre> box in the published card');
  else {
    for (const [re, what] of [
      [/id="bs-selfmap-raw-box"/, 'id="bs-selfmap-raw-box"'], [/className="bs-selfmap-raw-pre"/, 'className="bs-selfmap-raw-pre"'],
      [/tabIndex=\{0\}/, 'tabIndex={0}'], [/role="region"/, 'role="region"'], [/aria-label=\{[^}]*boxLabel\s*\}/, 'aria-label={….boxLabel}'],
    ]) if (!re.test(pre)) wrong.push(`the box has ${what}`);
  }
  if (!/\brawTreasureMapText\s*\(/.test(card)) wrong.push('the box shows rawTreasureMapText(…)');
  assert(wrong.length === 0, wrong.join('; '));
});

test('D12 (story 4 AC-4, AC-5; ADR 0003 sub-decision 5): never a stale version, and not a press — the event is read from the current answer on each render and never kept in state, a ref or an effect; the toggle\'s handler touches no press state, the press helper or a refresh', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src && /\brawTreasureMap\s*\(\s*answer\s*\)/.test(src), `${rel(PAGE)} ${src ? 'does not read rawTreasureMap(answer)' : 'does not exist'} — these refusals need the toggle to mean anything`);
  const wrong = [];
  if (/use(?:State|Ref|Memo)\s*\([^)]*rawTreasureMap/.test(src)) wrong.push('the event is kept in a hook');
  if (/\bset\w*\s*\(\s*rawTreasureMap/.test(src)) wrong.push('the event is copied into state');
  if (/useEffect\s*\([\s\S]{0,200}rawTreasureMap/.test(src)) wrong.push('the event is read in an effect');
  // Through a name too: `const x = rawTreasureMap(answer)` and then x handed to a setter, a hook or an effect.
  const name = (src.match(/const\s+(\w+)\s*=\s*rawTreasureMap\s*\(\s*answer\s*\)/) || [])[1];
  if (name) {
    const n = name.replace(/\$/g, '\\$');
    if (new RegExp(`\\bset\\w*\\s*\\(\\s*${n}\\b`).test(src)) wrong.push(`${name} is copied into state`);
    if (new RegExp(`use(?:State|Ref|Memo)\\s*\\([^)]*\\b${n}\\b`).test(src)) wrong.push(`${name} is kept in a hook`);
    if (new RegExp(`useEffect\\s*\\([\\s\\S]{0,200}\\b${n}\\b`).test(src)) wrong.push(`${name} is read in an effect`);
  }
  const handler = attrExpr(tagWith(publishedCard(src), 'button', 'bs-selfmap-raw-toggle'), 'onClick');
  if (!handler) wrong.push('the toggle has an onClick');
  else if (/onPress|setAssistantSelfMap|refresh|setPressing|setResult|setNotice/.test(handler)) wrong.push(`the toggle's handler reaches the press: ${handler.trim()}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('D13 (story 4 § Copy): the raw words have one home — none of them, nor the composed labels, is typed into AssistantTreasureMap.jsx', () => {
  const raw = safeRead(PAGE);
  assert(raw && /bs-selfmap-raw-toggle/.test(raw), `${rel(PAGE)} ${raw ? 'has no raw toggle yet' : 'does not exist'} — the words must come from ./assistantTreasureMapCopy`);
  const retyped = [SM.RAW.show, SM.RAW.hide, SM.RAW.boxLabel, SM.RAW.closedLabel, SM.RAW.openLabel, SM.RAW.closedMark, SM.RAW.openMark].filter((x) => raw.includes(x));
  assert(retyped.length === 0, `retyped in the page: ${retyped.map(show).join('; ')}`);
});

test('D14 (story 4 AC-2; ADR 0003 sub-decision 6): the styles — .bs-selfmap-raw-pre wraps (white-space: pre-wrap; overflow-wrap: anywhere), caps its height and scrolls (max-height, overflow-y: auto), and shows keyboard focus; .bs-selfmap-raw-toggle shows keyboard focus', () => {
  const css = safeRead(STYLES);
  const wrong = [];
  const rule = (sel) => { const m = css.match(new RegExp(`${sel.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`)); return m ? m[1] : ''; };
  const pre = rule('.bs-selfmap-raw-pre');
  if (!pre) wrong.push('no .bs-selfmap-raw-pre { … } rule');
  else {
    if (!/white-space:\s*pre-wrap/.test(pre)) wrong.push('.bs-selfmap-raw-pre: white-space: pre-wrap');
    if (!/overflow-wrap:\s*anywhere/.test(pre)) wrong.push('.bs-selfmap-raw-pre: overflow-wrap: anywhere');
    if (!/max-height:/.test(pre)) wrong.push('.bs-selfmap-raw-pre: a max-height');
    if (!/overflow-y:\s*auto/.test(pre)) wrong.push('.bs-selfmap-raw-pre: overflow-y: auto');
  }
  if (!/\.bs-selfmap-raw-pre:focus-visible\s*\{/.test(css)) wrong.push('no .bs-selfmap-raw-pre:focus-visible rule');
  if (!/\.bs-selfmap-raw-toggle\s*\{/.test(css)) wrong.push('no .bs-selfmap-raw-toggle { … } rule');
  if (!/\.bs-selfmap-raw-toggle:focus-visible\s*\{/.test(css)) wrong.push('no .bs-selfmap-raw-toggle:focus-visible rule');
  assert(wrong.length === 0, wrong.join('; '));
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
