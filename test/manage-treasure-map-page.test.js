'use strict';
/**
 * manage-treasure-map #1: the Manage your Treasure Map page, its menu links, and the Advanced placeholder.
 *
 * Story: engineering-team/stories/done/manage-treasure-map/1-the-manage-your-treasure-map-page.md
 * ADR:   engineering-team/decisions/done/manage-treasure-map/0001-a-design-page-on-the-shared-strict-map-read.md
 * Plan:  engineering-team/stories/done/manage-treasure-map/1-the-manage-your-treasure-map-page.test-plan.md
 * Browser half: tests/brainstorm/manage-treasure-map.spec.js (what a viewer SEES: the pages, the panel's phases, the
 * FAQ, the menus, direct loads, 375 px).
 *
 * Classes:
 *   M — the menu list ui/src/config/avatarMenuLinks.js: the three addresses, and My Treasure Map's target picked by
 *       the menu's profileBase (ADR sub-decisions 1–2).                                                   [AC-1]
 *   V — the pure view-model ui/src/pages/treasure-map/manageTreasureMap.js, loaded in Node: every word of § Copy,
 *       the FAQ, the raw text, and which phase the raw Treasure Map panel is in (ADR sub-decision 4).  [AC-2..AC-6]
 *   A — the My Assistants page's Treasure Map link follows the Brainstorm menus (ADR sub-decision 3).      [AC-6]
 *   D — source sentinels on the JSX this runner cannot execute: the routes outside /tapestry, the strict shared read
 *       keyed on the session, the links read from their owner, nothing signed, published or stored, no Edit/Save,
 *       the design frame.                                                                       [AC-2, AC-4..AC-6]
 *   R0 — regressions that pass before and after: the three menus' profileBase values, the Tapestry side's links, and
 *       both addresses served the app (not blocked as probes), so a direct load reaches the router.  [AC-1, AC-2, AC-5, AC-6]
 *   H — the live contract on whatever instance is reachable (BRAINSTORM_BASE_URL, else localhost:7778): both
 *       addresses answer the app. Skips when nothing answers, or on a Node without fetch.
 *
 * Everything except R0 and H FAILS against the current code: avatarMenuLinks.js exports none of the three addresses
 * and sends every menu's My Treasure Map to the TA page; ui/src/pages/treasure-map/ does not exist; App.jsx has no
 * route for it; myAssistants.js's TREASURE_MAP_PATH is the TA page.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const MENU = path.join(REPO, 'ui/src/config/avatarMenuLinks.js');
const VIEW_MODEL = path.join(REPO, 'ui/src/pages/treasure-map/manageTreasureMap.js');
const PAGE = path.join(REPO, 'ui/src/pages/treasure-map/Index.jsx');
const ADVANCED = path.join(REPO, 'ui/src/pages/treasure-map/Advanced.jsx');
const APP = path.join(REPO, 'ui/src/App.jsx');
const MA_VIEW_MODEL = path.join(REPO, 'ui/src/pages/assistants/myAssistants.js');
const HEADER = path.join(REPO, 'ui/src/components/Header.jsx');
const BS_MENU = path.join(REPO, 'ui/src/components/BrainstormUserMenu.jsx');
const LANDING = path.join(REPO, 'ui/src/pages/BrainstormSearch.jsx');
const LAYOUT = path.join(REPO, 'ui/src/components/Layout.jsx');
const CURATED = path.join(REPO, 'ui/src/pages/grapevine/MyCuratedDLists.jsx');
const TA_LIST = path.join(REPO, 'ui/src/pages/grapevine/TrustedAssertionsList.jsx');
const SITE_TRUST = path.join(REPO, 'src/utils/siteTrust.js');
const HOST_BASE = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';
const NL = String.fromCharCode(10);

const NEW_PAGE = '/treasure-map';
const ADVANCED_PAGE = '/treasure-map/advanced';
const TA_PAGE = '/tapestry/grapevine/treasure-map';

// Fixture keys, never live ones.
const VIEWER = 'a1'.repeat(32);
const LOCAL = 'a2'.repeat(32);
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);

/** Source with comments removed, leaving `https://` inside strings intact. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}

async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { return await import(`${pathToFileURL(absPath).href}?t=${Date.now()}`); } catch (err) {
    throw new Error(`${rel(absPath)} could not be loaded in Node: ${err.message}`);
  }
}
const menu = () => esm(MENU, 'the avatar menu list');
const vm = () => esm(VIEW_MODEL, 'ADR 0001 sub-decision 4: the pure view-model, loadable in Node.');
function need(mod, name, file, what) {
  assert(mod && typeof mod[name] !== 'undefined', `${rel(file)} does not export ${name}. ${what}`);
  return mod[name];
}

// ── Reading JSX structure (the root `typescript` dependency's parser — a library call, not a lint step) ─────────

let tsLib = null;
function ts() {
  if (!tsLib) {
    try { tsLib = require('typescript'); } catch (err) {
      throw new Error(`test/manage-treasure-map-page.test.js parses JSX with the root "typescript" dependency and could not load it (${err.message}).`);
    }
  }
  return tsLib;
}
function parse(file) {
  const src = safeRead(file);
  return src ? ts().createSourceFile(file, src, ts().ScriptTarget.Latest, true, ts().ScriptKind.JSX) : null;
}
function walk(node, visit) { visit(node); ts().forEachChild(node, (child) => walk(child, visit)); }
/** The `path:` property's initializer text of an object literal, or null. */
function pathOf(obj) {
  const prop = obj.properties.find((p) => p.name && p.name.getText() === 'path');
  return prop && prop.initializer ? prop.initializer.getText() : null;
}

/** Every string a value holds, however deeply nested (COPY's keys are the Implementer's; its words are the story's). */
function stringsIn(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (typeof value === 'function') { /* a word that takes an argument isn't one of § Copy's fixed strings */ }
  else if (Array.isArray(value)) value.forEach((v) => stringsIn(v, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => stringsIn(v, out));
  return out;
}

const PEOPLE = [
  { classification: 'owner', assistantPubkey: LOCAL },
  { classification: 'admin', assistantPubkey: LOCAL },
  { classification: 'customer', assistantPubkey: LOCAL },
  { classification: 'customer', assistantPubkey: null },
  { classification: 'guest', assistantPubkey: null },
];

// The story's § Copy, word for word (curly apostrophes, as the story says).
const COPY_WORDS = {
  kicker: 'Treasure Map',
  intro: 'Your Treasure Map tells other apps where to find the insights your Assistant gathers from your trusted community — who to trust, what’s worth your attention, and how your community organizes ideas. Brainstorm keeps it up to date for you.',
  faqButton: 'Frequently asked questions',
  rawShow: 'View the raw Treasure Map',
  rawHide: 'Hide the raw Treasure Map',
  chip: 'kind 10040',
  noneTitle: 'No Treasure Map found',
  noneLine: 'We couldn’t locate a kind 10040 event for your profile on your relays.',
  loading: 'Loading your Treasure Map…',
  error: 'Couldn’t read your Treasure Map.',
  retry: 'Try again',
  signedOut: 'Sign in to see your Treasure Map.',
  signIn: 'Sign in with nostr',
  advancedPrompt: 'Need fine-grained control over every entry?',
  advancedKicker: 'Treasure Map · Advanced',
  backLink: 'Manage your Treasure Map',
};
const FAQ_WORDS = [
  ['What is a Treasure Map?', 'A public record that points other nostr apps to the insights your Assistant calculates for you, so every app you use can benefit from your trusted community.'],
  ['Do I need to do anything?', 'Not usually. Brainstorm creates your Treasure Map during setup and keeps it current. You only need to sign again when something important changes.'],
  ['Who can see it?', 'Anyone. It’s published to relays like any other nostr event, so any app can read it.'],
  ['What’s on the Advanced page?', 'Every individual entry in your Treasure Map — scores, lists, and concepts — along with which Assistant provides each one. Most people never need it.'],
];

const MAP = {
  id: '9'.repeat(64), pubkey: VIEWER, created_at: 1790121600, kind: 10040, content: '',
  tags: [['30392', B, 'wss://two.example'], ['30382:rank', A, 'wss://one.example'], ['39998:dlist-header', A, 'wss://one.example'], ['30382:followers', B, 'wss://two.example']],
  sig: 'f'.repeat(128),
};

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// M — the menu (AC-1)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('M1: the menu module names the three addresses — /treasure-map, /treasure-map/advanced, and the TA Treasure Map page', async () => {
  const m = await menu();
  const want = { MANAGE_TREASURE_MAP_PATH: NEW_PAGE, TREASURE_MAP_ADVANCED_PATH: ADVANCED_PAGE, TA_TREASURE_MAP_PATH: TA_PAGE };
  const wrong = Object.entries(want).filter(([k, v]) => m[k] !== v).map(([k, v]) => `${k}: want ${show(v)}, got ${show(m[k])}`);
  assert(wrong.length === 0, `ADR 0001 sub-decision 1: ${wrong.join('; ')}`);
});

test('M2: the Brainstorm menus (profileBase /user) send My Treasure Map to /treasure-map; the Tapestry menu (/tapestry/users) to the TA page', async () => {
  const { personalLinks } = await menu();
  const wrong = [];
  for (const person of PEOPLE) {
    for (const [profileBase, want] of [['/user', NEW_PAGE], ['/tapestry/users', TA_PAGE]]) {
      const links = personalLinks({ pubkey: VIEWER, ...person, profileBase });
      const item = links.find((l) => l && l.key === 'my-treasure-map');
      if (!item) { wrong.push(`${profileBase} ${show(person)}: no my-treasure-map entry`); continue; }
      if (item.to !== want) wrong.push(`${profileBase} ${show(person)}: want ${want}, got ${show(item.to)}`);
    }
  }
  assert(wrong.length === 0, `AC-1: ${wrong.join('; ')}`);
});

test('M3: My Treasure Map keeps its label, icon and place in both menus — only its target differs', async () => {
  const { personalLinks } = await menu();
  const shapes = ['/user', '/tapestry/users'].map((profileBase) => {
    const links = personalLinks({ pubkey: VIEWER, classification: 'customer', assistantPubkey: LOCAL, profileBase });
    const i = links.findIndex((l) => l && l.key === 'my-treasure-map');
    return { profileBase, i, label: links[i] && links[i].label, icon: links[i] && links[i].icon, keys: links.map((l) => l.key) };
  });
  for (const s of shapes) {
    assert(s.label === 'My Treasure Map' && s.icon === '🗺️', `${s.profileBase}: want "🗺️ My Treasure Map", got ${show([s.icon, s.label])}`);
    assert(s.i === 2, `${s.profileBase}: My Treasure Map stays third, after My Profile and My Assistant's Profile; got index ${s.i} in ${show(s.keys)}`);
  }
  assert(show(shapes[0].keys) === show(shapes[1].keys), `both menus list the same items in the same order; got ${show(shapes[0].keys)} vs ${show(shapes[1].keys)}`);
});

test('M4: exactly one item in each menu opens a Treasure Map page — the new page in the Brainstorm menus, never both', async () => {
  const { personalLinks } = await menu();
  for (const profileBase of ['/user', '/tapestry/users']) {
    const links = personalLinks({ pubkey: VIEWER, classification: 'customer', assistantPubkey: LOCAL, profileBase });
    const maps = links.filter((l) => l && (l.to === NEW_PAGE || l.to === TA_PAGE));
    assert(maps.length === 1, `${profileBase}: one Treasure Map item; got ${show(maps)}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// V — the view-model (AC-2 … AC-6)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('V1: COPY holds every fixed word of § Copy, exactly, with curly apostrophes', async () => {
  const mod = await vm();
  const COPY = need(mod, 'COPY', VIEW_MODEL, 'ADR 0001 sub-decision 4: every string in § Copy.');
  const all = stringsIn(COPY).map((s) => s.trim());
  const missing = Object.entries(COPY_WORDS).filter(([, w]) => !all.includes(w)).map(([k, w]) => `${k}: ${show(w)}`);
  assert(missing.length === 0, `COPY is missing (or words differ from) § Copy's: ${missing.join('; ')}`);
  const straight = all.filter((s) => /[A-Za-z]'[A-Za-z]/.test(s));
  assert(straight.length === 0, `§ Copy's apostrophes are curly (’); straight ones in ${show(straight)}`);
});

test('V2: FAQS are the four questions and answers, in the story’s order', async () => {
  const mod = await vm();
  const FAQS = need(mod, 'FAQS', VIEW_MODEL, 'ADR 0001 sub-decision 4: the four { q, a } pairs.');
  assert(Array.isArray(FAQS) && FAQS.length === 4, `want 4 FAQs, got ${show(FAQS)}`);
  FAQ_WORDS.forEach(([q, a], i) => {
    const f = FAQS[i] || {};
    assert(f.q === q, `FAQ ${i + 1}: question want ${show(q)}, got ${show(f.q)}`);
    assert(f.a === a, `FAQ ${i + 1}: answer want ${show(a)}, got ${show(f.a)}`);
  });
});

test('V3: the raw panel’s phase — signed out without a user; loading while sign-in or the read is pending; then found, none or error as the read answered', async () => {
  const mod = await vm();
  const mapPanelPhase = need(mod, 'mapPanelPhase', VIEW_MODEL, 'ADR 0001 sub-decision 4.');
  const user = { pubkey: VIEWER };
  const rows = [
    // [authLoading, user, status] → phase
    [true, null, 'idle', 'loading'],
    [true, user, 'found', 'loading'],
    [true, user, 'none', 'loading'],
    [false, null, 'idle', 'signed-out'],
    [false, null, 'none', 'signed-out'],
    [false, null, 'found', 'signed-out'],
    [false, user, 'idle', 'loading'],
    [false, user, 'loading', 'loading'],
    [false, user, 'found', 'found'],
    [false, user, 'none', 'none'],
    [false, user, 'error', 'error'],
  ];
  const wrong = [];
  for (const [authLoading, u, status, want] of rows) {
    let got;
    try { got = mapPanelPhase({ authLoading, user: u, status }); } catch (err) { got = `threw ${err.message}`; }
    if (got !== want) wrong.push(`authLoading=${authLoading} user=${u ? 'yes' : 'no'} status=${status}: want ${want}, got ${show(got)}`);
  }
  assert(wrong.length === 0, `AC-4/AC-6: ${wrong.join('; ')}`);
});

test('V4: the panel never says "none" unless a signed-in read answered none — an unknown or missing status is still loading', async () => {
  const { mapPanelPhase } = await vm();
  assert(typeof mapPanelPhase === 'function', 'mapPanelPhase is not exported');
  for (const status of [undefined, null, '', 'weird', 'NONE']) {
    let got;
    try { got = mapPanelPhase({ authLoading: false, user: { pubkey: VIEWER }, status }); } catch (err) { got = `threw ${err.message}`; }
    assert(got === 'loading', `status ${show(status)}: want "loading" (never claim no Map before a read said so), got ${show(got)}`);
  }
});

test('V5: the raw text is the whole event as found — every field, the tags in the Map’s order, indented', async () => {
  const mod = await vm();
  const rawMapText = need(mod, 'rawMapText', VIEW_MODEL, 'ADR 0001 sub-decision 4.');
  const text = rawMapText(MAP);
  assert(typeof text === 'string' && text.length > 0, `want text, got ${show(text)}`);
  let back = null;
  try { back = JSON.parse(text); } catch (err) { throw new Error(`the raw text is not JSON: ${err.message}`); }
  assert(show(back) === show(MAP), `the raw text must be the event as found (same fields, same order of tags); got ${text}`);
  assert(text.includes(`${NL}  "`), `the raw text is indented (two spaces); got ${show(text.slice(0, 60))}`);
});

test('V6: no event, no text', async () => {
  const { rawMapText } = await vm();
  assert(typeof rawMapText === 'function', 'rawMapText is not exported');
  for (const ev of [null, undefined]) assert(rawMapText(ev) === '', `rawMapText(${ev}) should be '', got ${show(rawMapText(ev))}`);
});

test('V7: the view-model loads in Node — no React import, nothing that signs, publishes or stores', () => {
  const src = codeOnly(safeRead(VIEW_MODEL));
  assert(src, `${rel(VIEW_MODEL)} does not exist`);
  assert(!/from\s+['"]react['"]/.test(src), `${rel(VIEW_MODEL)} imports React; ADR 0001 sub-decision 4: it is pure`);
  const bad = src.match(/\b(signEvent\s*\(|publish\w*\s*\(|fetch\s*\(|localStorage|sessionStorage)/);
  assert(!bad, `${rel(VIEW_MODEL)} uses ${bad && bad[1]}; it only shapes words and phases`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// A — the My Assistants page's links (AC-6)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('A1: the My Assistants page’s Treasure Map link — introduction, Manage, Duties tab — now opens /treasure-map', async () => {
  const mod = await esm(MA_VIEW_MODEL, 'the My Assistants view-model');
  assert(mod.TREASURE_MAP_PATH === NEW_PAGE, `ADR 0001 sub-decision 3: myAssistants.js TREASURE_MAP_PATH should follow the Brainstorm menus to ${NEW_PAGE}; got ${show(mod.TREASURE_MAP_PATH)}`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// D — UI source sentinels (JSX this runner cannot execute)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('D1: App.jsx routes both addresses to the two pages, from the menu module’s constants, outside the /tapestry tree', () => {
  const src = codeOnly(safeRead(APP));
  assert(/from\s+['"]\.\/pages\/treasure-map\/Index(\.jsx)?['"]/.test(src), `${rel(APP)} does not import pages/treasure-map/Index`);
  assert(/from\s+['"]\.\/pages\/treasure-map\/Advanced(\.jsx)?['"]/.test(src), `${rel(APP)} does not import pages/treasure-map/Advanced`);
  const sf = parse(APP);
  const found = {};
  walk(sf, (n) => {
    if (!ts().isObjectLiteralExpression(n)) return;
    const p = pathOf(n);
    if (p !== 'MANAGE_TREASURE_MAP_PATH' && p !== 'TREASURE_MAP_ADVANCED_PATH') return;
    const el = n.properties.find((q) => q.name && q.name.getText() === 'element');
    let nested = false;
    for (let up = n.parent; up; up = up.parent) {
      if (ts().isObjectLiteralExpression(up) && /^['"]\/tapestry['"]$/.test(pathOf(up) || '')) nested = true;
    }
    found[p] = { element: el ? el.initializer.getText() : '', nested };
  });
  const want = { MANAGE_TREASURE_MAP_PATH: 'ManageTreasureMapPage', TREASURE_MAP_ADVANCED_PATH: 'TreasureMapAdvancedPage' };
  const wrong = [];
  for (const [p, comp] of Object.entries(want)) {
    if (!found[p]) { wrong.push(`no { path: ${p} } route`); continue; }
    if (!new RegExp(`<${comp}\\b`).test(found[p].element)) wrong.push(`${p} → ${found[p].element || 'no element'}, want <${comp} />`);
    if (found[p].nested) wrong.push(`${p} is inside the /tapestry tree; it belongs beside /assistants`);
  }
  assert(wrong.length === 0, `ADR 0001 sub-decision 7: ${wrong.join('; ')}`);
});

test('D2: the page reads the Map through the shared hook, strictly, keyed on the session’s user — never a route or query parameter', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  assert(/import\s+useTreasureMap\s+from\s+['"][^'"]*hooks\/useTreasureMap(\.js)?['"]/.test(src), `${rel(PAGE)} should import the shared useTreasureMap hook (AC-4: the same places /assistants looks)`);
  assert(/useTreasureMap\([^)]*strict\s*:\s*true/.test(src), `${rel(PAGE)} should call useTreasureMap(…, { strict: true }) as /assistants does`);
  assert(/useAuth\(/.test(src), `${rel(PAGE)} should take the viewer from useAuth()`);
  const param = src.match(/\b(useParams|useSearchParams|location\.search|URLSearchParams)\b/);
  assert(!param, `${rel(PAGE)} uses ${param && param[1]}; whose Map is shown comes from the session only (AC-4)`);
});

test('D3: the pages read their addresses from the menu module — no re-typed /treasure-map or TA path', () => {
  const page = codeOnly(safeRead(PAGE));
  const adv = codeOnly(safeRead(ADVANCED));
  const model = codeOnly(safeRead(VIEW_MODEL));
  assert(page && adv, `${rel(PAGE)} and ${rel(ADVANCED)} must both exist`);
  const literal = /['"`]\/(tapestry\/grapevine\/)?treasure-map(\/advanced)?['"`]/;
  for (const [file, src] of [[PAGE, page], [ADVANCED, adv], [VIEW_MODEL, model]]) {
    const hit = src.match(literal);
    assert(!hit, `${rel(file)} re-types ${hit && hit[0]}; read it from avatarMenuLinks.js (ADR 0001 sub-decision 1)`);
  }
  assert(/TREASURE_MAP_ADVANCED_PATH/.test(page) && /config\/avatarMenuLinks/.test(page), `${rel(PAGE)} should link Advanced management to TREASURE_MAP_ADVANCED_PATH`);
  assert(/MANAGE_TREASURE_MAP_PATH/.test(adv) && /TA_TREASURE_MAP_PATH/.test(adv) && /config\/avatarMenuLinks/.test(adv),
    `${rel(ADVANCED)} should link back to MANAGE_TREASURE_MAP_PATH and on to TA_TREASURE_MAP_PATH`);
});

// D4's title narrowed at treasure-map-edit #5's Test Design: Save (story 5) signs and publishes through useMapSave
// (ADR treasure-map-edit/0005), so the page files themselves still never do.
test('D4: neither page file signs, publishes or stores anything itself', () => {
  const wrong = [];
  for (const file of [PAGE, ADVANCED]) {
    const src = codeOnly(safeRead(file));
    if (!src) { wrong.push(`${rel(file)} does not exist`); continue; }
    const imp = src.match(/from\s+['"][^'"]*(publish\w*|signerGuard|nostrPublish|assistantActions|dispositionActions)[^'"]*['"]/i);
    if (imp) wrong.push(`${rel(file)} imports ${imp[0]}`);
    const call = src.match(/\b(signEvent|getActiveSigner\w*|publish\w*\(|localStorage|sessionStorage)/);
    if (call) wrong.push(`${rel(file)} uses ${call[1]}`);
    if (/method\s*:\s*['"](POST|PUT|PATCH|DELETE)['"]/i.test(src)) wrong.push(`${rel(file)} sends a non-GET request`);
  }
  assert(wrong.length === 0, `AC-6: in no state does either page publish, sign or store anything — ${wrong.join('; ')}`);
});

// Re-aimed at treasure-map-edit #5's Test Design: Save changes arrives with story 5, in COPY.edit like Edit mode's
// other words, so the page offers it through COPY.edit.save and never types it itself.
test('D5 (treasure-map-edit #5): the page offers Save changes through COPY.edit.save, never as its own literal', () => {
  const sf = parse(PAGE);
  assert(sf, `${rel(PAGE)} does not exist`);
  const texts = [];
  walk(sf, (n) => {
    if (ts().isJsxText(n)) texts.push(n.getText().trim());
    if (ts().isStringLiteral(n) || ts().isNoSubstitutionTemplateLiteral(n)) texts.push(n.text.trim());
  });
  const bad = texts.filter((t) => /^Save changes$/.test(t));
  assert(bad.length === 0, `${rel(PAGE)} types Save changes itself ${show(bad)}; the words live in COPY.edit`);
  assert(/COPY\.edit\.save\b/.test(safeRead(PAGE)), `${rel(PAGE)} doesn't offer COPY.edit.save (treasure-map-edit #5)`);
});

test('D6: both pages sit in the shared Brainstorm design frame, in its default (720 px) column', () => {
  const wrong = [];
  for (const file of [PAGE, ADVANCED]) {
    const src = codeOnly(safeRead(file));
    if (!src) { wrong.push(`${rel(file)} does not exist`); continue; }
    if (!/import\s+BrainstormDesignShell\b[^;]*from\s+['"][^'"]*components\/BrainstormDesignShell(\.jsx)?['"]/.test(src)) wrong.push(`${rel(file)} does not import BrainstormDesignShell`);
    if (!/<BrainstormDesignShell\b/.test(src)) wrong.push(`${rel(file)} does not render <BrainstormDesignShell>`);
    if (/<BrainstormDesignShell\b[^>]*\bwide\b/.test(src)) wrong.push(`${rel(file)} asks for the wide column; the blueprint's is 720 px`);
  }
  assert(wrong.length === 0, `ADR 0001 sub-decisions 5–6: ${wrong.join('; ')}`);
});

test('D7: the Advanced placeholder reads no data — no Treasure Map read, no fetch', () => {
  const src = codeOnly(safeRead(ADVANCED));
  assert(src, `${rel(ADVANCED)} does not exist`);
  const reads = src.match(/\b(useTreasureMap|useCypher|fetch\(|queryRelay|fetchProfilesChunked)\b/);
  assert(!reads, `${rel(ADVANCED)} uses ${reads && reads[1]}; AC-5: it reads nothing`);
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// R0 — regressions that pass before and after
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('R0-1: each avatar menu still says which shell it is in — the Tapestry header passes /tapestry/users, the two Brainstorm menus /user', () => {
  const want = [[HEADER, '/tapestry/users'], [BS_MENU, '/user'], [LANDING, '/user']];
  const wrong = [];
  for (const [file, base] of want) {
    const src = codeOnly(safeRead(file));
    const calls = src.match(/personalLinks\(\{[\s\S]*?\}\)/g) || [];
    if (calls.length === 0) { wrong.push(`${rel(file)}: no personalLinks({ … }) call`); continue; }
    for (const c of calls) {
      const m = c.match(/profileBase\s*:\s*['"]([^'"]*)['"]/);
      if (!m || m[1] !== base) wrong.push(`${rel(file)}: profileBase ${m ? show(m[1]) : 'missing'}, want ${show(base)}`);
    }
  }
  assert(wrong.length === 0, `ADR 0001 sub-decision 2 keys My Treasure Map on profileBase: ${wrong.join('; ')}`);
});

test('R0-2: the Tapestry side’s links to the TA Treasure Map page don’t move — the sidebar, My Curated DLists, the TA list', () => {
  const wrong = [];
  if (!safeRead(LAYOUT).includes(`{ to: '${TA_PAGE}', label: 'TA Treasure Map' }`)) wrong.push(`${rel(LAYOUT)}: the sidebar's TA Treasure Map item`);
  if (!new RegExp(`TREASURE_MAP_PATH\\s*=\\s*['"]${TA_PAGE}['"]`).test(safeRead(CURATED))) wrong.push(`${rel(CURATED)}: its TREASURE_MAP_PATH`);
  if (!safeRead(TA_LIST).includes(`"${TA_PAGE}"`)) wrong.push(`${rel(TA_LIST)}: its link`);
  assert(wrong.length === 0, `AC-6: the Tapestry side keeps opening ${TA_PAGE} — changed: ${wrong.join('; ')}`);
});

test('R0-3: neither address is blocked as a probe, so the server serves the app and a direct load or refresh reaches the router', () => {
  const { isBlockedProbePath } = require(SITE_TRUST);
  for (const p of [NEW_PAGE, ADVANCED_PAGE, `${NEW_PAGE}/`, `${ADVANCED_PAGE}/`]) {
    assert(isBlockedProbePath(p) === false, `isBlockedProbePath(${show(p)}) should be false (AC-2, AC-5: never "Page not found")`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// H — live contract (skips when nothing answers)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

let hExecuted = 0;
let hSkipped = 0;
async function live(pathname) {
  if (typeof fetch !== 'function') return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 4000);
  try { return await fetch(`${HOST_BASE}${pathname}`, { signal: ctl.signal, headers: { accept: 'text/html' } }); } catch { return null; } finally { clearTimeout(timer); }
}

for (const p of [NEW_PAGE, ADVANCED_PAGE]) {
  test(`H (R0): live — ${p} is served the app, so a direct load or refresh reaches the router`, async () => {
    const res = await live(p);
    if (!res) { hSkipped++; return 'SKIP'; }
    hExecuted++;
    const text = await res.text();
    assert(res.status === 200 && /<div id="root"/.test(text), `${HOST_BASE}${p}: got ${res.status}, ${text.slice(0, 80)}`);
  });
}

async function run() {
  console.log(`${NL}=== manage-treasure-map-page (manage-treasure-map #1) ===`);
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
  console.log(`manage-treasure-map-page: H-class ${hExecuted} executed / ${hSkipped} skipped`);
  if (hSkipped > 0 && hExecuted === 0) {
    console.log('manage-treasure-map-page: !! LIVE COVERAGE DID NOT RUN — stack unreachable (or no fetch on this Node).');
    if (process.env.TAPESTRY_REQUIRE_LIVE === '1') {
      failures.push({ name: 'live coverage', message: 'TAPESTRY_REQUIRE_LIVE=1 but the whole H-class skipped.' });
      fail++;
    }
  }
  console.log(`${NL}manage-treasure-map-page: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped, hExecuted, hSkipped };
}

module.exports = { run };
