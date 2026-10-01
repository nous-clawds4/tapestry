'use strict';
/**
 * Tests for Story 4 (epic tagging-edges) — the Tagging pipeline panel: the code guard.
 *
 * Story: engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md — "Explanations" (each outcome, reason
 *        code, path state and setup-problem code the status can carry today is shown as the code plus a sentence that
 *        is not the code itself; an unknown code reads "not recognised"), AC-3 (the eight path states, named) and AC-5
 *        (every state has its own text; no emoji, no exclamation marks).
 * ADR:   engineering-team/decisions/tagging-edges/0004-tagging-pipeline-panel.md — § Implementation notes → UI
 *        (EXPLANATIONS, FAMILIES, explain), § Seams for Test Design ("The guard test"), and § Clarifications T3
 *        (setupProblemKey is 'identity:<problem>' or 'schema:<rule>:<problem>') and T6 (explain).
 *
 * What this suite does. It builds the inventory of codes the status routes can carry TODAY by reading the producers
 * themselves — exactly the extractions § Seams lists — and then asks the panel's view module whether it recognises
 * each one. A code a producer adds later without a sentence fails here by name.
 *
 * Classes:
 *   PC1–PC17  — extraction and floor. Each reads one producer (comments stripped by codeOnly, the
 *               assistant-identification-tags-page precedent) or one exported enum, and asserts at least TODAY's count
 *               (computed on 88af7df3 and written below), so a literal that moves out of the extraction's reach fails
 *               loudly instead of silently shrinking the inventory. These PASS now: the producers exist.
 *   PC18–PC34 — own sentence. Every extracted code of a fixed-code kind has its OWN entry in EXPLANATIONS[kind]
 *               (own property), and explain(kind, code) returns { code: as given, text: that entry, recognised: true }
 *               — ADR § UI: "one sentence per code the guard test lists", so a FAMILIES pattern cannot stand in for
 *               it. PC27 (the confirmationWhy template prefixes) is the one family input here and checks recognition
 *               only.
 *   PC35–PC40 — FAMILIES examples (recognition only), the fixed fetch codes (own sentence, PC36), and the copy rules at
 *               run time (every sentence non-empty, no '!', no emoji, no bare "an error occurred", not its own code).
 *               PC37 is retired: EXPLANATIONS' frozen 17-kind shape is the view suite's TV2, and FAMILIES' entry shape
 *               its TV3; PC40 keeps only the copy rules TV3 lacks.
 *   PC41      — story 4's review, round 1 (Non-blocking 10): 'EBADJSON', the status route's own damaged-file code, has
 *               its own countCode sentence that says the file is damaged, not the E-family's operating-system one.
 *   PC18–PC40 FAIL now (red phase): ui/src/utils/taggingPipelineView.js does not exist yet. The loader turns the
 *   missing file into "<file> not implemented yet: it does not export <name> (ADR 0004 § …)", so the suite always
 *   loads and each test fails by name; a file that exists but fails to load says so instead.
 *
 * Test Design readings (for the owner at the gate):
 *   - "Not its own code" (PC39) is read as the story reads it — "the sentence is not the code itself". A sentence
 *     fails only when (a) lower-cased, with '-', '_', '.', ':' turned into spaces and trailing punctuation trimmed,
 *     it equals the code treated the same way ("Done." for 'done'; "report not held" for 'report-not-held'); or
 *     (b) the code contains '-', '_', ':' or '.' and appears in the sentence verbatim as a whole token (jargon such
 *     as 'report-not-held' or 'not-64-hex'). A plain one-word code may appear in ordinary English: "A read of the
 *     relay failed." is a fine sentence for 'read'.
 *   - "It never says 'an error occurred' without saying what to do" (ADR § UI; product-team/guardrails/language.md)
 *     is checked as: a sentence matching /\b(an? )?error (has )?occurred\b/i must have a second clause ('.', ';' or
 *     ' — ' before its end).
 *   - setupProblem's schema keys are the product of the rules and problems at realtime/index.js:929-931 (ADR § Seams:
 *     "the product of the schema rules and problems"): 2 rules × 2 problems = 4 keys, one of which
 *     (nostrUser_pubkey:not-online) no producer writes today.
 *   - The two confirmationWhy template prefixes are checked as prefix + 'error' (the producer's own fallback when the
 *     error has no code) and prefix + 'ENOENT'.
 *   - fetchCode's fixed codes (network, timeout, bad-json) come from § UI's readSection, which has no producer yet;
 *     PC36 lists them from the ADR rather than extracting them.
 *
 * Hermetic: reads source files and requires three stack-free lib modules; no network, graph, relay or host state.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const REPO = path.join(__dirname, '..');
const NL = String.fromCharCode(10);

const RUNNER_REL = 'src/pipeline/tagging-edges/reconcileTaggingEdges.js';
const REALTIME_REL = 'src/pipeline/tagging-edges/realtime/index.js';
const ROUTE_REL = 'src/api/tagging-edges/realtime.js';
const GRAPH_REL = 'src/pipeline/tagging-edges/graph.js';
const SWEEP_REL = 'src/lib/tagging-edges/sweep.js';
const LIB_RT_REL = 'src/lib/tagging-edges/realtime.js';
const CONTRACT_REL = 'src/lib/tagging-edges/contract.js';
const VIEW_REL = 'ui/src/utils/taggingPipelineView.js';

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
const show = (v) => JSON.stringify(v);

/* ─── Source reading ─── */

function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
    .split(NL)
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join(NL);
}
function source(rel) {
  let raw;
  try { raw = fs.readFileSync(path.join(REPO, rel), 'utf8'); } catch (e) {
    throw new Error(`${rel} could not be read (${e.code}) — the guard reads this producer (ADR 0004 § Seams for Test Design)`);
  }
  return codeOnly(raw);
}
function allMatches(src, re, group = 1) {
  const out = [];
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  let m;
  while ((m = g.exec(src)) !== null) out.push(m[group]);
  return out;
}
const uniq = (xs) => [...new Set(xs)];
/** The text between the `{` that follows `header` and its matching `}` (brace counting; enough for these bodies). */
function bodyAfter(src, header, rel) {
  const at = src.indexOf(header);
  assert(at !== -1, `${rel} no longer contains "${header}" — the guard's extraction must follow it (ADR 0004 § Seams for Test Design)`);
  // A function's body opens after its parameter list (which may itself destructure with braces).
  const open = header.startsWith('function ') ? src.indexOf(') {', at) + 2 : src.indexOf('{', at + header.length - 1);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  throw new Error(`${rel}: the block after "${header}" never closes`);
}
function requireLib(rel) {
  try { return require(path.join(REPO, rel)); } catch (e) {
    throw new Error(`${rel} could not be required stack-free (${e.message}) — the guard reads its exports (ADR 0004 § Seams for Test Design)`);
  }
}
function floor(kind, codes, n, where) {
  assert(codes.length >= n,
    `${kind}: the extraction from ${where} found ${codes.length} code(s), below today's floor of ${n} — a literal moved out ` +
    `of the guard's reach, or the producer changed shape; update the extraction, never lower the floor to pass ` +
    `(ADR 0004 § Seams: "Each extraction asserts a floor at today's count"). Found: ${show(codes)}`);
}

/* ─── The extractions (ADR 0004 § Seams for Test Design → "The guard test") ─── */

const NOT_STARTED = ['lock-busy', 'not-started-under-the-lock'];

const extract = {
  /** finish('…' and the pessimistic record's outcome: 'failed'. */
  passOutcome() {
    const src = source(RUNNER_REL);
    const fromFinish = allMatches(src, /\bfinish\('([^']+)'/);
    const pessimistic = allMatches(bodyAfter(src, 'function pessimisticRecord(', RUNNER_REL), /\boutcome:\s*'([^']+)'/);
    assert(pessimistic.length === 1 && pessimistic[0] === 'failed',
      `${RUNNER_REL}: pessimisticRecord no longer writes outcome: 'failed' (found ${show(pessimistic)}) — ADR 0004 § Seams`);
    return uniq([...fromFinish, ...pessimistic]);
  },
  /** First argument of refuse('…' / fail('…', and reasonCode: '…', without the not-started family. */
  passReason() {
    const src = source(RUNNER_REL);
    return uniq([
      ...allMatches(src, /\brefuse\('([^']+)'/),
      ...allMatches(src, /\bfail\('([^']+)'/),
      ...allMatches(src, /\breasonCode:\s*'([^']+)'/),
    ]).filter((c) => !NOT_STARTED.includes(c));
  },
  /** stage: '…' and fsFailure('…'. */
  failureStage() {
    const src = source(RUNNER_REL);
    return uniq([...allMatches(src, /\bstage:\s*'([^']+)'/), ...allMatches(src, /\bfsFailure\('([^']+)'/)]);
  },
  /** read: '…', plus 'graph-verify' (the port sets it, the runner copies it). */
  failureRead() {
    const src = source(RUNNER_REL);
    const graphSrc = source(GRAPH_REL);
    assert(/'graph-verify'/.test(graphSrc), `${GRAPH_REL} no longer sets 'graph-verify' on its error (ADR 0004 § Seams, graph.js:325)`);
    assert(/\.read\s*===\s*'graph-verify'/.test(src), `${RUNNER_REL} no longer copies read 'graph-verify' (ADR 0004 § Seams, reconcileTaggingEdges.js:488)`);
    return uniq([...allMatches(src, /\bread:\s*'([^']+)'/), 'graph-verify']);
  },
  /** why: '…' literals. */
  confirmationWhy() {
    return uniq(allMatches(source(RUNNER_REL), /\bwhy:\s*'([^']+)'/));
  },
  /** The template prefixes: why: `<prefix>${…}`. */
  confirmationWhyPrefixes() {
    return uniq(allMatches(source(RUNNER_REL), /\bwhy:\s*`([^`$]+)\$\{/));
  },
  refusedReason() { return uniq(Object.values(requireLib(CONTRACT_REL).REFUSAL || {})); },
  heldReason() { return uniq(Object.values(requireLib(SWEEP_REL).REMOVAL_REASON || {})); },
  leftInPlaceReason() { return uniq(Object.values(requireLib(SWEEP_REL).LEFT_REASON || {})); },
  changeKind() { return uniq(Object.values(requireLib(SWEEP_REL).CHANGE_KIND || {})); },
  /** Every literal a return inside currentState() can yield (ternaries included; comparands excluded). */
  pathStateFromCurrentState() {
    const body = bodyAfter(source(REALTIME_REL), 'function currentState()', REALTIME_REL);
    const out = [];
    for (const expr of allMatches(body, /\breturn\b([^;]*);/)) {
      // Walk the literals left to right (each quote pair consumed once); drop a comparand (`=== '…'`).
      const lit = /'([^'\\]*)'/g;
      let m;
      while ((m = lit.exec(expr)) !== null) {
        if (!/[=!]==\s*$/.test(expr.slice(0, m.index))) out.push(m[1]);
      }
    }
    return uniq(out);
  },
  /** The route's forced state when the switch is off (src/api/tagging-edges/realtime.js:100). */
  pathStateForcedByRoute() {
    return uniq(allMatches(source(ROUTE_REL), /\bstate:\s*on\s*\?[^\n]*:\s*'([^']+)'\s*,/));
  },
  pathState() { return uniq([...extract.pathStateFromCurrentState(), ...extract.pathStateForcedByRoute()]); },
  /** The keys of STAGE_TEXT = Object.freeze({…}). */
  lastErrorStage() {
    const block = bodyAfter(source(REALTIME_REL), 'const STAGE_TEXT = Object.freeze(', REALTIME_REL);
    return uniq(allMatches(block, /(?:^|[{,\n])\s*(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))\s*:/m, 0)
      .map((m) => m.replace(/^[{,\s]+/, '').replace(/\s*:$/, '').replace(/^'|'$/g, '')));
  },
  /** The second argument of endCatchUp(, plus 'not-established'. */
  catchUpOutcome() {
    return uniq([...allMatches(source(REALTIME_REL), /\bendCatchUp\([^,()]+,\s*'([^']+)'/), 'not-established']);
  },
  /** The second argument of failCatchUp(. */
  catchUpStage() {
    return uniq(allMatches(source(REALTIME_REL), /\bfailCatchUp\([^,()]+,\s*'([^']+)'/));
  },
  /** The LOST_REASONS array. */
  notEstablishedReason() {
    const src = source(REALTIME_REL);
    const m = /const LOST_REASONS = Object\.freeze\(\[([^\]]*)\]\)/.exec(src);
    assert(m, `${REALTIME_REL} no longer declares LOST_REASONS = Object.freeze([...]) (ADR 0004 § Seams)`);
    return uniq(allMatches(m[1], /'([^']+)'/));
  },
  /** checkIdentity's returns (sweep.js:61-67), 'missing' among them. */
  identityProblems() {
    return uniq(allMatches(bodyAfter(source(SWEEP_REL), 'function checkIdentity(', SWEEP_REL), /\breturn\s+'([^']+)'/));
  },
  /** The schema problem shapes (realtime/index.js:929-931): { kind: 'schema', rule: '…', problem: '…' }. */
  schemaShapes() {
    return allMatches(source(REALTIME_REL), /\{\s*kind:\s*'schema',\s*rule:\s*'([^']+)',\s*problem:\s*'([^']+)'\s*\}/, 0)
      .map((s) => { const m = /rule:\s*'([^']+)',\s*problem:\s*'([^']+)'/.exec(s); return [m[1], m[2]]; });
  },
  /** T3: 'identity:<problem>' for every checkIdentity problem, and 'schema:<rule>:<problem>' over rules × problems. */
  setupProblem() {
    const ids = extract.identityProblems().map((p) => `identity:${p}`);
    const shapes = extract.schemaShapes();
    const rules = uniq(shapes.map((s) => s[0]));
    const problems = uniq(shapes.map((s) => s[1]));
    const schema = [];
    for (const r of rules) for (const p of problems) schema.push(`schema:${r}:${p}`);
    return uniq([...ids, ...schema]);
  },
  /** SCAN_ERROR_CODES, read by a source scan (it is not exported). */
  scanErrorCodes() {
    const src = source(LIB_RT_REL);
    const m = /const SCAN_ERROR_CODES = Object\.freeze\(\[([\s\S]*?)\]\)/.exec(src);
    assert(m, `${LIB_RT_REL} no longer declares SCAN_ERROR_CODES = Object.freeze([...]) (ADR 0004 § Seams, realtime.js:68-71)`);
    return uniq(allMatches(m[1], /'([^']+)'/));
  },
  /** SCAN_ERROR_CODES plus identity, timeout, unparseable and error (allowErrorCode's fallback). */
  countCode() { return uniq([...extract.scanErrorCodes(), 'identity', 'timeout', 'unparseable', 'error']); },
};

/* Today's counts (88af7df3), computed by running the extractions above against the current source. */
const FLOORS = {
  passOutcome: 4,
  passReason: 12,
  failureStage: 9,
  failureRead: 3,
  confirmationWhy: 7,
  confirmationWhyPrefixes: 2,
  refusedReason: 10,
  heldReason: 2,
  leftInPlaceReason: 2,
  changeKind: 5,
  pathState: 8,
  lastErrorStage: 12,
  catchUpOutcome: 4,
  catchUpStage: 3,
  notEstablishedReason: 4,
  identityProblems: 4,
  schemaShapes: 3,
  setupProblem: 8,
  scanErrorCodes: 12,
  countCode: 14,
};

/** The eight states AC-3 names: off, starting, waiting on a setup problem / the graph / the relay, catching up, live, stopped. */
const AC3_STATES = ['off', 'starting', 'waiting-setup', 'waiting-graph', 'waiting-relay', 'catching-up', 'live', 'stopped'];

/* ─── The view module (red now) ─── */

let viewPromise = null;
async function view(...names) {
  const abs = path.join(REPO, VIEW_REL);
  if (!viewPromise) viewPromise = import(pathToFileURL(abs).href).then((m) => ({ m }), (e) => ({ e }));
  const { m, e } = await viewPromise;
  if (e) {
    if (!fs.existsSync(abs)) {
      throw new Error(`${VIEW_REL} not implemented yet: it does not export ${names.join(', ')} (ADR 0004 § Implementation ` +
        `notes → UI, taggingPipelineView.js) [import failed: ${e.code || e.message}]`);
    }
    throw new Error(`${VIEW_REL} exists but failed to load: ${[e.code, e.message].filter(Boolean).join(' ')} (ADR 0004 § UI "Form": plain ESM, ` +
      `.js-suffixed imports, Node 16 syntax)`);
  }
  for (const n of names) {
    assert(m[n] !== undefined, `${VIEW_REL} not implemented yet: it does not export ${n} (ADR 0004 § Implementation notes → UI)`);
  }
  return m;
}

/**
 * A fixed-code kind: every code needs its OWN sentence — an own property of EXPLANATIONS[kind] holding a string —
 * and explain(kind, c) must return { code: c, text: that sentence, recognised: true }. A FAMILIES pattern that happens
 * to match does not count (ADR 0004 § UI: "one sentence per code the guard test lists"). Reports every miss at once.
 */
async function assertOwnSentence(kind, codes) {
  const { explain, EXPLANATIONS } = await view('explain', 'EXPLANATIONS');
  assert(typeof explain === 'function', `${VIEW_REL}: explain must be a function (ADR 0004 § UI)`);
  const table = EXPLANATIONS && Object.prototype.hasOwnProperty.call(EXPLANATIONS, kind) ? EXPLANATIONS[kind] : null;
  const own = (c) => !!table && typeof table === 'object' && Object.prototype.hasOwnProperty.call(table, c) &&
    typeof table[c] === 'string';
  const noSentence = codes.filter((c) => !own(c));
  assert(noSentence.length === 0,
    `EXPLANATIONS.${kind} has no own sentence for ${noSentence.length} of ${codes.length} code(s) the producers can ` +
    `write today: ${noSentence.map(show).join(', ')} (ADR 0004 § UI: "one sentence per code the guard test lists"; ` +
    `story "Explanations"; ADR 0004 § Seams)`);
  const wrong = [];
  for (const c of codes) {
    let r;
    try { r = explain(kind, c); } catch (err) { wrong.push(`${show(c)} (threw ${err.message})`); continue; }
    if (!r || r.recognised !== true || r.code !== c || r.text !== table[c]) {
      wrong.push(`${show(c)} -> ${show(r)} (expected { code: ${show(c)}, text: ${show(table[c])}, recognised: true })`);
    }
  }
  assert(wrong.length === 0,
    `explain('${kind}', code) does not answer with EXPLANATIONS.${kind}'s own sentence for ${wrong.length} code(s): ` +
    `${wrong.join('; ')} (ADR 0004 § UI: the exact map is looked up first; T6)`);
}

/** A family input: assert explain(kind, c).recognised === true and code returned as given; report every miss at once. */
async function assertRecognised(kind, codes) {
  const { explain } = await view('explain');
  assert(typeof explain === 'function', `${VIEW_REL}: explain must be a function (ADR 0004 § UI)`);
  const misses = [];
  for (const c of codes) {
    let r;
    try { r = explain(kind, c); } catch (err) { misses.push(`${show(c)} (threw ${err.message})`); continue; }
    if (!r || r.recognised !== true || r.code !== c) misses.push(`${show(c)} -> ${show(r)}`);
  }
  assert(misses.length === 0,
    `explain('${kind}', code) does not recognise ${misses.length} of ${codes.length} family input(s) (or does not return ` +
    `the code as given): ${misses.join('; ')} — FAMILIES needs an entry for them (ADR 0004 § UI FAMILIES; T6)`);
}

/* ─── Emoji / token helpers ─── */

const EMOJI = /\p{Extended_Pictographic}/u;
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
/** Lower-case, '-', '_', '.', ':' to spaces, whitespace collapsed, trailing punctuation trimmed. */
function normalise(s) {
  return String(s).toLowerCase().replace(/[-_.:]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[\s.,;!?'"”’)]+$/, '').trim();
}
/**
 * Is `sentence` its own `code` (PC39, the story's reading)? (a) The two are equal once normalised; or (b) the code
 * holds '-', '_', ':' or '.' and appears in the sentence verbatim as a whole token (a boundary is anything but a
 * letter, digit, '_' or '-'). A plain one-word code may appear in ordinary English.
 */
function isOwnCode(sentence, code) {
  if (normalise(sentence) === normalise(code)) return true;
  if (/[-_:.]/.test(code)) return new RegExp(`(^|[^A-Za-z0-9_-])${escapeRe(code)}($|[^A-Za-z0-9_-])`).test(sentence);
  return false;
}
const ERROR_OCCURRED = /\b(an? )?error (has )?occurred\b/i;
/** Says "an error occurred" with no second clause ('.', ';' or ' — ' before its end) — i.e. without saying what to do. */
function bareErrorOccurred(sentence) {
  if (!ERROR_OCCURRED.test(sentence)) return false;
  const body = sentence.trim().replace(/[\s.;!?]+$/, '');
  return !(body.includes('.') || body.includes(';') || body.includes(' — '));
}

/* ═══ PC1–PC17 — extraction and floors (pass now) ═══ */

test("PC1: passOutcome — finish('…') plus the pessimistic record's outcome 'failed' yields at least today's 4 outcomes (refused, failed, done-removals-held, done) [AC-2 \"its outcome and reason (with explanations)\"; story \"Explanations\"; ADR 0004 § Seams → passOutcome]", () => {
  const codes = extract.passOutcome();
  floor('passOutcome', codes, FLOORS.passOutcome, RUNNER_REL);
  assert(!codes.includes('not-started'), `passOutcome must not take 'not-started' (never written to the report): ${show(codes)}`);
});

test("PC2: passReason — the first argument of refuse('…')/fail('…') and every reasonCode: '…' yield at least today's 12 codes, with the not-started family (lock-busy, not-started-under-the-lock) left out because it is never written to the report [AC-2 \"its outcome and reason (with explanations)\"; story \"Explanations\"; ADR 0004 § Seams → passReason]", () => {
  const codes = extract.passReason();
  floor('passReason', codes, FLOORS.passReason, RUNNER_REL);
  for (const c of NOT_STARTED) assert(!codes.includes(c), `passReason must exclude '${c}' (ADR 0004 § Seams): ${show(codes)}`);
});

test("PC3: failureStage — stage: '…' and fsFailure('…') in the runner yield at least today's 9 stages [AC-2 \"its outcome and reason (with explanations)\"; story \"Explanations\"; ADR 0004 § Seams → failureStage]", () => {
  floor('failureStage', extract.failureStage(), FLOORS.failureStage, RUNNER_REL);
});

test("PC4: failureRead — read: '…' in the runner plus 'graph-verify' (set by the graph port, copied by the runner) yield at least today's 3 reads [AC-2 \"its outcome and reason (with explanations)\"; story \"Explanations\"; ADR 0004 § Seams → failureRead]", () => {
  const codes = extract.failureRead();
  floor('failureRead', codes, FLOORS.failureRead, RUNNER_REL);
  assert(codes.includes('graph-verify'), `failureRead must include 'graph-verify': ${show(codes)}`);
});

test("PC5: confirmationWhy — why: '…' literals yield at least today's 7 codes, and the two template prefixes ('held-file-unreadable ' and 'claim failed: ') are both found [AC-2 \"its outcome and reason (with explanations)\"; story \"Explanations\"; ADR 0004 § Seams → confirmationWhy]", () => {
  floor('confirmationWhy', extract.confirmationWhy(), FLOORS.confirmationWhy, RUNNER_REL);
  const prefixes = extract.confirmationWhyPrefixes();
  floor('confirmationWhy (template prefixes)', prefixes, FLOORS.confirmationWhyPrefixes, RUNNER_REL);
  for (const p of ['held-file-unreadable ', 'claim failed: ']) {
    assert(prefixes.includes(p), `confirmationWhy's template prefix ${show(p)} is no longer found in ${RUNNER_REL}: ${show(prefixes)}`);
  }
});

test('PC6: refusedReason — the exported REFUSAL (contract.js) has at least today\'s 10 values [AC-2 "its outcome and reason (with explanations)"; story "Explanations"; ADR 0004 § Seams → refusedReason]', () => {
  floor('refusedReason', extract.refusedReason(), FLOORS.refusedReason, `${CONTRACT_REL} REFUSAL`);
});

test('PC7: heldReason — the exported REMOVAL_REASON (sweep.js) has at least today\'s 2 values [AC-2 "its outcome and reason (with explanations)"; story "Explanations"; ADR 0004 § Seams → heldReason]', () => {
  floor('heldReason', extract.heldReason(), FLOORS.heldReason, `${SWEEP_REL} REMOVAL_REASON`);
});

test('PC8: leftInPlaceReason — the exported LEFT_REASON (sweep.js) has at least today\'s 2 values [AC-2 "its outcome and reason (with explanations)"; story "Explanations"; ADR 0004 § Seams → leftInPlaceReason]', () => {
  floor('leftInPlaceReason', extract.leftInPlaceReason(), FLOORS.leftInPlaceReason, `${SWEEP_REL} LEFT_REASON`);
});

test('PC9: changeKind — the exported CHANGE_KIND (sweep.js) has at least today\'s 5 values [AC-2 "its outcome and reason (with explanations)"; story "Explanations"; ADR 0004 § Seams → changeKind]', () => {
  floor('changeKind', extract.changeKind(), FLOORS.changeKind, `${SWEEP_REL} CHANGE_KIND`);
});

test("PC10: pathState — every literal a return in currentState() can yield (ternary branches included, comparands such as 'signal' and 'first' not), plus the status route's forced 'off', are exactly the eight states AC-3 names [AC-3; ADR 0004 § Seams → pathState]", () => {
  const fromFn = extract.pathStateFromCurrentState();
  const forced = extract.pathStateForcedByRoute();
  assert(show(forced) === show(['off']), `${ROUTE_REL} must force state 'off' when the switch is off (found ${show(forced)}; ADR 0004 § Seams, realtime.js:100)`);
  for (const c of ['off', 'waiting-relay']) assert(fromFn.includes(c), `currentState()'s ternary branch '${c}' was not extracted: ${show(fromFn)}`);
  const codes = extract.pathState();
  floor('pathState', codes, FLOORS.pathState, `${REALTIME_REL} currentState() + ${ROUTE_REL}`);
  assert(show([...codes].sort()) === show([...AC3_STATES].sort()),
    `pathState must be exactly AC-3's eight states ${show(AC3_STATES)}; extracted ${show(codes)}`);
});

test('PC11: lastErrorStage — the keys of STAGE_TEXT = Object.freeze({…}) are at least today\'s 12 stages [AC-3 "Problems"; ADR 0004 § Seams → lastErrorStage]', () => {
  const codes = extract.lastErrorStage();
  floor('lastErrorStage', codes, FLOORS.lastErrorStage, `${REALTIME_REL} STAGE_TEXT`);
  assert(codes.includes('unexpected') && codes.includes('relay-read'), `STAGE_TEXT keys look mis-extracted: ${show(codes)}`);
});

test("PC12: catchUpOutcome — the second argument of every endCatchUp(…) plus 'not-established' are at least today's 4 outcomes [AC-3 \"Its last catch-up\"; ADR 0004 § Seams → catchUpOutcome]", () => {
  floor('catchUpOutcome', extract.catchUpOutcome(), FLOORS.catchUpOutcome, `${REALTIME_REL} endCatchUp(`);
});

test("PC13: catchUpStage — the second argument of every failCatchUp(…) is at least today's 3 stages [AC-3 \"Its last catch-up\"; ADR 0004 § Seams → catchUpStage]", () => {
  floor('catchUpStage', extract.catchUpStage(), FLOORS.catchUpStage, `${REALTIME_REL} failCatchUp(`);
});

test('PC14: notEstablishedReason — the LOST_REASONS array holds at least today\'s 4 reasons [AC-3; ADR 0004 § Seams → notEstablishedReason]', () => {
  floor('notEstablishedReason', extract.notEstablishedReason(), FLOORS.notEstablishedReason, `${REALTIME_REL} LOST_REASONS`);
});

test("PC15: setupProblem — 'identity:<problem>' for each of checkIdentity's returns ('missing' among them, at least 4) and 'schema:<rule>:<problem>' over the product of the schema shapes' rules and problems (at least 3 shapes) give at least today's 8 keys [AC-3 \"Problems\"; ADR 0004 § Seams → setupProblem; T3]", () => {
  const problems = extract.identityProblems();
  floor('checkIdentity problems', problems, FLOORS.identityProblems, `${SWEEP_REL} checkIdentity`);
  assert(problems.includes('missing'), `checkIdentity's 'missing' was not extracted: ${show(problems)}`);
  floor('schema problem shapes', extract.schemaShapes(), FLOORS.schemaShapes, `${REALTIME_REL} schemaReady`);
  const keys = extract.setupProblem();
  floor('setupProblem', keys, FLOORS.setupProblem, `${SWEEP_REL} + ${REALTIME_REL}`);
  for (const k of ['identity:missing', 'schema:tags_address:missing', 'schema:tags_address:not-online', 'schema:nostrUser_pubkey:missing']) {
    assert(keys.includes(k), `setupProblem key ${k} was not built (T3): ${show(keys)}`);
  }
});

test('PC16: countCode — SCAN_ERROR_CODES, read by a source scan, holds at least 12 codes and allowErrorCode(c) === c for each, so every one survives to the status and the drift answer [AC-4; ADR 0004 § Seams → countCode]', () => {
  const codes = extract.scanErrorCodes();
  floor('SCAN_ERROR_CODES', codes, FLOORS.scanErrorCodes, `${LIB_RT_REL} SCAN_ERROR_CODES`);
  const { allowErrorCode } = requireLib(LIB_RT_REL);
  assert(typeof allowErrorCode === 'function', `${LIB_RT_REL} no longer exports allowErrorCode (ADR 0004 § Server, SWR71)`);
  const bad = codes.filter((c) => allowErrorCode(c) !== c);
  assert(bad.length === 0, `allowErrorCode(c) !== c for ${show(bad)} — those codes would reach the panel as 'error' (ADR 0004 § Seams)`);
});

test("PC17: countCode — the inventory is SCAN_ERROR_CODES plus 'identity', 'timeout', 'unparseable' and 'error' (allowErrorCode's fallback), at least today's 14 codes [AC-4; ADR 0004 § Seams → countCode]", () => {
  const { allowErrorCode } = requireLib(LIB_RT_REL);
  assert(allowErrorCode(undefined) === 'error' && allowErrorCode('something else') === 'error',
    `allowErrorCode's fallback is no longer 'error' (${LIB_RT_REL}:888, :893)`);
  floor('countCode', extract.countCode(), FLOORS.countCode, `${LIB_RT_REL} + the ADR's four`);
});

/* ═══ PC18–PC34 — every extracted code is recognised (red now) ═══ */

const RECOGNITION = [
  ['PC18', 'passOutcome', () => extract.passOutcome(), 'AC-2; ADR 0004 § Seams → passOutcome'],
  ['PC19', 'passReason', () => extract.passReason(), 'AC-2; ADR 0004 § Seams → passReason'],
  ['PC20', 'failureStage', () => extract.failureStage(), 'AC-2; ADR 0004 § Seams → failureStage'],
  ['PC21', 'failureRead', () => extract.failureRead(), 'AC-2; ADR 0004 § Seams → failureRead'],
  ['PC22', 'refusedReason', () => extract.refusedReason(), 'AC-2; ADR 0004 § Seams → refusedReason'],
  ['PC23', 'heldReason', () => extract.heldReason(), 'AC-2; ADR 0004 § Seams → heldReason'],
  ['PC24', 'leftInPlaceReason', () => extract.leftInPlaceReason(), 'AC-2; ADR 0004 § Seams → leftInPlaceReason'],
  ['PC25', 'changeKind', () => extract.changeKind(), 'AC-2; ADR 0004 § Seams → changeKind'],
  ['PC26', 'confirmationWhy', () => extract.confirmationWhy(), 'AC-2; ADR 0004 § Seams → confirmationWhy'],
  ['PC28', 'pathState', () => extract.pathState(), 'AC-3; ADR 0004 § Seams → pathState'],
  ['PC29', 'lastErrorStage', () => extract.lastErrorStage(), 'AC-3; ADR 0004 § Seams → lastErrorStage'],
  ['PC30', 'catchUpOutcome', () => extract.catchUpOutcome(), 'AC-3; ADR 0004 § Seams → catchUpOutcome'],
  ['PC31', 'catchUpStage', () => extract.catchUpStage(), 'AC-3; ADR 0004 § Seams → catchUpStage'],
  ['PC32', 'notEstablishedReason', () => extract.notEstablishedReason(), 'AC-3; ADR 0004 § Seams → notEstablishedReason'],
  ['PC33', 'setupProblem', () => extract.setupProblem(), 'AC-3; ADR 0004 § Seams → setupProblem; T3'],
  ['PC34', 'countCode', () => extract.countCode(), 'AC-4; ADR 0004 § Seams → countCode'],
];

for (const [id, kind, codesOf, ref] of RECOGNITION) {
  test(`${id}: every ${kind} code the producers can write today has its own sentence in EXPLANATIONS.${kind}, and explain('${kind}', code) returns it with the code as given and recognised true [${ref}; ADR 0004 § UI "one sentence per code the guard test lists"; T6]`, async () => {
    await assertOwnSentence(kind, codesOf());
  });
  if (id === 'PC26') {
    test("PC27: explain('confirmationWhy', …) recognises both template prefixes followed by an error code — 'held-file-unreadable ' and 'claim failed: ' each with 'error' (the producer's own fallback) and with 'ENOENT' [AC-2; ADR 0004 § Seams → confirmationWhy, § UI FAMILIES]", async () => {
      const codes = [];
      for (const p of extract.confirmationWhyPrefixes()) codes.push(`${p}error`, `${p}ENOENT`);
      await assertRecognised('confirmationWhy', codes);
    });
  }
}

/* ═══ PC35–PC40 — FAMILIES, fetch codes, kinds, and the copy rules (red now) ═══ */

test("PC35: FAMILIES recognise the open code families' examples — fetchCode 'http-502'; countCode 'ENOSPC', 'Neo.TransientError.General.DatabaseUnavailable', 'ServiceUnavailable' and 'SessionExpired'; confirmationWhy 'held-file-unreadable ENOENT' and 'claim failed: EACCES' — with the code returned as given [AC-5 \"shows the error's code\"; ADR 0004 § UI FAMILIES; T6]", async () => {
  const { explain, FAMILIES } = await view('explain', 'FAMILIES');
  assert(Array.isArray(FAMILIES) && Object.isFrozen(FAMILIES), `FAMILIES must be a frozen list (ADR 0004 § UI)`);
  const cases = [
    ['fetchCode', 'http-502'],
    ['countCode', 'ENOSPC'],
    ['countCode', 'Neo.TransientError.General.DatabaseUnavailable'],
    ['countCode', 'ServiceUnavailable'],
    ['countCode', 'SessionExpired'],
    ['confirmationWhy', 'held-file-unreadable ENOENT'],
    ['confirmationWhy', 'claim failed: EACCES'],
  ];
  const misses = [];
  for (const [kind, code] of cases) {
    const r = explain(kind, code);
    if (!r || r.recognised !== true || r.code !== code) misses.push(`${kind}:${show(code)} -> ${show(r)}`);
  }
  assert(misses.length === 0, `FAMILIES examples not recognised (or code not returned as given): ${misses.join('; ')}`);
});

test("PC36: readSection's fixed codes 'network', 'timeout' and 'bad-json' each have their own sentence in EXPLANATIONS.fetchCode, which explain('fetchCode', …) returns [AC-5 \"names the read … shows the error's code\"; ADR 0004 § UI readSection, \"one sentence per code\"; T7]", async () => {
  await assertOwnSentence('fetchCode', ['network', 'timeout', 'bad-json']);
});

test("PC38: every EXPLANATIONS sentence is a non-empty string with no '!', no emoji (\\p{Extended_Pictographic}), and no \"an error occurred\" without a second clause saying what to do [AC-5 \"Colours and copy\"; story \"Explanations\"; ADR 0004 § UI (language rules) and § Seams → static checks, run time; product-team/guardrails/language.md]", async () => {
  const { EXPLANATIONS } = await view('EXPLANATIONS');
  const bad = [];
  let n = 0;
  for (const kind of Object.keys(EXPLANATIONS)) {
    for (const code of Object.keys(EXPLANATIONS[kind] || {})) {
      n++;
      const s = EXPLANATIONS[kind][code];
      if (typeof s !== 'string' || s.trim() === '') bad.push(`${kind}.${code}: empty or not a string`);
      else if (s.includes('!')) bad.push(`${kind}.${code}: has '!'`);
      else if (EMOJI.test(s)) bad.push(`${kind}.${code}: has an emoji`);
      else if (bareErrorOccurred(s)) bad.push(`${kind}.${code}: says "an error occurred" without saying what to do`);
    }
  }
  assert(n > 0, `EXPLANATIONS holds no sentences`);
  assert(bad.length === 0, `EXPLANATIONS sentences break the copy rules: ${bad.join('; ')}`);
});

test("PC39: no EXPLANATIONS sentence is its own code — (a) not equal to it once both are lower-cased with '-', '_', '.', ':' as spaces and trailing punctuation trimmed, and (b) a code holding '-', '_', ':' or '.' never appears in it verbatim as a whole token; a plain one-word code may appear in ordinary English [story \"Explanations\": \"the sentence is not the code itself\"; ADR 0004 § UI (\"a sentence never repeats its code\") and § Seams]", async () => {
  const { EXPLANATIONS } = await view('EXPLANATIONS');
  const bad = [];
  for (const kind of Object.keys(EXPLANATIONS)) {
    for (const code of Object.keys(EXPLANATIONS[kind] || {})) {
      const s = EXPLANATIONS[kind][code];
      if (typeof s === 'string' && isOwnCode(s, code)) bad.push(`${kind}.${code}: ${show(s)}`);
    }
  }
  assert(bad.length === 0, `these sentences are their own code (the story's reading; see the header): ${bad.join('; ')}`);
});

test("PC40: every FAMILIES sentence has no '!', no emoji and no \"an error occurred\" without saying what to do (the entry shape itself is the view suite's TV3) [AC-5 \"Colours and copy\"; ADR 0004 § UI FAMILIES and its language rules]", async () => {
  const { FAMILIES } = await view('FAMILIES');
  assert(Array.isArray(FAMILIES), `FAMILIES must be a list (ADR 0004 § UI)`);
  const bad = [];
  FAMILIES.forEach((f, i) => {
    const s = f && f.sentence;
    const at = `#${i} (${show(f && f.kind)})`;
    if (typeof s !== 'string') return; // TV3 reports a missing sentence
    if (s.includes('!')) bad.push(`${at}: sentence has '!'`);
    else if (EMOJI.test(s)) bad.push(`${at}: sentence has an emoji`);
    else if (bareErrorOccurred(s)) bad.push(`${at}: sentence says "an error occurred" without saying what to do`);
  });
  assert(bad.length === 0, `FAMILIES sentences break the copy rules: ${bad.join('; ')}`);
});

/* ═══ PC41 — story 4's review, round 1 ═══ */

test("PC41: countCode 'EBADJSON' — the status route's own code for a damaged file (src/api/tagging-edges/index.js readJson) — has its OWN entry in EXPLANATIONS.countCode, which explain('countCode', 'EBADJSON') returns; it is not the E-family sentence (an operating-system error), and it says the file is damaged (/damaged|cannot be (read|parsed)/i) [review Non-blocking 10; AC-5 \"Explanations\"; ADR 0004 § UI, \"one sentence per code\"; T6]", async () => {
  const { explain, EXPLANATIONS, FAMILIES } = await view('explain', 'EXPLANATIONS', 'FAMILIES');
  const route = source('src/api/tagging-edges/index.js');
  assert(/code:\s*'EBADJSON'/.test(route),
    `src/api/tagging-edges/index.js no longer throws code: 'EBADJSON' — follow the producer before changing this test`);
  const table = EXPLANATIONS && EXPLANATIONS.countCode;
  assert(!!table && Object.prototype.hasOwnProperty.call(table, 'EBADJSON') && typeof table.EBADJSON === 'string',
    `EXPLANATIONS.countCode must have its own 'EBADJSON' entry: the file is damaged, and the owner can confirm again ` +
    `(review Non-blocking 10); today it falls to the E-family pattern /^E[A-Z0-9_]+$/, whose sentence speaks of an ` +
    `operating-system error and the relay and database containers`);
  const r = explain('countCode', 'EBADJSON');
  assert(r && r.recognised === true && r.code === 'EBADJSON' && r.text === table.EBADJSON,
    `explain('countCode', 'EBADJSON') must answer with EXPLANATIONS.countCode.EBADJSON (the exact table first, T6); got ${show(r)}`);
  const family = (Array.isArray(FAMILIES) ? FAMILIES : []).find((f) => f && f.kind === 'countCode' && f.test instanceof RegExp && f.test.test('EBADJSON'));
  assert(!family || r.text !== family.sentence,
    `EXPLANATIONS.countCode.EBADJSON must not be the E-family sentence (${show(family && family.sentence)}) — review Non-blocking 10`);
  assert(/damaged|cannot be (read|parsed)/i.test(r.text),
    `EXPLANATIONS.countCode.EBADJSON must say the file is damaged (/damaged|cannot be (read|parsed)/i); got ${show(r.text)}`);
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- tagging-pipeline-codes tests (tagging-edges story #4: the code guard) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntagging-pipeline-codes: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}
if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { run, extract };
