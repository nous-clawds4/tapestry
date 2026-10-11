'use strict';
/**
 * assistant-duty-menu #1: the Duty Menu page — what your Assistant offers, the menu it has published, one status line,
 * and the public line — read from the hub's one answer.
 *
 * Story: engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.md (AC-5, AC-6, § Copy)
 * ADR:   engineering-team/decisions/assistant-duty-menu/0001-a-duty-menu-check-beside-the-others.md (sub-decision 6)
 * Plan:  engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.test-plan.md
 * Check half: test/assistant-duty-menu-check.test.js. Browser half: tests/brainstorm/assistant-duty-menu.spec.js
 * (what a viewer sees in each state). Words and canned answers: test/helpers/dutyMenuFixtures.js.
 *
 * Classes (all stack-free):
 *   P — the page's words and pure helpers, ui/src/pages/assistant/dutyMenuCopy.js, loaded in Node: the story's
 *       § Copy, categoryOf (agreeing with the Treasure Map rule's appliesTo) and statusLine (no line for an
 *       unfinished check: ADR 0001 Amendment 1 item 1, P5; the none line apart from the status line:
 *       Amendment 2 item 3, P6).                                                                        [AC-5]
 *   D — source sentinels on what this runner cannot execute: the route in App.jsx, and DutyMenu.jsx's states, its
 *       one shared answer, its words' one home, and that it never fetches, refreshes, polls or publishes. [AC-5, AC-6]
 *
 * Everything FAILS against the current code: dutyMenuCopy.js and DutyMenu.jsx do not exist, and /assistant/duty-menu
 * routes to the placeholder page.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const DM = require('./helpers/dutyMenuFixtures');

const REPO = path.resolve(__dirname, '..');
const COPY_MOD = path.join(REPO, 'ui/src/pages/assistant/dutyMenuCopy.js');
const PAGE = path.join(REPO, 'ui/src/pages/assistant/DutyMenu.jsx');
const APP = path.join(REPO, 'ui/src/App.jsx');
const RULE = path.join(REPO, 'src/lib/treasureMapCategories.mjs');
const NL = String.fromCharCode(10);
const HEX = 'ab'.repeat(32);

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
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { return await import(pathToFileURL(absPath).href); } catch (err) { throw new Error(`${rel(absPath)} must load in Node as ESM: ${err.message}`); }
}
const copyModule = () => esm(COPY_MOD, 'ADR 0001 sub-decision 6 creates it: the story\'s words, categoryOf(key) and statusLine(answer).');
const ruleModule = () => esm(RULE, 'It is the Treasure Map\'s category rule (entryOf, appliesTo).');
function needFn(mod, name) {
  assert(typeof mod[name] === 'function', `ui/src/pages/assistant/dutyMenuCopy.js must export ${name}() (ADR 0001 sub-decision 6)`);
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

/** The names categoryOf gives, as a list in the order they appear (a bare `*` names all three, joined). */
const namesIn = (text) => ['scores', 'lists', 'concepts'].filter((c) => typeof text === 'string' && text.includes(DM.CATEGORY_NAMES[c]));

/* ───────────────────────── P — the page's words and helpers ───────────────────────── */

test('P1: the copy module loads in Node and holds every sentence the story\'s § Copy gives this page, the exception "not offered", and the three category names (AC-5; § Copy)', async () => {
  const mod = await copyModule();
  const strings = stringsOf(Object.fromEntries(Object.entries(mod).filter(([, v]) => typeof v !== 'function')));
  const want = [...DM.PAGE_SENTENCES, DM.PAGE.checking, DM.PAGE.notOffered, ...Object.values(DM.CATEGORY_NAMES)];
  const missing = want.filter((s) => !strings.has(s));
  assert(missing.length === 0, `missing, word for word: ${missing.map(show).join('; ')}`);
});

test('P2: categoryOf names a row\'s Treasure Map category — 30382 and 3038x Scores; 30392–30394 and 3039x Lists; 39998, 39999 and Concept keys Concepts; scoped keys by their kind slot; a bare * all three, in that order (AC-5; ADR 0001 sub-decision 6)', async () => {
  const categoryOf = needFn(await copyModule(), 'categoryOf');
  const C = DM.CATEGORY_NAMES;
  const cases = [
    ['30382', C.scores], ['3038x', C.scores], ['30382:rank', C.scores], ['30385', C.scores],
    ['30392', C.lists], ['30393', C.lists], ['30394', C.lists], ['3039x', C.lists], ['3039x:tag', C.lists],
    ['39998', C.concepts], ['39999', C.concepts], ['39999:my-list', C.concepts],
  ];
  const wrong = cases.filter(([k, want]) => categoryOf(k) !== want).map(([k, want]) => `${k}: want ${show(want)}, got ${show(categoryOf(k))}`);
  const star = categoryOf('*');
  if (!(typeof star === 'string' && show(namesIn(star)) === show(['scores', 'lists', 'concepts'])
    && star.indexOf(C.scores) < star.indexOf(C.lists) && star.indexOf(C.lists) < star.indexOf(C.concepts))) wrong.push(`*: want Scores, Lists and Concepts joined in that order, got ${show(star)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('P3: categoryOf agrees with the Treasure Map rule\'s appliesTo for every key the offer uses and each family — the page and /treasure-map cannot sort a key differently (ADR 0001 sub-decision 6: "a test pins the agreement")', async () => {
  const categoryOf = needFn(await copyModule(), 'categoryOf');
  const { entryOf, appliesTo } = await ruleModule();
  const keys = [...DM.OFFER_KEYS.scores, ...DM.OFFER_KEYS.lists, ...DM.OFFER_KEYS.concepts, '30380', '30389', '30390', '30399', '3038x', '3039x', '30382:rank', '3039x:tag', '39999:my-list', '*'];
  const wrong = [];
  for (const key of keys) {
    const rule = ['scores', 'lists', 'concepts'].filter((c) => appliesTo(c, entryOf([key, HEX, ''])));
    const page = namesIn(categoryOf(key));
    if (show(rule) !== show(page)) wrong.push(`${key}: the rule says ${show(rule)}, categoryOf says ${show(categoryOf(key))}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P4: statusLine gives the one status line from the answer — up to date when done; not published yet when no menu was found; out of date when the menu found differs; and the same with an empty offer (AC-5 "One status line", AC-4; owner\'s answer 3(b))', async () => {
  const statusLine = needFn(await copyModule(), 'statusLine');
  const S = DM.PAGE.status;
  const cases = [
    ['done', DM.ANSWERS.DONE, S.upToDate],
    ['none published', DM.ANSWERS.NONE, S.notPublished],
    ['out of date', DM.ANSWERS.STALE, S.outOfDate],
    ['empty offer, empty menu', DM.ANSWERS.EMPTY_DONE, S.upToDate],
    ['empty offer, no menu', DM.ANSWERS.EMPTY_NONE, S.notPublished],
  ];
  const wrong = cases.filter(([, a, want]) => statusLine(a) !== want).map(([label, a, want]) => `${label}: want ${show(want)}, got ${show(statusLine(a))}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('P5: no status line when the check did not finish — statusLine gives none for an unfinished answer, a check-failed one, or no answer at all; the reason line is the only line (ADR 0001 Amendment 1 item 1)', async () => {
  const statusLine = needFn(await copyModule(), 'statusLine');
  const cases = [['unfinished', DM.ANSWERS.UNFINISHED], ['check-failed', DM.ANSWERS.CHECK_FAILED], ['no answer (null)', null], ['no answer (undefined)', undefined]];
  const wrong = cases.filter(([, a]) => { const got = statusLine(a); return got !== null && got !== undefined && got !== ''; })
    .map(([label, a]) => `${label}: want no line, got ${show(statusLine(a))}`);
  if (statusLine(DM.ANSWERS.DONE) !== DM.PAGE.status.upToDate) wrong.push('control: a finished, current answer still gives the up-to-date line');
  assert(wrong.length === 0, wrong.join('; '));
});

test('P6: the published panel\'s none line and the not-published status line are two sentences — "No Duty Menu was found for your Assistant." in the copy module, and statusLine for no menu gives the status sentence, never the none line (ADR 0001 Amendment 2 item 3; story § Copy as amended)', async () => {
  const mod = await copyModule();
  const statusLine = needFn(mod, 'statusLine');
  const strings = stringsOf(Object.fromEntries(Object.entries(mod).filter(([, v]) => typeof v !== 'function')));
  const wrong = [];
  if (DM.PAGE.none === DM.PAGE.status.notPublished) wrong.push('fixture: the none line and the status line must differ');
  if (!strings.has(DM.PAGE.none)) wrong.push(`the copy module holds the none line ${show(DM.PAGE.none)}`);
  if (statusLine(DM.ANSWERS.NONE) !== DM.PAGE.status.notPublished) wrong.push(`statusLine(no menu): want ${show(DM.PAGE.status.notPublished)}, got ${show(statusLine(DM.ANSWERS.NONE))}`);
  if (statusLine(DM.ANSWERS.NONE) === DM.PAGE.none) wrong.push('the status line repeats the none line');
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── D — the page and its route, by source ───────────────────────── */

test('D1: App.jsx serves /assistant/duty-menu with the page — DutyMenuPage imported from ./pages/assistant/DutyMenu and given to ACTION_PAGES under duty-menu; the Treasure Map card still has none (AC-5; ADR 0001 sub-decision 6)', () => {
  const app = codeOnly(safeRead(APP));
  const wrong = [];
  if (!/import\s+DutyMenuPage\s+from\s+['"]\.\/pages\/assistant\/DutyMenu(?:\.jsx)?['"]/.test(app)) wrong.push("no `import DutyMenuPage from './pages/assistant/DutyMenu'`");
  const pages = (app.match(/const\s+ACTION_PAGES\s*=\s*\{([\s\S]*?)\};/) || [])[1];
  if (pages === undefined) wrong.push('App.jsx has no `const ACTION_PAGES = { … };`');
  else {
    if (!/['"]duty-menu['"]\s*:\s*<DutyMenuPage\s*\/>/.test(pages)) wrong.push("ACTION_PAGES has no 'duty-menu': <DutyMenuPage />");
    if (/['"]?treasure-map['"]?\s*:/.test(pages)) wrong.push('the Treasure Map card stays a placeholder');
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('D2: the page reads the one shared answer — useAuth, useAssistantAttention, the hub\'s assistantAttention reading for its mark, the action\'s own entry — and takes its words and helpers from ./dutyMenuCopy (AC-5, AC-6; ADR 0001 sub-decision 6)', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist — ADR 0001 sub-decision 6 creates it`);
  const wrong = [];
  for (const [re, what] of [
    [/export\s+default\s+function\s+\w+\s*\(/, 'a default-exported page component'],
    [/\buseAuth\s*\(/, 'useAuth()'],
    [/\buseAssistantAttention\s*\(/, 'useAssistantAttention() — the one answer'],
    [/\bassistantAttention\s*\(/, "assistantAttention(user, attention) — the hub's mark for this action"],
    [/\bASSISTANT_ACTIONS\b/, "the action's own entry (its title and description from actions.js)"],
    [/['"]duty-menu['"]/, "the action's key, 'duty-menu'"],
    [/from\s*['"]\.\/dutyMenuCopy(?:\.js)?['"]/, "the words from './dutyMenuCopy' (named apart from the page)"],
    [/\bcategoryOf\s*\(/, 'categoryOf(key) for each line'],
    [/\bstatusLine\s*\(/, 'statusLine(answer) for the status line'],
  ]) if (!re.test(src)) wrong.push(`no ${what}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('D3: the page has the hub\'s frame and states — TopBar, the back link, the title and description, the sign-in line and button, the no-assistant line and its link to Account Setup, Checking… and the failed line by phase, the Needs attention / Done mark with its screen-reader prefixes, styled like the hub\'s built pages (AC-5; § Copy "From the hub")', () => {
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

test('D4: read-only and one request — the page never fetches, never calls refresh(), never polls, stores nothing, and publishes or signs nothing (AC-6; ADR 0001 sub-decision 6: "story 2\'s publish will")', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src && /\buseAssistantAttention\s*\(/.test(src), `${rel(PAGE)} ${src ? 'does not read the shared answer' : 'does not exist'} — these refusals need a real page to mean anything`);
  const hits = [
    [/\bfetch\s*\(/, 'fetch('], [/\.refresh\s*\(|\brefresh\s*\(/, 'refresh()'], [/setInterval\s*\(|setTimeout\s*\(/, 'a timer (polling)'],
    [/localStorage|sessionStorage/, 'browser storage'], [/['"]\/api\//, 'an /api/ address'],
    // answer.published is the published menu, read; what is refused is a call or an import that publishes or signs.
    [/\bpublish(?!ed)\w*\s*\(|finalizeEvent|signEvent|window\.nostr|from\s*['"][^'"]*(?:publish|nostrPublish|signer)[^'"]*['"]/i, 'a publish or a signature'],
  ].filter(([re]) => re.test(src)).map(([, what]) => what);
  assert(hits.length === 0, `the page must only read the one answer: it uses ${hits.join(', ')}`);
});

test('D5: the page\'s own words have one home — none of § Copy\'s sentences is typed into DutyMenu.jsx; it shows them from ./dutyMenuCopy (AC-5; § Copy)', () => {
  const raw = safeRead(PAGE);
  assert(raw && /from\s*['"]\.\/dutyMenuCopy(?:\.js)?['"]/.test(raw), `${rel(PAGE)} ${raw ? 'does not import ./dutyMenuCopy' : 'does not exist'} — the words must come from there`);
  const retyped = [...DM.PAGE_SENTENCES, DM.PAGE.checking].filter((s) => raw.includes(s));
  assert(retyped.length === 0, `retyped in the page: ${retyped.map(show).join('; ')}`);
});

async function run() {
  console.log(`${NL}=== assistant-duty-menu-page (assistant-duty-menu #1) ===`);
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
  console.log(`${NL}assistant-duty-menu-page: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };
