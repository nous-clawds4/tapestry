'use strict';
/**
 * treasure-map-card-details #1: a Needs attention pill on an unassigned category card on /treasure-map.
 *
 * Story: engineering-team/stories/done/treasure-map-card-details/1-needs-attention-pill.md (Light profile; the test plan
 *        is the story's Edge cases and AC→handle lines)
 * Browser half: tests/brainstorm/treasure-map-needs-attention.spec.js (what a viewer sees and does).
 *
 *   W1 — the words are /assistant's: COPY.needsAttention and its screen-reader prefix equal ASSISTANT_COPY's.  [AC-6]
 *   S1 — manageTreasureMap.js takes them from ASSISTANT_COPY, imported from '../assistant/actions.js' (with the
 *        `.js` suffix the page's Node suites need), never retyped.                                          [AC-6]
 *   S2 — CategoryCard draws the pill from COPY, hidden from screen readers, and the screen-reader prefix outside
 *        the title span, which still holds only the title.                                            [AC-1, AC-4]
 *   S3 — the pill's CSS: the /assistant badge's shape, the light-page amber (#b45309, or the page's --orange
 *        token resolved to it), contrast at least 4.5:1.                                                     [AC-5]
 *   S4 — the Assistant top-bar alert and its count don't read the Treasure Map themselves (negative pin; since
 *        assistant-trusted-content-status #1 the provider may re-ask the server after the viewer saves a Map). [AC-7]
 *   R1 — regression sentinel: the card states the pill follows, for the story's edge-case Maps E1–E3 — a card is
 *        'none' exactly when no Assistant counts. Passes before and after.                                [AC-1, E1–E3]
 *
 * W1, S1, S2 and S3 FAIL against the code before the story: COPY has no needsAttention, manageTreasureMap.js doesn't
 * import actions.js, CategoryCard has no pill and styles.css has no .bsd-tm-cat-attention.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.resolve(__dirname, '..');
const VIEW_MODEL = path.join(REPO, 'ui/src/pages/treasure-map/manageTreasureMap.js');
const PAGE = path.join(REPO, 'ui/src/pages/treasure-map/Index.jsx');
const ACTIONS = path.join(REPO, 'ui/src/pages/assistant/actions.js');
const STYLES = path.join(REPO, 'ui/src/styles.css');
const ALERT_FILES = [
  path.join(REPO, 'ui/src/utils/topBarAlert.js'),
  path.join(REPO, 'ui/src/context/AssistantAttentionContext.jsx'),
];
const NL = String.fromCharCode(10);

// Fixture keys, never live ones.
const A = 'c1'.repeat(32);
const D = 'd1'.repeat(32);
const R = 'wss://relay.example';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const show = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);

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
/** The source of one top-level function in the page, from its declaration to the next top-level declaration. */
function functionSource(src, name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) return '';
  const rest = src.slice(start + 1);
  const next = rest.search(/\n(?:export\s+default\s+)?function\s|\nconst\s|\n\/\*\*/);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}
/** The declarations of one CSS rule whose selector list is exactly `selector`, or ''. */
function cssRule(css, selector) {
  const re = new RegExp(`(^|\\})\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'm');
  const m = css.match(re);
  return m ? m[2] : '';
}
function declaration(rule, prop) {
  const m = rule.match(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+)`));
  return m ? m[1].trim() : '';
}
function luminance(hex) {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const mapOf = (tags) => ({ id: '9'.repeat(64), pubkey: 'a1'.repeat(32), kind: 10040, created_at: 1, content: '', sig: 'f'.repeat(128), tags });

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// W, S — words and wiring
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('W1: COPY.needsAttention is "Needs attention" and COPY.needsAttentionSrPrefix "Needs attention: " — /assistant\'s words', async () => {
  const { COPY } = await esm(VIEW_MODEL, 'The page view-model.');
  const { ASSISTANT_COPY } = await esm(ACTIONS, 'The /assistant page words.');
  const wrong = [];
  if (COPY.needsAttention !== 'Needs attention') wrong.push(`needsAttention is ${show(COPY.needsAttention)}`);
  if (COPY.needsAttentionSrPrefix !== 'Needs attention: ') wrong.push(`needsAttentionSrPrefix is ${show(COPY.needsAttentionSrPrefix)}`);
  if (COPY.needsAttention !== ASSISTANT_COPY.needsAttention) wrong.push('needsAttention differs from ASSISTANT_COPY\'s');
  if (COPY.needsAttentionSrPrefix !== ASSISTANT_COPY.needsAttentionSrPrefix) wrong.push('needsAttentionSrPrefix differs from ASSISTANT_COPY\'s');
  assert(wrong.length === 0, wrong.join('; '));
});

test('S1: manageTreasureMap.js takes the words from ASSISTANT_COPY, imported from \'../assistant/actions.js\', not retyped', () => {
  const src = codeOnly(safeRead(VIEW_MODEL));
  assert(src, `${rel(VIEW_MODEL)} does not exist`);
  const wrong = [];
  if (!/import\s*\{[^}]*\bASSISTANT_COPY\b[^}]*\}\s*from\s*['"]\.\.\/assistant\/actions\.js['"]/.test(src)) {
    wrong.push('it doesn\'t import ASSISTANT_COPY from \'../assistant/actions.js\' (with the .js suffix)');
  }
  if (!/needsAttention\s*:\s*ASSISTANT_COPY\.needsAttention\b/.test(src)) wrong.push('COPY.needsAttention isn\'t ASSISTANT_COPY.needsAttention');
  if (!/needsAttentionSrPrefix\s*:\s*ASSISTANT_COPY\.needsAttentionSrPrefix\b/.test(src)) wrong.push('COPY.needsAttentionSrPrefix isn\'t ASSISTANT_COPY.needsAttentionSrPrefix');
  if (/['"]Needs attention/.test(src)) wrong.push('the words are retyped as a literal');
  assert(wrong.length === 0, `${rel(VIEW_MODEL)}: ${wrong.join('; ')}`);
});

test('S2: CategoryCard draws the pill (COPY.needsAttention, aria-hidden) and the screen-reader prefix outside the title span, for an unassigned card', () => {
  const src = codeOnly(safeRead(PAGE));
  assert(src, `${rel(PAGE)} does not exist`);
  const card = functionSource(src, 'CategoryCard');
  assert(card, `${rel(PAGE)} has no CategoryCard`);
  const wrong = [];
  const pill = card.match(/<span\b[^>]*\bclassName="bsd-tm-cat-attention"[^>]*>\s*\{COPY\.needsAttention\}\s*<\/span>/);
  if (!pill) wrong.push('no <span className="bsd-tm-cat-attention">{COPY.needsAttention}</span>');
  else if (!/aria-hidden="true"/.test(pill[0])) wrong.push('the pill is not aria-hidden="true"');
  if (!/<span\b[^>]*\bclassName="bs-sr-only"[^>]*>\s*\{COPY\.needsAttentionSrPrefix\}\s*<\/span>/.test(card)) {
    wrong.push('no <span className="bs-sr-only">{COPY.needsAttentionSrPrefix}</span>');
  }
  // AC-4: the title span the Edit controls point at holds the title and nothing else.
  if (!/<span\b[^>]*\bid=\{titleId\(card\.key\)\}[^>]*>\s*\{card\.title\}\s*<\/span>/.test(card)) {
    wrong.push('the span with id={titleId(card.key)} must hold only {card.title}');
  }
  if (!/card\.state\s*===\s*['"]none['"]/.test(card)) wrong.push('the pill isn\'t tied to card.state === \'none\'');
  assert(wrong.length === 0, `CategoryCard: ${wrong.join('; ')}`);
});

test('S3: .bsd-tm-cat-attention — the /assistant badge\'s pill shape, amber #b45309 on #fffbeb, contrast at least 4.5:1', () => {
  const css = safeRead(STYLES);
  const rule = cssRule(css, '.bsd-tm-cat-attention');
  assert(rule, `${rel(STYLES)} has no .bsd-tm-cat-attention rule`);
  const wrong = [];
  // The colour may be the page's --orange token (Gate B finding 4). It is resolved where the pill meets it: in the
  // .bsd-page rule, which the light design pages sit in. The stylesheet's root value (#d29922) is the dark pages'.
  let color = declaration(rule, 'color').toLowerCase();
  const token = color.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/);
  if (token) {
    const def = declaration(cssRule(css, '.bsd-page'), token[1]).toLowerCase();
    color = def || `${color} (not defined in .bsd-page)`;
  }
  const bg = (declaration(rule, 'background-color') || declaration(rule, 'background')).toLowerCase();
  if (color !== '#b45309') wrong.push(`color is ${show(color)}, want #b45309`);
  if (bg !== '#fffbeb') wrong.push(`background is ${show(bg)}, want #fffbeb`);
  if (/^#[0-9a-f]{6}$/.test(color) && /^#[0-9a-f]{6}$/.test(bg) && contrast(color, bg) < 4.5) {
    wrong.push(`contrast ${contrast(color, bg).toFixed(2)}:1 is under 4.5:1`);
  }
  if (declaration(rule, 'border-radius') !== '999px') wrong.push('border-radius isn\'t 999px (a pill)');
  if (!/^1px solid\b/.test(declaration(rule, 'border'))) wrong.push('no 1px solid border');
  if (declaration(rule, 'font-weight') !== '700') wrong.push('font-weight isn\'t 700');
  if (declaration(rule, 'font-size') !== '0.72rem') wrong.push('font-size isn\'t the badge\'s 0.72rem');
  if (declaration(rule, 'padding') !== '0.1rem 0.55rem') wrong.push('padding isn\'t the badge\'s 0.1rem 0.55rem');
  assert(wrong.length === 0, wrong.join('; '));
});

// Re-aimed by assistant-trusted-content-status #1 (its story AC-5/AC-6, ADR 0001 sub-decision 9; owner-approved
// 2026-10-08): the Assistant alert's count now covers Scores, Lists and Concepts, which the SERVER answers from the
// Treasure Map in the one attention answer — this story's AC-7 kept the count out of it only for its own scope. What
// still holds: the alert files never read or interpret the Map themselves. The provider may only re-ask the server after
// the viewer saves a Map (a kind 10040 by the viewer); nothing else of the Treasure Map is allowed there.
test('S4: the Assistant top-bar alert and its count read nothing of the Treasure Map themselves — the provider only re-asks the server after the viewer saves one (AC-7, negative pin; re-aimed by assistant-trusted-content-status #1)', () => {
  const wrong = [];
  for (const file of ALERT_FILES) {
    const src = codeOnly(safeRead(file));
    if (!src) { wrong.push(`${rel(file)} does not exist`); continue; }
    const hit = src.match(/treasure|categoryAssistants|categoryCards|categoryEntries|manageTreasureMap|treasureMapCategories/i);
    if (hit) wrong.push(`${rel(file)} mentions ${show(hit[0])}`);
    const kinds = src.match(/10040/g) || [];
    const isProvider = /AssistantAttentionContext\.jsx$/.test(file);
    if (!isProvider && kinds.length > 0) wrong.push(`${rel(file)} mentions "10040"`);
    if (isProvider) {
      if (kinds.length > 1) wrong.push(`${rel(file)} mentions "10040" more than once (only the re-ask after a save is allowed)`);
      if (kinds.length === 1 && !/ev\.kind\s*===\s*10040\s*&&\s*ev\.pubkey\s*===\s*pubkey\s*\)\s*\{\s*refresh\(\);/.test(src)) {
        wrong.push(`${rel(file)}: its one 10040 must be the re-ask after the viewer's own save — if (ev.kind === 10040 && ev.pubkey === pubkey) { refresh(); …`);
      }
    }
  }
  assert(wrong.length === 0, wrong.join('; '));
});

// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════
// R — the card states the pill follows (regression sentinel; passes before and after)
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════════════

test('R1: a card is \'none\' exactly when no Assistant counts — E1 (*:tag only), E2 (a bare * counts), E3 (a family entry with no valid Assistant)', async () => {
  const { categoryAssistants, categoryCards } = await esm(VIEW_MODEL, 'The page view-model.');
  const states = (tags) => categoryCards({ assistants: categoryAssistants(mapOf(tags)), profiles: {}, localPubkey: null })
    .map((c) => `${c.key}:${c.state}`).join(' ');
  const cases = [
    [null, 'scores:none lists:none concepts:none', 'no Map'],
    [[['*:tag', D, R]], 'scores:none lists:none concepts:none', 'E1: only *:tag'],
    [[['*', D, R]], 'scores:single lists:single concepts:single', 'E2: a bare * reaches all three'],
    [[['*', D, R], ['3038x', A, R]], 'scores:single lists:single concepts:single', 'E2: * covered for Scores by 3038x'],
    [[['3038x', 'not-a-key', R]], 'scores:none lists:none concepts:none', 'E3: a family entry with no valid Assistant'],
    [[['3038x', 'not-a-key', R], ['*', D, R]], 'scores:single lists:single concepts:single', 'E3: … unless a * reaches it'],
    [[['30382:rank', A, R], ['39998', D, R]], 'scores:single lists:none concepts:single', 'only Lists unassigned'],
  ];
  const wrong = [];
  for (const [tags, want, label] of cases) {
    const got = tags ? states(tags) : categoryCards({ assistants: categoryAssistants(null), profiles: {}, localPubkey: null })
      .map((c) => `${c.key}:${c.state}`).join(' ');
    if (got !== want) wrong.push(`${label}: want ${want}, got ${got}`);
  }
  assert(wrong.length === 0, wrong.join('; '));
});

async function run() {
  console.log(`${NL}=== treasure-map-needs-attention (treasure-map-card-details #1) ===`);
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, f] of tests) {
    try {
      await f();
      console.log(`  PASS  ${name}`);
      pass++;
    } catch (err) {
      console.log(`  FAIL  ${name}${NL}        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`${NL}treasure-map-needs-attention: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

module.exports = { run };
