'use strict';
/**
 * assistant-management #1: the Assistant Management page, its FAQ and ten placeholder action pages, and the
 * profile editor's move to /assistant/profile/edit.
 *
 * Story: engineering-team/stories/assistant-management/1-the-assistant-management-page.md
 * ADR:   engineering-team/decisions/assistant-management/0001-the-hub-takes-assistant-and-the-editor-moves-under-it.md
 * Plan:  engineering-team/stories/assistant-management/1-the-assistant-management-page.test-plan.md
 * Browser half: tests/brainstorm/assistant-management-page.spec.js (B-class: what a viewer SEES and can DO).
 * Expected words: test/helpers/assistantManagementFixtures.js (the stories' § Copy, one copy for every suite).
 *
 * Classes (all stack-free except H):
 *   D — the data module, ui/src/pages/assistant/actions.js, loaded in Node as ESM: the sections, the ten actions,
 *       their links, alert criteria and notes, the FAQ, the count wording and assistantAttention(user).
 *   M — the two addresses, in ui/src/config/avatarMenuLinks.js: the hub's and the editor's, and which menu item
 *       goes where.
 *   W — the browser code, by source. CI runs no browser, so this is the CI backstop for the B-class: the routes, the
 *       editor's heading and back link, no request from the hub or the placeholders, new-tab NIP links, the
 *       /settings card.
 *   O — outside the app: every home of the editor's address agrees, and nothing user-facing still sends people to
 *       "the My Assistant page (/assistant)".
 *   H — the reachable instance serves the app for all twelve addresses. A guard: it passes before and after, and
 *       skips when nothing answers.
 *
 * Against the code before this story, everything but H fails. actions.js, ActionPage.jsx, ActionText.jsx,
 * EditProfile.jsx and src/utils/assistantPages.js do not exist. MY_ASSISTANT_PATH is still '/assistant', and there
 * is no ASSISTANT_MANAGEMENT_PATH. /assistant still renders the editor. The refusals, the legacy panels and BIBLE
 * still name "the My Assistant page (/assistant)".
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const X = require('./helpers/assistantManagementFixtures');

const REPO = path.resolve(__dirname, '..');
const ACTIONS_MOD = path.join(REPO, 'ui/src/pages/assistant/actions.js');
const MENU_MOD = path.join(REPO, 'ui/src/config/avatarMenuLinks.js');
const APP = path.join(REPO, 'ui/src/App.jsx');
const HUB_PAGE = path.join(REPO, 'ui/src/pages/assistant/Index.jsx');
const ACTION_PAGE = path.join(REPO, 'ui/src/pages/assistant/ActionPage.jsx');
const ACTION_TEXT = path.join(REPO, 'ui/src/pages/assistant/ActionText.jsx');
const EDIT_PAGE = path.join(REPO, 'ui/src/pages/assistant/EditProfile.jsx');
const BRAINSTORM_SETTINGS = path.join(REPO, 'ui/src/pages/BrainstormSettings.jsx');
const SERVER_PAGES = path.join(REPO, 'src/utils/assistantPages.js');
const LEGACY_PAGES = [path.join(REPO, 'public/pages/nip85.html'), path.join(REPO, 'public/pages/customers/customer.html')];
const BIBLE = path.join(REPO, 'BIBLE.md');
const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const NL = String.fromCharCode(10);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const j = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();

let hExecuted = 0;
let hSkipped = 0;

/**
 * Source with comments removed, leaving `https://` inside strings intact (the pattern test/my-assistant-page.test.js
 * uses). Block comments become blank lines, so line numbers in failure messages stay true.
 */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

// ─── Loading the modules under test — or a failure that says exactly what is missing ───

const esmCache = new Map();
async function loadEsm(absPath, what) {
  if (!esmCache.has(absPath)) {
    let mod;
    if (!fs.existsSync(absPath)) {
      mod = { __loadError: new Error(`${rel(absPath)} does not exist. ${what}`) };
    } else {
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
const actionsModule = () => loadEsm(ACTIONS_MOD,
  'ADR assistant-management/0001 sub-decision 1 creates it: the one data module for the hub, the ten placeholder pages and their routes.');
const menuModule = () => loadEsm(MENU_MOD, 'It holds the menu links and the page addresses.');
function need(mod, name, file = 'ui/src/pages/assistant/actions.js') {
  assert(mod[name] !== undefined, `${file} must export ${name} (ADR assistant-management/0001 sub-decision 1).`);
  return mod[name];
}

/** A description's words as a reader sees them: strings as they are, link parts as their text. */
function partsText(parts) {
  assert(Array.isArray(parts), `a description must be an array of parts (strings and { text, href } links), got ${j(parts)}`);
  return parts.map((p) => (typeof p === 'string' ? p : p && p.text)).join('');
}
const linkParts = (parts) => (Array.isArray(parts) ? parts.filter((p) => p && typeof p === 'object') : []);

// ─── Reading JSX structure with the root `typescript` dependency's parser (a library call, not a lint step) ───

let tsLib = null;
function ts() {
  if (!tsLib) tsLib = require('typescript');
  return tsLib;
}
function parse(file) {
  const src = safeRead(file);
  return src ? ts().createSourceFile(file, src, ts().ScriptTarget.Latest, true, ts().ScriptKind.JSX) : null;
}
function walk(node, visit) { visit(node); ts().forEachChild(node, (child) => walk(child, visit)); }
function jsxElements(sf, tagName) {
  const out = [];
  if (sf) walk(sf, (n) => { if (ts().isJsxElement(n) && n.openingElement.tagName.getText() === tagName) out.push(n); });
  return out;
}
function attrOf(el, name) {
  const opening = ts().isJsxElement(el) ? el.openingElement : el;
  const prop = opening.attributes.properties.find((p) => ts().isJsxAttribute(p) && p.name.getText() === name);
  if (!prop || !prop.initializer) return null;
  if (ts().isStringLiteral(prop.initializer)) return { literal: prop.initializer.text };
  if (ts().isJsxExpression(prop.initializer) && prop.initializer.expression) {
    const e = prop.initializer.expression;
    if (ts().isStringLiteral(e) || ts().isNoSubstitutionTemplateLiteral(e)) return { literal: e.text };
    return { expr: e.getText() };
  }
  return null;
}
/**
 * The words a JSX element renders, with `NAME.path` expressions resolved against `scope` (the loaded modules'
 * exports) — so a heading may be written out or taken from the copy module. An unresolvable expression comes back
 * as `{expr}`, which never equals an approved string.
 */
function jsxWords(node, scope) {
  const t = ts();
  const resolve = (expr) => {
    const segs = expr.getText().split('.');
    let v = scope[segs[0]];
    for (const s of segs.slice(1)) v = v == null ? undefined : v[s];
    return typeof v === 'string' ? v : `{${expr.getText()}}`;
  };
  const out = [];
  const visit = (n) => {
    if (t.isJsxText(n)) out.push(n.text);
    else if (t.isJsxExpression(n)) {
      const e = n.expression;
      if (!e) return;
      if (t.isStringLiteral(e) || t.isNoSubstitutionTemplateLiteral(e)) out.push(e.text);
      else if (t.isPropertyAccessExpression(e) || t.isIdentifier(e)) out.push(resolve(e));
      else out.push(`{${e.getText()}}`);
    } else if (t.isJsxElement(n)) n.children.forEach(visit);
    else if (t.isJsxSelfClosingElement(n)) out.push('');
  };
  if (t.isJsxElement(node)) node.children.forEach(visit); else visit(node);
  return squash(out.join(''));
}

/* ───────────────────────── D — the data module ───────────────────────── */

test('D1: the page has three sections, in the approved order: Public Persona, Trusted Content, Notifications (AC-1)', async () => {
  const sections = need(await actionsModule(), 'ASSISTANT_SECTIONS');
  const got = (sections || []).map((s) => ({ key: s && s.key, heading: s && s.heading }));
  assert(j(got) === j(X.SECTIONS), `expected ${j(X.SECTIONS)}, got ${j(got)}`);
});

test('D2: the ten actions, in the approved order and sections, with their approved titles, addresses and descriptions (AC-1, AC-3)', async () => {
  const actions = need(await actionsModule(), 'ASSISTANT_ACTIONS');
  assert(Array.isArray(actions) && actions.length === 10, `expected exactly 10 actions (the ask lists two, six and two), got ${j(actions && actions.length)}`);
  const wrong = [];
  X.ACTIONS.forEach((want, i) => {
    const got = actions[i] || {};
    if (got.section !== want.section) wrong.push(`#${i + 1} section: want ${j(want.section)}, got ${j(got.section)}`);
    if (got.path !== want.path) wrong.push(`#${i + 1} path: want ${j(want.path)}, got ${j(got.path)}`);
    if (got.title !== want.title) wrong.push(`#${i + 1} title: want ${j(want.title)}, got ${j(got.title)}`);
    let text;
    try { text = partsText(got.description); } catch (err) { text = `(${err.message})`; }
    if (text !== want.text) wrong.push(`#${i + 1} (${want.title}) description: want ${j(want.text)}, got ${j(text)}`);
  });
  const keys = actions.map((a) => a && a.key);
  if (!keys.every((k) => typeof k === 'string' && k.length > 0) || new Set(keys).size !== keys.length) {
    wrong.push(`every action needs its own non-empty string key (assistantAttention answers with them), got ${j(keys)}`);
  }
  assert(wrong.length === 0, `story 1 § Copy: ${wrong.join('; ')}`);
});

test('D3: exactly three descriptions carry a link — the NIP each names, at the approved address — and the other seven carry none (AC-3)', async () => {
  const mod = await actionsModule();
  const actions = need(mod, 'ASSISTANT_ACTIONS');
  const wrong = [];
  X.ACTIONS.forEach((want, i) => {
    const links = linkParts((actions[i] || {}).description).map((p) => ({ text: p.text, href: p.href }));
    const expected = want.link ? [want.link] : [];
    if (j(links) !== j(expected)) wrong.push(`${want.title}: want ${j(expected)}, got ${j(links)}`);
  });
  const nips = need(mod, 'NIP_LINKS');
  if (j(nips) !== j(X.NIP_LINKS)) wrong.push(`NIP_LINKS: want ${j(X.NIP_LINKS)}, got ${j(nips)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('D4: each action carries the owner\'s alert criteria and planning notes, null where the owner gave none; only the profile action links to the editor (AC-5)', async () => {
  const actions = need(await actionsModule(), 'ASSISTANT_ACTIONS');
  const wrong = [];
  X.ACTIONS.forEach((want, i) => {
    const got = actions[i] || {};
    if ((got.alertCriteria ?? null) !== want.alertCriteria) wrong.push(`${want.title} alertCriteria: want ${j(want.alertCriteria)}, got ${j(got.alertCriteria)}`);
    if ((got.planningNotes ?? null) !== want.planningNotes) wrong.push(`${want.title} planningNotes: want ${j(want.planningNotes)}, got ${j(got.planningNotes)}`);
    const edit = got.editLink ? { text: got.editLink.text, to: got.editLink.to } : null;
    const wantEdit = want.editLink || null;
    if (j(edit) !== j(wantEdit)) wrong.push(`${want.title} editLink: want ${j(wantEdit)}, got ${j(edit)}`);
  });
  assert(wrong.length === 0, `story 1 § Copy (the placeholder pages): ${wrong.join('; ')}`);
});

test('D5: the FAQ is the owner\'s five questions and answers, in order — with "follows (kind 3)", never "kind 1" (AC-4)', async () => {
  const faq = need(await actionsModule(), 'ASSISTANT_FAQ');
  const got = (faq || []).map((q) => ({ question: q && q.question, answer: q && q.answer }));
  const wrong = [];
  if (got.length !== 5) wrong.push(`expected 5 entries, got ${got.length}`);
  X.FAQ.forEach((want, i) => {
    const g = got[i] || {};
    if (g.question !== want.question) wrong.push(`#${i + 1} question: want ${j(want.question)}, got ${j(g.question)}`);
    if (g.answer !== want.answer) wrong.push(`#${i + 1} answer: want ${j(want.answer)}, got ${j(g.answer)}`);
  });
  assert(!j(got).includes('follows (kind 1)'), 'the follow list is kind 3 (NIP-02); the approved answer says "follows (kind 3)"');
  assert(wrong.length === 0, `story 1 § Copy (the FAQ): ${wrong.join('; ')}`);
});

test('D6: the count reads "10 actions need attention", and "1 action needs attention" for one (AC-2; the pill says the same, story 2)', async () => {
  const countText = need(await actionsModule(), 'attentionCountText');
  assert(typeof countText === 'function', 'attentionCountText must be a function of n');
  for (const n of [10, 1, 2, 0]) {
    assert(countText(n) === X.countText(n), `attentionCountText(${n}): want ${j(X.countText(n))}, got ${j(countText(n))}`);
  }
});

test('D7: every action needs attention for a viewer who has an assistant here, and none for anyone else — the answer is about the viewer\'s own assistant (AC-2)', async () => {
  const mod = await actionsModule();
  const attention = need(mod, 'assistantAttention');
  const actions = need(mod, 'ASSISTANT_ACTIONS');
  const allKeys = actions.map((a) => a.key);
  const cases = [
    ['a visitor (no user)', null, false],
    ['a signed-in guest with no assistant', { pubkey: 'ee'.repeat(32), classification: 'guest', assistantPubkey: null }, false],
    ['an Admin not yet given a key', { pubkey: 'ad'.repeat(32), classification: 'admin', assistantPubkey: null }, false],
    ['an Owner whose TA key is missing', { pubkey: 'bb'.repeat(32), classification: 'owner', assistantPubkey: null }, false],
    ['a Customer with an assistant', { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) }, true],
    ['the Owner, whose assistant is the instance TA', { pubkey: 'bb'.repeat(32), classification: 'owner', assistantPubkey: 'aa'.repeat(32) }, true],
  ];
  const wrong = [];
  for (const [who, user, has] of cases) {
    const got = attention(user);
    const want = { hasAssistant: has, needsAttention: has ? allKeys : [], count: has ? 10 : 0 };
    const shaped = got && { hasAssistant: got.hasAssistant, needsAttention: got.needsAttention, count: got.count };
    if (j(shaped) !== j(want)) wrong.push(`${who}: want ${j(want)}, got ${j(got)}`);
  }
  assert(wrong.length === 0, `ADR 0001 sub-decision 1 (a scaffold: all ten, for exactly the viewers with an assistant): ${wrong.join('; ')}`);
});

test('D8: every action lives under the hub\'s address, and the profile page is ASSISTANT_PROFILE_PATH, /assistant/profile (AC-3, AC-5)', async () => {
  const mod = await actionsModule();
  const menu = await menuModule();
  assert(mod.ASSISTANT_PROFILE_PATH === X.PROFILE_PAGE, `ASSISTANT_PROFILE_PATH: want ${j(X.PROFILE_PAGE)}, got ${j(mod.ASSISTANT_PROFILE_PATH)}`);
  const hub = menu.ASSISTANT_MANAGEMENT_PATH;
  assert(hub === X.HUB, `avatarMenuLinks.js must export ASSISTANT_MANAGEMENT_PATH = ${j(X.HUB)}, got ${j(hub)}`);
  const outside = need(mod, 'ASSISTANT_ACTIONS').filter((a) => !String(a.path).startsWith(`${hub}/`)).map((a) => a.path);
  assert(outside.length === 0, `these actions are not under ${hub}/: ${j(outside)}`);
});

test('D9: the data module stays loadable by Node — its only import is ../../config/avatarMenuLinks.js (ADR 0001 sub-decision 1)', () => {
  const src = codeOnly(safeRead(ACTIONS_MOD));
  assert(src, `${rel(ACTIONS_MOD)} does not exist`);
  const imports = [...src.matchAll(/^\s*import\b[^;]*?from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  const bare = [...src.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  assert(j([...imports, ...bare]) === j(['../../config/avatarMenuLinks.js']),
    `expected exactly one import, from '../../config/avatarMenuLinks.js' (with the .js, so Node can load it), got ${j([...imports, ...bare])}`);
  assert(!/\brequire\s*\(/.test(src), 'no require(): the module is ESM');
});

test('D10: plainText(parts) gives a description\'s words as a reader sees them (ADR 0001 sub-decision 1)', async () => {
  const mod = await actionsModule();
  const plainText = need(mod, 'plainText');
  const wrong = need(mod, 'ASSISTANT_ACTIONS')
    .map((a, i) => [X.ACTIONS[i] && X.ACTIONS[i].text, plainText(a.description), a.title])
    .filter(([want, got]) => want !== got)
    .map(([want, got, title]) => `${title}: want ${j(want)}, got ${j(got)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

/* ───────────────────────── M — the two addresses ───────────────────────── */

test('M1: the hub is ASSISTANT_MANAGEMENT_PATH = "/assistant", and the editor keeps its constant, MY_ASSISTANT_PATH, now "/assistant/profile/edit" (AC-6)', async () => {
  const menu = await menuModule();
  assert(menu.ASSISTANT_MANAGEMENT_PATH === X.HUB, `ASSISTANT_MANAGEMENT_PATH: want ${j(X.HUB)}, got ${j(menu.ASSISTANT_MANAGEMENT_PATH)}`);
  assert(menu.MY_ASSISTANT_PATH === X.EDITOR, `MY_ASSISTANT_PATH: want ${j(X.EDITOR)}, got ${j(menu.MY_ASSISTANT_PATH)} — every in-app editor link follows this one value`);
});

test('M2: in both avatar menus, "My Assistant\'s Profile" opens the editor and "Assistant Management" opens the hub (AC-6)', async () => {
  const menu = await menuModule();
  const wrong = [];
  for (const profileBase of ['/user', '/tapestry/users']) {
    const links = menu.personalLinks({ pubkey: 'cc'.repeat(32), assistantPubkey: 'c1'.repeat(32), classification: 'customer', profileBase });
    const mine = (links || []).find((l) => l && l.key === 'my-assistant');
    if (!mine || mine.to !== X.EDITOR) wrong.push(`${profileBase}: "My Assistant's Profile" → want ${X.EDITOR}, got ${j(mine && mine.to)}`);
  }
  const mgmt = (menu.accountLinks || []).find((l) => l && l.key === 'assistant-management');
  if (!mgmt || mgmt.to !== X.HUB) wrong.push(`"Assistant Management" → want ${X.HUB}, got ${j(mgmt && mgmt.to)}`);
  if (mgmt && mgmt.label !== 'Assistant Management') wrong.push(`the item keeps its label, got ${j(mgmt.label)}`);
  assert(wrong.length === 0, wrong.join('; '));
});

test('M3: avatarMenuLinks.js still has no imports, so Node can load it and the pages can import it cheaply (guard)', () => {
  const src = codeOnly(safeRead(MENU_MOD));
  assert(src && !/^\s*import\b/m.test(src), 'ui/src/config/avatarMenuLinks.js must stay import-free (its header says so; three Node suites load it directly)');
});

/* ───────────────────────── W — the browser code, by source (CI runs no browser) ───────────────────────── */

test('W1: App.jsx routes the hub at /assistant, the editor at /assistant/profile/edit, and the ten placeholder pages from ASSISTANT_ACTIONS (AC-1, AC-5, AC-6, AC-7)', () => {
  const app = codeOnly(safeRead(APP));
  const importOf = (file) => (app.match(new RegExp(`import\\s+(\\w+)\\s+from\\s+['"]\\./pages/assistant/${file}(?:\\.jsx?)?['"]`)) || [])[1];
  const hub = importOf('Index');
  const editor = importOf('EditProfile');
  const placeholder = importOf('ActionPage');
  const wrong = [];
  if (!hub) wrong.push('no default import from ./pages/assistant/Index (the hub)');
  if (!editor) wrong.push('no default import from ./pages/assistant/EditProfile (the moved editor)');
  if (!placeholder) wrong.push('no default import from ./pages/assistant/ActionPage (the placeholder page)');
  if (!/import\s*\{[^}]*\bASSISTANT_ACTIONS\b[^}]*\}\s*from\s*['"]\.\/pages\/assistant\/actions(?:\.js)?['"]/.test(app)) wrong.push('ASSISTANT_ACTIONS is not imported from ./pages/assistant/actions');
  if (hub && !new RegExp(`path:\\s*ASSISTANT_MANAGEMENT_PATH\\s*,\\s*element:\\s*<${hub}\\b`).test(app)) {
    wrong.push(`no { path: ASSISTANT_MANAGEMENT_PATH, element: <${hub} /> } route`);
  }
  if (editor && !new RegExp(`path:\\s*MY_ASSISTANT_PATH\\s*,\\s*element:\\s*<${editor}\\b`).test(app)) {
    wrong.push(`no { path: MY_ASSISTANT_PATH, element: <${editor} /> } route`);
  }
  if (placeholder && !new RegExp(`ASSISTANT_ACTIONS\\.map\\(\\s*\\(?\\s*(\\w+)\\s*\\)?\\s*=>\\s*\\(\\s*\\{\\s*path:\\s*\\1\\.path\\s*,\\s*element:\\s*<${placeholder}\\b[^>]*\\baction=\\{\\s*\\1\\s*\\}`).test(app)) {
    wrong.push(`the ten placeholder routes are not generated as ...ASSISTANT_ACTIONS.map((a) => ({ path: a.path, element: <${placeholder} action={a} /> }))`);
  }
  if (/\bMyAssistantPage\b/.test(app)) wrong.push('App.jsx still names MyAssistantPage — the editor moved to EditProfile.jsx');
  assert(wrong.length === 0, `ADR 0001 sub-decision 2: ${wrong.join('; ')}`);
});

test('W2: the editor page is headed "Edit Assistant Profile" and links back to /assistant/profile (AC-6)', async () => {
  const sf = parse(EDIT_PAGE);
  assert(sf, `${rel(EDIT_PAGE)} does not exist — ADR 0001 sub-decision 6 moves the editor page there (git mv from Index.jsx)`);
  const scope = { ...(await actionsModule()), ...(await menuModule()) };
  const h1s = jsxElements(sf, 'h1').map((h) => jsxWords(h, scope));
  assert(h1s.length === 1 && h1s[0] === X.COPY.editorHeading, `the page has one h1, reading exactly ${j(X.COPY.editorHeading)}; got ${j(h1s)}`);
  const backs = jsxElements(sf, 'Link').filter((l) => {
    const to = attrOf(l, 'to');
    return to && (to.literal === X.PROFILE_PAGE || to.expr === 'ASSISTANT_PROFILE_PATH');
  }).map((l) => jsxWords(l, scope));
  assert(backs.includes(X.COPY.editorBack), `a <Link to={ASSISTANT_PROFILE_PATH}> reading ${j(X.COPY.editorBack)}; found ${j(backs)}`);
  const code = codeOnly(safeRead(EDIT_PAGE));
  assert(!/My Assistant(?!'s)/.test(code.replace(/hasMyAssistantPage/g, '')), 'the editor page no longer calls itself "My Assistant"');
  assert(/export\s+default\s+function\s+EditAssistantProfilePage\b/.test(code), 'the component is renamed EditAssistantProfilePage (ADR 0001 sub-decision 6)');
});

test('W3: the hub and the placeholder pages ask nothing of the server and never read the instance TA — only the sign-in state the app already holds (AC-2, AC-7)', () => {
  const wrong = [];
  for (const file of [HUB_PAGE, ACTION_PAGE, ACTION_TEXT, ACTIONS_MOD]) {
    const src = codeOnly(safeRead(file));
    if (!src) { wrong.push(`${rel(file)} does not exist`); continue; }
    for (const [re, what] of [
      [/\bfetch\s*\(/, 'fetch('], [/['"`]\/api\//, 'an /api/ path'], [/\buseSetupStatus\b/, 'useSetupStatus'],
      [/\bXMLHttpRequest\b|\bEventSource\b|\bWebSocket\b/, 'a network object'], [/\btaPubkey\b|\buseConfig\b/, 'the instance TA (useConfig/taPubkey)'],
    ]) if (re.test(src)) wrong.push(`${rel(file)} uses ${what}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('W4: the hub wears the Brainstorm top bar, reads sign-in, marks cards from assistantAttention, and holds the FAQ in a disclosure that says whether it is open (AC-1, AC-2, AC-4)', () => {
  const src = codeOnly(safeRead(HUB_PAGE));
  assert(src, `${rel(HUB_PAGE)} does not exist`);
  const wrong = [];
  if (!/<TopBar\b/.test(src)) wrong.push('no <TopBar />');
  if (!/\buseAuth\s*\(/.test(src)) wrong.push('no useAuth()');
  if (!/\bassistantAttention\s*\(/.test(src)) wrong.push('no assistantAttention(user): the marks and the count must come from the one answer the pill also counts');
  for (const name of ['ASSISTANT_SECTIONS', 'ASSISTANT_ACTIONS', 'ASSISTANT_FAQ']) if (!new RegExp(`\\b${name}\\b`).test(src)) wrong.push(`${name} is not rendered`);
  const disclosure = (/<details\b/.test(src) && /<summary\b/.test(src)) || /aria-expanded/.test(src);
  if (!disclosure) wrong.push('the FAQ is not in a <details>/<summary> (or a toggle with aria-expanded)');
  if (/<details\b[^>]*\bopen\b/.test(src)) wrong.push('the FAQ <details> must not be open by default');
  if (/MyAssistantPage|AssistantProfileEditor/.test(src)) wrong.push('the hub still holds the editor');
  assert(wrong.length === 0, `ADR 0001 sub-decisions 3–5: ${wrong.join('; ')}`);
});

test('W5: the NIP links open in a new tab, safely — target="_blank" with rel="noopener noreferrer" (AC-3)', () => {
  const sf = parse(ACTION_TEXT);
  assert(sf, `${rel(ACTION_TEXT)} does not exist`);
  const anchors = jsxElements(sf, 'a');
  const selfClosing = [];
  walk(sf, (n) => { if (ts().isJsxSelfClosingElement(n) && n.tagName.getText() === 'a') selfClosing.push(n); });
  const all = [...anchors, ...selfClosing];
  assert(all.length >= 1, `${rel(ACTION_TEXT)} renders no <a>`);
  for (const a of all) {
    const target = attrOf(a, 'target');
    const relAttr = attrOf(a, 'rel');
    assert(target && target.literal === '_blank', `every link part opens in a new tab: target="_blank", got ${j(target)}`);
    assert(relAttr && /\bnoopener\b/.test(relAttr.literal || '') && /\bnoreferrer\b/.test(relAttr.literal || ''), `rel must include noopener and noreferrer, got ${j(relAttr)}`);
  }
});

test('W6: the Brainstorm /settings card names the Edit Assistant Profile page and links to it (AC-6, story 1 § Copy)', () => {
  const src = safeRead(BRAINSTORM_SETTINGS);
  const code = squash(codeOnly(src));
  assert(code.includes(X.COPY.settingsCardText), `the card says ${j(X.COPY.settingsCardText)}`);
  assert(code.includes(X.COPY.settingsCardButton), `its button reads ${j(X.COPY.settingsCardButton)}`);
  assert(!code.includes('Open My Assistant') && !code.includes('on the My Assistant page'), 'the card no longer names "My Assistant"');
  assert(/href=\{\s*MY_ASSISTANT_PATH\s*\}/.test(code), 'the button still links through MY_ASSISTANT_PATH');
});

/* ───────────────────────── O — outside the app ───────────────────────── */

test('O1: the server has one definition of the editor\'s address, and it equals the UI\'s (ADR 0001 sub-decision 6)', async () => {
  assert(fs.existsSync(SERVER_PAGES), `${rel(SERVER_PAGES)} does not exist — ADR 0001 sub-decision 6 creates it (CommonJS, no requires)`);
  delete require.cache[require.resolve(SERVER_PAGES)];
  const pages = require(SERVER_PAGES);
  const menu = await menuModule();
  assert(pages.EDIT_ASSISTANT_PROFILE_PATH === X.EDITOR, `EDIT_ASSISTANT_PROFILE_PATH: want ${j(X.EDITOR)}, got ${j(pages.EDIT_ASSISTANT_PROFILE_PATH)}`);
  assert(pages.EDIT_ASSISTANT_PROFILE_PATH === menu.MY_ASSISTANT_PATH,
    `the two homes of the editor's address disagree: server ${j(pages.EDIT_ASSISTANT_PROFILE_PATH)}, UI ${j(menu.MY_ASSISTANT_PATH)}`);
  assert(pages.EDIT_ASSISTANT_PROFILE_PAGE === X.EDITOR_PAGE_PHRASE, `EDIT_ASSISTANT_PROFILE_PAGE: want ${j(X.EDITOR_PAGE_PHRASE)}, got ${j(pages.EDIT_ASSISTANT_PROFILE_PAGE)}`);
  assert(!/\brequire\s*\(/.test(codeOnly(safeRead(SERVER_PAGES))), `${rel(SERVER_PAGES)} requires nothing`);
});

test('O2: the two legacy panels name the Edit Assistant Profile page and link to its address (AC-6, story 1 § Copy)', () => {
  const wrong = [];
  for (const file of LEGACY_PAGES) {
    const html = squash(safeRead(file).replace(/<!--[\s\S]*?-->/g, ' '));
    if (!html) { wrong.push(`${rel(file)} not found`); continue; }
    if (!html.includes(X.LEGACY_PANEL_SENTENCE)) wrong.push(`${rel(file)}: no ${j(X.LEGACY_PANEL_SENTENCE)}`);
    const link = html.match(/<a\b[^>]*\bhref=["']([^"']*)["'][^>]*>\s*🤖 Edit and publish its profile[^<]*<\/a>/);
    if (!link) wrong.push(`${rel(file)}: no "🤖 Edit and publish its profile…" link`);
    else {
      if (link[1] !== X.EDITOR) wrong.push(`${rel(file)}: the link goes to ${j(link[1])}, want ${j(X.EDITOR)}`);
      if (squash(link[0].replace(/<[^>]+>/g, '')) !== X.LEGACY_PANEL_LINK_TEXT) wrong.push(`${rel(file)}: the link reads ${j(squash(link[0].replace(/<[^>]+>/g, '')))}, want ${j(X.LEGACY_PANEL_LINK_TEXT)}`);
    }
  }
  assert(wrong.length === 0, wrong.join('; '));
});

test('O3: BIBLE §14 says the one writer is called from the Edit Assistant Profile page, at /assistant/profile/edit (ADR 0001 sub-decision 6)', () => {
  const bible = safeRead(BIBLE);
  const line = bible.split(NL).find((l) => l.startsWith("**An assistant's profile (kind 0) has one writer:**")) || '';
  assert(line, 'BIBLE.md has no "An assistant\'s profile (kind 0) has one writer" paragraph');
  assert(line.includes('the Edit Assistant Profile page (`/assistant/profile/edit`)'),
    `the paragraph must name "the Edit Assistant Profile page (\`/assistant/profile/edit\`)"; it reads: ${j(line.slice(0, 200))}`);
});

/**
 * The stale-address sweep. In code (comments removed) under ui/src, src, public and bin, and in BIBLE.md, nothing may
 * still send a person to the editor at the old address or by the old name:
 *   - a string literal that is exactly '/assistant' — the hub's own constant in avatarMenuLinks.js excepted;
 *   - href="/assistant", or "(/assistant)" / "(`/assistant`)" in prose;
 *   - "My Assistant page" anywhere outside a comment.
 */
function filesUnder(dir, re) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (!['node_modules', 'dist', '.git'].includes(entry.name)) out.push(...filesUnder(p, re)); } else if (re.test(entry.name)) out.push(p);
  }
  return out;
}
test('O4: nothing user-facing still sends people to "the My Assistant page (/assistant)" — in the app, the server, the legacy pages or BIBLE (AC-6)', () => {
  const files = [
    ...filesUnder(path.join(REPO, 'ui/src'), /\.(jsx?|mjs)$/),
    ...filesUnder(path.join(REPO, 'src'), /\.(jsx?|mjs|cjs)$/),
    ...filesUnder(path.join(REPO, 'public'), /\.(html?|jsx?)$/),
    ...filesUnder(path.join(REPO, 'bin'), /\.(jsx?|mjs|cjs)$/),
  ];
  const hits = [];
  for (const file of files) {
    let src = safeRead(file);
    if (/\.html?$/.test(file)) src = src.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
    const code = codeOnly(src);
    const lines = code.split(NL);
    lines.forEach((line, i) => {
      const at = `${rel(file)}:${i + 1}`;
      if (/(['"`])\/assistant\1/.test(line) && !(file === MENU_MOD && /ASSISTANT_MANAGEMENT_PATH\s*=/.test(line))) hits.push(`${at} writes the literal '/assistant': ${squash(line).slice(0, 120)}`);
      if (/href=["']\/assistant["']/.test(line)) hits.push(`${at} links to /assistant: ${squash(line).slice(0, 120)}`);
      if (/\((?:`)?\/assistant(?:`)?\)/.test(line)) hits.push(`${at} names "(/assistant)": ${squash(line).slice(0, 120)}`);
      if (/My Assistant page/.test(line)) hits.push(`${at} names "the My Assistant page": ${squash(line).slice(0, 120)}`);
    });
  }
  safeRead(BIBLE).split(NL).forEach((line, i) => {
    if (/My Assistant page|\(`?\/assistant`?\)/.test(line)) hits.push(`BIBLE.md:${i + 1}: ${squash(line).slice(0, 120)}`);
  });
  assert(hits.length === 0, `${hits.length} place(s) still send people to the old address or name:${NL}          ${hits.join(`${NL}          `)}`);
});

/* ───────────────────────── H — the live server (a guard) ───────────────────────── */

test('H1: the reachable instance serves the app for all twelve addresses — the hub, the ten action pages and the editor (AC-7; guard)', async () => {
  const addresses = [X.HUB, ...X.ACTIONS.map((a) => a.path), X.EDITOR];
  let first;
  try {
    first = await fetch(`${HOST_BASE}${X.HUB}`, { signal: AbortSignal.timeout(3000) });
  } catch {
    hSkipped++;
    return 'SKIP';
  }
  hExecuted++;
  const wrong = [];
  for (const address of addresses) {
    const res = address === X.HUB ? first : await fetch(`${HOST_BASE}${address}`, { signal: AbortSignal.timeout(5000) });
    const body = await res.text();
    if (res.status !== 200 || !/text\/html/.test(res.headers.get('content-type') || '') || !body.includes('id="root"')) {
      wrong.push(`${address}: ${res.status} ${res.headers.get('content-type')}`);
    }
  }
  assert(wrong.length === 0, `each address must answer 200 with the app shell (the SPA catch-all, bin/control-panel.js): ${wrong.join('; ')}`);
  return undefined;
});

async function run() {
  console.log(`${NL}=== assistant-management-page (assistant-management #1) ===`);
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
  console.log(`assistant-management-page: H-class ${hExecuted} executed / ${hSkipped} skipped`);
  if (hSkipped > 0 && hExecuted === 0) {
    console.log('assistant-management-page: !! LIVE COVERAGE DID NOT RUN — no instance answered.');
    if (process.env.TAPESTRY_REQUIRE_LIVE === '1') {
      failures.push({ name: 'live coverage', message: 'TAPESTRY_REQUIRE_LIVE=1 but the whole H-class skipped.' });
      fail++;
    }
  }
  console.log(`${NL}assistant-management-page: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped, hExecuted, hSkipped };
}

module.exports = { run };
