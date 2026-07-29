/**
 * Story 3 (epic: goal-intent-fields) — Show the four on the goal screens that
 * already exist.
 *
 * Story: engineering-team/stories/goal-intent-fields/3-show-the-four-on-the-goal-screens-that-already-exist.md
 * ADR:   engineering-team/decisions/goal-intent-fields/0003-screen-side-intent-display-and-the-narrow-d13-supersession.md
 * Book:  engineering-team/audits/store-and-show-the-prompt-and-the-estimate/book.md
 *
 * The four, in the concept's own declared names:
 *   prompt (string) · chanceOfSuccess (number) · needsHumanInput (boolean) ·
 *   needsBreakdown (boolean).
 *
 * ── The one thing this suite exists to pin ────────────────────────────────
 * THE SCREEN IS THE INTERPRETATION POINT, AND IT MUST NOT INTERPRET BY
 * FALSINESS. Stories 1 and 2 made a never-set property arrive as `null` and a
 * stored `0` / `false` / `''` arrive verbatim. A screen written with `!value`
 * throws that distinction away:
 *
 *     !goal.chanceOfSuccess   reads a stored 0     as "never set"
 *     !goal.needsHumanInput   reads a stored false as "never set"  ← 5 LIVE GOALS
 *     !goal.prompt            reads a set-empty '' as "never set"
 *
 * A test that a falsiness implementation would still pass has not tested this.
 * The two assertions where falsiness actually dies are called out by name:
 *
 *   U4  — estimateLineOnProposalCard(0) must render the NUMBER 0, and must not
 *         equal estimateLineOnProposalCard(null), which renders WORDS. Under
 *         `v ? number : words` the stored 0 takes the words branch. FAILS.
 *   U7  — promptDisplay('') and promptDisplay(null) are two DIFFERENT states
 *         with two DIFFERENT sentences. Under `if (!p) return UNSET` they
 *         collapse into one. FAILS.
 *
 * The flags are the case where discrimination is deliberately NOT observable
 * at the screen: AC2 says a never-set flag displays the declared default
 * `false`, and a stored `false` displays `false`, so the two legitimately look
 * the same. No U-class assertion can catch falsiness on a flag.
 *
 * **What S4 actually reaches, stated precisely** (an earlier draft of this
 * header overclaimed it). S4 keys on THE FOUR PROPERTY NAMES, so it catches
 * `!goal.needsHumanInput` at a call site — but a module written
 * `flagWord(v) { return v ? 'yes' : 'no'; }` names none of the four and PASSES
 * it. No acceptance criterion is left exposed by that: for the only inputs the
 * read surface can deliver — `true`, `false`, `null`, `undefined` — `v ?` and
 * `v === true ?` render identically, so AC1 and AC2 hold either way. The
 * residue is a malformed stored flag (a truthy non-boolean such as `'yes'`),
 * which no acceptance criterion rules on and which this suite therefore does
 * not pin. Recorded so no one reads S4 as more than it is.
 *
 * ── Test classes (per test-hermeticity-ci/0001) ──────────────────────────
 *
 *   U-class (EXECUTED, stack-free, always gates CI) — the pure formatter
 *     module ui/src/utils/goalIntent.js, loaded by dynamic import of the plain
 *     .js (the harness cannot parse .jsx — the pov-notice-text precedent). This
 *     is the whole reason ADR 0003 puts the rules in a util instead of inline
 *     in three components: absence, the excerpt and the two estimate
 *     formatters become directly testable.
 *
 *   S-class (source assertions, stack-free, STRUCTURE-BOUNDED) — the things a
 *     pure function cannot show: that the three screens actually consume the
 *     module, that no screen re-decides absence by falsiness, that the d2
 *     boundary between the two estimate formatters is real, that the record
 *     spine and the runners-up stay clear of the four, that nothing sorts or
 *     colours by them, and that no new screen, route, component or design token
 *     appears. NO fixed-width src.slice anywhere (OPEN.md #109): regions are
 *     bounded by the next top-level declaration or by paren balance computed on
 *     a string/comment-masked copy that preserves offsets.
 *
 *   B-class — NOT IN THIS FILE. `tests/brainstorm/goal-intent-screens.spec.js`,
 *     run by `npm run test:playwright`. **The layer that can fail when nothing
 *     renders.** Gate 3 built a probe that imported this module into all three
 *     screens, named all four properties, called every formatter and rendered
 *     NONE of the results — and an earlier version of this file went 36 passed,
 *     0 failed against it. An S-class scan asserts a token appears IN A FILE;
 *     only a browser asserts a value reaches A SCREEN. ADR 0003 Amendment 1
 *     authorizes that class; the S-class pins below stay exactly as ratified and
 *     remain the always-on layer, because B skips with no server.
 *
 *   H-class (live local stack, READ-ONLY, FIXTURE-FREE, per-test SKIP) — the
 *     three reads the three screens consume, over the REAL corpus. Its only job
 *     is ATTRIBUTION: if a screen shows nothing, these say whether the data was
 *     there. Nothing is written — the D-class of story 2 already supplies
 *     determinism, and writing fixtures into the definitive local-first graph
 *     (CLAUDE.md principle 4) would be risk with no coverage to show for it.
 *     This is a deliberate deviation from ADR 0003's suggested fixture pair,
 *     recorded in the test plan: the live corpus already contains every case
 *     the fixtures would have created (H1 asserts exactly that).
 *
 *   R-class (regression sentinels, stack-free, pass BEFORE and after) — the
 *     shipped pins from CLOSED books that this story must leave green,
 *     re-asserted against the NEW file contents, plus one they cannot reach:
 *     R5 scans the shared module, because moving owner-facing copy out of a
 *     .jsx moves it out of the four per-file jargon scans that guard it.
 *
 * ── Pass-by-design sentinels — 16 of the 37. They pass BEFORE the Implementer
 *    touches anything and must STILL pass after. Stated here so a green line is
 *    never mistaken for evidence the feature landed: ──
 *      S5 S6 S9 S10 S11 S12  no new screen/route, no ordering, the spine and the
 *                            runners-up clear, hooks and design tokens untouched,
 *                            and the record-rendering screen still whole (AC1's
 *                            record clause is a REGRESSION GUARD, not a
 *                            capability test — ADR 0003 Amendment 1)
 *      H1 H2 H3 H4 H5        the live reads (story 2 shipped them)
 *      R1 R2 R3 R4 R6        the closed-book pins + the story-1/2 contracts
 *    (R5 fails today only because the file it scans does not exist yet.)
 *    The other 21 FAIL until the feature lands. Verified by running the suite
 *    before any implementation existed: 16 passed, 21 failed, 0 skipped.
 *
 * ── Harness defects this suite is designed around (OPEN.md) ──
 *   #104/#106 — a fully-skipped H-class still reports suite PASS. run() prints
 *     an explicit `H-class: n executed / m skipped` line and shouts when the
 *     live class did not run; TAPESTRY_REQUIRE_LIVE=1 turns an all-skipped
 *     H-class into a suite FAILURE. The reachability probe retries.
 *   #108 — vacuous iteration. Every loop asserts ARITY first, and every sweep
 *     counts the comparisons it actually made and fails if that count is zero.
 *     H4 returns SKIP (not PASS) when the live proposal queue is empty.
 *   #109 — byte-offset source assertions. No fixed-width src.slice anywhere.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');

/* the client files this story is allowed to change */
const GOAL_INTENT = path.join(ROOT, 'ui/src/utils/goalIntent.js');
const GOALS_PAGE = path.join(ROOT, 'ui/src/pages/brain/Goals.jsx');
const DETAIL_PAGE = path.join(ROOT, 'ui/src/pages/brain/GoalDetail.jsx');
const PROPOSALS_PAGE = path.join(ROOT, 'ui/src/pages/brain/Proposals.jsx');
const STYLES_CSS = path.join(ROOT, 'ui/src/styles.css');
/* the client files this story may NOT change */
const BRAIN_PAGES_DIR = path.join(ROOT, 'ui/src/pages/brain');
const APP_JSX = path.join(ROOT, 'ui/src/App.jsx');
const LAYOUT_JSX = path.join(ROOT, 'ui/src/components/Layout.jsx');
/** AC1's record-rendering clause maps here and nowhere else (ADR 0003 Amendment 1). */
const ELEMENT_DETAIL = path.join(ROOT, 'ui/src/pages/concepts/ElementDetail.jsx');
const HOOKS = [
  path.join(ROOT, 'ui/src/hooks/useBrainGoals.js'),
  path.join(ROOT, 'ui/src/hooks/useBrainGoalDetail.js'),
  path.join(ROOT, 'ui/src/hooks/useBrainProposals.js'),
];
/* the server halves this story rests on and must not touch */
const GOALS_CORE = path.join(ROOT, 'src/lib/brain/goals.js');

const CONTAINER = process.env.TAPESTRY_CONTAINER || 'tapestry';
const HOST_BASE = `http://localhost:${process.env.TAPESTRY_PORT || '7778'}`;
const CONTAINER_BASE = `http://127.0.0.1:${process.env.TAPESTRY_CONTAINER_PORT || '7778'}`;

/**
 * THE SPEC's own list — the four in the concept's declared names and order.
 * Every loop iterates THIS, never a constant the implementation exports: a loop
 * over an absent/empty export would run zero bodies and pass vacuously
 * (OPEN.md row 108).
 */
const FOUR = ['prompt', 'chanceOfSuccess', 'needsHumanInput', 'needsBreakdown'];

/** The three projecting screens the story enumerates — closed, per ADR 0003. */
const THREE_SCREENS = [
  [GOALS_PAGE, 'ui/src/pages/brain/Goals.jsx (the Goals list)'],
  [DETAIL_PAGE, 'ui/src/pages/brain/GoalDetail.jsx (the Goal detail)'],
  [PROPOSALS_PAGE, 'ui/src/pages/brain/Proposals.jsx (the Proposals card)'],
];

/* ── frozen inventories: AC3's "no new screen and no new route" ──────────────
 * Measured 2026-07-27 on this branch, with the regexes used below. A story that
 * legitimately adds a route/nav entry/design token updates these three numbers
 * AND says so in its own artifacts — that is the point of freezing them.
 * Re-measured 2026-07-29 for PR #480 (goals submenu + Rationale/GoalSets/
 * GoalPlaceholders): +3 screens, +4 route entries, +4 nav destinations; CSS
 * custom properties unchanged at 45. Operator-authorized re-pin.
 */
const BRAIN_PAGE_FILES = ['GoalDetail.jsx', 'GoalPlaceholders.jsx', 'GoalSets.jsx', 'Goals.jsx', 'Proposals.jsx', 'Rationale.jsx'];
const ROUTE_PATH_ENTRIES = 108;
const NAV_TO_ENTRIES = 25;
const CSS_CUSTOM_PROPERTIES = 45;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function short(x, n = 300) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : s.slice(0, n);
}
/** JSON-quoted, so whitespace and type differences are visible in a failure. */
function quoted(x, n = 240) { return String(JSON.stringify(x)).slice(0, n); }
function rel(p) { return path.relative(ROOT, p); }

/* ══════════════════════════════════════════════════════════════════════
   Structure-bounded source extraction — never a byte window (OPEN.md #109)
   ══════════════════════════════════════════════════════════════════════ */

/**
 * Blank out every comment, PRESERVING OFFSETS and newlines. Comments must be
 * masked before any pattern scan: ADR 0003 d3 instructs the Implementer to
 * write a header comment that QUOTES the falsiness bug (`if (!goal.prompt)`)
 * in order to warn against it, and a scan that read comments would fail on
 * exactly the code that documents itself best.
 */
function maskComments(src) {
  const out = src.split('');
  const blank = (i) => { if (src[i] !== '\n') out[i] = ' '; };
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') { blank(i); i += 1; } continue; }
    if (c === '/' && n === '*') {
      blank(i); blank(i + 1); i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { blank(i); i += 1; }
      if (i < src.length) { blank(i); blank(i + 1); i += 2; }
      continue;
    }
    i += 1;
  }
  return out.join('');
}

/**
 * Comments PLUS string literals blanked, offsets preserved, so paren balance
 * can be computed without a `(` inside a string throwing the count off (which
 * would silently over-read a region into unrelated JSX — the #109 failure mode
 * one layer up).
 *
 * The apostrophe rule is not a nicety. A first draft of this masker treated
 * every `'` as a string delimiter and the apostrophe in the JSX prose
 * "The proposer couldn't run" opened a phantom string that swallowed 40 lines
 * of Proposals.jsx — including the whole passedOver block S9 bounds. A quote
 * is therefore only treated as a delimiter when its partner is on the SAME
 * line, which is true of every real single/double-quoted JS string (they
 * cannot span lines) and false of apostrophes in JSX text. Template literals,
 * which legitimately span lines, keep the multi-line treatment.
 */
function maskLiterals(src) {
  const masked = maskComments(src);
  const out = masked.split('');
  const blank = (i) => { if (masked[i] !== '\n') out[i] = ' '; };
  const lineEnd = (from) => { const j = masked.indexOf('\n', from); return j === -1 ? masked.length : j; };
  let i = 0;
  while (i < masked.length) {
    const c = masked[i];
    if (c === '`') {
      blank(i); i += 1;
      while (i < masked.length) {
        if (masked[i] === '\\') { blank(i); blank(i + 1); i += 2; continue; }
        if (masked[i] === '`') { blank(i); i += 1; break; }
        blank(i); i += 1;
      }
      continue;
    }
    if (c === "'" || c === '"') {
      const end = lineEnd(i);
      let j = i + 1;
      let close = -1;
      while (j < end) {
        if (masked[j] === '\\') { j += 2; continue; }
        if (masked[j] === c) { close = j; break; }
        j += 1;
      }
      if (close === -1) { i += 1; continue; }   // JSX prose apostrophe — not a string
      for (let k = i; k <= close; k += 1) blank(k);
      i = close + 1;
      continue;
    }
    i += 1;
  }
  return out.join('');
}

/**
 * The [start, end) of the balanced parenthesised region beginning at `open`
 * (which must index a `(` in the masked copy). Returns null when the source
 * runs out first — every caller treats that as a LOUD failure rather than
 * silently accepting a truncated or over-long region.
 */
function balancedParens(masked, open) {
  let depth = 0;
  for (let i = open; i < masked.length; i += 1) {
    if (masked[i] === '(') depth += 1;
    else if (masked[i] === ')') { depth -= 1; if (depth === 0) return [open, i + 1]; }
  }
  return null;
}

/**
 * Every call region for the named methods/helpers, bounded by paren balance.
 * `{ label, text }` where text is sliced from the ORIGINAL source (offsets are
 * preserved by maskLiterals), so the assertions read real code.
 */
function callRegions(src, file, patterns) {
  const masked = maskLiterals(src);
  const regions = [];
  for (const [label, re] of patterns) {
    const rx = new RegExp(re.source, 'g');
    let m;
    while ((m = rx.exec(masked)) !== null) {
      const open = masked.indexOf('(', m.index);
      assert(open !== -1, `${file}: could not find the argument list of ${label} at offset ${m.index}.`);
      const span = balancedParens(masked, open);
      assert(span, `${file}: the argument list of ${label} at offset ${open} is unbalanced — the region could not be ` +
        'bounded, so this assertion refuses to guess (OPEN.md #109).');
      regions.push({ label, text: src.slice(span[0], span[1]) });
    }
  }
  return regions;
}

/**
 * The source of one top-level function declaration, bounded by the NEXT
 * top-level declaration (never a fixed-width window). An unfound name returns
 * '' — every caller asserts non-empty FIRST, so a renamed function fails loudly
 * instead of matching nothing.
 */
function functionRegion(src, name) {
  const decl = new RegExp(`\\n(?:export\\s+default\\s+)?function\\s+${name}\\s*\\(`);
  const m = decl.exec(src);
  if (!m) return '';
  const start = m.index + 1;
  const after = start + (m[0].length - 1);
  const rest = src.slice(after);
  const next = rest.search(/\n(?:export\s+default\s+)?function\s+\w|\nconst\s+\w+\s*=|\nexport\s+(?:const|default|function)\s/);
  return next === -1 ? src.slice(start) : src.slice(start, after + next);
}

function needRegion(src, name, file) {
  const body = functionRegion(src, name);
  assert(body, `could not locate the top-level function \`${name}\` in ${file} — it was renamed or removed. ` +
    'This pin is structure-bounded on purpose (OPEN.md #109); it will not silently match nothing.');
  return body;
}

/** Which of the four a bounded source region names. */
function fourNamesIn(text) {
  return FOUR.filter((f) => new RegExp(`\\b${f}\\b`).test(text));
}

/** Owner-visible text of a .jsx: quoted strings plus JSX text nodes. */
function visibleText(src) {
  return [
    ...[...src.matchAll(/'([^'\\\n]*)'/g)].map((m) => m[1]),
    ...[...src.matchAll(/"([^"\\\n]*)"/g)].map((m) => m[1]),
    ...[...src.matchAll(/`([^`]*)`/g)].map((m) => m[1]),
    ...[...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
  ].join('\n');
}

/* ══════════════════════════════════════════════════════════════════════
   U-class loading — the pure formatter module (ESM, dynamic import)
   ══════════════════════════════════════════════════════════════════════ */

let intentModule = null;
async function loadGoalIntent() {
  if (intentModule) return intentModule;
  assert(fs.existsSync(GOAL_INTENT),
    'ui/src/utils/goalIntent.js does not exist yet. ADR 0003 d3 puts every absence rule and every owner-facing ' +
    'string for the four in ONE pure module that all three goal screens import — so the null-vs-0-vs-false ' +
    'discrimination is written once, where a reviewer can check it. Without it nothing can be shown.');
  try {
    intentModule = await import(pathToFileURL(GOAL_INTENT).href);
  } catch (e) {
    throw new Error(`ui/src/utils/goalIntent.js failed to import: ${e.message}. It must be a plain ES module ` +
      '(no React import, no JSX) so the stack-free harness can execute it.');
  }
  return intentModule;
}

async function need(name) {
  const mod = await loadGoalIntent();
  assert(typeof mod[name] === 'function',
    `ui/src/utils/goalIntent.js must export \`${name}()\` (ADR 0003 d3). Exports found: ${short(Object.keys(mod))}.`);
  return mod[name];
}

/** A long multi-line markdown prompt, modelled on the live 6 155-character one. */
const LONG_PROMPT = `# Session prompt

Read the goal, then orient before touching code.

${Array.from({ length: 160 }, (_, i) => `${i + 1}. step ${i + 1} — do the thing carefully and write down what happened`).join('\n')}

    indented   and   spaced

`;
const LONG_COLLAPSED = LONG_PROMPT.replace(/\s+/g, ' ').trim();
const SHORT_PROMPT = 'Read the goal, then stop and ask.';

/* ══════════════════════════════════════════════════════════════════════
   U-class — the pure formatter (stack-free, always executed)
   ══════════════════════════════════════════════════════════════════════ */

test('U1 (AC1/AC2): the three goal screens share one formatter that knows how to show each of the four', async () => {
  const mod = await loadGoalIntent();
  const wanted = ['promptDisplay', 'estimateLine', 'estimateLineOnProposalCard', 'flagWord'];
  assert(wanted.length === 4, 'the expected-export list changed shape.');
  const missing = wanted.filter((n) => typeof mod[n] !== 'function');
  assert(missing.length === 0,
    `ui/src/utils/goalIntent.js must export ${short(wanted)} (ADR 0003 d3) — one rule per property, plus the second ` +
    `estimate formatter d2 requires for the Proposals card. Missing: ${short(missing)}. Found: ${short(Object.keys(mod))}.`);
  assert(typeof mod.PROMPT_EXCERPT_MAX === 'number' && Number.isFinite(mod.PROMPT_EXCERPT_MAX) && mod.PROMPT_EXCERPT_MAX > 0,
    'it must also export PROMPT_EXCERPT_MAX — the bound that makes a list-screen excerpt an excerpt (AC1). ' +
    `Got ${quoted(mod.PROMPT_EXCERPT_MAX)}.`);
  // The owner-facing constants of ADR 0003 d3. The browser class builds every
  // expected on-screen string FROM THESE rather than hard-coding a sentence, so
  // the copy stays the operator's to reword — but a missing constant must fail
  // here, in one line, rather than as an obscure import error inside Playwright.
  const labels = ['LABEL_ESTIMATE', 'LABEL_NEEDS_YOU', 'LABEL_TOO_BIG', 'PROMPT_UNSET', 'ESTIMATE_UNSET_ON_CARD'];
  assert(labels.length === 5, 'the expected-constant list changed shape.');
  const missingLabels = labels.filter((n) => typeof mod[n] !== 'string' || mod[n].trim() === '');
  assert(missingLabels.length === 0,
    `ui/src/utils/goalIntent.js must export the owner-facing constants as non-empty strings (ADR 0003 d3): ` +
    `missing or empty ${short(missingLabels)}. tests/brainstorm/goal-intent-screens.spec.js asserts these exact ` +
    'strings reach the DOM, which is how "visible" is proved without pinning a sentence.');
});

test('U2 (AC1): an estimate the owner recorded is shown as the number they recorded', async () => {
  const estimateLine = await need('estimateLine');
  const onCard = await need('estimateLineOnProposalCard');
  for (const v of [75, 15, 100]) {
    const a = estimateLine(v);
    const b = onCard(v);
    assert(typeof a === 'string' && a.includes(String(v)),
      `the Goals list and the Goal detail show a recorded estimate as its number; estimateLine(${v}) gave ${quoted(a)}.`);
    assert(typeof b === 'string' && b.includes(String(v)),
      `and so does the Proposals card, which is the entire width of the ratified supersession of second-brain 0006 ` +
      `d13 (ADR 0003 d1); estimateLineOnProposalCard(${v}) gave ${quoted(b)}.`);
  }
});

test('U3 (AC2): on the Goals list and the Goal detail an estimate nobody set is shown at the declared default of 0', async () => {
  const estimateLine = await need('estimateLine');
  const never = estimateLine(null);
  const alsoNever = estimateLine(undefined);
  const storedZero = estimateLine(0);
  assert(typeof never === 'string' && never.length > 0, `estimateLine(null) must render something; got ${quoted(never)}.`);
  assert(!/\bnull\b|\bundefined\b|\bNaN\b/i.test(never),
    `a never-set estimate must never surface as a literal null/undefined/NaN — the screen APPLIES the concept's ` +
    `"The default is 0, if not otherwise estimated" (AC2). Got ${quoted(never)}.`);
  assert(never.includes('0'), `and the default it applies is 0; got ${quoted(never)}.`);
  assert(never === alsoNever, `undefined and null are both "never set" here; got ${quoted(never)} vs ${quoted(alsoNever)}.`);
  assert(storedZero === never,
    'AC2 read literally: on these two screens a never-set estimate shows the declared default 0, which is what a ' +
    `stored 0 shows too. Got ${quoted(storedZero)} vs ${quoted(never)}. (This test does NOT discriminate falsiness — ` +
    'U4 is the test that does. It is here because AC2 says these two must agree, and an implementation that made ' +
    'them disagree would be wrong in the other direction.)');
});

test('U4 (AC2/AC4 — THE discriminating test): on the Proposals card a stored 0 is a number and a never-set estimate is words', async () => {
  const onCard = await need('estimateLineOnProposalCard');
  const storedZero = onCard(0);
  const neverSet = onCard(null);
  const alsoNever = onCard(undefined);

  assert(typeof storedZero === 'string' && /0/.test(storedZero),
    'the owner recorded 0. That is a value they authored, so the card renders it as a number — the ratified ' +
    `supersession covers exactly this (ADR 0003 d1). estimateLineOnProposalCard(0) gave ${quoted(storedZero)}. ` +
    'AN IMPLEMENTATION THAT TESTS `!value` OR `value ? … : …` FAILS HERE, because a stored 0 is falsy and takes ' +
    'the never-set branch. Use `value == null`.');
  assert(typeof neverSet === 'string' && neverSet.length > 0,
    `a never-recorded estimate must still render something on the card; got ${quoted(neverSet)}.`);
  assert(storedZero !== neverSet,
    'a stored 0 and a never-recorded estimate must not render identically on this screen: one is the owner\'s own ' +
    `value, the other is nobody's. Both gave ${quoted(storedZero)}.`);
  assert(neverSet === alsoNever, `undefined and null are both "never recorded"; got ${quoted(neverSet)} vs ${quoted(alsoNever)}.`);
  assert(!/\d/.test(neverSet),
    'AC4: "On the Proposals screen the estimate appears as the owner\'s own recorded value." A screen-applied ' +
    'default is not the owner\'s value, so no digit may appear where the owner recorded nothing — that is the ' +
    'false-attribution second-brain 0006 d13 exists to prevent, and the supersession does not reach it ' +
    `(ADR 0003 d2). Got ${quoted(neverSet)}.`);
  assert(!/\bnull\b|\bundefined\b|\bNaN\b/i.test(neverSet),
    `and it must not surface as a literal null/undefined/NaN either; got ${quoted(neverSet)}.`);
});

test('U5 (ADR d2): the two estimate formatters agree wherever the owner recorded a value and differ only where nobody did', async () => {
  const estimateLine = await need('estimateLine');
  const onCard = await need('estimateLineOnProposalCard');
  for (const v of [0, 15, 75, 100]) {
    assert(estimateLine(v) === onCard(v),
      `where the owner recorded ${v}, every screen says the same thing — the split is about ABSENCE, not about ` +
      `screens disagreeing on a real value. Got ${quoted(estimateLine(v))} vs ${quoted(onCard(v))}.`);
  }
  assert(estimateLine(null) !== onCard(null),
    'estimateLineOnProposalCard is a CONTRACT, not a helper (ADR 0003 d2, Consequences): collapsing it into ' +
    'estimateLine puts a number nobody authored on a proposal card and re-opens second-brain 0006 d13. The two ' +
    `must differ for a never-set estimate; both gave ${quoted(estimateLine(null))}.`);
});

test('U6 (AC1/AC2): a flag set to true reads differently from one set to false, and a flag nobody set reads as the declared false', async () => {
  const flagWord = await need('flagWord');
  const yes = flagWord(true);
  const no = flagWord(false);
  const never = flagWord(undefined);
  const alsoNever = flagWord(null);
  for (const [label, v] of [['true', yes], ['false', no], ['undefined', never], ['null', alsoNever]]) {
    assert(typeof v === 'string' && v.length > 0, `flagWord(${label}) must render a word; got ${quoted(v)}.`);
    assert(!/\bnull\b|\bundefined\b/i.test(v), `flagWord(${label}) must not surface a literal null/undefined; got ${quoted(v)}.`);
  }
  assert(yes !== no, `a flag the owner set to true and one set to false must read differently; both gave ${quoted(yes)}.`);
  assert(never === no && alsoNever === no,
    'AC2: the concept declares "Absent means false", and the screen is where that is applied — so a flag nobody set ' +
    `reads exactly as a flag set to false. Got never-set ${quoted(never)} vs stored-false ${quoted(no)}. ` +
    'Note for the reviewer: this is the one property where stored-false and never-set are DELIBERATELY ' +
    'indistinguishable on screen, so falsiness cannot be caught here — S4 is the pin that catches it.');
});

test('U7 (AC2 — THE second discriminating test): a prompt nobody wrote, a prompt set to empty, and a prompt with text are three different things', async () => {
  const promptDisplay = await need('promptDisplay');
  const unset = promptDisplay(null);
  const unsetToo = promptDisplay(undefined);
  const empty = promptDisplay('');
  const blank = promptDisplay('   \n  \t ');
  const text = promptDisplay(SHORT_PROMPT);

  for (const [label, r] of [['null', unset], ['undefined', unsetToo], ["''", empty], ['whitespace', blank], ['text', text]]) {
    assert(r && typeof r === 'object' && typeof r.state === 'string' && typeof r.text === 'string',
      `promptDisplay(${label}) must answer { state, text } with both strings (ADR 0003 d4); got ${short(r)}.`);
  }
  assert(unset.state === 'unset' && unsetToo.state === 'unset',
    `a prompt that was never written is 'unset'; got ${quoted(unset.state)} / ${quoted(unsetToo.state)}.`);
  assert(empty.state === 'empty',
    "a prompt the owner set to an empty string is 'empty' — a DIFFERENT state. AN IMPLEMENTATION THAT TESTS " +
    `\`!prompt\` FAILS HERE, because '' is falsy and takes the never-set branch. Got ${quoted(empty.state)}.`);
  assert(blank.state === 'empty',
    `a prompt of nothing but whitespace is empty, not text and not unset; got ${quoted(blank.state)}.`);
  assert(text.state === 'text', `a prompt with words in it is text; got ${quoted(text.state)}.`);
  assert(unset.text !== empty.text,
    'AC2 in its own words: a never-set prompt shown as "an area indistinguishable from a prompt that was set to ' +
    `empty" does not satisfy it. Both rendered ${quoted(unset.text)}.`);
  assert(unset.text !== blank.text, `and the same for a whitespace-only prompt; both rendered ${quoted(unset.text)}.`);
});

test('U8 (AC2): a prompt nobody wrote says so in words — never a literal null, never a blank space', async () => {
  const promptDisplay = await need('promptDisplay');
  const { text } = promptDisplay(null);
  assert(typeof text === 'string' && text.trim().length > 0,
    `AC2: the prompt "is shown explicitly as not set". An empty or whitespace-only rendering is exactly the ` +
    `"indistinguishable" area AC2 rejects. Got ${quoted(text)}.`);
  assert(!/^\s*(null|undefined|NaN)\s*$/i.test(text) && !/\bnull\b|\bundefined\b/i.test(text),
    `AC2: "Rendering a literal null or undefined … does not satisfy this." Got ${quoted(text)}.`);
  assert(/[a-z]/i.test(text) && text.trim().split(/\s+/).length >= 2,
    `and it must read as words to the owner, not as a marker; got ${quoted(text)}.`);
});

test('U9 (AC1): on a list-type screen a long multi-line prompt becomes an excerpt of the prompt\'s own opening, on one line', async () => {
  const promptDisplay = await need('promptDisplay');
  const mod = await loadGoalIntent();
  const max = mod.PROMPT_EXCERPT_MAX;
  assert(typeof max === 'number' && Number.isFinite(max) && max > 0, `PROMPT_EXCERPT_MAX must be a positive number; got ${quoted(max)}.`);
  assert(LONG_PROMPT.length > 6000, 'the fixture prompt must be long enough to model the live 6 155-character one.');

  const r = promptDisplay(LONG_PROMPT);
  assert(r.state === 'text', `a long prompt is text; got ${quoted(r.state)}.`);
  assert(r.text.length < LONG_PROMPT.length,
    `AC1 says an EXCERPT on list-type screens; ${LONG_PROMPT.length} characters came back whole (${r.text.length}).`);
  assert(r.text.length <= max + 1,
    `the excerpt must respect its own bound: expected at most ${max} characters plus a truncation mark, got ${r.text.length}.`);
  assert(!/[\n\r]/.test(r.text),
    'a 160-line markdown prompt must not reflow a single row of a list — the excerpt is whitespace-collapsed ' +
    `(ADR 0003 d4). Got ${quoted(r.text, 200)}.`);
  const head = LONG_COLLAPSED.slice(0, Math.max(1, Math.min(20, max - 1)));
  assert(r.text.startsWith(head),
    'AC1: the excerpt is "an excerpt of the actual prompt" — a bare badge, an icon or a "has prompt" label ' +
    `satisfies nothing. It must begin with the prompt's own first characters ${quoted(head)}; got ${quoted(r.text, 200)}.`);
  assert(/…|\.\.\./.test(r.text.slice(-3)),
    `a truncated excerpt must say it was truncated; got ${quoted(r.text.slice(-12))}.`);
});

test('U10 (AC1): a prompt that already fits is shown whole, with no truncation mark', async () => {
  const promptDisplay = await need('promptDisplay');
  const mod = await loadGoalIntent();
  assert(SHORT_PROMPT.length < mod.PROMPT_EXCERPT_MAX, 'the short fixture must fit inside the excerpt bound.');
  const r = promptDisplay(SHORT_PROMPT);
  assert(r.text.includes(SHORT_PROMPT),
    `a prompt shorter than the bound is not an excerpt of anything — it is the prompt. Got ${quoted(r.text)}.`);
  assert(!/…|\.\.\.$/.test(r.text),
    `and it must carry no truncation mark, which would claim text that was never cut off. Got ${quoted(r.text)}.`);
});

test('U11 (AC1): the Goal detail gets the prompt in full — every line of it, exactly as stored', async () => {
  const promptDisplay = await need('promptDisplay');
  const r = promptDisplay(LONG_PROMPT, 0);
  assert(r.state === 'text', `the full-text call still reports state 'text'; got ${quoted(r.state)}.`);
  assert(r.text === LONG_PROMPT,
    'AC1: the prompt appears "in full on the goal detail screen". With truncation switched off the text must come ' +
    `through byte-identical — not collapsed, not trimmed, not re-escaped. Stored ${LONG_PROMPT.length} characters, ` +
    `got ${r.text.length}: ${quoted(r.text, 200)}`);
  assert(r.text.split('\n').length === LONG_PROMPT.split('\n').length,
    'the line count changed — something reflowed the prompt, and the detail screen preserves its line structure ' +
    '(ADR 0003 d4/d8: white-space: pre-wrap, never a markdown renderer).');
});

test('U12 (AC1, tolerance): a malformed stored estimate is shown as stored — the screen adds no type rule', async () => {
  const estimateLine = await need('estimateLine');
  const onCard = await need('estimateLineOnProposalCard');
  for (const [v, needle] of [['lots', 'lots'], [150, '150'], [-3, '-3'], ['75', '75']]) {
    assert(estimateLine(v).includes(needle),
      `type-validating or clamping on read is out of scope for this story (ADR 0003, Out of scope) — a malformed ` +
      `stored value renders as stored. estimateLine(${quoted(v)}) gave ${quoted(estimateLine(v))}.`);
    assert(onCard(v).includes(needle),
      `and the same on the Proposals card. estimateLineOnProposalCard(${quoted(v)}) gave ${quoted(onCard(v))}.`);
  }
});

test('U13 (AC2): every formatter answers without throwing for every value a stored record can hold', async () => {
  const promptDisplay = await need('promptDisplay');
  const estimateLine = await need('estimateLine');
  const onCard = await need('estimateLineOnProposalCard');
  const flagWord = await need('flagWord');
  const inputs = [null, undefined, '', '   ', 0, false, true, 42, 'text', {}, []];
  assert(inputs.length === 11, 'the tolerance-input list changed shape (arity guard, OPEN.md #108).');
  const fns = [['promptDisplay', promptDisplay], ['estimateLine', estimateLine],
    ['estimateLineOnProposalCard', onCard], ['flagWord', flagWord]];
  assert(fns.length === 4, 'the formatter list changed shape.');
  let checked = 0;
  for (const [name, fn] of fns) {
    for (const v of inputs) {
      let out;
      try { out = fn(v); }
      catch (e) { throw new Error(`${name}(${quoted(v)}) threw: ${e.message}. AC2: the screen "renders without error" ` +
        'whatever the record holds — a read path is tolerant by construction.'); }
      const ok = name === 'promptDisplay'
        ? (out && typeof out.state === 'string' && typeof out.text === 'string')
        : typeof out === 'string';
      assert(ok, `${name}(${quoted(v)}) answered ${short(out)} — the wrong shape.`);
      checked += 1;
    }
  }
  assert(checked === inputs.length * fns.length, `expected ${inputs.length * fns.length} checks; made ${checked}.`);
});

test('U14 (AC4): the shared formatter offers no way to rank, order or compare goals by the four', async () => {
  const mod = await loadGoalIntent();
  const names = Object.keys(mod);
  assert(names.length > 0, 'the module exports nothing to inspect.');
  for (const n of names) {
    assert(!/sort|order|rank|priorit|compare|score|gauge|percent|filter/i.test(n),
      `the four are CARRIED, never CONSULTED (AC4): the shared module must expose no ordering, ranking, ` +
      `prioritising or filtering helper. Found the export '${n}'.`);
  }
});

/* ══════════════════════════════════════════════════════════════════════
   S-class — structure-bounded source assertions (stack-free)
   ══════════════════════════════════════════════════════════════════════ */

test('S1 (story scope): the shared formatter is a plain utility, not a new component', () => {
  const src = safeRead(GOAL_INTENT);
  assert(src, 'ui/src/utils/goalIntent.js is missing or unreadable (see U1).');
  assert(!/from\s+['"]react['"]|require\s*\(\s*['"]react['"]\s*\)/.test(src),
    'the story puts "new design tokens or components invented for these four" OUT OF SCOPE. A module that imports ' +
    'React is a component in waiting; this one is a utility in the established ui/src/utils/ family (ADR 0003 d3).');
  assert(!/<\/[A-Za-z]|\/>/.test(src),
    'and it must contain no JSX for the same reason — and because the stack-free harness cannot parse it.');
});

test('S2 (AC1): all three goal screens draw their wording from the one shared formatter', () => {
  assert(THREE_SCREENS.length === 3, 'the projecting-screen inventory changed shape (arity guard, OPEN.md #108).');
  for (const [file, label] of THREE_SCREENS) {
    const src = safeRead(file);
    assert(src, `${label} is missing or unreadable — regression.`);
    assert(/from\s+['"][^'"]*utils\/goalIntent(\.js)?['"]/.test(src),
      `${label} must import ui/src/utils/goalIntent (ADR 0003 d3). One module means the three screens can never ` +
      'disagree about the same goal\'s absence rules, because there is one implementation of them.');
  }
});

test('S3 (AC1): all three goal screens render all four — the estimate, both flags, and the prompt as text', () => {
  for (const [file, label] of THREE_SCREENS) {
    const src = safeRead(file);
    assert(src, `${label} is missing or unreadable — regression.`);
    const named = fourNamesIn(src);
    assert(named.length === FOUR.length,
      `${label} must show all four (AC1). It names ${short(named)}; missing ${short(FOUR.filter((f) => !named.includes(f)))}.`);
    assert(/\bpromptDisplay\s*\(/.test(src),
      `${label} must put the prompt through promptDisplay() (ADR 0003 d5) — AC1 requires the prompt "as its own ` +
      'text", and a bare presence indicator (a badge, an icon, a "has prompt" label with none of the text) ' +
      'satisfies nothing, on any screen.');
    assert(/\bflagWord\s*\(/.test(src),
      `${label} must render both flags through flagWord() (ADR 0003 d5) — the declared default is applied at the screen.`);
  }
});

test('S4 (AC2 — the falsiness pin): no screen and no formatter decides "not set" by falsiness', () => {
  const files = [[GOAL_INTENT, 'ui/src/utils/goalIntent.js'], ...THREE_SCREENS];
  assert(files.length === 4, 'the falsiness-scan file list changed shape (arity guard, OPEN.md #108).');
  const four = FOUR.join('|');
  const negation = new RegExp(`(^|[^\\w.$])!\\s*(?:[\\w.$?]+\\.)?(${four})\\b`);
  const guard = new RegExp(`\\b(${four})\\s*(?:\\?(?!\\?)|\\|\\||&&)`);
  const ifTruthy = new RegExp(`\\bif\\s*\\(\\s*(?:[\\w.$?]+\\.)?(${four})\\s*\\)`);
  const boolCoerce = new RegExp(`\\bBoolean\\s*\\(\\s*(?:[\\w.$?]+\\.)?(${four})\\b`);
  let scanned = 0;
  for (const [file, label] of files) {
    const src = safeRead(file);
    assert(src, `${label} is missing or unreadable (see U1/S2).`);
    // Comments only: a falsiness pattern must never be hidden from this scan by
    // a string-masking heuristic. Comments ARE masked, because the ADR tells the
    // Implementer to quote the bug in the module header in order to warn off it.
    const code = maskComments(src);
    for (const [why, re] of [
      ['a bare negation (`!value`)', negation],
      ['a truthiness guard (`value ?` / `value ||` / `value &&`)', guard],
      ['a truthiness `if (value)`', ifTruthy],
      ['a Boolean() coercion', boolCoerce],
    ]) {
      const m = re.exec(code);
      assert(!m,
        `${label} decides absence with ${why} on '${m && m[m.length - 1]}'. THIS IS THE BUG THIS FEATURE ATTRACTS ` +
        '(ADR 0003 d3): `!goal.chanceOfSuccess` reads a stored 0 as never-set, `!goal.needsHumanInput` reads a ' +
        'stored false as never-set — and 5 live goals store exactly that — and `!goal.prompt` reads a prompt set ' +
        'to empty as never-set. Stories 1 and 2 guarantee only never-set arrives as null; test `value == null`. ' +
        'It also catches the bare presence indicator AC1 forbids (`{g.prompt && <span>has prompt</span>}`). ' +
        `Matched near: ${quoted(code.slice(Math.max(0, m ? m.index - 30 : 0), (m ? m.index : 0) + 70))}`);
      scanned += 1;
    }
  }
  assert(scanned === files.length * 4, `expected ${files.length * 4} scans; made ${scanned}.`);
  const modSrc = safeRead(GOAL_INTENT);
  assert(/[!=]==?\s*null|===\s*undefined/.test(maskComments(modSrc)),
    'and the module must test absence against null explicitly (`value == null`) — the positive half of the same ' +
    'rule. Not one nullish comparison appears in ui/src/utils/goalIntent.js.');
});

test('S5 (AC3): no new screen and no new route — the change lands only on the three screens that already exist', () => {
  const pages = fs.readdirSync(BRAIN_PAGES_DIR).filter((f) => !f.startsWith('.')).sort();
  assert(pages.length === BRAIN_PAGE_FILES.length && pages.every((p, i) => p === BRAIN_PAGE_FILES[i]),
    `AC3: no new screen is built. ui/src/pages/brain/ must hold exactly ${short(BRAIN_PAGE_FILES)}; got ${short(pages)}.`);

  const app = safeRead(APP_JSX);
  assert(app, 'ui/src/App.jsx is missing — regression.');
  const routePaths = [...app.matchAll(/\bpath:\s*['"`]([^'"`]*)['"`]/g)].map((m) => m[1]);
  assert(routePaths.length === ROUTE_PATH_ENTRIES,
    `AC3: no new route. ui/src/App.jsx carried ${ROUTE_PATH_ENTRIES} route path entries when this story was ` +
    `specified; it now carries ${routePaths.length}. AC3 holds by NON-ACTION — this file is untouched by this story.`);
  const suspicious = routePaths.filter((p) => /prompt|estimate|intent|chance|needs|flag/i.test(p));
  assert(suspicious.length === 0, `and no route may be named for the four; found ${short(suspicious)}.`);
  assert(/path:\s*['"`]goals['"`]/.test(app) && /path:\s*['"`]goals\/:slug['"`]/.test(app) && /path:\s*['"`]proposals['"`]/.test(app),
    'the three brain routes must still be registered exactly as they were (second-brain 0001 d5, 0004 d10, 0006 d12).');

  const layout = safeRead(LAYOUT_JSX);
  assert(layout, 'ui/src/components/Layout.jsx is missing — regression.');
  const navTo = [...layout.matchAll(/\bto:\s*['"`]([^'"`]*)['"`]/g)].map((m) => m[1]);
  assert(navTo.length === NAV_TO_ENTRIES,
    `AC3: no new nav entry either. ui/src/components/Layout.jsx carried ${NAV_TO_ENTRIES} nav destinations when ` +
    `this story was specified; it now carries ${navTo.length}.`);
});

test('S6 (AC4): nothing on these screens sorts, filters or groups by the four', () => {
  const patterns = [
    ['a .sort(', /\.\s*sort\s*\(/],
    ['a .filter(', /\.\s*filter\s*\(/],
    ['a .reduce(', /\.\s*reduce\s*\(/],
    ['a .reverse(', /\.\s*reverse\s*\(/],
    ['a .findIndex(', /\.\s*findIndex\s*\(/],
    ['a localeCompare(', /\.\s*localeCompare\s*\(/],
    ['a useMemo(', /\buseMemo\s*\(/],
  ];
  let total = 0;
  for (const [file, label] of THREE_SCREENS) {
    const src = safeRead(file);
    assert(src, `${label} is missing or unreadable — regression.`);
    const regions = callRegions(src, label, patterns);
    for (const r of regions) {
      const named = fourNamesIn(r.text);
      assert(named.length === 0,
        `${label}: ${r.label} region references ${short(named)}. AC4: "which goals appear, and in what order, is ` +
        'identical to before this story" — no sorting, filtering, grouping or badge-driven prioritization by the ' +
        `four is added. Region: ${quoted(r.text, 200)}`);
    }
    total += regions.length;
    assert(!/\b(goals|proposals|roots|records|pointers)\s*\.\s*(sort|filter|reverse)\s*\(/.test(maskComments(src)),
      `${label} must not reorder or thin the collection the server handed it — the render order is the server's ` +
      '(ADR 0003 d6).');
  }
  assert(total >= 2,
    `the AC4 region sweep found ${total} sort/filter/group regions across the three screens and would have passed ` +
    'vacuously (OPEN.md #108). At least the Goals list\'s useMemo grouping and its freshUuids filter must be found.');
});

test('S7 (AC4): none of the four drives a colour, a badge or a conditional style', () => {
  const four = new RegExp(`\\b(${FOUR.join('|')})\\b`);
  let lines = 0;
  for (const [file, label] of THREE_SCREENS) {
    const src = safeRead(file);
    assert(src, `${label} is missing or unreadable — regression.`);
    src.split('\n').forEach((line, i) => {
      if (!four.test(line)) return;
      lines += 1;
      assert(!/className=\{[^}]*[?|&]/.test(line),
        `${label}:${i + 1} makes a class conditional on one of the four. AC4 forbids "badge-driven prioritization", ` +
        `and a coloured "needs you" chip is exactly that (ADR 0003 d6) — the four render as plain words at the ` +
        `same weight as their neighbours. Line: ${quoted(line.trim(), 200)}`);
      assert(!/style=\{\{/.test(line),
        `${label}:${i + 1} attaches an inline style to one of the four — same rule (ADR 0003 d6). ` +
        `Line: ${quoted(line.trim(), 200)}`);
    });
  }
  assert(lines > 0,
    'not one line across the three screens mentions any of the four, so this sweep inspected nothing and would have ' +
    'passed vacuously (OPEN.md #108). The feature is not implemented.');
});

test('S8 (ADR d2): the words-only estimate belongs to the Proposals card, and the number-applying one never appears there', () => {
  const goals = safeRead(GOALS_PAGE);
  const detail = safeRead(DETAIL_PAGE);
  const proposals = safeRead(PROPOSALS_PAGE);
  assert(goals && detail && proposals, 'one of the three goal screens is missing or unreadable — regression.');
  const card = /\bestimateLineOnProposalCard\b/;
  const plain = /\bestimateLine\b/;   // word-bounded: does NOT match estimateLineOnProposalCard

  assert(card.test(proposals),
    'ui/src/pages/brain/Proposals.jsx must use estimateLineOnProposalCard (ADR 0003 d2) — the one place a ' +
    'never-recorded estimate must render in words rather than as a manufactured 0.');
  assert(!plain.test(proposals),
    'and it must NOT use estimateLine, which applies the declared default as a NUMBER. A manufactured 0 next to a ' +
    'real 75 reads as "the owner rates this one zero" — a false attribution, and the harm second-brain 0006 d13 ' +
    'exists to prevent. The ratified supersession covers owner-authored values only (ADR 0003 d1/d2).');
  for (const [src, label] of [[goals, 'Goals.jsx'], [detail, 'GoalDetail.jsx']]) {
    assert(plain.test(src),
      `${label} must use estimateLine — d13 does not reach these two screens, so AC2's declared default 0 applies ` +
      'there literally.');
    assert(!card.test(src),
      `${label} must NOT use estimateLineOnProposalCard — that formatter is scoped to the one screen d13 governs.`);
  }
});

test('S9 (ADR d1): the four never enter the goal\'s record spine and never attach to a runner-up', () => {
  const detail = safeRead(DETAIL_PAGE);
  assert(detail, 'ui/src/pages/brain/GoalDetail.jsx is missing — regression.');
  const recordEntry = needRegion(detail, 'RecordEntry', 'ui/src/pages/brain/GoalDetail.jsx');
  const namedInSpine = fourNamesIn(recordEntry);
  assert(namedInSpine.length === 0,
    `RecordEntry references ${short(namedInSpine)}. The goal detail's records list IS "spine content" under ` +
    'second-brain 0006 d13, which this story narrows only for the proposal card — the four belong in the intent ' +
    'block at the top of the page, never inside a record entry (ADR 0003 d1).');

  const proposals = safeRead(PROPOSALS_PAGE);
  assert(proposals, 'ui/src/pages/brain/Proposals.jsx is missing — regression.');
  const runnerRegions = callRegions(proposals, 'Proposals.jsx', [['the passedOver map', /\bpassedOver\s*\.\s*map\s*\(/]]);
  assert(runnerRegions.length >= 1,
    'the passed-over runners-up block was not found in Proposals.jsx — this pin refuses to guess (OPEN.md #109/#108).');
  for (const r of runnerRegions) {
    const named = fourNamesIn(r.text);
    assert(named.length === 0,
      `a runner-up entry references ${short(named)}. d13's reach over passedOver is NOT superseded: attaching any ` +
      'number to a runner-up remains forbidden outright — it is the ranking d13 was written against (ADR 0003 d1). ' +
      `Region: ${quoted(r.text, 200)}`);
  }
  assert(!new RegExp(`passedOver[^\\n]*\\b(${FOUR.join('|')})\\b|\\b(${FOUR.join('|')})\\b[^\\n]*passedOver`).test(proposals),
    'and none of the four may appear on the same line as passedOver.');
});

test('S10 (ADR d7): the three brain hooks are untouched — they already pass the four through', () => {
  assert(HOOKS.length === 3, 'the hook list changed shape (arity guard, OPEN.md #108).');
  for (const f of HOOKS) {
    const src = safeRead(f);
    assert(src, `${rel(f)} is missing — regression.`);
    const named = fourNamesIn(src);
    assert(named.length === 0,
      `${rel(f)} names ${short(named)}. All three hooks pass the parsed JSON straight through with no key ` +
      'whitelist, so no hook changes and a hook diff is a defect (ADR 0003 d7). If a screen cannot get a value, ' +
      'that is story 2\'s gap, not this story\'s.');
    assert(/setGoals|setGoal\b|setProposals/.test(src), `${rel(f)} must still hand the parsed response straight to state.`);
  }
});

test('S11 (story scope): no new design token is invented for the four', () => {
  const css = safeRead(STYLES_CSS);
  assert(css, 'ui/src/styles.css is missing — regression.');
  const props = [...css.matchAll(/(^|[;{\s])(--[A-Za-z0-9_-]+)\s*:/g)].map((m) => m[2]);
  assert(props.length > 0, 'no custom properties found in styles.css — the scan matched nothing (OPEN.md #108).');
  const named = props.filter((p) => /prompt|estimate|intent|chance|needs|flag/i.test(p));
  assert(named.length === 0,
    `the story puts "new design tokens … invented for these four" OUT OF SCOPE; found ${short(named)}.`);
  assert(props.length === CSS_CUSTOM_PROPERTIES,
    `and no new custom property at all: styles.css defined ${CSS_CUSTOM_PROPERTIES} when this story was specified, ` +
    `and now defines ${props.length}. Everything the four need reuses classes that already exist (ADR 0003 d8).`);
});

test('S12 (AC1, the record-rendering clause — pass-by-design): the generic element record view still stringifies the whole stored record', () => {
  const src = safeRead(ELEMENT_DETAIL);
  assert(src, 'ui/src/pages/concepts/ElementDetail.jsx is missing — regression.');
  // ADR 0003 Amendment 1's ruling: AC1's "on a record-rendering screen, all four
  // remain visible as stored" maps to EXACTLY THIS FILE, and it is a REGRESSION
  // GUARD, not a capability test. The capability is already true — stories 1 and
  // 2 made it so — because this view stringifies the WHOLE parsed record. The
  // only thing this story could do is break it, so that is all this asserts.
  const whole = [...src.matchAll(/JSON\.stringify\(\s*fullJson\s*,/g)];
  assert(whole.length >= 2,
    'the record view must still render the whole parsed record via JSON.stringify(fullJson, …) — the story\'s ' +
    `named record-rendering member (ElementDetail.jsx :403 / :545). Found ${whole.length} of the 2 expected sites.`);
  const masked = maskComments(src);
  for (const bad of [/JSON\.stringify\(\s*\{\s*\.\.\.\s*fullJson\s*\}\s*,\s*\[/, /\bpick\s*\(\s*fullJson/, /\bomit\s*\(\s*fullJson/]) {
    assert(!bad.test(masked),
      'and it must render the record WHOLE — no key whitelist, no pick/omit, no destructured subset. A filter ' +
      'here would hide the four the moment they are stored, which is the one way this story could break a ' +
      'screen it is forbidden to touch (ADR 0003 Amendment 1).');
  }
  const named = fourNamesIn(src);
  assert(named.length === 0,
    `ElementDetail.jsx names ${short(named)}. This story does not touch it — the four appear there by virtue of ` +
    'being in the record, not by anything this story does (ADR 0003, "Unchanged, deliberately"). ' +
    'A diff naming them here is a defect.');
});

/* ══════════════════════════════════════════════════════════════════════
   H-class — the live stack, READ-ONLY and FIXTURE-FREE (SKIP when absent)
   ══════════════════════════════════════════════════════════════════════ */

function dockerCurl(args, timeout = 20000) {
  return cp.execFileSync('docker', ['exec', CONTAINER, 'curl', ...args], { encoding: 'utf8', timeout });
}
function loopbackGetJson(pathname, timeout = 20000) {
  const out = dockerCurl(['-s', '-m', '40', `${CONTAINER_BASE}${pathname}`], timeout + 25000);
  try { return JSON.parse(out); }
  catch { throw new Error(`loopback GET ${pathname} did not return JSON: ${short(out)}`); }
}

/**
 * Reachability, RETRIED. The single-shot probe is a recorded false-negative
 * source (OPEN.md #104/#106): identical code flipped ten H tests between
 * executed and skipped across consecutive runs.
 */
let reachable = null;
async function stackAvailable() {
  if (reachable !== null) return reachable;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let host = false;
    try {
      const r = await fetch(`${HOST_BASE}/api/auth/user-classification`, { signal: AbortSignal.timeout(5000) });
      host = r.ok;
    } catch { host = false; }
    let loopback = false;
    try {
      const out = dockerCurl(['-s', '-m', '5', `${CONTAINER_BASE}/api/auth/user-classification`], 12000);
      loopback = /"success"\s*:\s*true/.test(out);
    } catch { loopback = false; }
    if (host && loopback) { reachable = true; return reachable; }
  }
  reachable = false;
  return reachable;
}

let hExecuted = 0;
let hSkipped = 0;
/**
 * A live test that counts its own execution (OPEN.md #104/#106). A body may
 * itself return 'SKIP' when the live corpus cannot supply its case — that is
 * recorded as a SKIP, never as a pass (OPEN.md #108).
 */
function htest(name, fn) {
  test(name, async () => {
    if (!(await stackAvailable())) { hSkipped += 1; return 'SKIP'; }
    hExecuted += 1;
    const r = await fn();
    if (r === 'SKIP') { hExecuted -= 1; hSkipped += 1; return 'SKIP'; }
    return r;
  });
}

let liveGoals = null;
function goalsList() {
  if (!liveGoals) {
    const r = loopbackGetJson('/api/brain/goals', 40000);
    assert(r && r.success === true && Array.isArray(r.goals),
      `GET /api/brain/goals must answer {success, goals[]}; got ${short(r)}`);
    assert(r.goals.length > 0, 'the live goals list is empty — these live checks have nothing to read.');
    liveGoals = r.goals;
  }
  return liveGoals;
}

htest('H1 (evidence — pass-by-design): the live corpus still holds every case these screens must render', () => {
  const rows = goalsList();
  const census = {
    total: rows.length, withPrompt: 0, longestPrompt: 0, multiLinePrompt: 0,
    withEstimate: 0, storedFalse: 0, storedTrue: 0, noneOfTheFour: 0,
  };
  for (const g of rows) {
    if (g.prompt != null) {
      census.withPrompt += 1;
      census.longestPrompt = Math.max(census.longestPrompt, String(g.prompt).length);
      if (String(g.prompt).includes('\n')) census.multiLinePrompt += 1;
    }
    if (g.chanceOfSuccess != null) census.withEstimate += 1;
    if (g.needsHumanInput === false || g.needsBreakdown === false) census.storedFalse += 1;
    if (g.needsHumanInput === true || g.needsBreakdown === true) census.storedTrue += 1;
    if (FOUR.every((f) => g[f] == null)) census.noneOfTheFour += 1;
  }
  console.log(`      live corpus census: ${JSON.stringify(census)}`);

  assert(census.storedFalse > 0,
    'no live goal stores a flag as false any more. That is the evidence that makes the falsiness bug REAL rather ' +
    'than theoretical on this instance — the U/S classes still cover it, but the live claim can no longer be made.');
  assert(census.noneOfTheFour > 0,
    'every live goal now carries at least one of the four, so AC2\'s never-set case has no live evidence left.');
  assert(census.multiLinePrompt > 0 && census.longestPrompt > 1000,
    'no live goal carries a long multi-line prompt any more, so AC1\'s excerpt-vs-full-text split has no live ' +
    `evidence left. Census: ${JSON.stringify(census)}`);
  assert(census.withEstimate > 0, 'no live goal carries an estimate, so the recorded-value case has no live evidence.');
});

htest('H2 (attribution): every goal the Goals list serves already carries all four, so a blank screen is this story\'s defect', () => {
  const rows = goalsList();
  let checked = 0;
  for (const g of rows) {
    for (const f of FOUR) {
      assert(Object.prototype.hasOwnProperty.call(g, f),
        `GET /api/brain/goals row '${g.slug}' is missing the key '${f}'. That is a goal-intent-fields #2 regression, ` +
        'NOT a screen defect — this test exists so the two can be told apart.');
      checked += 1;
    }
  }
  assert(checked === rows.length * FOUR.length,
    `expected ${rows.length * FOUR.length} key checks; made ${checked} (OPEN.md #108).`);
});

htest('H3 (attribution): the goal detail read carries all four for a goal with a prompt and for a goal with none', () => {
  const rows = goalsList();
  const withPrompt = rows.find((g) => typeof g.prompt === 'string' && g.prompt.length > 0);
  const withNone = rows.find((g) => FOUR.every((f) => g[f] == null));
  assert(withPrompt && withNone, 'H1 should have caught a corpus missing either case first.');
  let checked = 0;
  for (const g of [withPrompt, withNone]) {
    const d = loopbackGetJson(`/api/brain/goals/${encodeURIComponent(g.slug)}`, 40000);
    assert(d && d.success === true && d.goal, `the detail read for '${g.slug}' answered ${short(d)}`);
    for (const f of FOUR) {
      assert(Object.prototype.hasOwnProperty.call(d.goal, f),
        `GET /api/brain/goals/${g.slug} is missing the key '${f}' — a story-2 regression, not a screen defect.`);
      checked += 1;
    }
  }
  assert(checked === 2 * FOUR.length, `expected ${2 * FOUR.length} key checks; made ${checked}.`);
  const back = loopbackGetJson(`/api/brain/goals/${encodeURIComponent(withPrompt.slug)}`, 40000);
  assert(back.goal.prompt === withPrompt.prompt,
    `'${withPrompt.slug}': the detail read and the list read must agree on the prompt byte for byte, or the ` +
    'screens are being handed two different values.');
});

htest('H4 (attribution + AC4): the open proposal card carries all four, and today\'s live case is a never-recorded estimate', () => {
  const q = loopbackGetJson('/api/brain/proposals', 40000);
  assert(q && q.success === true && Array.isArray(q.proposals),
    `GET /api/brain/proposals must answer {success, proposals[]}; got ${short(q)}`);
  if (q.proposals.length === 0) {
    console.log('      (the live proposal queue is empty — recorded as a SKIP, not a pass; OPEN.md #108)');
    return 'SKIP';
  }
  let checked = 0;
  let neverSetEstimates = 0;
  for (const card of q.proposals) {
    for (const f of FOUR) {
      assert(Object.prototype.hasOwnProperty.call(card, f),
        `the proposal card for goal '${card.goal}' is missing the key '${f}' — a story-2 regression, not a screen defect.`);
      checked += 1;
    }
    if (card.chanceOfSuccess == null) neverSetEstimates += 1;
  }
  assert(checked === q.proposals.length * FOUR.length, `expected ${q.proposals.length * FOUR.length} checks; made ${checked}.`);
  console.log(`      live proposal queue: ${q.proposals.length} open, ${neverSetEstimates} with no recorded estimate`);
  assert(neverSetEstimates > 0,
    'no open proposal nominates a goal without an estimate, so ADR 0003 d2\'s live case — the one where the card ' +
    'must say the default in WORDS rather than render a manufactured 0 — has no live evidence right now. The ' +
    'U-class still covers it deterministically (U4).');
});

htest('H5 (second-brain 0006 d13, what survives — pass-by-design): the live proposal card carries no key that reads as a score, rank or percentage', () => {
  const q = loopbackGetJson('/api/brain/proposals', 40000);
  assert(q && q.success === true && Array.isArray(q.proposals), `the queue must answer {success, proposals[]}; got ${short(q)}`);
  if (q.proposals.length === 0) {
    console.log('      (the live queue is empty — recorded as a SKIP, not a pass; OPEN.md #108)');
    return 'SKIP';
  }
  let checked = 0;
  for (const card of q.proposals) {
    const keys = Object.keys(card);
    assert(keys.length > 0, 'a card with no keys — nothing to inspect.');
    for (const k of keys) {
      assert(!/score|rank|percent/i.test(k),
        `the system-generated-ranking prohibition is NOT superseded (ADR 0003 d1): no computed score, gauge, ` +
        `percentage bar or ranking number may appear on a proposal card. Found key '${k}' — this is the-proposal-loop ` +
        'H2\'s pin, from a CLOSED book, restated so a break is attributed to this story.');
      checked += 1;
    }
  }
  assert(checked > 0, 'no card key was inspected (OPEN.md #108).');
});

/* ══════════════════════════════════════════════════════════════════════
   R-class — regression sentinels (pass BEFORE and after)
   ══════════════════════════════════════════════════════════════════════ */

test('R1 (second-brain 0006 d13 / the-proposal-loop S11+S13): the Proposals view still shows no computed score, and no exclamation mark', () => {
  const src = safeRead(PROPOSALS_PAGE);
  assert(src, 'ui/src/pages/brain/Proposals.jsx is missing — regression.');
  assert(!/\bscore\b|\brank\b|\bpercent|\bgauge\b|★|⭐|toFixed\s*\(/i.test(src),
    'the-proposal-loop S11 scans this WHOLE FILE, comments included, and it is a shipped pin from a closed book. ' +
    'The supersession this story carries is narrow by design: it licenses rendering the owner\'s own ' +
    'chanceOfSuccess, and introduces none of these tokens (ADR 0003 d1). If the module docstring is being ' +
    'rewritten, the replacement text must avoid them too.');
  const jsxText = [...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]).join('\n');
  assert(!/!/.test(jsxText.replace(/[<>]/g, '')),
    'no exclamation marks in owner-facing copy (style guide; the-proposal-loop S13).');
  for (const w of ['element', 'kind', 'schema', 'pubkey', 'superset', 'concept header', 'persona', 'acceptance criteria', 'lease', 'payload', 'endpoint']) {
    assert(!new RegExp(`\\b${w}\\b`, 'i').test(visibleText(src)),
      `banned jargon "${w}" found in owner-visible text of Proposals.jsx (style guide; the-proposal-loop S13).`);
  }
});

test('R2 (capture-a-goal-and-see-it S5b/S7/S8): the Goals view still carries no control vocabulary, no future standing word, and no jargon', () => {
  const src = safeRead(GOALS_PAGE);
  assert(src, 'ui/src/pages/brain/Goals.jsx is missing — regression.');
  assert(!/toggle|checkbox|switch/i.test(src),
    'capture-a-goal-and-see-it S5b pins this file free of control vocabulary ANYWHERE in the file — so any future ' +
    'collapse affordance for a long prompt needs the disclose/expand family instead (ADR 0003, Consequences (b)).');
  for (const w of ['achieved', 'abandoned']) {
    assert(!new RegExp(`['"\`>]${w}['"\`<]`).test(src),
      `standing word "${w}" belongs to later stories (capture-a-goal-and-see-it S7).`);
  }
  for (const w of ['superset', 'pubkey', 'payload', 'concept header', 'acceptance criteria', 'lease']) {
    assert(!new RegExp(`\\b${w}\\b`, 'i').test(visibleText(src)),
      `banned jargon "${w}" found in owner-visible text of Goals.jsx (style guide; capture-a-goal-and-see-it S8).`);
  }
});

test('R3 (attach-the-world S6/S7 + sessions-read-the-brain S9/S10): the Goal detail stays display-only, with no way to inject markup', () => {
  const src = safeRead(DETAIL_PAGE);
  assert(src, 'ui/src/pages/brain/GoalDetail.jsx is missing — regression.');
  assert(!/<input\b|<textarea\b|contentEditable|onSubmit=|<form\b/i.test(src),
    'the story puts "any editing affordance" out of scope, and attach-the-world S7 / sessions-read-the-brain S9 ' +
    'already enforce it mechanically. Setting the four is story 1\'s write path, not a control on this page.');
  assert(!/deleteRecord|editRecord|removeEntry|onEdit|onDelete/i.test(src),
    'no per-entry edit/delete handler may exist — the ledger is the ledger (attach-the-world S7).');
  assert(!/<iframe|dangerouslySetInnerHTML|<embed|<object\b/.test(src),
    'attach-the-world S6 keeps this file free of markup injection, which is why the full prompt renders as PLAIN ' +
    'TEXT with its line structure preserved by CSS — never as markdown, and never through innerHTML (ADR 0003, Option F).');
  for (const w of ['superset', 'pubkey', 'payload', 'concept header', 'acceptance criteria', 'lease', 'schema', 'endpoint']) {
    assert(!new RegExp(`\\b${w}\\b`, 'i').test(visibleText(src)),
      `banned jargon "${w}" found in owner-visible text of GoalDetail.jsx (style guide; sessions-read-the-brain S10).`);
  }
});

test('R4 (teach-it-what-matters S12): the brain UI still references no priority-signal surface', () => {
  for (const [f, label] of [[DETAIL_PAGE, 'GoalDetail.jsx'], [APP_JSX, 'App.jsx'], [LAYOUT_JSX, 'Layout.jsx'], [STYLES_CSS, 'styles.css']]) {
    const src = safeRead(f);
    assert(src, `${label} is missing — regression.`);
    assert(!/priority-signal|prioritySignal|brain\/signals|record-priority-signal/i.test(src),
      `${label} must not reference signals (teach-it-what-matters S12) — this story adds intent display, not a ` +
      'second prioritisation surface.');
  }
});

test('R5 (the gap the shipped scans cannot reach): the shared formatter\'s owner-facing copy is held to the same register as the screens', () => {
  const src = safeRead(GOAL_INTENT);
  assert(src, 'ui/src/utils/goalIntent.js is missing or unreadable (see U1).');
  const strings = [
    ...[...src.matchAll(/'([^'\\\n]*)'/g)].map((m) => m[1]),
    ...[...src.matchAll(/"([^"\\\n]*)"/g)].map((m) => m[1]),
    ...[...src.matchAll(/`([^`]*)`/g)].map((m) => m[1]),
  ].join('\n');
  assert(strings.trim().length > 0, 'the module holds no strings to inspect — the owner-facing wording lives somewhere else.');
  assert(!/!/.test(strings),
    'no exclamation marks in owner-facing copy (style guide). Four shipped scans enforce this per-.jsx-file; moving ' +
    'the copy into a util moves it OUT of their reach, which is what this test closes.');
  assert(!/\bscore\b|\brank\b|\bpercent|\bgauge\b|★|⭐|toFixed\s*\(/i.test(src),
    'and the-proposal-loop S11\'s token ban follows the copy into the module — the strings it holds are rendered on ' +
    'the Proposals card.');
  for (const w of ['element', 'kind', 'schema', 'pubkey', 'superset', 'concept header', 'persona', 'acceptance criteria', 'lease', 'payload', 'endpoint']) {
    assert(!new RegExp(`\\b${w}\\b`, 'i').test(strings),
      `banned jargon "${w}" found in the shared module's owner-facing strings (style guide; the union of the four ` +
      'per-file scans that guard the three screens).');
  }
});

test('R6 (stories 1 and 2, stack-free): the write and read halves this story rests on are untouched', () => {
  assert(fs.existsSync(GOALS_CORE), 'src/lib/brain/goals.js is missing — a goal-intent-fields #1/#2 regression.');
  const core = require(GOALS_CORE);
  assert(typeof core.pickIntentFields === 'function' && typeof core.projectIntentFields === 'function',
    'goal-intent-fields #1 shipped pickIntentFields and #2 shipped projectIntentFields; both must survive — this ' +
    'story is CLIENT-ONLY, and a src/ diff means the extent was mis-derived (ADR 0003).');
  const written = core.pickIntentFields({ needsHumanInput: false });
  assert(Object.is(written.needsHumanInput, false) && !('chanceOfSuccess' in written),
    `on a stored record absence stays key-absence (story 1); got ${short(Object.keys(written))}.`);
  const none = core.projectIntentFields({});
  for (const f of FOUR) {
    assert(none[f] === null,
      `a never-set property still arrives at the screen as null, never as 0/false/'' (story 2, ADR 0002 d1) — that ` +
      `guarantee is what makes \`== null\` the right test at the screen. '${f}' came back ${quoted(none[f])}.`);
  }
  const stored = core.projectIntentFields({ chanceOfSuccess: 0, needsHumanInput: false, prompt: '' });
  assert(Object.is(stored.chanceOfSuccess, 0) && Object.is(stored.needsHumanInput, false) && stored.prompt === '',
    `and a stored 0 / false / empty prompt still arrives verbatim; got ${short(stored)}.`);
});

/* ══════════════════════════════════════════════════════════════════════ */

async function run() {
  console.log('\n=== show-the-four-on-the-goal-screens-that-already-exist (goal-intent-fields #3) ===');
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
  // OPEN.md #104/#106: a fully-skipped H-class is otherwise indistinguishable
  // from a real pass. Say so out loud, and let a gate demand live execution.
  console.log(`show-the-four: H-class ${hExecuted} executed / ${hSkipped} skipped`);
  if (hSkipped > 0 && hExecuted === 0) {
    console.log('show-the-four: !! LIVE COVERAGE DID NOT RUN — every H-class assertion skipped (stack unreachable or ' +
      'the live queue was empty). The U-class still drove the formatter stack-free, and the S-class still bounded ' +
      'the three screens.');
    if (process.env.TAPESTRY_REQUIRE_LIVE === '1') {
      const msg = 'TAPESTRY_REQUIRE_LIVE=1 was set but the whole H-class skipped — the live stack was unreachable.';
      console.log(`  FAIL  H-class execution required\n        ${msg}`);
      failures.push({ name: 'H-class execution required', message: msg });
      fail++;
    }
  }
  console.log(`\nshow-the-four-on-the-goal-screens-that-already-exist: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped, hExecuted, hSkipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
