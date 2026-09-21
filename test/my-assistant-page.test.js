/**
 * assistant-profile #4: One place — the My Assistant page.
 *
 * Story: engineering-team/stories/done/assistant-profile/4-my-assistant-page.md
 * ADR:   engineering-team/decisions/done/assistant-profile/0004-my-assistant-page-hosts-the-one-editor.md
 * Plan:  engineering-team/stories/done/assistant-profile/4-my-assistant-page.test-plan.md
 * Browser half: tests/brainstorm/my-assistant-page.spec.js (B-class — what the page, the menus and
 * every entry point DO).
 *
 * Classes (all stack-free — no strfry, no Neo4j, no relay traffic):
 *   M — the one predicate behind the menu item and the page (ui/src/config/avatarMenuLinks.js),
 *       imported and called directly: the module has no imports and ui/package.json makes it ESM.
 *   Q — the status answer, through its seam (createAssistantStatusHandler): the no-key answer says
 *       whether it is the Owner's, and — carried forward from ledger
 *       2026-09-21-status-no-key-relay-gate-unpinned — who may make its name lookup reach relays.
 *   E — the publish handler, through its seam: an array-shaped customerPubkey.
 *   A — the avatar proxy: its "no picture" answer says so in a machine-readable code.
 *   W — the browser code, by source: the CI-enforced backstop for the B-class (CI runs no browser).
 *
 * Against current code: M1–M3 and M5 fail (no predicates; the assistant item still points at a
 * profile view), Q1 fails (no isOwner in the no-key answer), Q4 and E1 fail (an array
 * customerPubkey gets 500 or 403, not 400), A1 fails (no code), and W1–W14 fail (no page, no
 * route, the editor still has two hosts, …). M4, Q2, Q3, W15 and W16 are guards: they pass before
 * and after, and pin behaviour this story must keep.
 *
 * W17–W20 were added by assistant-profile #5 (ledger 2026-09-21-my-assistant-checks-browser-only): guards
 * that give B1, B11, B12 and B16 a CI-run counterpart. They pass against the code as it is, and each fails
 * against the defect story 4's review planted for its B-test.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { nip19, generateSecretKey, getPublicKey } = require('nostr-tools');

const REPO = path.resolve(__dirname, '..');
const UI_SRC = path.join(REPO, 'ui/src');
const MENU_MOD = path.join(REPO, 'ui/src/config/avatarMenuLinks.js');
const PAGE = path.join(REPO, 'ui/src/pages/assistant/Index.jsx');
const APP = path.join(REPO, 'ui/src/App.jsx');
const EDITOR = path.join(REPO, 'ui/src/components/AssistantProfileEditor.jsx');
const AUTH_CONTEXT = path.join(REPO, 'ui/src/context/AuthContext.jsx');
const USER_DETAIL = path.join(REPO, 'ui/src/pages/users/UserDetail.jsx');
const TAPESTRY_SETTINGS = path.join(REPO, 'ui/src/pages/settings/Index.jsx');
const BRAINSTORM_SETTINGS = path.join(REPO, 'ui/src/pages/BrainstormSettings.jsx');
const MENUS = {
  'the Tapestry menu (ui/src/components/Header.jsx)': path.join(REPO, 'ui/src/components/Header.jsx'),
  'the Brainstorm menu (ui/src/components/BrainstormUserMenu.jsx)': path.join(REPO, 'ui/src/components/BrainstormUserMenu.jsx'),
  'the landing page\'s menu (ui/src/pages/BrainstormSearch.jsx)': path.join(REPO, 'ui/src/pages/BrainstormSearch.jsx'),
};
const ASSISTANT_SRC = path.join(REPO, 'src/api/assistant/index.js');
const PROFILE_STATE = path.join(REPO, 'src/api/assistant/profileState.js');
const AVATAR = path.join(REPO, 'src/api/assistant/avatar.js');
const CONFIG = path.join(REPO, 'src/utils/config.js');

// Fixture keys — never live ones.
const OWNER = 'bb'.repeat(32);
const ADMIN = 'ad'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const GUEST = 'ee'.repeat(32);
const STRANGER = 'dd'.repeat(32);
const TA = 'aa'.repeat(32);
const ADMIN_ASSISTANT = 'a1'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);
const GUEST_ASSISTANT = 'e1'.repeat(32);
const ASSISTANT_OF = { [OWNER]: TA, [ADMIN]: ADMIN_ASSISTANT, [CUSTOMER]: CUSTOMER_ASSISTANT };

// The ADR's fixed values.
const MY_ASSISTANT = '/assistant';
const NO_ASSISTANT_REASON = 'No assistant is provisioned for your account yet.';   // unchanged (AC3)
const NOT_PUBLIC = { domain: 'localhost:7777', isPublic: false, website: '', avatarUrl: 'https://tapestry.brainstorm.world/ta-avatar.png' };
const PUBLIC = { domain: 'staging.brainstorm.world', isPublic: true, website: 'https://staging.brainstorm.world', avatarUrl: 'https://staging.brainstorm.world/ta-avatar.png' };

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const j = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);

/** Source with comments removed, leaving `https://` inside strings intact. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join('\n');
}

// ─── Reading JSX structure ──────────────────────────────────────────────────────
// A regex cannot tell JSX text ("don't") from a string, so the structural checks parse the file with the
// root `typescript` dependency's parser (package.json) — a library call, not a lint or typecheck step.

let tsLib = null;
function ts() {
  if (!tsLib) {
    try { tsLib = require('typescript'); } catch (err) {
      throw new Error(`test/my-assistant-page.test.js parses JSX with the root "typescript" dependency and could not load it (${err.message}).`);
    }
  }
  return tsLib;
}
function parse(file) {
  const src = safeRead(file);
  return src ? ts().createSourceFile(file, src, ts().ScriptTarget.Latest, true, ts().ScriptKind.JSX) : null;
}
function walk(node, visit) { visit(node); ts().forEachChild(node, (child) => walk(child, visit)); }
const norm = (text) => text.replace(/\?\./g, '.').replace(/\s+/g, '');

/** The text of a function or const (arrow, or useCallback(arrow)) named `name`, anywhere in the file. */
function functionText(sf, name) {
  let found = '';
  if (sf) walk(sf, (n) => {
    if (found) return;
    if (ts().isFunctionDeclaration(n) && n.name && n.name.text === name) found = n.getText();
    else if (ts().isVariableDeclaration(n) && ts().isIdentifier(n.name) && n.name.text === name && n.initializer) found = n.initializer.getText();
  });
  return found;
}

/**
 * Does `expr` being truthy imply one of `guards` (normalised expressions, e.g. 'status.isOwner')? A guard may
 * also be a negation or a comparison written out as such — '!user', "body.code==='no-picture'" — which then
 * counts only where the code says exactly that (story 5's W17–W20).
 */
function asserts(expr, guards) {
  const t = ts();
  while (t.isParenthesizedExpression(expr)) expr = expr.expression;
  if (t.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    if (op === t.SyntaxKind.AmpersandAmpersandToken) return asserts(expr.left, guards) || asserts(expr.right, guards);
    if ((op === t.SyntaxKind.EqualsEqualsEqualsToken || op === t.SyntaxKind.EqualsEqualsToken) && expr.right.kind === t.SyntaxKind.TrueKeyword) return asserts(expr.left, guards);
    if (op === t.SyntaxKind.BarBarToken) return false;
    return guards.includes(norm(expr.getText()));
  }
  if (t.isCallExpression(expr) && expr.expression.getText() === 'Boolean' && expr.arguments.length === 1) return asserts(expr.arguments[0], guards);
  if (t.isPrefixUnaryExpression(expr) && expr.operator === t.SyntaxKind.ExclamationToken) {
    const inner = expr.operand;
    if (t.isPrefixUnaryExpression(inner) && inner.operator === t.SyntaxKind.ExclamationToken) return asserts(inner.operand, guards);
    return guards.includes(norm(expr.getText()));
  }
  return guards.includes(norm(expr.getText()));
}
/**
 * Does `expr` being FALSE imply one of `guards` holds (`!guard`, `!guard || …`)? That is what an `else`
 * branch, a ternary's false branch and the code after `if (…) return` need.
 */
function refutes(expr, guards) {
  const t = ts();
  while (t.isParenthesizedExpression(expr)) expr = expr.expression;
  if (t.isPrefixUnaryExpression(expr) && expr.operator === t.SyntaxKind.ExclamationToken) return asserts(expr.operand, guards);
  if (t.isBinaryExpression(expr) && expr.operatorToken.kind === t.SyntaxKind.BarBarToken) return refutes(expr.left, guards) || refutes(expr.right, guards);
  return false;
}
const endsInReturn = (stmt) => {
  const t = ts();
  if (t.isReturnStatement(stmt)) return true;
  return t.isBlock(stmt) && stmt.statements.length > 0 && t.isReturnStatement(stmt.statements[stmt.statements.length - 1]);
};

/** Guards plus every const assigned from something that asserts one (const canBadge = status?.isOwner === true). */
function withAliases(sf, guards) {
  const out = [...guards];
  if (sf) walk(sf, (n) => {
    if (ts().isVariableDeclaration(n) && ts().isIdentifier(n.name) && n.initializer && asserts(n.initializer, guards)) out.push(n.name.text);
  });
  return out;
}

/** Is `node` reached only when a guard holds — `g && …`, `g ? … : …`, `if (g) …`, or after `if (!g) return`? */
function guardedHere(node, guards) {
  const t = ts();
  for (let child = node, p = node.parent; p; child = p, p = p.parent) {
    if (t.isBinaryExpression(p) && p.operatorToken.kind === t.SyntaxKind.AmpersandAmpersandToken && p.right === child && asserts(p.left, guards)) return true;
    if (t.isConditionalExpression(p) && p.whenTrue === child && asserts(p.condition, guards)) return true;
    if (t.isConditionalExpression(p) && p.whenFalse === child && refutes(p.condition, guards)) return true;
    if (t.isIfStatement(p) && p.thenStatement === child && asserts(p.expression, guards)) return true;
    if (t.isIfStatement(p) && p.elseStatement === child && refutes(p.expression, guards)) return true;
    if (t.isBlock(p) || t.isSourceFile(p)) {
      const before = p.statements.slice(0, Math.max(p.statements.indexOf(child), 0));
      if (before.some((s) => t.isIfStatement(s) && refutes(s.expression, guards) && endsInReturn(s.thenStatement))) return true;
    }
    // A declared function (a component, a handler) is where the climb ends; an inline callback such as
    // rows.map(row => …) is not.
    if (t.isFunctionDeclaration(p) || t.isMethodDeclaration(p)) return false;
    if ((t.isArrowFunction(p) || t.isFunctionExpression(p)) && t.isVariableDeclaration(p.parent)) return false;
  }
  return false;
}

/** The capitalised helper component (not `main`) that `node` sits in, if any. */
function helperComponentOf(node, main) {
  const t = ts();
  for (let p = node.parent; p; p = p.parent) {
    let name = null;
    if (t.isFunctionDeclaration(p) && p.name) name = p.name.text;
    else if ((t.isArrowFunction(p) || t.isFunctionExpression(p)) && t.isVariableDeclaration(p.parent) && t.isIdentifier(p.parent.name)) name = p.parent.name.text;
    if (name) return /^[A-Z]/.test(name) && name !== main ? name : null;
  }
  return null;
}

/**
 * Is every rendering of text matching `label` (JSX text or a string) reached only when one of `guards`
 * holds? Guards are normalised expressions ('status.isOwner'); consts assigned from them count too. A label
 * inside a helper component counts when every place that renders the helper is guarded — one level, all an
 * extraction needs.
 */
function renderedOnlyWhen(file, label, guards, main = 'AssistantProfileEditor') {
  const sf = parse(file);
  if (!sf) return { ok: false, why: `${rel(file)} does not exist` };
  const all = withAliases(sf, guards);
  const labels = [];
  walk(sf, (n) => {
    const t = ts();
    if ((t.isJsxText(n) || t.isStringLiteral(n) || t.isNoSubstitutionTemplateLiteral(n)) && label.test(n.text)) labels.push(n);
  });
  if (labels.length === 0) return { ok: false, why: `the text ${label} is not in ${rel(file)}` };
  for (const n of labels) {
    if (guardedHere(n, all)) continue;
    const helper = helperComponentOf(n, main);
    const uses = [];
    if (helper) walk(sf, (u) => { if ((ts().isJsxOpeningElement(u) || ts().isJsxSelfClosingElement(u)) && u.tagName.getText() === helper) uses.push(u); });
    if (!(helper && uses.length && uses.every((u) => guardedHere(u, all)))) {
      return { ok: false, why: `${label} is rendered at ${rel(file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1} without a ${all.join(' / ')} guard` };
    }
  }
  return { ok: true };
}

function jsFilesUnder(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') out.push(...jsFilesUnder(p)); } else if (/\.(jsx?|mjs)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function fakeRes() {
  const res = { statusCode: 200, body: undefined, headers: {} };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.set = (k, v) => { res.headers[k] = v; return res; };
  res.send = (body) => { res.body = body; return res; };
  return res;
}

// ─── The modules under test — or a failure that says exactly what is missing ───

let menuModule = null;
async function getMenuModule() {
  if (!menuModule) {
    try {
      menuModule = await import(pathToFileURL(MENU_MOD).href);
    } catch (err) {
      throw new Error(`ui/src/config/avatarMenuLinks.js could not be imported by Node (${err.message}). ADR 0004's testability note ` +
        'relies on it staying a dependency-free ES module: keep its predicates pure and import-free.');
    }
  }
  return menuModule;
}
async function menuExport(name, what) {
  const mod = await getMenuModule();
  if (typeof mod[name] !== 'function') {
    throw new Error(`ui/src/config/avatarMenuLinks.js does not export ${name}() — ${what} (ADR 0004 sub-decision 2).`);
  }
  return mod[name];
}

function getIndex() { return require(ASSISTANT_SRC); }
function getStatusFactory() {
  const mod = getIndex();
  if (typeof mod.createAssistantStatusHandler !== 'function') {
    throw new Error('src/api/assistant/index.js does not export createAssistantStatusHandler(deps) (ADR assistant-profile/0003).');
  }
  return mod.createAssistantStatusHandler;
}
function getPublishFactory() {
  const mod = getIndex();
  if (typeof mod.createPublishProfileHandler !== 'function') {
    throw new Error('src/api/assistant/index.js does not export createPublishProfileHandler(deps) (ADR assistant-profile/0002).');
  }
  return mod.createPublishProfileHandler;
}

/** The status seam's dependencies — a key store holding every role's assistant unless `noKey`. */
function statusFakes(opts = {}) {
  const calls = { keys: [], personName: [], state: [] };
  const deps = {
    getOwnerPubkey: () => OWNER,
    getAdminPubkeys: () => [ADMIN],
    getAssistantKeys: async (pk) => {
      calls.keys.push(pk);
      if (opts.noKey) return null;
      const assistant = ASSISTANT_OF[pk];
      return assistant ? { pubkey: assistant, npub: nip19.npubEncode(assistant) } : null;
    },
    getPersonName: async (pk, options) => { calls.personName.push({ pubkey: pk, options }); return ''; },
    describeInstance: () => opts.instance || PUBLIC,
    resolveAssistantProfileState: async (options) => {
      calls.state.push(options);
      return { hasProfile: false, profile: null, event: null, source: null };
    },
  };
  return { deps, calls };
}
function statusReq({ customerPubkey, session = null, localTrusted = false, defaults } = {}) {
  const query = { customerPubkey };
  if (defaults !== undefined) query.defaults = defaults;
  return { query, session: session ? { authenticated: true, pubkey: session } : {}, localTrusted };
}
async function askStatus(opts, reqOpts) {
  const factory = getStatusFactory();
  const f = statusFakes(opts);
  const res = fakeRes();
  await factory(f.deps)(statusReq(reqOpts), res);
  return { res, calls: f.calls };
}

/* ───────────────────────── M — one predicate for the menu item and the page ───────────────────────── */

// Who is signed in, and what ADR 0004 sub-decision 2 says about them.
const PEOPLE = [
  // [who, user, mayCreateAssistant, hasMyAssistantPage]
  ['the Owner, with the instance TA', { pubkey: OWNER, classification: 'owner', assistantPubkey: TA }, false, true],
  ['the Owner, whose TA key is missing', { pubkey: OWNER, classification: 'owner', assistantPubkey: null }, false, true],
  ['an Admin with an assistant', { pubkey: ADMIN, classification: 'admin', assistantPubkey: ADMIN_ASSISTANT }, true, true],
  ['an Admin with none yet', { pubkey: ADMIN, classification: 'admin', assistantPubkey: null }, true, true],
  ['a Customer with an assistant', { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: CUSTOMER_ASSISTANT }, true, true],
  ['a Customer with none', { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: null }, true, true],
  ['a guest who kept an assistant from an earlier role', { pubkey: GUEST, classification: 'guest', assistantPubkey: GUEST_ASSISTANT }, false, true],
  ['a guest with no assistant', { pubkey: GUEST, classification: 'guest', assistantPubkey: null }, false, false],
];

test('M1: an Admin or a Customer may create an assistant here — the roles provision-key accepts, less the Owner, whose assistant is the instance TA; nobody else may', async () => {
  const mayCreateAssistant = await menuExport('mayCreateAssistant', 'whether this signed-in user may create an assistant of their own here');
  const wrong = [];
  for (const [who, user, want] of PEOPLE) if (mayCreateAssistant(user) !== want) wrong.push(`${who}: expected ${want}, got ${j(mayCreateAssistant(user))}`);
  for (const [who, user] of [['nobody signed in (null)', null], ['nobody signed in (undefined)', undefined], ['an unauthenticated classification', { pubkey: null, classification: 'unauthenticated', assistantPubkey: null }]]) {
    if (mayCreateAssistant(user) !== false) wrong.push(`${who}: expected false, got ${j(mayCreateAssistant(user))}`);
  }
  assert(wrong.length === 0, `AC3 — "allowed to create one": ${wrong.join('; ')}`);
});

test('M2: the My Assistant page has something for exactly these people — anyone with an assistant, the Owner (even with a missing key, which the page explains), and anyone who may create one; not a guest with none, and not nobody', async () => {
  const hasMyAssistantPage = await menuExport('hasMyAssistantPage', 'whether the My Assistant page has something for this user to manage');
  const wrong = [];
  for (const [who, user, , want] of PEOPLE) if (hasMyAssistantPage(user) !== want) wrong.push(`${who}: expected ${want}, got ${j(hasMyAssistantPage(user))}`);
  for (const [who, user] of [['nobody signed in (null)', null], ['nobody signed in (undefined)', undefined]]) {
    if (hasMyAssistantPage(user) !== false) wrong.push(`${who}: expected false, got ${j(hasMyAssistantPage(user))}`);
  }
  assert(wrong.length === 0, `AC3: ${wrong.join('; ')}`);
});

test('M3: "My Assistant\'s Profile" leads to the My Assistant page exactly when the page has something for the viewer — from both menus — and otherwise stays disabled with its unchanged explanation', async () => {
  const personalLinks = await menuExport('personalLinks', 'the personal links both avatar menus render');
  const wrong = [];
  for (const profileBase of ['/user', '/tapestry/users']) {
    for (const [who, user, , hasPage] of PEOPLE) {
      const links = personalLinks({ pubkey: user.pubkey, assistantPubkey: user.assistantPubkey, classification: user.classification, profileBase });
      const item = (links || []).find((l) => l && l.key === 'my-assistant');
      if (!item) { wrong.push(`${profileBase}: no 'my-assistant' entry`); continue; }
      if (item.label !== "My Assistant's Profile" || item.icon !== '🤖') wrong.push(`${profileBase}, ${who}: the label and icon stay "🤖 My Assistant's Profile" — got ${j([item.icon, item.label])}`);
      if (hasPage && item.to !== MY_ASSISTANT) wrong.push(`${profileBase}, ${who}: expected to "${MY_ASSISTANT}", got ${j(item.to)}`);
      if (!hasPage && (item.to !== null || item.disabledReason !== NO_ASSISTANT_REASON)) {
        wrong.push(`${profileBase}, ${who}: expected disabled (to null) with "${NO_ASSISTANT_REASON}", got ${j({ to: item.to, disabledReason: item.disabledReason })}`);
      }
    }
  }
  assert(wrong.length === 0, `AC2/AC3 (and the approval-time resolution: the item opens the My Assistant page, superseding navigation-scaffolding #2's profile view): ${wrong.join('; ')}`);
});

test('M4: "My Profile" keeps following each menu\'s own profile page — /user/‹pubkey› on the Brainstorm side, /tapestry/users/‹pubkey› in Tapestry', async () => {
  const personalLinks = await menuExport('personalLinks', 'the personal links both avatar menus render');
  for (const profileBase of ['/user', '/tapestry/users']) {
    const links = personalLinks({ pubkey: CUSTOMER, assistantPubkey: CUSTOMER_ASSISTANT, classification: 'customer', profileBase });
    const mine = (links || []).find((l) => l && l.key === 'my-profile');
    assert(mine && mine.to === `${profileBase}/${CUSTOMER}`, `profileBase ${profileBase}: expected My Profile to be ${profileBase}/${CUSTOMER}, got ${j(mine && mine.to)}`);
  }
});

test('M5: the page\'s address is one exported constant, "/assistant" — and "Assistant Management" leads there too', async () => {
  const mod = await getMenuModule();
  assert(mod.MY_ASSISTANT_PATH === MY_ASSISTANT,
    `ADR 0004: avatarMenuLinks.js exports MY_ASSISTANT_PATH = '${MY_ASSISTANT}', which every entry point links to — got ${j(mod.MY_ASSISTANT_PATH)}`);
  const item = (mod.accountLinks || []).find((l) => l && l.key === 'assistant-management');
  assert(item && item.to === mod.MY_ASSISTANT_PATH, `"Assistant Management" must lead to MY_ASSISTANT_PATH — got ${j(item && item.to)}`);
});

/* ───────────────────────── Q — the status answer ───────────────────────── */

test('Q1: the no-key answer says whether it is the Owner\'s assistant — so an Owner whose TA key is missing is told so in the Owner\'s words, not a Customer\'s', async () => {
  for (const defaults of [undefined, '0']) {
    for (const [who, person, want] of [['the Owner', OWNER, true], ['an Admin', ADMIN, false], ['a Customer', CUSTOMER, false]]) {
      const { res } = await askStatus({ noKey: true }, { customerPubkey: person, session: person, defaults });
      assert(res.statusCode === 200 && res.body && res.body.success === true && res.body.hasRelayKey === false,
        `${who}${defaults ? ' (defaults=0)' : ''}: expected the no-key answer, got ${res.statusCode} ${j(res.body)}`);
      assert(res.body.isOwner === want,
        `${who}${defaults ? ' (defaults=0)' : ''}: the no-key answer must carry isOwner: ${want} (ADR 0004 sub-decision 4, the Owner-copy fix) — got ${j(res.body.isOwner)}`);
    }
  }
});

test('Q2: with no key, the person\'s-name lookup reaches the relays under ADR 0001\'s rule — the person, the Owner, an Admin, the operator; never an anonymous caller or a stranger (guard, ledger 2026-09-21-status-no-key-relay-gate-unpinned)', async () => {
  const cases = [
    ['the person, signed in', { customerPubkey: CUSTOMER, session: CUSTOMER }, true],
    ['the Owner, about a Customer', { customerPubkey: CUSTOMER, session: OWNER }, true],
    ['an Admin, about a Customer', { customerPubkey: CUSTOMER, session: ADMIN }, true],
    ['the in-container operator', { customerPubkey: CUSTOMER, localTrusted: true }, true],
    ['an anonymous caller', { customerPubkey: CUSTOMER }, false],
    ['another signed-in user', { customerPubkey: CUSTOMER, session: STRANGER }, false],
  ];
  for (const [who, reqOpts, want] of cases) {
    const { res, calls } = await askStatus({ noKey: true }, reqOpts);
    assert(res.statusCode === 200 && res.body.hasRelayKey === false, `${who}: expected the no-key answer, got ${res.statusCode} ${j(res.body)}`);
    assert(calls.personName.length === 1 && calls.personName[0].pubkey === CUSTOMER, `${who}: the name looked up must be the person's — got ${j(calls.personName)}`);
    const got = calls.personName[0].options && calls.personName[0].options.allowRelayLookup;
    assert(got === want, `${who}: the no-key branch must ask with allowRelayLookup: ${want} — got ${j(got)}. An anonymous GET about any pubkey takes this branch.`);
    assert(calls.state.length === 0, `${who}: with no key there is no assistant to run the setup check for`);
  }
});

test('Q3: through the handler\'s own default dependencies, the real name lookup asks no relay for an anonymous caller or a stranger, and one for the person (guard, ledger 2026-09-21-status-no-key-relay-gate-unpinned)', async () => {
  const profileState = require(PROFILE_STATE);
  const saved = { scan: profileState.scanLocalKind0, query: profileState.queryRelaysKind0 };
  const asked = [];
  // profileDefaults.js reads these two off the profileState module at call time, so the stubs reach the
  // real getPersonName; nothing touches strfry or a relay.
  profileState.scanLocalKind0 = async () => null;
  profileState.queryRelaysKind0 = async (relays, pubkey) => { asked.push(pubkey); return []; };
  try {
    const factory = getStatusFactory();
    // Everything the no-key branch needs EXCEPT the name lookup, which stays the handler's default.
    const deps = {
      getOwnerPubkey: () => OWNER,
      getAdminPubkeys: () => [ADMIN],
      getAssistantKeys: async () => null,
      describeInstance: () => NOT_PUBLIC,
      resolveAssistantProfileState: async () => { throw new Error('with no key the setup check must not run'); },
    };
    // Fresh people each run: the name memo is module-level.
    const fresh = () => crypto.randomBytes(32).toString('hex');
    const cases = [['an anonymous caller', null, 0], ['another signed-in user', STRANGER, 0], ['the person themselves', 'self', 1]];
    for (const [who, session, want] of cases) {
      const person = fresh();
      asked.length = 0;
      const res = fakeRes();
      await factory(deps)(statusReq({ customerPubkey: person, session: session === 'self' ? person : session }), res);
      assert(res.statusCode === 200 && res.body && res.body.hasRelayKey === false, `${who}: expected the no-key answer, got ${res.statusCode} ${j(res.body)}`);
      assert(asked.length === want && asked.every((pk) => pk === person),
        `${who}: the real name lookup must query the profile relays ${want}× about the person — it queried ${j(asked.map((pk) => pk.slice(0, 8)))}`);
    }
  } finally {
    profileState.scanLocalKind0 = saved.scan;
    profileState.queryRelaysKind0 = saved.query;
  }
});

test('Q4: an array-shaped customerPubkey is refused with 400 — not a 500 from the npub encoder — and nothing is looked up', async () => {
  const { res, calls } = await askStatus({}, { customerPubkey: [CUSTOMER], session: CUSTOMER });
  assert(res.statusCode === 400 && res.body && res.body.success === false,
    `GET /api/assistant/status?customerPubkey[]=‹hex›: Express hands the handler an array — expected 400, got ${res.statusCode} ${j(res.body)} ` +
    '(ledger 2026-09-21-assistant-api-review-tidy-ups, folded in by ADR 0004 sub-decision 8)');
  assert(calls.keys.length === 0 && calls.personName.length === 0 && calls.state.length === 0,
    `nothing may be looked up for a malformed customerPubkey — got ${j({ keys: calls.keys.length, names: calls.personName.length, checks: calls.state.length })}`);
});

/* ───────────────────────── E — the publish handler ───────────────────────── */

test('E1: an array-shaped customerPubkey is refused with 400 by the publish handler too — whoever is signed in — and nothing is signed or written', async () => {
  // A key store that has the person's assistant, so a handler that let the array through would go on to
  // sign — and fail somewhere else, or succeed about the wrong person.
  const sk = generateSecretKey();
  const assistantKeys = { pubkey: getPublicKey(sk), privkey: Buffer.from(sk).toString('hex') };
  for (const [who, session] of [['the Owner', OWNER], ['the person', CUSTOMER]]) {
    const calls = { keys: 0, imported: 0 };
    const deps = {
      getAssistantKeys: async () => { calls.keys++; return assistantKeys; },
      getOwnerPubkey: () => OWNER,
      getPersonName: async () => '',
      describeInstance: () => NOT_PUBLIC,
      importEvent: async () => { calls.imported++; },
      updateNip05Mapping: () => {},
      isLocalOnly: () => true,
      getSettings: () => ({ aRelays: {} }),
      publishToRelays: async () => [],
      now: () => 1_700_000_000_000,
    };
    const res = fakeRes();
    await getPublishFactory()(deps)({ body: { customerPubkey: [CUSTOMER] }, query: {}, session: { authenticated: true, pubkey: session } }, res);
    assert(res.statusCode === 400 && res.body && res.body.success === false,
      `${who} publishing with customerPubkey [‹hex›]: expected 400, got ${res.statusCode} ${j(res.body)} (ledger 2026-09-21-assistant-api-review-tidy-ups)`);
    assert(calls.keys === 0 && calls.imported === 0, `${who}: no key may be read and nothing written — got ${j(calls)}`);
  }
});

/* ───────────────────────── A — the avatar proxy ───────────────────────── */

test('A1: when the owner has no profile picture, the avatar proxy says so in a machine-readable code — { code: "no-picture" } — beside its words', async () => {
  // Everything avatar.js loads is loaded first, with the real config, so only avatar.js itself — loaded
  // below — can see the stand-in; nothing else in this process keeps it.
  require('multer');
  require(path.join(REPO, 'src/middleware/auth.js'));
  require(ASSISTANT_SRC);
  const config = require(CONFIG);
  const savedGet = config.getConfigFromFile;
  const key = require.resolve(AVATAR);
  const savedModule = require.cache[key];
  delete require.cache[key];
  // avatar.js takes getConfigFromFile when it loads, so a fresh copy loaded now sees this owner. strfry is
  // absent here (and holds no kind 0 by this fixture key anywhere), so the owner has no picture.
  config.getConfigFromFile = (name, fallback) => (name === 'BRAINSTORM_OWNER_PUBKEY' ? OWNER : fallback);
  let avatar;
  try { avatar = require(AVATAR); } finally { config.getConfigFromFile = savedGet; }
  try {
    const res = fakeRes();
    await avatar.handleOwnerAvatar({ localTrusted: true }, res);
    assert(res.statusCode === 404 && res.body && res.body.success === false && /no profile picture/i.test(res.body.error || ''),
      `precondition: the owner has no picture — expected the proxy's 404 "no picture" answer, got ${res.statusCode} ${j(res.body)}`);
    assert(res.body.code === 'no-picture',
      `ADR 0004 sub-decision 5: the "no picture" answer carries code: 'no-picture', so the editor can tell it from a refusal or a ` +
      `broken picture host — got ${j(res.body)}`);
  } finally {
    delete require.cache[key];
    if (savedModule) require.cache[key] = savedModule;
  }
});

/* ───────────────────────── W — the browser code, by source (the CI backstop) ───────────────────────── */

test('W1: /assistant is a route, and it renders the My Assistant page (ui/src/pages/assistant/Index.jsx)', () => {
  const app = codeOnly(safeRead(APP));
  const imp = app.match(/import\s+(\w+)\s+from\s+['"]\.\/pages\/assistant\/Index(?:\.jsx)?['"]/);
  assert(fs.existsSync(PAGE), `${rel(PAGE)} does not exist. ADR 0004 creates the page there.`);
  assert(imp, 'App.jsx does not import the page from ./pages/assistant/Index');
  assert(new RegExp(`path:\\s*['"]/assistant['"]\\s*,\\s*element:\\s*<${imp[1]}\\b`).test(app),
    `App.jsx has no { path: '/assistant', element: <${imp[1]} /> } route — today /assistant, where "Assistant Management" points, renders "Page not found"`);
});

test('W2: the old address /tapestry/settings/assistant redirects to /assistant from a flat route — and the Settings page no longer has an "assistant" child that would tie with it', () => {
  const app = codeOnly(safeRead(APP));
  assert(/path:\s*['"]settings\/assistant['"]\s*,\s*element:\s*<Navigate\s+to=(?:["']\/assistant["']|\{\s*MY_ASSISTANT_PATH\s*\})\s+replace\b/.test(app),
    'App.jsx must have { path: \'settings/assistant\', element: <Navigate to="/assistant" replace /> } among the /tapestry children — ' +
    'outside the Settings page, whose Owner-only gate would stop a Customer\'s old link');
  assert(!/path:\s*['"]assistant['"]/.test(app),
    'the Settings page\'s own { path: \'assistant\' } child must go: it scores the same as the flat redirect (35), so which one matches would depend on array order');
});

test('W3: the profile editor has one host — only the My Assistant page imports AssistantProfileEditor; neither Settings area does', () => {
  const importers = jsFilesUnder(UI_SRC)
    .filter((f) => /import\s+\w+\s+from\s+['"][^'"]*\/AssistantProfileEditor(?:\.jsx)?['"]/.test(codeOnly(safeRead(f))))
    .map(rel)
    .sort();
  assert(j(importers) === j([rel(PAGE)]),
    `AC2 ("neither Settings area offers an editor of its own"): expected exactly [${rel(PAGE)}], got ${j(importers)}`);
});

test('W4: the "Edit Assistant profile" banner on the assistant\'s own profile page links to the My Assistant page', () => {
  const src = codeOnly(safeRead(USER_DETAIL));
  assert(!src.includes('/tapestry/settings/assistant'), 'UserDetail.jsx still links to /tapestry/settings/assistant — an Owner/Admin-only page, so a dead end for a Customer');
  assert(/\bto=(?:\{\s*MY_ASSISTANT_PATH\s*\}|["']\/assistant["'])/.test(src), 'AC2: the banner\'s link must go to MY_ASSISTANT_PATH ("/assistant")');
});

test('W5: the Tapestry Settings "Assistant Profile" tab opens the My Assistant page — it has a destination, not a panel', () => {
  const src = codeOnly(safeRead(TAPESTRY_SETTINGS));
  const entry = (src.match(/\{[^{}]*key:\s*['"]assistant['"][^{}]*\}/) || [''])[0];
  assert(entry, 'the Settings page has no { key: \'assistant\' } tab — AC2 keeps the tab as an entry point');
  assert(/\bto:\s*(?:MY_ASSISTANT_PATH|['"]\/assistant['"])/.test(entry), `the tab must carry to: MY_ASSISTANT_PATH — got ${entry.trim()}`);
  assert(!/\bpath:/.test(entry), `the tab has no path of its own, so it is never the active panel — got ${entry.trim()}`);
  const switchTab = functionText(parse(TAPESTRY_SETTINGS), 'switchTab');
  assert(/\.to\b/.test(switchTab), `switchTab must navigate to a tab's \`to\` when it has one — got ${switchTab.replace(/\s+/g, ' ')}`);
});

test('W6: the Brainstorm /settings page links to the My Assistant page in place of its editor', () => {
  const src = codeOnly(safeRead(BRAINSTORM_SETTINGS));
  assert(/href=(?:\{\s*MY_ASSISTANT_PATH\s*\}|["']\/assistant["'])/.test(src), 'AC2: /settings must offer a link to MY_ASSISTANT_PATH ("/assistant") — the card that held the editor');
});

test('W7: every avatar menu tells personalLinks who the viewer is — the classification decides whether "My Assistant\'s Profile" has somewhere to go', () => {
  const wrong = [];
  for (const [where, file] of Object.entries(MENUS)) {
    const calls = [];
    const sf = parse(file);
    if (sf) walk(sf, (n) => { if (ts().isCallExpression(n) && n.expression.getText() === 'personalLinks') calls.push(n); });
    const passes = (call) => {
      const arg = call.arguments[0];
      return arg && ts().isObjectLiteralExpression(arg)
        && arg.properties.some((prop) => prop.name && prop.name.getText() === 'classification');
    };
    if (calls.length === 0 || !calls.every(passes)) wrong.push(`${where}: ${calls.map((c) => c.getText().replace(/\s+/g, ' ')).join(' / ') || 'no personalLinks call'}`);
  }
  assert(wrong.length === 0, `AC3: an Admin with no assistant yet must find the item enabled, so each menu passes classification — missing in ${wrong.join('; ')}`);
});

test('W8: the editor offers the badged-avatar generator only when status.isOwner — an Admin would be stamped with the Owner\'s face, and a Customer is refused', () => {
  const verdict = renderedOnlyWhen(EDITOR, /Generate badged avatar/, ['status.isOwner']);
  assert(verdict.ok, `AC4 (ADR 0004 sub-decision 4): ${verdict.why}`);
});

test('W9: when the generator fails, only the proxy\'s "no-picture" answer reads as "no profile picture" — every other failure shows what the server said', () => {
  const body = codeOnly(functionText(parse(EDITOR), 'generateComposite'));
  assert(body, 'AssistantProfileEditor.jsx has no generateComposite');
  const code = body.search(/['"]no-picture['"]/);
  const copy = body.search(/no profile picture/i);
  assert(code >= 0, 'AC4: generateComposite must tell the proxy\'s "no-picture" answer apart — it never mentions that code');
  assert(copy < 0 || code < copy, 'the "no profile picture" copy must sit behind the no-picture check');
  assert(/\.error\b/.test(body), 'AC4 ("any failure says what actually happened"): the other failures must show the server\'s own error');
});

test('W10: with no key, only someone who may create an assistant is offered "Create my Tapestry Assistant key" — and the Owner is told the instance\'s key is missing', () => {
  const src = codeOnly(safeRead(EDITOR));
  assert(/function\s+AssistantProfileEditor\s*\(\s*\{[^}]*\bcanCreateAssistant\b/.test(src), 'the editor must take a canCreateAssistant prop (ADR 0004 § Implementation notes)');
  const create = renderedOnlyWhen(EDITOR, /Create my Tapestry Assistant key/, ['canCreateAssistant', 'props.canCreateAssistant']);
  assert(create.ok, `AC3/AC4: ${create.why}`);
  const owner = renderedOnlyWhen(EDITOR, /key is missing/i, ['status.isOwner']);
  assert(owner.ok, `AC4 (the Owner-copy fix): ${owner.why}`);
});

test('W11: after creating the key the editor tells its host, so the rest of the app learns about the new assistant', () => {
  const body = codeOnly(functionText(parse(EDITOR), 'provisionKey'));
  assert(/\bonAssistantCreated\b/.test(body), `provisionKey must call onAssistantCreated after a successful provision — got ${body.replace(/\s+/g, ' ').slice(0, 300)}`);
});

test('W12: sign-in state can be re-read quietly — AuthContext offers refreshUser, which re-reads the classification and never sets loading', () => {
  const src = codeOnly(safeRead(AUTH_CONTEXT));
  const body = codeOnly(functionText(parse(AUTH_CONTEXT), 'refreshUser'));
  assert(body, 'AuthContext.jsx has no refreshUser (ADR 0004 sub-decision 7)');
  assert(/\/api\/auth\/user-classification/.test(body), 'refreshUser must re-read /api/auth/user-classification');
  assert(!/\bsetLoading\s*\(/.test(body), 'refreshUser must not touch loading — pages gated on sign-in would unmount');
  assert(/value=\{\{[^}]*\brefreshUser\b[^}]*\}\}/.test(src), 'the provider\'s value must include refreshUser');
});

test('W13: the public-profile link goes to /user/‹assistant› — the profile page search results use — not the control panel\'s', () => {
  const src = codeOnly(safeRead(EDITOR));
  assert(src.includes('`/user/${status.assistantPubkey}`'), 'ADR 0004 sub-decision 6: the link must be `/user/${status.assistantPubkey}`');
  assert(!src.includes('`/tapestry/users/${status.assistantPubkey}`'), 'the editor still links to /tapestry/users/‹assistant›');
});

test('W14: the page wears the Brainstorm top bar, decides with the menu\'s own predicates, shows the viewer\'s own assistant, and never reads the instance TA', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  assert(/<TopBar\b/.test(src), 'the page renders <TopBar /> (the Brainstorm look, like /setup)');
  const fromMenu = src.match(/import\s*\{([^}]*)\}\s*from\s*['"][./]*config\/avatarMenuLinks(?:\.js)?['"]/);
  assert(fromMenu && /\bhasMyAssistantPage\b/.test(fromMenu[1]) && /\bmayCreateAssistant\b/.test(fromMenu[1]),
    'the page must take hasMyAssistantPage and mayCreateAssistant from config/avatarMenuLinks — one predicate for the menu and the page, so they cannot disagree');
  assert(/<AssistantProfileEditor\b[^>]*\bcustomerPubkey=\{\s*user\??\.pubkey\s*\}/.test(src), 'the editor is for user.pubkey — the viewer\'s own assistant (principle 1)');
  assert(/<AssistantProfileEditor\b[^>]*\bcanCreateAssistant=/.test(src) && /<AssistantProfileEditor\b[^>]*\bonAssistantCreated=/.test(src),
    'the page passes canCreateAssistant and onAssistantCreated to the editor');
  assert(/\blogin\b/.test(src), 'a visitor is asked to sign in (AC5)');
  assert(!/\btaPubkey\b|\buseConfig\b/.test(src), 'the page must never read the instance TA — whose assistant is the viewer\'s question');
});

test('W15: on an instance that is not public, the editor says no NIP-05 is published, and why (guard — the CI counterpart of story 3\'s B7)', () => {
  const src = codeOnly(safeRead(EDITOR));
  assert(/isPublicInstance\s*===\s*false/.test(src) && /no NIP-05 is published/.test(src),
    'the "NIP-05: none — … no NIP-05 is published" line, shown when status.isPublicInstance === false, is missing (ledger 2026-09-21-status-no-key-relay-gate-unpinned, item 2)');
});

test('W16: "Use this avatar" returns before touching the picture when the upload offers no public url (guard — the CI counterpart of story 3\'s B3)', () => {
  const body = codeOnly(functionText(parse(EDITOR), 'useComposite'));
  const check = body.search(/if\s*\(\s*!\s*data\??\.url\s*\)/);
  const use = body.search(/updateField\(\s*['"]picture['"]/);
  assert(check >= 0 && use > check && /return\b/.test(body.slice(check, use)),
    'useComposite must return early when data.url is empty — before any updateField(\'picture\', …) (ledger 2026-09-21-status-no-key-relay-gate-unpinned, item 2)');
});

// W17–W20 were added by assistant-profile #5, carried forward from ledger 2026-09-21-my-assistant-checks-browser-only:
// the CI-run counterparts of B1, B11, B12 and B16. Before them, each of the review's planted defects for those four
// passed every Node suite and was caught only by the browser class, which CI does not run (review 4, non-blocking 1).

/** Every JSX element (opening or self-closing) named `name` in `sf`. */
function jsxNamed(sf, name) {
  const out = [];
  if (sf) walk(sf, (n) => { if ((ts().isJsxOpeningElement(n) || ts().isJsxSelfClosingElement(n)) && n.tagName.getText() === name) out.push(n); });
  return out;
}

test('W17: the page keeps its visitor branch — "Sign in with nostr" is offered only when no one is signed in, and the editor only to someone who is (guard — the CI counterpart of B1)', () => {
  const signIn = renderedOnlyWhen(PAGE, /Sign in with nostr/, ['!user'], 'MyAssistantPage');
  assert(signIn.ok, `AC5: a visitor is asked to sign in, on the page itself — ${signIn.why}`);
  const editors = jsxNamed(parse(PAGE), 'AssistantProfileEditor');
  assert(editors.length >= 1, `${rel(PAGE)} renders no AssistantProfileEditor`);
  assert(editors.every((e) => guardedHere(e, ['user'])),
    'AC5 ("sees no one\'s assistant controls"): the editor must be reached only after the visitor branch — only when user is set');
});

test('W18: the editor is shown only to someone the page has something for — under hasMyAssistantPage(user), the avatar menu\'s own predicate (guard — the CI counterpart of B11)', () => {
  const editors = jsxNamed(parse(PAGE), 'AssistantProfileEditor');
  assert(editors.length >= 1, `${rel(PAGE)} renders no AssistantProfileEditor`);
  assert(editors.every((e) => guardedHere(e, ['hasMyAssistantPage(user)'])),
    'AC3 (ADR 0004 sub-decision 2): the page shows the editor exactly when hasMyAssistantPage(user) — a guest with no assistant gets the explanation, not an editor');
});

test('W19: after an assistant is created the app is told — the page hands the editor useAuth()\'s refreshUser as onAssistantCreated, and refreshUser takes the new assistantPubkey from the answer (guard — the CI counterpart of B12)', () => {
  const sf = parse(PAGE);
  let local = null;   // the page's own name for useAuth()'s refreshUser
  if (sf) walk(sf, (n) => {
    if (!(ts().isVariableDeclaration(n) && n.initializer && norm(n.initializer.getText()) === 'useAuth()' && ts().isObjectBindingPattern(n.name))) return;
    for (const el of n.name.elements) {
      if ((el.propertyName ? el.propertyName.getText() : el.name.getText()) === 'refreshUser') local = el.name.getText();
    }
  });
  assert(local, 'ADR 0004 sub-decision 7: the page takes refreshUser from useAuth()');
  const handed = jsxNamed(sf, 'AssistantProfileEditor').map((e) => {
    const a = e.attributes.properties.find((p) => ts().isJsxAttribute(p) && p.name.getText() === 'onAssistantCreated');
    return a && a.initializer && ts().isJsxExpression(a.initializer) && a.initializer.expression ? norm(a.initializer.expression.getText()) : null;
  });
  assert(handed.length >= 1 && handed.every((h) => h === local),
    `AC3: the page must pass onAssistantCreated={${local}} — got ${j(handed)}`);
  const body = codeOnly(functionText(parse(AUTH_CONTEXT), 'refreshUser'));
  assert(/\bsetUser\s*\(/.test(body) && /\bassistantPubkey\s*:\s*data\??\.assistantPubkey\b/.test(body),
    `ADR 0004 sub-decision 7: refreshUser must set assistantPubkey from the answer (data.assistantPubkey), so the menus and the dashboard see the new assistant — got ${body.replace(/\s+/g, ' ').slice(0, 300)}`);
});

test('W20: the "no profile picture" copy shows only for the proxy\'s 404 that says code "no-picture" — both conditions, not either one (guard — the CI counterpart of B16)', () => {
  const status = renderedOnlyWhen(EDITOR, /no profile picture to stamp/i, ['res.status===404']);
  const code = renderedOnlyWhen(EDITOR, /no profile picture to stamp/i, ["body.code==='no-picture'", 'body.code==="no-picture"']);
  assert(status.ok && code.ok,
    `AC4 (ADR 0004 sub-decision 5: "only for res.status === 404 && body?.code === 'no-picture'") — ${[status, code].filter((v) => !v.ok).map((v) => v.why).join('; ')}`);
});

async function run() {
  console.log('\n=== my-assistant-page (assistant-profile #4) ===');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nmy-assistant-page: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail === 0 ? 0 : 1));
}
