'use strict';
/**
 * tagging-edges #4: the tagging pipeline panel — source-level sentinels (PS-class).
 *
 * Story: engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md (AC-1, AC-5, AC-6)
 * ADR:   engineering-team/decisions/tagging-edges/0004-tagging-pipeline-panel.md
 *        § UI, § Seams for Test Design ("Static checks on the panel's source"), § Clarifications T9
 *
 * What it reads (stack-free, no request to any host):
 *   - the panel folder, ui/src/pages/settings/taggingPipeline/ (every .jsx / .js under it);
 *   - ui/src/utils/taggingPipelineView.js and ui/src/utils/taggingPipelineFetch.js;
 *   - ui/src/pages/settings/RelaySettings.jsx (the sub-tab wiring, and today's five sub-tabs);
 *   - ui/src/styles.css (nothing added for the panel).
 *
 * JSX structure is read with the root `typescript` package's parser (createSourceFile(..., ScriptKind.JSX)), the
 * house parser (test/assistant-alert.test.js) — a library call, not a lint step. Code-only text (comments removed)
 * comes from the same package's printer with removeComments, so a URL's "//" or JSX text is never mistaken for a
 * comment.
 *
 * Against the tree before the Implementer (88af7df3): the tests that pin today's RelaySettings sub-tabs, imports and
 * render lines, and today's styles.css, PASS; every test about the new files fails by name ("… not implemented yet").
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const PANEL_DIR = path.join(REPO, 'ui/src/pages/settings/taggingPipeline');
const PANEL = path.join(PANEL_DIR, 'TaggingPipelinePanel.jsx');
const VIEW = path.join(REPO, 'ui/src/utils/taggingPipelineView.js');
const FETCH = path.join(REPO, 'ui/src/utils/taggingPipelineFetch.js');
const RELAY = path.join(REPO, 'ui/src/pages/settings/RelaySettings.jsx');
const STYLES = path.join(REPO, 'ui/src/styles.css');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
const rel = (p) => path.relative(REPO, p);
const j = (v) => JSON.stringify(v);

// ─── the house parser ─────────────────────────────────────────────────────────────────────────────────────────────
let tsLib = null;
function ts() { if (!tsLib) tsLib = require('typescript'); return tsLib; }
const parsed = new Map();
function parse(file) {
  if (!parsed.has(file)) {
    const src = safeRead(file);
    const kind = file.endsWith('.jsx') ? ts().ScriptKind.JSX : ts().ScriptKind.JS;
    parsed.set(file, src == null ? null : ts().createSourceFile(file, src, ts().ScriptTarget.Latest, true, kind));
  }
  return parsed.get(file);
}
function walk(node, visit) { visit(node); ts().forEachChild(node, (child) => walk(child, visit)); }
function codeOnly(sf) { return ts().createPrinter({ removeComments: true }).printFile(sf); }
function lineOf(sf, node) { return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1; }
function where(sf, node) { return `${rel(sf.fileName)}:${lineOf(sf, node)}`; }
function unparen(n) { while (n && ts().isParenthesizedExpression(n)) n = n.expression; return n; }
function propName(p) {
  const t = ts();
  if (!p || !p.name) return null;
  if (t.isIdentifier(p.name) || t.isStringLiteral(p.name) || t.isNumericLiteral(p.name)) return p.name.text;
  return null;
}
function calleeName(call) {
  const t = ts();
  const c = call.expression;
  if (t.isIdentifier(c)) return c.text;
  if (t.isPropertyAccessExpression(c)) return c.name.text;
  return null;
}

// ─── the files under check ────────────────────────────────────────────────────────────────────────────────────────
function listDir(dir) {
  let out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(listDir(p) || []);
    else out.push(p);
  }
  return out;
}
function notYet(file, what) {
  return new Error(`${rel(file)} not implemented yet: ${what}`);
}
/** The panel folder's .jsx/.js files; throws by name while the folder or the panel is missing. */
function panelFiles() {
  const all = listDir(PANEL_DIR);
  if (all == null) throw notYet(PANEL_DIR, 'the panel folder does not exist (ADR 0004 § UI: ui/src/pages/settings/taggingPipeline/TaggingPipelinePanel.jsx)');
  if (!all.includes(PANEL)) throw notYet(PANEL, 'the folder holds no TaggingPipelinePanel.jsx (ADR 0004 § UI)');
  return all.filter((p) => /\.(jsx|js)$/.test(p));
}
/** The panel folder plus the two utils — the static checks' scope (ADR 0004 § Seams "Static checks"). */
function scopeFiles() {
  const missing = [VIEW, FETCH].filter((p) => safeRead(p) == null);
  let folder = [];
  let folderErr = null;
  try { folder = panelFiles(); } catch (e) { folderErr = e; }
  if (folderErr || missing.length) {
    const parts = [];
    if (folderErr) parts.push(folderErr.message);
    for (const m of missing) parts.push(`${rel(m)} not implemented yet: the file does not exist (ADR 0004 § UI)`);
    throw new Error(`the static checks have nothing to scan yet — ${parts.join('; ')}`);
  }
  return folder.concat([VIEW, FETCH]);
}

// ─── literal text in a file: strings, templates (with ${} holes), JSX text ────────────────────────────────────────
/** Every piece of literal text in a source file, with where it sits. Templates are rebuilt with "${}" holes. */
function literalTexts(sf) {
  const t = ts();
  const out = [];
  walk(sf, (n) => {
    if (t.isStringLiteral(n) || t.isNoSubstitutionTemplateLiteral(n)) {
      out.push({ text: n.text, node: n, kind: 'string' });
    } else if (t.isTemplateExpression(n)) {
      let s = n.head.text;
      for (const span of n.templateSpans) s += '${}' + span.literal.text;
      out.push({ text: s, node: n, kind: 'template' });
    } else if (t.isJsxText(n)) {
      if (n.text.trim()) out.push({ text: n.text, node: n, kind: 'jsx-text' });
    }
  });
  return out;
}
const VAR_RE = /var\(\s*--[^)]*\)/g;
const withoutVars = (s) => s.replace(VAR_RE, '');

// CSS named colours (CSS Color 4), matched as whole words, case-insensitively.
const NAMED_COLOURS = ('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown ' +
  'burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod ' +
  'darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
  'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue ' +
  'firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew ' +
  'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
  'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
  'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid ' +
  'mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream ' +
  'mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen ' +
  'paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown ' +
  'royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow ' +
  'springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' ');
const NAMED_SET = new Set(NAMED_COLOURS);
const NAMED_WORD_RE = new RegExp(`\\b(${NAMED_COLOURS.join('|')})\\b`, 'i');
const CSS_COLOUR_PROP_RE = new RegExp(
  '(?:^|[;{\\s"\'`])(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|' +
  'fill|stroke|box-shadow|text-shadow|caret-color|text-decoration-color|column-rule-color)\\s*:\\s*([^;}"\'`]*)', 'gi');
const JS_COLOUR_KEY_RE = /colou?r|background|border|outline|fill|stroke|shadow/i;

const ALLOWED_TOKENS = ['--green', '--orange', '--red', '--text', '--text-muted', '--border', '--bg-secondary', '--bg-tertiary'];
const SECTION_IDS = ['tp-pass', 'tp-held', 'tp-schedule', 'tp-path', 'tp-drift'];
const SECTION_STATES = ['loading', 'ready', 'empty', 'error'];
const READ_PATHS = [
  '/api/tagging-edges/status',
  '/api/tagging-edges/realtime/status',
  '/api/scheduled-tasks/list',
  '/api/tagging-edges/held',
  '/api/tagging-edges/drift-counts',
];

// ─── RelaySettings: today's shape, read from the file at 88af7df3 (UI as at 66d60cb5) ───────────────────────────────
const TODAY_TABS = [
  { key: 'router', label: '🔄 Router Management' },
  { key: 'sync', label: '🔃 Negentropy Sync' },
  { key: 'config', label: '📡 Relay Configuration' },
  { key: 'etl', label: '⚡ Streaming ETL' },
  { key: 'schedule', label: '📅 Scheduled Tasks' },
];
const TODAY_IMPORTS = ['react', './scheduledTasks/AddOrEditEntryModal.jsx', '../../utils/tagFilterValidation', '../../utils/nextTaskCountdown'];
const TODAY_RENDERS = { router: 'RouterStatus', sync: 'NegentropySync', config: 'RelaySettingsForm-or-fragment', etl: 'StreamingETLPanel', schedule: 'ScheduledTasksPanel' };
const PANEL_SPEC = './taggingPipeline/TaggingPipelinePanel.jsx';

function relaySf() {
  const sf = parse(RELAY);
  assert(sf, `${rel(RELAY)} could not be read`);
  return sf;
}
/** RELAY_TABS as [{ key, label }] — null for an entry that is not a plain { key: '…', label: '…' }. */
function relayTabs() {
  const t = ts();
  const sf = relaySf();
  let arr = null;
  walk(sf, (n) => {
    if (t.isVariableDeclaration(n) && t.isIdentifier(n.name) && n.name.text === 'RELAY_TABS' && n.initializer) {
      arr = unparen(n.initializer);
    }
  });
  assert(arr && t.isArrayLiteralExpression(arr), `${rel(RELAY)} has no const RELAY_TABS = [ … ] array`);
  return arr.elements.map((el) => {
    if (!t.isObjectLiteralExpression(el)) return null;
    const o = {};
    for (const p of el.properties) {
      if (!t.isPropertyAssignment(p)) return null;
      const init = unparen(p.initializer);
      if (!(t.isStringLiteral(init) || t.isNoSubstitutionTemplateLiteral(init))) return null;
      o[propName(p)] = init.text;
    }
    return o;
  });
}
/** Every `{activeTab === '<k>' && <X …/>}` in RelaySettings: [{ key, node, right, pos }]. */
function renderLines() {
  const t = ts();
  const sf = relaySf();
  const out = [];
  walk(sf, (n) => {
    if (!t.isJsxExpression(n) || !n.expression) return;
    const e = unparen(n.expression);
    if (!t.isBinaryExpression(e) || e.operatorToken.kind !== t.SyntaxKind.AmpersandAmpersandToken) return;
    const left = unparen(e.left);
    if (!t.isBinaryExpression(left) || left.operatorToken.kind !== t.SyntaxKind.EqualsEqualsEqualsToken) return;
    if (!t.isIdentifier(left.left) || left.left.text !== 'activeTab') return;
    const k = unparen(left.right);
    if (!t.isStringLiteral(k)) return;
    out.push({ key: k.text, node: n, right: unparen(e.right), pos: n.getStart(sf) });
  });
  return out;
}
function jsxTag(node) {
  const t = ts();
  if (!node) return null;
  if (t.isJsxSelfClosingElement(node)) return node.tagName.getText();
  if (t.isJsxElement(node)) return node.openingElement.tagName.getText();
  if (t.isJsxFragment(node)) return '<>';
  return null;
}
function jsxAttrs(node) {
  const t = ts();
  const opening = t.isJsxElement(node) ? node.openingElement : node;
  return opening && opening.attributes ? opening.attributes.properties : [];
}

// ─── panel helpers ────────────────────────────────────────────────────────────────────────────────────────────────
function allCalls(files, names) {
  const t = ts();
  const out = [];
  for (const f of files) {
    const sf = parse(f);
    if (!sf) continue;
    walk(sf, (n) => {
      if (t.isCallExpression(n) && names.includes(calleeName(n))) out.push({ sf, node: n, name: calleeName(n) });
    });
  }
  return out;
}
function containsNumeric(node) {
  const t = ts();
  let hit = false;
  walk(node, (n) => { if (t.isNumericLiteral(n) || t.isBigIntLiteral(n)) hit = true; });
  return hit;
}
/** Same-file variable declarations by name → their initializers. */
function localInits(sf, name) {
  const t = ts();
  const out = [];
  walk(sf, (n) => {
    if (t.isVariableDeclaration(n) && t.isIdentifier(n.name) && n.name.text === name && n.initializer) out.push(n.initializer);
  });
  return out;
}
function isFunctionLike(n) {
  const t = ts();
  return t.isArrowFunction(n) || t.isFunctionExpression(n) || t.isFunctionDeclaration(n) || t.isMethodDeclaration(n);
}
/** setTimeout(f) or setTimeout(f, 0): a one-shot deferral, not a poll period (PS10, PS11). */
function isZeroDeferral(call) {
  const t = ts();
  if (calleeName(call) !== 'setTimeout') return false;
  const d = call.arguments[1] && unparen(call.arguments[1]);
  return !d || (t.isNumericLiteral(d) && Number(d.text) === 0);
}
/** A function's own name: `function f(){}`, or `const f = () => …` / `const f = function () {}`. */
function fnName(fn) {
  const t = ts();
  if (t.isFunctionDeclaration(fn) && fn.name) return fn.name.text;
  const p = fn.parent;
  if (p && t.isVariableDeclaration(p) && p.initializer === fn && t.isIdentifier(p.name)) return p.name.text;
  return null;
}
/** Same-file functions by name: declarations and function-valued variable initializers. */
function localFunctions(sf, name) {
  const t = ts();
  const out = [];
  walk(sf, (d) => {
    if (t.isFunctionDeclaration(d) && d.name && d.name.text === name) out.push(d);
    if (t.isVariableDeclaration(d) && t.isIdentifier(d.name) && d.name.text === name && d.initializer && isFunctionLike(unparen(d.initializer))) out.push(unparen(d.initializer));
  });
  return out;
}
const normText = (sf, n) => n.getText(sf).replace(/\s+/g, '');

// ═══════════════════════════════ PS — the panel file and its wiring into RelaySettings ═══════════════════════════════

test('PS1: the panel is its own file, ui/src/pages/settings/taggingPipeline/TaggingPipelinePanel.jsx, whose default export is a function named TaggingPipelinePanel taking one destructured props object that names onOpenTab [AC-1; ADR 0004 § UI "TaggingPipelinePanel.jsx (new): export default function TaggingPipelinePanel({ onOpenTab })"]', async () => {
  const t = ts();
  const sf = parse(PANEL);
  if (!sf) throw notYet(PANEL, 'the file does not exist, so it does not export default function TaggingPipelinePanel({ onOpenTab }) (ADR 0004 § UI)');
  let fn = null;
  let exportedName = null;
  const fnByName = new Map();
  walk(sf, (n) => {
    if (t.isFunctionDeclaration(n) && n.name) {
      fnByName.set(n.name.text, n);
      const mods = (n.modifiers || []).map((m) => m.kind);
      if (mods.includes(t.SyntaxKind.ExportKeyword) && mods.includes(t.SyntaxKind.DefaultKeyword)) { fn = n; exportedName = n.name.text; }
    }
    if (t.isVariableDeclaration(n) && t.isIdentifier(n.name) && n.initializer) {
      const init = unparen(n.initializer);
      if (t.isArrowFunction(init) || t.isFunctionExpression(init)) fnByName.set(n.name.text, init);
    }
  });
  walk(sf, (n) => {
    if (!fn && t.isExportAssignment(n) && !n.isExportEquals && t.isIdentifier(n.expression)) {
      exportedName = n.expression.text;
      fn = fnByName.get(exportedName) || null;
    }
  });
  if (!fn) throw notYet(PANEL, 'it has no default-exported function (ADR 0004 § UI: export default function TaggingPipelinePanel({ onOpenTab }))');
  assert(exportedName === 'TaggingPipelinePanel',
    `${rel(PANEL)}'s default export is named ${j(exportedName)}; ADR 0004 § UI names it TaggingPipelinePanel`);
  const p0 = fn.parameters[0];
  assert(p0 && t.isObjectBindingPattern(p0.name),
    `TaggingPipelinePanel must take one destructured props object, ({ onOpenTab }) — got ${p0 ? j(p0.getText(sf)) : 'no parameter'} (ADR 0004 § UI)`);
  const names = p0.name.elements.map((e) => (e.propertyName || e.name).getText(sf));
  assert(names.includes('onOpenTab'),
    `TaggingPipelinePanel's props must name onOpenTab (the schedule warning's button calls onOpenTab('schedule')); it destructures ${j(names)} (ADR 0004 § UI)`);
});

test('PS2: RelaySettings imports the panel as the default import TaggingPipelinePanel from exactly \'./taggingPipeline/TaggingPipelinePanel.jsx\' [AC-1; ADR 0004 § UI "RelaySettings.jsx gets three edits": 1. the import]', async () => {
  const t = ts();
  const sf = relaySf();
  const hits = sf.statements.filter((s) => t.isImportDeclaration(s) && t.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text === PANEL_SPEC);
  if (!hits.length) throw notYet(RELAY, `RelaySettings does not import TaggingPipelinePanel from '${PANEL_SPEC}' yet (ADR 0004 § UI, edit 1)`);
  assert(hits.length === 1, `RelaySettings imports '${PANEL_SPEC}' ${hits.length} times; expected once`);
  const clause = hits[0].importClause;
  assert(clause && clause.name && clause.name.text === 'TaggingPipelinePanel',
    `the import of '${PANEL_SPEC}' must be the default import named TaggingPipelinePanel; got ${j(hits[0].getText(sf))}`);
});

test('PS3: today\'s five Relays sub-tabs keep their keys, labels and order in RELAY_TABS — router "🔄 Router Management", sync "🔃 Negentropy Sync", config "📡 Relay Configuration", etl "⚡ Streaming ETL", schedule "📅 Scheduled Tasks" (passes before and after the change) [AC-6 "The tab bar"; ADR 0004 § UI "The other five sub-tabs are untouched"]', async () => {
  const tabs = relayTabs();
  assert(!tabs.includes(null), `every RELAY_TABS entry must be a plain { key: '…', label: '…' } object; got ${j(tabs)}`);
  const todays = tabs.filter((tb) => TODAY_TABS.some((x) => x.key === tb.key));
  assert(j(todays) === j(TODAY_TABS),
    `RELAY_TABS's existing entries, in order, must be exactly ${j(TODAY_TABS)}; got ${j(todays)}`);
  const others = tabs.filter((tb) => !TODAY_TABS.some((x) => x.key === tb.key)).map((tb) => tb.key);
  assert(others.every((k) => k === 'tagging'),
    `the only sub-tab this story may add is 'tagging'; RELAY_TABS also holds ${j(others.filter((k) => k !== 'tagging'))}`);
});

test('PS4: RELAY_TABS holds { key: \'tagging\', label: \'Tagging pipeline\' } directly after the etl entry and directly before schedule, so the tab bar reads router, sync, config, etl, tagging, schedule [AC-1 "a sub-tab directly after ⚡ Streaming ETL, labelled Tagging pipeline"; AC-6; ADR 0004 § UI edit 2; T9 "the sub-tab\'s accessible name is Tagging pipeline"]', async () => {
  const tabs = relayTabs();
  const idx = tabs.findIndex((tb) => tb && tb.key === 'tagging');
  if (idx === -1) throw notYet(RELAY, `RELAY_TABS holds no { key: 'tagging', label: 'Tagging pipeline' } entry yet; today it is ${j(tabs.map((tb) => tb && tb.key))} (ADR 0004 § UI, edit 2)`);
  assert(tabs.filter((tb) => tb && tb.key === 'tagging').length === 1, 'RELAY_TABS holds more than one tagging entry');
  assert(j(tabs[idx]) === j({ key: 'tagging', label: 'Tagging pipeline' }),
    `the new entry must be exactly { key: 'tagging', label: 'Tagging pipeline' } (no emoji, no other field); got ${j(tabs[idx])}`);
  const want = ['router', 'sync', 'config', 'etl', 'tagging', 'schedule'];
  const got = tabs.map((tb) => tb && tb.key);
  assert(j(got) === j(want), `RELAY_TABS's keys must read ${j(want)}; got ${j(got)}`);
});

test('PS5: RelaySettings renders the panel with exactly {activeTab === \'tagging\' && <TaggingPipelinePanel onOpenTab={setActiveTab} />}, once, and nowhere else [AC-1; AC-2 "pointing to the Scheduled Tasks sub-tab"; ADR 0004 § UI edit 3]', async () => {
  const t = ts();
  const sf = relaySf();
  const lines = renderLines().filter((l) => l.key === 'tagging');
  if (!lines.length) throw notYet(RELAY, "RelaySettings has no {activeTab === 'tagging' && <TaggingPipelinePanel onOpenTab={setActiveTab} />} render line yet (ADR 0004 § UI, edit 3)");
  assert(lines.length === 1, `RelaySettings has ${lines.length} activeTab === 'tagging' render lines; expected one`);
  const r = lines[0].right;
  assert(t.isJsxSelfClosingElement(r) && r.tagName.getText(sf) === 'TaggingPipelinePanel',
    `the tagging render line must render <TaggingPipelinePanel … /> self-closing; got ${j(r && r.getText(sf))}`);
  const attrs = jsxAttrs(r).map((a) => a.getText(sf).replace(/\s+/g, ''));
  assert(j(attrs) === j(['onOpenTab={setActiveTab}']),
    `<TaggingPipelinePanel> must take exactly onOpenTab={setActiveTab}; got ${j(attrs)}`);
  let uses = 0;
  walk(sf, (n) => {
    if ((t.isJsxSelfClosingElement(n) || t.isJsxOpeningElement(n)) && n.tagName.getText(sf) === 'TaggingPipelinePanel') uses++;
  });
  assert(uses === 1, `RelaySettings renders <TaggingPipelinePanel> ${uses} times; expected once, behind activeTab === 'tagging'`);
});

test('PS6: the tagging render line sits beside the etl line — after {activeTab === \'etl\' && …} and before {activeTab === \'schedule\' && …} [ADR 0004 § UI edit 3 "beside the etl line"]', async () => {
  const lines = renderLines();
  const at = (k) => (lines.find((l) => l.key === k) || {}).pos;
  if (at('tagging') == null) throw notYet(RELAY, "RelaySettings has no activeTab === 'tagging' render line yet, so it cannot sit beside the etl line (ADR 0004 § UI, edit 3)");
  assert(at('etl') != null && at('schedule') != null, "RelaySettings lost its etl or schedule render line");
  assert(at('etl') < at('tagging') && at('tagging') < at('schedule'),
    `the tagging render line must come after the etl line and before the schedule line; the render lines read ${j(lines.map((l) => l.key))}`);
});

test('PS7: today\'s five sub-tabs keep their render lines — router → <RouterStatus />, sync → <NegentropySync settings={settings} />, config → its block, etl → <StreamingETLPanel />, schedule → <ScheduledTasksPanel /> — each once (passes before and after the change) [AC-6 "keep their labels, order and content"; ADR 0004 § UI "The other five sub-tabs are untouched"]', async () => {
  const sf = relaySf();
  const lines = renderLines();
  const problems = [];
  for (const k of Object.keys(TODAY_RENDERS)) {
    const mine = lines.filter((l) => l.key === k);
    if (mine.length !== 1) { problems.push(`${k}: ${mine.length} render lines`); continue; }
    if (k === 'config') continue; // a multi-line block today; its content is pinned by its own suites
    const tag = jsxTag(mine[0].right);
    if (tag !== TODAY_RENDERS[k]) problems.push(`${k}: renders ${j(tag)}, expected ${TODAY_RENDERS[k]}`);
  }
  const sync = lines.find((l) => l.key === 'sync');
  if (sync) {
    const attrs = jsxAttrs(sync.right).map((a) => a.getText(sf).replace(/\s+/g, ''));
    if (j(attrs) !== j(['settings={settings}'])) problems.push(`sync: <NegentropySync> takes ${j(attrs)}, expected settings={settings}`);
  }
  for (const k of ['router', 'etl', 'schedule']) {
    const l = lines.find((x) => x.key === k);
    if (l && jsxAttrs(l.right).length) problems.push(`${k}: <${TODAY_RENDERS[k]}> gained props ${j(jsxAttrs(l.right).map((a) => a.getText(sf)))}`);
  }
  assert(!problems.length, `today's render lines changed: ${problems.join('; ')}`);
});

test('PS8: RelaySettings keeps today\'s four imports (react, ./scheduledTasks/AddOrEditEntryModal.jsx, ../../utils/tagFilterValidation, ../../utils/nextTaskCountdown), and the only import it may gain is the panel\'s (passes before and after the change) [AC-6; ADR 0004 § UI "three edits and nothing else"]', async () => {
  const t = ts();
  const sf = relaySf();
  const specs = sf.statements.filter((s) => t.isImportDeclaration(s)).map((s) => s.moduleSpecifier.text);
  const missing = TODAY_IMPORTS.filter((s) => !specs.includes(s));
  assert(!missing.length, `RelaySettings lost import(s) ${j(missing)}`);
  const extra = specs.filter((s) => !TODAY_IMPORTS.includes(s) && s !== PANEL_SPEC);
  assert(!extra.length, `RelaySettings gained import(s) other than the panel's: ${j(extra)}`);
});

// ═══════════════════════════════ PS — polling, timers, sections ═══════════════════════════════════════════════════════

test('PS9: the panel uses POLL_MS and SCHEDULE_POLL_MS by name, from ui/src/utils/taggingPipelineView.js — imported unaliased ({ POLL_MS }), or read off a namespace import of the view module (view.POLL_MS); the folder declares neither name itself and refers to each beyond its import [AC-5 "Refresh"; ADR 0004 § UI "POLL_MS (5000) and SCHEDULE_POLL_MS (60000). The JSX uses them by name"; § Seams "POLL_MS used by name"]', async () => {
  const t = ts();
  const files = panelFiles();
  const viewNoExt = VIEW.replace(/\.js$/, '');
  const imported = new Set();
  const refs = { POLL_MS: 0, SCHEDULE_POLL_MS: 0 };
  const declared = [];
  for (const f of files) {
    const sf = parse(f);
    const namespaces = new Set(); // `import * as ns from '…/taggingPipelineView.js'` in this file
    for (const s of sf.statements) {
      if (!t.isImportDeclaration(s) || !t.isStringLiteral(s.moduleSpecifier)) continue;
      const target = path.resolve(path.dirname(f), s.moduleSpecifier.text);
      if (target !== VIEW && target !== viewNoExt) continue;
      const nb = s.importClause && s.importClause.namedBindings;
      if (nb && t.isNamedImports(nb)) {
        for (const el of nb.elements) {
          const orig = (el.propertyName || el.name).text;
          if (orig === el.name.text) imported.add(orig);
        }
      } else if (nb && t.isNamespaceImport(nb)) {
        namespaces.add(nb.name.text);
      }
    }
    walk(sf, (n) => {
      if (t.isIdentifier(n) && n.text in refs) {
        const p = n.parent;
        if (t.isImportSpecifier(p)) return;
        if (t.isPropertyAccessExpression(p) && p.name === n) {
          // ns.POLL_MS counts as a use by name only when ns is the view module's namespace import
          if (t.isIdentifier(p.expression) && namespaces.has(p.expression.text)) { imported.add(n.text); refs[n.text]++; }
          return;
        }
        if ((t.isVariableDeclaration(p) || t.isParameter(p) || t.isBindingElement(p) || t.isFunctionDeclaration(p)) && p.name === n) {
          declared.push(where(sf, n));
          return;
        }
        refs[n.text]++;
      }
    });
  }
  for (const name of ['POLL_MS', 'SCHEDULE_POLL_MS']) {
    assert(imported.has(name),
      `no file in ${rel(PANEL_DIR)}/ imports ${name} (unaliased, or as a namespace member) from ${rel(VIEW)} (ADR 0004 § UI: "The JSX uses them by name")`);
    assert(refs[name] > 0, `${name} is imported but never used in ${rel(PANEL_DIR)}/`);
  }
  assert(!declared.length, `the panel folder re-declares POLL_MS / SCHEDULE_POLL_MS at ${declared.join(', ')}; it must use the view module's`);
});

test('PS10: no setInterval / setTimeout in the panel folder is given a numeric delay — no number literal in the delay argument, and no same-file const holding one (the view module\'s POLL_MS / SCHEDULE_POLL_MS carry the periods); a setInterval always names its delay; a zero-delay deferral, setTimeout(f) or setTimeout(f, 0), is not a poll period and is allowed [AC-5; ADR 0004 § UI "Polling"; § Seams "POLL_MS used by name"]', async () => {
  const files = panelFiles();
  const timers = allCalls(files, ['setInterval', 'setTimeout']);
  assert(timers.length > 0,
    `${rel(PANEL_DIR)}/ sets no timer: the panel must re-read the status every POLL_MS and the schedule list every SCHEDULE_POLL_MS (ADR 0004 § UI "Polling")`);
  const bad = [];
  for (const { sf, node, name } of timers) {
    if (isZeroDeferral(node)) continue;
    const delay = node.arguments[1];
    if (!delay) { bad.push(`${where(sf, node)} ${name}(…) with no delay (a 0 ms poll)`); continue; }
    if (containsNumeric(delay)) { bad.push(`${where(sf, node)} ${name}(…, ${delay.getText(sf)})`); continue; }
    if (ts().isIdentifier(delay)) {
      for (const init of localInits(sf, delay.text)) {
        if (containsNumeric(init)) bad.push(`${where(sf, node)} ${name}(…, ${delay.text}) where ${delay.text} = ${init.getText(sf)}`);
      }
    }
  }
  assert(!bad.length, `timers with a numeric delay in the panel folder: ${bad.join('; ')} — use POLL_MS / SCHEDULE_POLL_MS from the view module`);
});

test('PS11: every timer the panel sets is cleared on unmount — each setInterval / setTimeout (a zero-delay deferral aside) keeps its id (const id = …, id = …, ref.current = …), sits in a useEffect / useLayoutEffect callback (directly, or in a same-file function that effect calls), and that effect\'s cleanup (its returned function) passes the same id to clearInterval / clearTimeout, directly or through a same-file function [AC-5; ADR 0004 § UI "Polling": "cleared on unmount (the StreamingETLPanel precedent)"]', async () => {
  const t = ts();
  const files = panelFiles();
  const sets = allCalls(files, ['setInterval', 'setTimeout']);
  assert(sets.length > 0, `${rel(PANEL_DIR)}/ sets no timer, so it cannot poll (ADR 0004 § UI "Polling")`);

  const cbsCache = new Map();
  const effectCallbacks = (sf) => {
    if (!cbsCache.has(sf)) {
      const cbs = new Set();
      for (const { node } of allCalls([sf.fileName], ['useEffect', 'useLayoutEffect'])) {
        const a = node.arguments[0] && unparen(node.arguments[0]);
        if (!a) continue;
        if (isFunctionLike(a)) cbs.add(a);
        else if (t.isIdentifier(a)) for (const d of localFunctions(sf, a.text)) cbs.add(d);
      }
      cbsCache.set(sf, cbs);
    }
    return cbsCache.get(sf);
  };
  const within = (n, anc) => { for (let p = n; p; p = p.parent) if (p === anc) return true; return false; };
  // The effect a node runs under: the nearest enclosing effect callback, or (depth-limited) the effect that calls a
  // named same-file function enclosing it. A function's calls to itself (a re-arm) are not its call sites.
  const effectOf = (sf, node, depth) => {
    const cbs = effectCallbacks(sf);
    for (let p = node.parent; p; p = p.parent) if (isFunctionLike(p) && cbs.has(p)) return p;
    if (depth <= 0) return null;
    for (let p = node.parent; p; p = p.parent) {
      if (!isFunctionLike(p)) continue;
      const nm = fnName(p);
      if (!nm) continue;
      let found = null;
      walk(sf, (c) => {
        if (found || !t.isCallExpression(c) || !t.isIdentifier(c.expression) || c.expression.text !== nm || within(c, p)) return;
        found = effectOf(sf, c, depth - 1);
      });
      if (found) return found;
    }
    return null;
  };
  // Where the timer's id is kept: `const id = setInterval(…)` → "id"; `x.current = setInterval(…)` → "x.current".
  const keptAs = (sf, call) => {
    let n = call;
    while (n.parent && t.isParenthesizedExpression(n.parent)) n = n.parent;
    const p = n.parent;
    if (p && t.isVariableDeclaration(p) && p.initializer === n && t.isIdentifier(p.name)) return p.name.text;
    if (p && t.isBinaryExpression(p) && p.operatorToken.kind === t.SyntaxKind.EqualsToken && p.right === n) return normText(sf, p.left);
    return null;
  };
  const clearedIn = (sf, fnNode, depth, out) => {
    walk(fnNode, (n) => {
      if (!t.isCallExpression(n)) return;
      const nm = calleeName(n);
      if ((nm === 'clearInterval' || nm === 'clearTimeout') && n.arguments[0]) out.add(normText(sf, unparen(n.arguments[0])));
      else if (depth > 0 && nm && t.isIdentifier(n.expression)) for (const d of localFunctions(sf, nm)) clearedIn(sf, d, depth - 1, out);
    });
    return out;
  };
  // The ids an effect's cleanup clears: the function (or same-file named function) the effect callback returns.
  const cleanupClears = (sf, cb) => {
    const out = new Set();
    walk(cb, (n) => {
      if (!t.isReturnStatement(n) || !n.expression) return;
      let owner = n.parent;
      while (owner && !isFunctionLike(owner)) owner = owner.parent;
      if (owner !== cb) return;
      const ret = unparen(n.expression);
      if (isFunctionLike(ret)) clearedIn(sf, ret, 2, out);
      else if (t.isIdentifier(ret)) for (const d of localFunctions(sf, ret.text)) clearedIn(sf, d, 2, out);
    });
    return out;
  };

  const bad = [];
  for (const { sf, node, name } of sets) {
    if (isZeroDeferral(node)) continue;
    const at = `${where(sf, node)} ${name}(…)`;
    const id = keptAs(sf, node);
    if (!id) { bad.push(`${at} is not cleared by its effect's cleanup — its id is not kept (a bare call can never be cleared)`); continue; }
    const cb = effectOf(sf, node, 2);
    if (!cb) { bad.push(`${at} is not cleared by its effect's cleanup — it is not set from a useEffect (directly, or through a same-file function one calls)`); continue; }
    const cleared = cleanupClears(sf, cb);
    if (!cleared.has(id)) {
      bad.push(`${at} is not cleared by its effect's cleanup — its id ${j(id)} is not passed to clearInterval / clearTimeout by the function that effect returns (it clears ${j([...cleared])})`);
    }
  }
  assert(!bad.length, `${bad.join('; ')} (ADR 0004 § UI "Polling": cleared on unmount)`);
});

test('PS12: the five sections carry their hooks — data-testid tp-pass, tp-held, tp-schedule, tp-path and tp-drift, each on an element that also carries data-state, and every literal data-state is one of loading, ready, empty, error [AC-5 "States"; ADR 0004 § UI "Sections"; § Seams "the data-testid hooks"; T9]', async () => {
  const t = ts();
  const files = panelFiles();
  const literalOnTestid = new Set(); // ids set as a literal data-testid on an element with data-state
  const literalAnywhere = new Set();
  const noState = [];
  const badStates = [];
  let genericWithState = false;
  for (const f of files) {
    const sf = parse(f);
    for (const lt of literalTexts(sf)) if (SECTION_IDS.includes(lt.text)) literalAnywhere.add(lt.text);
    walk(sf, (n) => {
      if (!(t.isJsxOpeningElement(n) || t.isJsxSelfClosingElement(n))) return;
      const attrs = n.attributes.properties.filter((a) => t.isJsxAttribute(a));
      const get = (nm) => attrs.find((a) => a.name.getText(sf) === nm);
      const tid = get('data-testid');
      const st = get('data-state');
      if (st && st.initializer && t.isStringLiteral(st.initializer) && !SECTION_STATES.includes(st.initializer.text)) {
        badStates.push(`${where(sf, n)} data-state="${st.initializer.text}"`);
      }
      if (!tid) return;
      const init = tid.initializer;
      if (init && t.isStringLiteral(init)) {
        if (SECTION_IDS.includes(init.text)) {
          if (st) literalOnTestid.add(init.text);
          else noState.push(`${where(sf, n)} data-testid="${init.text}" has no data-state`);
        }
      } else if (init && t.isJsxExpression(init) && st) {
        genericWithState = true;
      }
    });
  }
  const missing = SECTION_IDS.filter((id) => !literalOnTestid.has(id) && !(literalAnywhere.has(id) && genericWithState));
  assert(!missing.length,
    `section hook(s) missing: ${j(missing)} — each section needs data-testid="<id>" with a data-state on the same element (ADR 0004 § UI "Sections")`);
  assert(!noState.length, noState.join('; '));
  assert(!badStates.length, `data-state must be loading | ready | empty | error: ${badStates.join('; ')}`);
});

// ═══════════════════════════════ PS — reads only ═══════════════════════════════════════════════════════════════════

test('PS13: every request is a GET — no method other than GET (no method: \'POST\' | \'PUT\' | \'PATCH\' | \'DELETE\'), no such verb as a string, and no .post/.put/.patch/.delete call and no sendBeacon anywhere in the panel folder or the two utils; readSection sends method: \'GET\' [AC-1 "It changes nothing"; AC-6 "The panel adds reads, never a new way to change them"; ADR 0004 § UI "Every request the panel sends is a GET"; taggingPipelineFetch.js]', async () => {
  const t = ts();
  const files = scopeFiles();
  const bad = [];
  for (const f of files) {
    const sf = parse(f);
    walk(sf, (n) => {
      if ((t.isStringLiteral(n) || t.isNoSubstitutionTemplateLiteral(n)) && /^(post|put|patch|delete)$/i.test(n.text.trim())) {
        bad.push(`${where(sf, n)} the verb ${j(n.text)}`);
      }
      if (t.isPropertyAssignment(n) && propName(n) === 'method') {
        const v = unparen(n.initializer);
        if (!((t.isStringLiteral(v) || t.isNoSubstitutionTemplateLiteral(v)) && v.text === 'GET')) {
          bad.push(`${where(sf, n)} ${n.getText(sf)}`);
        }
      }
      if (t.isCallExpression(n) && t.isPropertyAccessExpression(n.expression) && /^(post|put|patch|delete)$/i.test(n.expression.name.text)) {
        bad.push(`${where(sf, n)} ${n.expression.getText(sf)}(…)`);
      }
      if (t.isCallExpression(n) && calleeName(n) === 'sendBeacon') {
        bad.push(`${where(sf, n)} ${n.expression.getText(sf)}(…) (a beacon is always a POST)`);
      }
    });
  }
  assert(!bad.length, `non-GET requests (or a method that is not the literal 'GET'): ${bad.join('; ')}`);
  const fsf = parse(FETCH);
  let getMethod = false;
  walk(fsf, (n) => {
    if (t.isPropertyAssignment(n) && propName(n) === 'method') {
      const v = unparen(n.initializer);
      if (t.isStringLiteral(v) && v.text === 'GET') getMethod = true;
    }
  });
  assert(getMethod, `${rel(FETCH)} must call fetchImpl(url, { method: 'GET', signal }) (ADR 0004 § UI "readSection")`);
});

test('PS14: the panel reads the five routes by their paths — /api/tagging-edges/status, /api/tagging-edges/realtime/status, /api/scheduled-tasks/list, /api/tagging-edges/held and /api/tagging-edges/drift-counts — and names no other /api/ path [AC-1; AC-2; AC-3; AC-4; AC-6; ADR 0004 § UI "Polling", "The held list", "Drift"; § Out of scope "Story 5\'s controls"]', async () => {
  const files = scopeFiles();
  const seen = new Set();
  const other = [];
  for (const f of files) {
    const sf = parse(f);
    for (const lt of literalTexts(sf)) {
      if (lt.kind === 'jsx-text') continue;
      const m = lt.text.match(/\/api\/[A-Za-z0-9_\-/]*/g) || [];
      for (const p of m) {
        const clean = p.replace(/\/+$/, '');
        if (READ_PATHS.includes(clean)) seen.add(clean);
        else other.push(`${where(sf, lt.node)} ${j(p)}`);
      }
    }
  }
  const missing = READ_PATHS.filter((p) => !seen.has(p));
  assert(!missing.length, `the panel folder and utils never name ${j(missing)} as a literal path (ADR 0004 § UI)`);
  assert(!other.length, `the panel names /api/ paths beyond its five reads: ${other.join('; ')} — write each read's full path; story 5's controls are out of scope`);
});

test('PS15: the held list is read 50 at a time — the expression that builds each /api/tagging-edges/held URL carries runId=, offset= and limit=50 in its query (limit=${X} with X a const equal to 50 counts), or, when the path is written bare, the function that sends it builds runId, offset and limit (50) with an object or URLSearchParams [AC-2 "Held removals… every held removal is reachable"; ADR 0004 § UI "The held list": /held?runId=<latest.runId>&offset=<n>&limit=50]', async () => {
  const t = ts();
  const files = scopeFiles();
  const HELD = '/api/tagging-edges/held';
  const isStr = (n) => t.isStringLiteral(n) || t.isNoSubstitutionTemplateLiteral(n);
  const isPlus = (n) => n && t.isBinaryExpression(n) && n.operatorToken.kind === t.SyntaxKind.PlusToken;

  // Is this expression 50? A 50 / '50' literal, String(x), or a const (this file first, then any scope file) that is.
  const is50 = (sf, e, depth = 3) => {
    e = unparen(e);
    if (!e || depth < 0) return false;
    if (t.isNumericLiteral(e) || isStr(e)) return Number(e.text) === 50 && e.text.trim() !== '';
    if (t.isCallExpression(e) && t.isIdentifier(e.expression) && e.expression.text === 'String' && e.arguments[0]) return is50(sf, e.arguments[0], depth - 1);
    if (t.isIdentifier(e)) {
      let inits = localInits(sf, e.text).map((i) => [sf, i]);
      if (!inits.length) for (const f of files) inits = inits.concat(localInits(parse(f), e.text).map((i) => [parse(f), i]));
      return inits.length > 0 && inits.every(([s2, i]) => is50(s2, i, depth - 1));
    }
    return false;
  };
  // An expression flattened into literal text with numbered holes; same-file string consts are inlined. Every
  // literal node it reads is recorded in `used`.
  const flatten = (sf, e, used, depth = 3) => {
    e = unparen(e);
    if (isStr(e)) { used.add(e); return [e.text]; }
    if (t.isTemplateExpression(e)) {
      used.add(e);
      let out = [e.head.text];
      for (const sp of e.templateSpans) out = out.concat(flatten(sf, sp.expression, used, depth), [sp.literal.text]);
      return out;
    }
    if (isPlus(e)) return flatten(sf, e.left, used, depth).concat(flatten(sf, e.right, used, depth));
    if (t.isIdentifier(e) && depth > 0) {
      const inits = localInits(sf, e.text);
      if (inits.length === 1) {
        const i = unparen(inits[0]);
        if (isStr(i) || t.isTemplateExpression(i) || isPlus(i)) return flatten(sf, i, used, depth - 1);
      }
    }
    return [{ hole: e }];
  };
  const textOf = (parts) => parts.map((p, k) => (typeof p === 'string' ? p : `\u0000${k}\u0000`)).join('');
  const queryOk = (sf, parts) => {
    const s = textOf(parts);
    const q = s.slice(s.indexOf(HELD) + HELD.length);
    const miss = [];
    if (!/[?&]runId=(?!&|$)/.test(q)) miss.push('runId');
    if (!/[?&]offset=(?!&|$)/.test(q)) miss.push('offset');
    const hole = q.match(/[?&]limit=\u0000(\d+)\u0000/);
    if (!(/[?&]limit=50(?![0-9])/.test(q) || (hole && is50(sf, parts[Number(hole[1])].hole)))) miss.push('limit=50');
    return miss;
  };
  // A function that sends the bare path: it must build runId, offset and limit (50) itself — object-literal keys,
  // URLSearchParams .set/.append, or a query string of its own.
  const functionOk = (sf, fn) => {
    const keys = new Set();
    walk(fn, (n) => {
      if (t.isPropertyAssignment(n) || t.isShorthandPropertyAssignment(n)) {
        const k = t.isShorthandPropertyAssignment(n) ? n.name.text : propName(n);
        if (k === 'runId' || k === 'offset') keys.add(k);
        if (k === 'limit' && is50(sf, t.isShorthandPropertyAssignment(n) ? n.name : n.initializer)) keys.add('limit');
      }
      if (t.isCallExpression(n) && ['set', 'append'].includes(calleeName(n)) && n.arguments[0] && isStr(unparen(n.arguments[0]))) {
        const k = unparen(n.arguments[0]).text;
        if (k === 'runId' || k === 'offset') keys.add(k);
        if (k === 'limit' && n.arguments[1] && is50(sf, n.arguments[1])) keys.add('limit');
      }
      if (t.isTemplateExpression(n) || isStr(n)) {
        const parts = flatten(sf, n, new Set());
        const s = textOf(parts);
        if (/(?:^|[?&])runId=/.test(s)) keys.add('runId');
        if (/(?:^|[?&])offset=/.test(s)) keys.add('offset');
        const hole = s.match(/(?:^|[?&])limit=\u0000(\d+)\u0000/);
        if (/(?:^|[?&])limit=50(?![0-9])/.test(s) || (hole && is50(sf, parts[Number(hole[1])].hole))) keys.add('limit');
      }
    });
    return ['runId', 'offset', 'limit'].filter((k) => !keys.has(k)).map((k) => (k === 'limit' ? 'limit=50' : k));
  };
  const enclosingFn = (n) => { for (let p = n.parent; p; p = p.parent) if (isFunctionLike(p)) return p; return null; };

  const problems = [];
  let named = 0;
  for (const f of files) {
    const sf = parse(f);
    // The URL-building expressions: templates, the top of each + chain, and strings outside both.
    const exprs = [];
    walk(sf, (n) => {
      if (t.isTemplateExpression(n)) exprs.push(n);
      else if (isPlus(n) && !isPlus(unparen(n.parent)) && !isPlus(n.parent)) exprs.push(n);
      else if (isStr(n)) {
        let p = n.parent;
        while (p && t.isParenthesizedExpression(p)) p = p.parent;
        if (!(p && (isPlus(p) || t.isTemplateSpan(p)))) exprs.push(n);
      }
    });
    const covered = new Set(); // literal nodes read by a URL expression that carries its own query
    const bare = [];
    for (const e of exprs) {
      const used = new Set();
      const parts = flatten(sf, e, used);
      const s = textOf(parts);
      if (!s.includes(HELD)) continue;
      named++;
      const q = s.slice(s.indexOf(HELD) + HELD.length);
      if (q.startsWith('?') && q.includes('=')) {
        for (const u of used) covered.add(u);
        const miss = queryOk(sf, parts);
        if (miss.length) problems.push(`${where(sf, e)} ${j(s.replace(/\u0000\d+\u0000/g, '${…}'))} sends no ${miss.join(', ')}`);
      } else {
        bare.push(e);
      }
    }
    for (const e of bare) {
      if (covered.has(e)) continue;
      // the functions that send it: its own, or — for a const written at file scope — those that name the const
      let fns = [];
      const own = enclosingFn(e);
      if (own) fns.push(own);
      else {
        let p = e.parent;
        while (p && (t.isParenthesizedExpression(p) || isPlus(p) || t.isPropertyAssignment(p) || t.isObjectLiteralExpression(p) || t.isArrayLiteralExpression(p))) p = p.parent;
        if (p && t.isVariableDeclaration(p) && t.isIdentifier(p.name)) {
          const nm = p.name.text;
          for (const f2 of files) {
            walk(parse(f2), (r) => {
              if (t.isIdentifier(r) && r.text === nm && r !== p.name && !(t.isImportSpecifier(r.parent))) {
                const fn = enclosingFn(r);
                if (fn) fns.push([parse(f2), fn]);
              }
            });
          }
          fns = fns.filter(Boolean);
        }
      }
      const pairs = fns.map((x) => (Array.isArray(x) ? x : [sf, x]));
      const results = pairs.map(([s2, fn]) => functionOk(s2, fn));
      if (!pairs.length) problems.push(`${where(sf, e)} names ${HELD} but no function sends it with runId, offset and limit=50`);
      else if (!results.some((m) => !m.length)) problems.push(`${where(sf, e)} ${j(e.getText(sf).slice(0, 80))}: the function that sends it builds no ${results[0].join(', ')}`);
    }
  }
  assert(named > 0, `no file in the panel folder or utils names ${HELD} (ADR 0004 § UI "The held list")`);
  assert(!problems.length, `${problems.join('; ')} (ADR 0004 § UI: /held?runId=<latest.runId>&offset=<n>&limit=50)`);
});

// ═══════════════════════════════ PS — the static checks (ADR 0004 § Seams "Static checks") ═════════════════════════

test('PS16: no colour literal in the panel folder or the two utils once every var(--…) is removed — no hex (#[0-9a-fA-F]{3,8}), no rgb( / rgba( / hsl( / hsla(, no CSS named colour as a quoted value or after a colour property, and no transparent [AC-5 "Colours and copy"; ADR 0004 § UI "Colours"; § Seams "No colour literal"]', async () => {
  const t = ts();
  const files = scopeFiles();
  const bad = [];
  for (const f of files) {
    const sf = parse(f);
    for (const lt of literalTexts(sf)) {
      const s = withoutVars(lt.text);
      const at = where(sf, lt.node);
      const hex = s.match(/#[0-9a-fA-F]{3,8}\b/);
      if (hex) bad.push(`${at} hex ${j(hex[0])}`);
      if (/\b(rgba?|hsla?)\s*\(/i.test(s)) bad.push(`${at} ${j(s.match(/\b(rgba?|hsla?)\s*\(/i)[0])}`);
      if (/\btransparent\b/i.test(s)) bad.push(`${at} transparent`);
      const isKey = lt.node.parent && (t.isPropertyAssignment(lt.node.parent) && lt.node.parent.name === lt.node);
      const isModule = lt.node.parent && (t.isImportDeclaration(lt.node.parent) || t.isExportDeclaration(lt.node.parent));
      if (lt.kind !== 'jsx-text' && !isKey && !isModule && NAMED_SET.has(s.trim().toLowerCase())) bad.push(`${at} the named colour ${j(s.trim())} as a quoted value`);
      CSS_COLOUR_PROP_RE.lastIndex = 0;
      let m;
      while ((m = CSS_COLOUR_PROP_RE.exec(s))) {
        const w = m[1].match(NAMED_WORD_RE);
        if (w) bad.push(`${at} the named colour ${j(w[1])} after a colour property`);
      }
    }
    walk(sf, (n) => {
      if (!t.isPropertyAssignment(n) || !JS_COLOUR_KEY_RE.test(propName(n) || '')) return;
      walk(n.initializer, (v) => {
        if (t.isStringLiteral(v) || t.isNoSubstitutionTemplateLiteral(v)) {
          const w = withoutVars(v.text).match(NAMED_WORD_RE);
          if (w) bad.push(`${where(sf, v)} ${propName(n)}: the named colour ${j(w[1])}`);
        }
      });
    });
  }
  assert(!bad.length, `colour literals: ${[...new Set(bad)].join('; ')} — colours come only from var(--token)`);
});

test('PS17: every var(--…) in the panel folder or the two utils is one of the eight allowed tokens — --green, --orange, --red, --text, --text-muted, --border, --bg-secondary, --bg-tertiary — written whole, with no fallback [AC-5; ADR 0004 § UI "Colours come only from these tokens… There are no fallbacks (var(--x, #888) is a literal)"]', async () => {
  const files = scopeFiles();
  const bad = [];
  let used = 0;
  for (const f of files) {
    const sf = parse(f);
    for (const lt of literalTexts(sf)) {
      const re = /var\(([^)]*)\)?/g;
      let m;
      while ((m = re.exec(lt.text))) {
        used++;
        const inner = m[1].trim();
        if (!m[0].endsWith(')') || !ALLOWED_TOKENS.includes(inner)) bad.push(`${where(sf, lt.node)} ${j(m[0])}`);
      }
    }
  }
  assert(used > 0, `the panel folder uses no var(--token) at all; its state colours and skeleton blocks come from the eight tokens (ADR 0004 § UI "Loading", "Colours")`);
  assert(!bad.length, `var() uses outside the eight tokens, with a fallback, or built from pieces: ${bad.join('; ')} — allowed: ${ALLOWED_TOKENS.join(', ')}`);
});

test('PS18: no emoji (\\p{Extended_Pictographic}) in any string, template or JSX text of the panel folder or the two utils [AC-5 "no emoji"; ADR 0004 § UI "Copy"; § Seams "No emoji"; product-team/guardrails/language.md]', async () => {
  const files = scopeFiles();
  const EMOJI = new RegExp('\\p{Extended_Pictographic}', 'u');
  const bad = [];
  for (const f of files) {
    const sf = parse(f);
    for (const lt of literalTexts(sf)) {
      const m = lt.text.match(EMOJI);
      if (m) bad.push(`${where(sf, lt.node)} ${j(m[0])} in ${j(lt.text.trim().slice(0, 60))}`);
    }
  }
  assert(!bad.length, `emoji in the panel's copy: ${bad.join('; ')}`);
});

test('PS19: no length in an inline style — no style={…} object in the panel folder (inline, or a same-file const it names) holds a number or a string with a digit, and no template value ending in px, rem, em or % [AC-5 "follows product-team/guardrails/design.md"; ADR 0004 § UI "Spacing": "Inline styles set colour tokens and layout keywords only… never a length"; § Seams "No length in an inline style"]', async () => {
  const t = ts();
  const files = panelFiles();
  const bad = [];
  let styles = 0;
  const checkValue = (sf, key, v) => {
    walk(v, (x) => {
      if (t.isNumericLiteral(x)) bad.push(`${where(sf, x)} ${key}: ${x.getText(sf)}`);
      else if ((t.isStringLiteral(x) || t.isNoSubstitutionTemplateLiteral(x)) && /\d/.test(withoutVars(x.text))) bad.push(`${where(sf, x)} ${key}: ${j(x.text)}`);
      else if (t.isTemplateExpression(x)) {
        const parts = [x.head.text, ...x.templateSpans.map((s) => s.literal.text)].map(withoutVars);
        if (parts.some((p) => /\d/.test(p)) || x.templateSpans.some((s) => /^(px|rem|em|%)/.test(s.literal.text))) bad.push(`${where(sf, x)} ${key}: ${x.getText(sf)}`);
      }
    });
  };
  const checkObject = (sf, expr, seen) => {
    const e = unparen(expr);
    if (!e) return;
    if (t.isIdentifier(e)) {
      if (seen.has(e.text)) return;
      seen.add(e.text);
      for (const init of localInits(sf, e.text)) checkObject(sf, init, seen);
      return;
    }
    walk(e, (n) => {
      if (t.isObjectLiteralExpression(n)) {
        for (const p of n.properties) {
          if (t.isPropertyAssignment(p)) checkValue(sf, propName(p) || p.name.getText(sf), p.initializer);
          else if (t.isSpreadAssignment(p)) checkObject(sf, p.expression, seen);
          else if (t.isShorthandPropertyAssignment(p)) checkObject(sf, p.name, seen);
        }
      } else if (t.isIdentifier(n) && n !== e && !(t.isPropertyAccessExpression(n.parent) && n.parent.name === n)
        && !(t.isPropertyAssignment(n.parent) && n.parent.name === n)) {
        checkObject(sf, n, seen);
      }
    });
  };
  for (const f of files) {
    const sf = parse(f);
    walk(sf, (n) => {
      if (t.isJsxAttribute(n) && n.name.getText(sf) === 'style' && n.initializer) {
        styles++;
        if (t.isStringLiteral(n.initializer)) { bad.push(`${where(sf, n)} style as a string`); return; }
        if (n.initializer.expression) checkObject(sf, n.initializer.expression, new Set());
      }
    });
  }
  assert(styles > 0, `the panel folder has no inline style at all; its colours are inline var(--token) styles and its skeleton bars are background: var(--bg-tertiary) blocks (ADR 0004 § UI "Loading", "Colours")`);
  assert(!bad.length, `lengths in inline styles: ${[...new Set(bad)].join('; ')} — spacing and sizes come from the existing classes or the browser's defaults (a needed length is a design.md:17 deviation for the owner)`);
});

test('PS20: no exclamation mark in copy — no JSX text, string or template text in the panel folder or the two utils holds a ! followed by whitespace, a quote or the end [AC-5 "no exclamation marks"; ADR 0004 § UI "Copy"; § Seams "No ! in copy"]', async () => {
  const files = scopeFiles();
  const bad = [];
  for (const f of files) {
    const sf = parse(f);
    for (const lt of literalTexts(sf)) {
      if (/!(?=\s|['"`]|$)/.test(lt.text)) bad.push(`${where(sf, lt.node)} ${j(lt.text.trim().slice(0, 80))}`);
    }
  }
  assert(!bad.length, `exclamation marks in the panel's copy: ${bad.join('; ')}`);
});

test('PS21: the view module speaks in tones, not colours — ui/src/utils/taggingPipelineView.js holds no string naming red, green or orange (a var(--red) included) [ADR 0004 § UI taggingPipelineView.js "Tones. It returns tones as ok | warn | bad | neutral, never colour words"]', async () => {
  const sf = parse(VIEW);
  if (!sf) throw notYet(VIEW, 'the file does not exist (ADR 0004 § UI: the plain-JS view model, returning tones ok | warn | bad | neutral)');
  const bad = [];
  for (const lt of literalTexts(sf)) {
    const m = lt.text.match(/\b(red|green|orange)\b/i);
    if (m) bad.push(`${where(sf, lt.node)} ${j(lt.text.trim().slice(0, 60))}`);
  }
  assert(!bad.length, `colour words in the view module: ${bad.join('; ')} — it returns ok | warn | bad | neutral and the panel maps them to tokens`);
});

test('PS22: nothing is added to ui/src/styles.css for the panel — no selector naming a tp- class, id or attribute value, or tagging-pipeline / taggingPipeline (passes before and after the change) [AC-5; ADR 0004 § UI "Nothing is added to styles.css"]', async () => {
  const css = safeRead(STYLES);
  assert(css != null, `${rel(STYLES)} could not be read`);
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const bad = [];
  const re = /([^{}]+)\{/g;
  let m;
  while ((m = re.exec(noComments))) {
    const sel = m[1].trim();
    // tp- only where a class, id or attribute value starts (so .http-… is not the panel's); tagging(-)pipeline anywhere
    if (/(?:^|[^A-Za-z0-9_-])tp-|tagging-?pipeline/i.test(sel)) bad.push(j(sel.slice(0, 80)));
  }
  assert(!bad.length, `styles.css holds selector(s) for the panel: ${bad.join('; ')}`);
});

test('PS23: the panel folder holds no stylesheet and imports none — its look comes only from inline token styles and existing classes [AC-5; ADR 0004 § UI "Colours… through existing token-only classes"; "Nothing is added to styles.css"]', async () => {
  const t = ts();
  const all = listDir(PANEL_DIR);
  if (all == null) throw notYet(PANEL_DIR, 'the panel folder does not exist (ADR 0004 § UI)');
  panelFiles();
  const sheets = all.filter((p) => /\.(css|scss|sass|less)$/i.test(p)).map(rel);
  const imports = [];
  for (const f of panelFiles()) {
    const sf = parse(f);
    for (const s of sf.statements) {
      if (t.isImportDeclaration(s) && t.isStringLiteral(s.moduleSpecifier) && /\.(css|scss|sass|less)$/i.test(s.moduleSpecifier.text)) imports.push(`${where(sf, s)} ${s.moduleSpecifier.text}`);
    }
  }
  assert(!sheets.length && !imports.length, `stylesheets in the panel folder: ${j(sheets.concat(imports))}`);
});

const PANEL_CLASSES = ['settings-group', 'settings-hint', 'btn-small', 'text-muted', 'settings-section'];

test('PS24: the panel uses only the existing token-only classes — every class token in a className (a string, template text, a branch of a conditional or &&/||, an array joined, or a same-file const, map or function it names) in the panel folder is one of settings-group, settings-hint, btn-small, text-muted, settings-section [AC-5; ADR 0004 § UI "Colours": "through existing token-only classes (settings-group, settings-hint, btn-small, text-muted, and settings-section…)"; "Nothing is added to styles.css"]', async () => {
  const t = ts();
  const files = panelFiles();
  const isStr = (n) => t.isStringLiteral(n) || t.isNoSubstitutionTemplateLiteral(n);
  // The strings an expression can evaluate to, in value position only (a comparison's operands are not class names).
  const values = (sf, e, seen, out) => {
    e = unparen(e);
    if (!e) return out;
    if (isStr(e)) out.push({ text: e.text, node: e });
    else if (t.isTemplateExpression(e)) {
      // text beside a hole is a fragment ("settings-${x}"): mark it so a partial token fails
      out.push({ text: e.head.text + (e.templateSpans.length ? '\u0000' : ''), node: e });
      e.templateSpans.forEach((sp, k) => {
        values(sf, sp.expression, seen, out);
        out.push({ text: '\u0000' + sp.literal.text + (k < e.templateSpans.length - 1 ? '\u0000' : ''), node: e });
      });
    } else if (t.isConditionalExpression(e)) { values(sf, e.whenTrue, seen, out); values(sf, e.whenFalse, seen, out); }
    else if (t.isBinaryExpression(e)) {
      const k = e.operatorToken.kind;
      if (k === t.SyntaxKind.AmpersandAmpersandToken) values(sf, e.right, seen, out);
      else if (k === t.SyntaxKind.BarBarToken || k === t.SyntaxKind.QuestionQuestionToken || k === t.SyntaxKind.PlusToken) {
        values(sf, e.left, seen, out); values(sf, e.right, seen, out);
      }
    } else if (t.isArrayLiteralExpression(e)) e.elements.forEach((x) => values(sf, x, seen, out));
    else if (t.isObjectLiteralExpression(e)) {
      for (const p of e.properties) if (t.isPropertyAssignment(p)) values(sf, p.initializer, seen, out);
    } else if (t.isElementAccessExpression(e) || t.isPropertyAccessExpression(e)) values(sf, e.expression, seen, out);
    else if (t.isCallExpression(e)) {
      // [a, b].filter(Boolean).join(' ') → the receiver's values; classFor(tone) → the same-file function's returns
      if (t.isPropertyAccessExpression(e.expression)) values(sf, e.expression.expression, seen, out);
      else if (t.isIdentifier(e.expression) && !seen.has(e.expression.text)) {
        seen.add(e.expression.text);
        for (const fn of localFunctions(sf, e.expression.text)) {
          if (!t.isBlock(fn.body)) values(sf, fn.body, seen, out);
          else walk(fn.body, (r) => {
            if (!t.isReturnStatement(r) || !r.expression) return;
            let owner = r.parent;
            while (owner && !isFunctionLike(owner)) owner = owner.parent;
            if (owner === fn) values(sf, r.expression, seen, out);
          });
        }
      }
    } else if (t.isIdentifier(e) && !seen.has(e.text)) {
      seen.add(e.text);
      for (const init of localInits(sf, e.text)) values(sf, init, seen, out);
    }
    return out;
  };
  const bad = [];
  for (const f of files) {
    const sf = parse(f);
    walk(sf, (n) => {
      if (!t.isJsxAttribute(n) || !['className', 'class'].includes(n.name.getText(sf)) || !n.initializer) return;
      const init = n.initializer;
      const vals = isStr(init) ? [{ text: init.text, node: init }]
        : (init.expression ? values(sf, init.expression, new Set(), []) : []);
      for (const v of vals) {
        for (const tok of v.text.split(/\s+/)) {
          if (!tok) continue;
          if (tok.includes('\u0000')) {
            const frag = tok.replace(/\u0000/g, '');
            if (frag) bad.push(`${where(sf, n)} a class built from pieces (${j(frag + '…')})`);
            continue;
          }
          if (!PANEL_CLASSES.includes(tok)) bad.push(`${where(sf, n)} ${j(tok)}`);
        }
      }
    });
  }
  assert(!bad.length, `className tokens outside the existing token-only classes: ${[...new Set(bad)].join('; ')} — allowed: ${PANEL_CLASSES.join(', ')}; a new class would mean adding to styles.css, which ADR 0004 § UI rules out`);
});

test('PS25: the schedule warning\'s button opens the Scheduled Tasks sub-tab — somewhere in the panel folder, onOpenTab (or props.onOpenTab) is called with the literal \'schedule\' [AC-2 "pointing to the Scheduled Tasks sub-tab"; ADR 0004 § UI "The schedule warning has a button that calls onOpenTab(\'schedule\')"]', async () => {
  const t = ts();
  const files = panelFiles();
  const calls = [];
  for (const f of files) {
    const sf = parse(f);
    walk(sf, (n) => {
      if (!t.isCallExpression(n)) return;
      const c = unparen(n.expression);
      const isOpen = (t.isIdentifier(c) && c.text === 'onOpenTab') || (t.isPropertyAccessExpression(c) && c.name.text === 'onOpenTab');
      if (!isOpen) return;
      const a0 = n.arguments[0] && unparen(n.arguments[0]);
      calls.push({ at: where(sf, n), arg: a0 && (t.isStringLiteral(a0) || t.isNoSubstitutionTemplateLiteral(a0)) ? a0.text : null, text: n.getText(sf) });
    });
  }
  assert(calls.some((c) => c.arg === 'schedule'),
    `no onOpenTab('schedule') call in ${rel(PANEL_DIR)}/ — the schedule warning's button must call it (ADR 0004 § UI); onOpenTab calls found: ${j(calls.map((c) => `${c.at} ${c.text}`))}`);
});

// ─── runner ────────────────────────────────────────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n--- tagging pipeline panel: source sentinels (epic tagging-edges, Story 4 — ADR 0004 § UI, § Seams "Static checks") ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntagging-pipeline-panel-source: ${pass} passed, ${fail} failed, 0 skipped`);
  return { pass, fail, skipped: 0, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
