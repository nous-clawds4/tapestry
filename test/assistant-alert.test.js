'use strict';
/**
 * assistant-management #2: the Assistant Alert — one pill at a time, the Setup Alert's first.
 *
 * Story: engineering-team/stories/assistant-management/2-the-assistant-alert.md
 * ADR:   engineering-team/decisions/assistant-management/0002-one-top-bar-alert-slot-setup-first.md
 * Plan:  engineering-team/stories/assistant-management/2-the-assistant-alert.test-plan.md
 * Browser half: tests/brainstorm/assistant-alert.spec.js (B-class: where the pill shows, what it says, where it goes).
 * Expected words: test/helpers/assistantManagementFixtures.js.
 *
 * Classes (all stack-free):
 *   P — the picker, ui/src/utils/topBarAlert.js, loaded in Node as ESM: pickTopBarPill(...) and isAssistantPath(...),
 *       over every case of story 2 § When the pill shows.
 *   C — the pill's words, ASSISTANT_ALERT_COPY in ui/src/pages/assistant/actions.js.
 *   W — the browser code, by source. CI runs no browser, so this is the CI backstop for the B-class: the slot reads the
 *       shared answers and nothing else, links to the hub, cannot be dismissed, and is mounted beside each avatar menu —
 *       four mounts, no more. W5 pins the other half of "never both" (ADR 0002 Amendment 1 point 3): the Setup Alert,
 *       beside the slot, draws only on an answered count of at least one step — exactly when the picker gives way.
 *
 * Against the code before this story, everything fails: topBarAlert.js and TopBarAlert.jsx do not exist, there is no
 * ASSISTANT_ALERT_COPY, and no top bar mounts a slot.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const X = require('./helpers/assistantManagementFixtures');

const REPO = path.resolve(__dirname, '..');
const UI_SRC = path.join(REPO, 'ui/src');
const PICKER = path.join(REPO, 'ui/src/utils/topBarAlert.js');
const SLOT = path.join(REPO, 'ui/src/components/TopBarAlert.jsx');
const ACTIONS_MOD = path.join(REPO, 'ui/src/pages/assistant/actions.js');
// The Setup Alert (setup-status-and-alert #2) and the one setup answer it reads, for W5.
const SETUP_ALERT = path.join(REPO, 'ui/src/components/SetupAlert.jsx');
const SETUP_CTX = path.join(REPO, 'ui/src/context/SetupStatusContext.jsx');
const SETUP_UTIL = path.join(REPO, 'ui/src/utils/setupStatus.js');
const MOUNTS = {
  'BrainstormUserMenu (behind TopBar and 14 pages\' own top bars)': path.join(REPO, 'ui/src/components/BrainstormUserMenu.jsx'),
  'the landing page\'s UserMenu (BrainstormSearch.jsx: landing and results views)': path.join(REPO, 'ui/src/pages/BrainstormSearch.jsx'),
  'the Tapestry header (every /tapestry page)': path.join(REPO, 'ui/src/components/Header.jsx'),
  'DevPage (the developer pages, where the menu would be)': path.join(REPO, 'ui/src/pages/developers/DevPage.jsx'),
};
const NL = String.fromCharCode(10);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const j = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);

function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

const esmCache = new Map();
async function loadEsm(absPath, what) {
  if (!esmCache.has(absPath)) {
    let mod;
    if (!fs.existsSync(absPath)) mod = { __loadError: new Error(`${rel(absPath)} does not exist. ${what}`) };
    else {
      try { mod = await import(pathToFileURL(absPath).href); } catch (err) {
        mod = { __loadError: new Error(`${rel(absPath)} must load in Node as ESM (relative imports with .js): ${err.message}`) };
      }
    }
    esmCache.set(absPath, mod);
  }
  const mod = esmCache.get(absPath);
  if (mod.__loadError) throw mod.__loadError;
  return mod;
}
async function picker() {
  const mod = await loadEsm(PICKER, 'ADR assistant-management/0002 sub-decision 1 creates it: the pure picker behind the one top-bar slot.');
  assert(typeof mod.pickTopBarPill === 'function', `${rel(PICKER)} must export pickTopBarPill({ signedIn, setupPhase, setupPendingCount, assistantCount, pathname })`);
  assert(typeof mod.isAssistantPath === 'function', `${rel(PICKER)} must export isAssistantPath(pathname)`);
  return mod;
}

// ─── Reading JSX structure (the root `typescript` dependency's parser — a library call, not a lint step) ───
let tsLib = null;
function ts() { if (!tsLib) tsLib = require('typescript'); return tsLib; }
function parse(file) {
  const src = safeRead(file);
  return src ? ts().createSourceFile(file, src, ts().ScriptTarget.Latest, true, ts().ScriptKind.JSX) : null;
}
function walk(node, visit) { visit(node); ts().forEachChild(node, (child) => walk(child, visit)); }
function jsxNamed(sf, name) {
  const out = [];
  if (sf) walk(sf, (n) => { if ((ts().isJsxOpeningElement(n) || ts().isJsxSelfClosingElement(n)) && n.tagName.getText() === name) out.push(n); });
  return out;
}
/** The name of the function declaration (or const-assigned function) a node sits in. */
function enclosingFunctionName(node) {
  const t = ts();
  for (let p = node.parent; p; p = p.parent) {
    if (t.isFunctionDeclaration(p) && p.name) return p.name.text;
    if ((t.isArrowFunction(p) || t.isFunctionExpression(p)) && t.isVariableDeclaration(p.parent) && t.isIdentifier(p.parent.name)) return p.parent.name.text;
  }
  return null;
}

// The picker's inputs, as ADR 0002 names them. `n` = the hub's count (story 1: all ten, for a viewer with an assistant).
const base = { signedIn: true, setupPhase: 'answered', setupPendingCount: 0, assistantCount: 10, pathname: '/about' };
const pick = (mod, over) => mod.pickTopBarPill({ ...base, ...over });
const shape = (r) => r && { pill: r.pill, count: r.count };
const NONE = { pill: null, count: 0 };

/* ───────────────────────── P — the picker ───────────────────────── */

test('P1: a visitor who is not signed in gets no pill, whatever else is true (AC-2)', async () => {
  const mod = await picker();
  const wrong = [];
  for (const setupPhase of ['idle', 'checking', 'answered', 'failed']) {
    for (const setupPendingCount of [0, 2]) {
      const got = shape(pick(mod, { signedIn: false, setupPhase, setupPendingCount }));
      if (j(got) !== j(NONE)) wrong.push(`${setupPhase}/${setupPendingCount}: ${j(got)}`);
    }
  }
  assert(wrong.length === 0, `want ${j(NONE)} for every case, got: ${wrong.join('; ')}`);
});

test('P2: while the setup status is still being checked (idle or checking), no pill shows — the Assistant pill waits (AC-3)', async () => {
  const mod = await picker();
  for (const setupPhase of ['idle', 'checking']) {
    const got = shape(pick(mod, { setupPhase }));
    assert(j(got) === j(NONE), `setupPhase '${setupPhase}' with ten actions needing attention: want ${j(NONE)}, got ${j(got)}`);
  }
});

test('P3: when the setup answer counts a step, the Setup Alert\'s turn comes first — the result is the setup pill with that count, never the Assistant pill (AC-3)', async () => {
  const mod = await picker();
  for (const setupPendingCount of [1, 3]) {
    const got = shape(pick(mod, { setupPendingCount }));
    assert(j(got) === j({ pill: 'setup', count: setupPendingCount }),
      `answered with ${setupPendingCount} step(s) left: want ${j({ pill: 'setup', count: setupPendingCount })}, got ${j(got)}`);
  }
  // Even on an /assistant page: the Assistant pill still gives way (the Setup Alert's own page rule is its story's).
  const onHub = shape(pick(mod, { setupPendingCount: 2, pathname: '/assistant' }));
  assert(onHub && onHub.pill !== 'assistant', `with setup steps left, no page shows the Assistant pill — on /assistant got ${j(onHub)}`);
});

test('P4: when the setup answer counts nothing, the Assistant pill shows with the hub\'s count (AC-1, AC-3, AC-5)', async () => {
  const mod = await picker();
  for (const assistantCount of [10, 1]) {
    const got = shape(pick(mod, { assistantCount }));
    assert(j(got) === j({ pill: 'assistant', count: assistantCount }), `count ${assistantCount}: want ${j({ pill: 'assistant', count: assistantCount })}, got ${j(got)}`);
  }
});

test('P5: when the setup check has failed, the Assistant pill shows — the Setup Alert shows nothing then, so there is nothing to give way to (AC-3)', async () => {
  const mod = await picker();
  const got = shape(pick(mod, { setupPhase: 'failed', setupPendingCount: 0 }));
  assert(j(got) === j({ pill: 'assistant', count: 10 }), `setupPhase 'failed': want ${j({ pill: 'assistant', count: 10 })}, got ${j(got)}`);
});

test('P6: with nothing needing attention — a viewer with no assistant — no pill shows, answered or failed (AC-2, AC-5)', async () => {
  const mod = await picker();
  for (const setupPhase of ['answered', 'failed']) {
    const got = shape(pick(mod, { setupPhase, assistantCount: 0 }));
    assert(j(got) === j(NONE), `setupPhase '${setupPhase}', count 0: want ${j(NONE)}, got ${j(got)}`);
  }
});

test('P7: the pill hides on /assistant and every page under it — and only there (AC-4)', async () => {
  const mod = await picker();
  const inside = ['/assistant', '/assistant/', '/assistant/profile', '/assistant/profile/edit', '/assistant/dlists', '/assistant/preferences'];
  const outside = ['/', '/about', '/tags', '/setup', '/setup/follow', '/tapestry/', '/tapestry/settings/relays', '/developers', '/assistants', '/assistant-x', '/user/aa'];
  const wrong = [];
  for (const p of inside) {
    if (mod.isAssistantPath(p) !== true) wrong.push(`isAssistantPath(${j(p)}) should be true`);
    const got = shape(pick(mod, { pathname: p }));
    if (j(got) !== j(NONE)) wrong.push(`on ${p}: want ${j(NONE)}, got ${j(got)}`);
  }
  for (const p of outside) {
    if (mod.isAssistantPath(p) !== false) wrong.push(`isAssistantPath(${j(p)}) should be false`);
    const got = shape(pick(mod, { pathname: p }));
    if (j(got) !== j({ pill: 'assistant', count: 10 })) wrong.push(`on ${p}: want the Assistant pill, got ${j(got)}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('P8: over every combination, the answer is exactly one of none / setup / assistant — and the Assistant pill only where setup-first allows it (AC-3)', async () => {
  const mod = await picker();
  const wrong = [];
  for (const signedIn of [true, false]) for (const setupPhase of ['idle', 'checking', 'answered', 'failed'])
    for (const setupPendingCount of [0, 1, 3]) for (const assistantCount of [0, 10]) for (const pathname of ['/about', '/assistant/pins']) {
      const got = mod.pickTopBarPill({ signedIn, setupPhase, setupPendingCount, assistantCount, pathname });
      const label = j({ signedIn, setupPhase, setupPendingCount, assistantCount, pathname });
      if (!got || ![null, 'setup', 'assistant'].includes(got.pill)) { wrong.push(`${label} → ${j(got)}`); continue; }
      const allowed = signedIn && (setupPhase === 'failed' || (setupPhase === 'answered' && setupPendingCount === 0))
        && assistantCount > 0 && pathname === '/about';
      if ((got.pill === 'assistant') !== allowed) wrong.push(`${label} → ${j(got)} (Assistant pill ${allowed ? 'expected' : 'not allowed'})`);
    }
  assert(wrong.length === 0, `${wrong.length} case(s): ${wrong.slice(0, 8).join('; ')}`);
});

test('P9: the picker stays loadable by Node — its only import is ../config/avatarMenuLinks.js (ADR 0002 sub-decision 1)', () => {
  const src = codeOnly(safeRead(PICKER));
  assert(src, `${rel(PICKER)} does not exist`);
  const imports = [...src.matchAll(/^\s*import\b[^;]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert(j(imports) === j(['../config/avatarMenuLinks.js']), `expected one import, from '../config/avatarMenuLinks.js', got ${j(imports)}`);
});

/* ───────────────────────── C — the pill's words ───────────────────────── */

test('C1: the pill\'s words are the approved ones — "Manage your Tapestry Assistant" (its name and sentence) and "Manage Assistant →" (story 2 § Copy)', async () => {
  const mod = await loadEsm(ACTIONS_MOD, 'ADR assistant-management/0001 creates it; it holds ASSISTANT_ALERT_COPY (ADR 0002 sub-decision 3).');
  const copy = mod.ASSISTANT_ALERT_COPY;
  const got = copy && { name: copy.name, sentence: copy.sentence, button: copy.button };
  const want = { name: X.ALERT.name, sentence: X.ALERT.sentence, button: X.ALERT.button };
  assert(j(got) === j(want), `ASSISTANT_ALERT_COPY: want ${j(want)}, got ${j(copy)}`);
});

/* ───────────────────────── W — the browser code, by source (CI runs no browser) ───────────────────────── */

test('W1: the slot reads only the shared answers — sign-in, the setup status, the page address and the hub\'s attention count — and decides with the picker (AC-2, AC-3, AC-5, AC-7)', () => {
  const src = codeOnly(safeRead(SLOT));
  assert(src, `${rel(SLOT)} does not exist — ADR 0002 sub-decision 2 creates it`);
  const wrong = [];
  for (const [re, what] of [
    [/export\s+default\s+function\s+TopBarAlert\s*\(/, 'export default function TopBarAlert()'],
    [/\buseAuth\s*\(/, 'useAuth()'], [/\buseSetupStatus\s*\(/, 'useSetupStatus() — the one setup answer the Setup Alert will read too'],
    [/\buseLocation\s*\(/, 'useLocation()'], [/\bassistantAttention\s*\(/, 'assistantAttention(user) — the hub\'s own answer, so the count cannot disagree'],
    [/\bpickTopBarPill\s*\(/, 'pickTopBarPill(...)'],
  ]) if (!re.test(src)) wrong.push(`no ${what}`);
  for (const [re, what] of [[/\bfetch\s*\(/, 'fetch('], [/['"`]\/api\//, 'an /api/ path'], [/localStorage|sessionStorage/, 'browser storage']]) {
    if (re.test(src)) wrong.push(`uses ${what} — the slot asks nothing beyond the shared answers and stores nothing`);
  }
  assert(wrong.length === 0, `ADR 0002 sub-decision 2: ${wrong.join('; ')}`);
});

test('W2: the pill is one link to the hub, named "Manage your Tapestry Assistant", with no close control (AC-1, AC-4)', async () => {
  const sf = parse(SLOT);
  assert(sf, `${rel(SLOT)} does not exist`);
  const links = jsxNamed(sf, 'Link');
  const toHub = links.filter((l) => {
    const to = l.attributes.properties.find((p) => ts().isJsxAttribute(p) && p.name.getText() === 'to');
    const v = to && to.initializer && (ts().isStringLiteral(to.initializer) ? to.initializer.text : to.initializer.expression && to.initializer.expression.getText());
    return v === 'ASSISTANT_MANAGEMENT_PATH' || v === X.HUB;
  });
  assert(toHub.length === 1, `exactly one <Link to={ASSISTANT_MANAGEMENT_PATH}> — the whole pill is the link; found ${toHub.length}`);
  const label = toHub[0].attributes.properties.find((p) => ts().isJsxAttribute(p) && p.name.getText() === 'aria-label');
  const labelText = label && label.initializer && (ts().isStringLiteral(label.initializer) ? label.initializer.text : label.initializer.expression && label.initializer.expression.getText());
  assert(labelText === X.ALERT.name || labelText === 'ASSISTANT_ALERT_COPY.name',
    `the pill's accessible name is "${X.ALERT.name}" (aria-label, from ASSISTANT_ALERT_COPY.name); got ${j(labelText)}`);
  const src = codeOnly(safeRead(SLOT));
  assert(!/<button\b/.test(src), 'no <button> in the slot: the pill cannot be dismissed, and its "Manage Assistant →" is part of the one link');
  assert(!/dismiss|onClose|setHidden|setDismissed/i.test(src), 'no dismiss state: the pill is persistent (story 2 § Out of scope)');
  assert(/\battentionCountText\s*\(/.test(src), 'the count uses attentionCountText, the same wording as the hub\'s count line (AC-5)');
});

test('W3: the slot is mounted beside each avatar menu — BrainstormUserMenu, the landing page\'s UserMenu, the Tapestry header and DevPage — once each (AC-1)', () => {
  const wrong = [];
  for (const [where, file] of Object.entries(MOUNTS)) {
    const src = codeOnly(safeRead(file));
    const uses = (src.match(/<TopBarAlert\b/g) || []).length;
    if (uses !== 1) wrong.push(`${where}: ${uses} <TopBarAlert /> (want 1)`);
    if (!/import\s+TopBarAlert\s+from\s+['"][./]*(?:components\/)?TopBarAlert(?:\.jsx)?['"]/.test(src)) wrong.push(`${where}: TopBarAlert is not imported`);
  }
  const sf = parse(MOUNTS['the landing page\'s UserMenu (BrainstormSearch.jsx: landing and results views)']);
  const inSearch = jsxNamed(sf, 'TopBarAlert');
  if (inSearch.length && enclosingFunctionName(inSearch[0]) !== 'UserMenu') {
    wrong.push(`BrainstormSearch.jsx mounts the slot in ${j(enclosingFunctionName(inSearch[0]))}, not in UserMenu — the landing and results views both render UserMenu, so one mount there covers both`);
  }
  assert(wrong.length === 0, `ADR 0002 sub-decision 4: ${wrong.join('; ')}`);
});

test('W4: nothing else mounts the slot — no page gets two pills, and TopBar itself does not (it already renders BrainstormUserMenu) (AC-1, AC-3)', () => {
  const files = [];
  const collect = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') collect(p); } else if (/\.(jsx?|mjs)$/.test(e.name)) files.push(p);
    }
  };
  collect(UI_SRC);
  const mounts = new Set(Object.values(MOUNTS));
  const extra = files.filter((f) => !mounts.has(f) && /<TopBarAlert\b/.test(codeOnly(safeRead(f)))).map(rel);
  assert(extra.length === 0, `only the four mounts may render <TopBarAlert />; also found in ${j(extra)}`);
});

test('W5: the Setup Alert, mounted beside the slot, draws its pill only when someone is signed in and the answered setup check counts a step — when the picker gives way, so the two pills never show together (AC-3; ADR 0002 Amendment 1 point 3)', async () => {
  const t = ts();
  const sf = parse(SETUP_ALERT);
  assert(sf, `${rel(SETUP_ALERT)} does not exist — setup-status-and-alert #2 ships it, and ADR 0002 Amendment 1 leans on its rule`);
  let fn = null;
  walk(sf, (n) => { if (!fn && t.isFunctionDeclaration(n) && n.name && n.name.text === 'SetupAlert') fn = n; });
  assert(fn && fn.body, `${rel(SETUP_ALERT)}: no function SetupAlert()`);
  const wrong = [];
  const src = codeOnly(fn.body.getText());
  if (!/\{[^}]*\bpendingCount\b[^}]*\}\s*=\s*useSetupStatus\s*\(\s*\)/.test(src)) {
    wrong.push('its pendingCount does not come from useSetupStatus() — the one answer the slot also reads');
  }
  // Before anything is drawn: return null unless someone is signed in and at least one step is counted.
  const strip = (e) => { while (e && t.isParenthesizedExpression(e)) e = e.expression; return e; };
  const disjuncts = (e) => {
    e = strip(e);
    return t.isBinaryExpression(e) && e.operatorToken.kind === t.SyntaxKind.BarBarToken ? [...disjuncts(e.left), ...disjuncts(e.right)] : [e];
  };
  const NONE_COUNTED = /^(pendingCount\s*<\s*1|pendingCount\s*<=\s*0|pendingCount\s*===?\s*0|!\s*pendingCount)$/;
  let guard = null;
  let drawnFirst = false;
  for (const st of fn.body.statements) {
    if (t.isReturnStatement(st) && st.expression && !/^null$/.test(st.expression.getText())) { drawnFirst = !guard; break; }
    if (t.isIfStatement(st) && !guard) {
      const then = t.isBlock(st.thenStatement) && st.thenStatement.statements.length === 1 ? st.thenStatement.statements[0] : st.thenStatement;
      if (t.isReturnStatement(then) && then.expression && then.expression.getText() === 'null') {
        const parts = disjuncts(st.expression).map((d) => d.getText().replace(/\s+/g, ' ').trim());
        if (parts.some((d) => NONE_COUNTED.test(d))) guard = parts;
      }
    }
  }
  if (!guard) wrong.push('no early "if (… pendingCount < 1 …) return null;" before the pill: it must draw nothing while no step is counted');
  else {
    if (drawnFirst) wrong.push('it returns its pill before the guard');
    if (!guard.includes('!user')) wrong.push(`the guard ${j(guard)} does not include !user — a signed-out visitor must see no pill`);
    if (!guard.includes('loading')) wrong.push(`the guard ${j(guard)} does not include loading — nothing while sign-in resolves`);
  }
  // The count is non-zero only once the check has answered: useSetupStatus summarizes the held answer in no other phase…
  const ctx = codeOnly(safeRead(SETUP_CTX));
  if (!/summarizeSetup\(\s*phase\s*===\s*['"]answered['"]\s*\?\s*ctx\.answer\s*:\s*null\s*\)/.test(ctx)) {
    wrong.push(`${rel(SETUP_CTX)}: useSetupStatus() must summarize the answer only when phase === 'answered' (summarizeSetup(phase === 'answered' ? ctx.answer : null))`);
  }
  // …and an answer that is not a signed-in success counts nothing.
  const util = await loadEsm(SETUP_UTIL, 'setup-status-and-alert #1 creates it: the pure summarizeSetup() behind /setup and the Setup Alert.');
  for (const [label, answer] of [['no answer', null], ['a failure', { success: false }], ['an expired session', { success: true, signedIn: false }]]) {
    const n = util.summarizeSetup(answer).pendingCount;
    if (n !== 0) wrong.push(`summarizeSetup(${label}).pendingCount is ${j(n)}, want 0`);
  }
  assert(wrong.length === 0, `"never both" rests on this (the picker returns 'setup', and the slot draws nothing, exactly when the answered count is at least one): ${wrong.join('; ')}`);
});

async function runSuite() {
  console.log(`${NL}=== assistant-alert (assistant-management #2) ===`);
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
  console.log(`${NL}assistant-alert: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run: runSuite };
