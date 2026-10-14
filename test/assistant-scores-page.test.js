'use strict';
/**
 * assistant-scores #1: the Scores page — its words, its pure helpers, its client calls, and its sources.
 *
 * Story: engineering-team/stories/assistant-scores/1-the-scores-page.md (AC-1–AC-3, AC-5, AC-6, § Copy)
 * ADR:   engineering-team/decisions/assistant-scores/0001-a-session-bound-scores-read-and-recalculate-route.md
 *        (sub-decisions 6 and 7, § Implementation notes "Client")
 * Plan:  engineering-team/stories/assistant-scores/1-the-scores-page.test-plan.md
 * Server half: test/assistant-scores-route.test.js. Browser half: tests/brainstorm/assistant-scores.spec.js.
 * Words and canned answers: test/helpers/scoresFixtures.js.
 *
 * Classes (all stack-free):
 *   U — ui/src/pages/assistant/scoresCopy.js, loaded in Node: the words, the reasons by code, and
 *       lastPublishedLine / countLine / runLine / buttonState.                                       [AC-1, AC-2, AC-3, AC-5]
 *   C — ui/src/utils/assistantScores.js against a fake fetch: one GET, one POST with no body, and a refusal
 *       answered rather than thrown.                                                                  [AC-2, AC-4]
 *   S — source sentinels on what this runner cannot execute: the route in App.jsx, the page's one home for
 *       words and network, no polling, the hub's own signed-out and no-Assistant lines, and the hub's Scores
 *       entry unchanged.                                                                               [AC-1, AC-5, AC-6]
 *
 * Round 2 (ADR Amendment 1, after review round 1): U7 the failed-press reason's approved words (N2); C4 a route-table 401,
 * which carries no code, read as not-signed-in (N1). N6 (clear the answer when the viewer changes) is checked by reading.
 *
 * Everything in U, C and S1–S3 FAILS against the current code: scoresCopy.js, assistantScores.js and Scores.jsx do not
 * exist, and /assistant/trusted-assertions routes to the placeholder page. S4 is a regression sentinel (AC-6) and
 * passes before and after.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const F = require('./helpers/scoresFixtures');

const REPO = path.resolve(__dirname, '..');
const COPY_MOD = path.join(REPO, 'ui/src/pages/assistant/scoresCopy.js');
const CLIENT = path.join(REPO, 'ui/src/utils/assistantScores.js');
const PAGE = path.join(REPO, 'ui/src/pages/assistant/Scores.jsx');
const APP = path.join(REPO, 'ui/src/App.jsx');
const ACTIONS = path.join(REPO, 'ui/src/pages/assistant/actions.js');
const TIME_AGO = path.join(REPO, 'ui/src/utils/timeAgo.js');
const TRUSTED_CONTENT = path.join(REPO, 'src/api/assistant/trustedContent.js');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function rel(p) { return path.relative(REPO, p); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function src(p, why = '') {
  const s = safeRead(p);
  assert(s.length > 0, `${rel(p)} must exist${why ? ` — ${why}` : ''}`);
  return s;
}
const show = (x) => JSON.stringify(x);

/**
 * Source with comments blanked out, so a structural assertion cannot be satisfied by prose. Strings are tracked, so a
 * `//` inside quotes is not read as a comment (test/about-this-instance.test.js's scanner).
 */
function code(s) {
  let out = '';
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    const d = s[i + 1];
    if (c === '/' && d === '*') {
      const end = s.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      for (let k = i; k < stop; k++) out += s[k] === '\n' ? '\n' : ' ';
      i = stop;
    } else if (c === '/' && d === '/') {
      let k = i;
      while (k < n && s[k] !== '\n') { out += ' '; k++; }
      i = k;
    } else if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      out += c;
      i++;
      while (i < n) {
        if (s[i] === '\\') { out += s[i] + (s[i + 1] || ''); i += 2; continue; }
        out += s[i];
        if (s[i] === quote) { i++; break; }
        i++;
      }
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

async function esm(absPath, what) {
  assert(fs.existsSync(absPath), `${rel(absPath)} does not exist. ${what}`);
  try { return await import(pathToFileURL(absPath).href); } catch (err) { throw new Error(`${rel(absPath)} must load in Node as ESM: ${err.message}`); }
}
const copyModule = () => esm(COPY_MOD, "ADR § Implementation notes creates it: the story's words, REASONS, and the page's pure helpers.");
const clientModule = () => esm(CLIENT, 'ADR § Implementation notes creates it: fetchAssistantScores() and recalculateAssistantScores().');
function needFn(mod, name, file = 'ui/src/pages/assistant/scoresCopy.js') {
  assert(typeof mod[name] === 'function', `${file} must export ${name}() (ADR § Implementation notes)`);
  return mod[name];
}
/** Every string anywhere inside a value (the words may be grouped however the module likes). */
function strings(x, out = []) {
  if (typeof x === 'string') out.push(x);
  else if (x && typeof x === 'object') for (const v of Object.values(x)) strings(v, out);
  return out;
}

const NOW_S = Math.floor(Date.now() / 1000);

// ── U — the words and helpers ───────────────────────────────────────────────────────────────────────────────────────

test("U1: scoresCopy.js carries every word of the story's § Copy and the ADR's unreadable line (AC-1, § Copy)", async () => {
  const m = await copyModule();
  assert(m.SCORES_COPY && typeof m.SCORES_COPY === 'object', 'scoresCopy.js must export SCORES_COPY');
  const words = strings(m.SCORES_COPY);
  const missing = Object.entries(F.COPY).filter(([, w]) => !words.includes(w)).map(([k, w]) => `${k}: "${w}"`);
  assert(missing.length === 0, `SCORES_COPY must carry, word for word: ${missing.join('; ')}`);
});

test('U2: lastPublishedLine says the date and time and how long ago, "not yet" for none, and never "not yet" for a failed read (AC-1)', async () => {
  const m = await copyModule();
  const line = needFn(m, 'lastPublishedLine');
  const { timeAgo } = await esm(TIME_AGO, 'the shared relative-time helper');
  const at = NOW_S - 3 * 3600;
  const expected = `${F.COPY.lastPublishedPrefix}${new Date(at * 1000).toLocaleString()} (${timeAgo(at)})`;
  const got = line({ finished: true, latestAt: at, count: 5 }, NOW_S);
  assert(got === expected, `expected "${expected}" — got ${show(got)}`);
  assert(got.includes('(3h ago)'), `three hours ago reads "(3h ago)" — got ${show(got)}`);
  const none = line({ finished: true, latestAt: null, count: 0 }, NOW_S);
  assert(none === F.COPY.notYet, `none published reads "${F.COPY.notYet}" — got ${show(none)}`);
  const failed = line({ finished: false }, NOW_S);
  assert(failed === F.COPY.unreadable, `a failed read reads "${F.COPY.unreadable}" — got ${show(failed)}`);
});

test('U3: countLine shows the count, a count of 0 included, and nothing when there is no count (AC-1)', async () => {
  const m = await copyModule();
  const line = needFn(m, 'countLine');
  const got = line({ finished: true, latestAt: 1, count: F.COUNT });
  assert(got === `${F.COPY.countPrefix}${F.COUNT.toLocaleString()}`, `expected "${F.COPY.countPrefix}${F.COUNT.toLocaleString()}" — got ${show(got)}`);
  const zero = line({ finished: true, latestAt: null, count: 0 });
  assert(zero === `${F.COPY.countPrefix}0`, `a count of 0 is shown, not hidden — got ${show(zero)}`);
  assert(line({ finished: true, latestAt: 1, count: null }) == null, 'a count that could not be taken shows no line');
  assert(line({ finished: false }) == null, 'a failed read shows no count line');
});

test('U4: runLine says queued or running, and nothing for no run or an unknown state (AC-2, AC-3)', async () => {
  const m = await copyModule();
  const line = needFn(m, 'runLine');
  assert(line('queued') === F.COPY.queued, `queued reads "${F.COPY.queued}" — got ${show(line('queued'))}`);
  assert(line('running') === F.COPY.running, `running reads "${F.COPY.running}" — got ${show(line('running'))}`);
  assert(line(null) == null, `no run shows no line — got ${show(line(null))}`);
  assert(line('unknown') == null, `an unknown state claims nothing — got ${show(line('unknown'))}`);
});

test('U5: buttonState shows the button only for a pipeline, and turns it off while a run is queued or running or a press is in flight (AC-2, AC-3, AC-5)', async () => {
  const m = await copyModule();
  const state = needFn(m, 'buttonState');
  const cases = [
    ['idle', F.ANSWERS.IDLE, false, { show: true, disabled: false }],
    ["the Owner's, idle", F.ANSWERS.OWNER_IDLE, false, { show: true, disabled: false }],
    ['queued', F.ANSWERS.QUEUED, false, { show: true, disabled: true }],
    ['running', F.ANSWERS.RUNNING, false, { show: true, disabled: true }],
    ['unknown (the press says why if it cannot start)', F.ANSWERS.UNKNOWN, false, { show: true, disabled: false }],
    ['a press in flight', F.ANSWERS.IDLE, true, { show: true, disabled: true }],
  ];
  for (const [label, answer, pressing, want] of cases) {
    const got = state(answer, pressing) || {};
    assert(got.show === want.show && got.disabled === want.disabled, `${label}: expected ${show(want)} — got ${show(got)}`);
  }
  for (const [label, answer] of [['no pipeline', F.ANSWERS.NO_PIPELINE], ['signed out', F.ANSWERS.SIGNED_OUT], ['no Assistant', F.ANSWERS.NO_ASSISTANT], ['no answer yet', null]]) {
    const got = state(answer, false) || {};
    assert(got.show === false, `${label}: no button — got ${show(got)}`);
  }
});

test("U6: every refusal code has a reason to fill \"Couldn't start a recalculation: {reason}\" (ADR sub-decision 7)", async () => {
  const m = await copyModule();
  assert(m.REASONS && typeof m.REASONS === 'object', 'scoresCopy.js must export REASONS, the words by code');
  for (const c of Object.values(F.CODES)) {
    const r = m.REASONS[c];
    assert(typeof r === 'string' && r.trim().length > 0, `REASONS['${c}'] must be a non-empty string — got ${show(r)}`);
    assert(!r.startsWith(F.COPY.couldNotStartPrefix), `REASONS['${c}'] is the fragment after the prefix, not the whole line — got ${show(r)}`);
  }
});

// ── C — the client calls ────────────────────────────────────────────────────────────────────────────────────────────

/** Swap global fetch for one call's fake; returns what it was asked. */
async function withFetch(answer, fn) {
  const saved = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url, init = {}) => {
    asked.push({ url: String(url), init });
    return {
      status: answer.status,
      ok: answer.status >= 200 && answer.status < 300,
      json: async () => { if (answer.body === undefined) throw new SyntaxError('not JSON'); return answer.body; },
    };
  };
  try { return { result: await fn(), asked }; } finally { globalThis.fetch = saved; }
}

test('C1: fetchAssistantScores asks GET /api/assistant/scores once, with no parameters, and answers the body (AC-1, AC-4)', async () => {
  const m = await clientModule();
  const get = needFn(m, 'fetchAssistantScores', rel(CLIENT));
  const { result, asked } = await withFetch({ status: 200, body: F.ANSWERS.IDLE }, () => get());
  assert(asked.length === 1, `one request — got ${asked.length}`);
  assert(asked[0].url === F.ROUTES.status, `exactly ${F.ROUTES.status}, no query — got ${asked[0].url}`);
  const method = (asked[0].init.method || 'GET').toUpperCase();
  assert(method === 'GET', `a GET — got ${method}`);
  assert(result && result.success === true && result.published && result.published.count === F.COUNT, `the answer's body — got ${show(result)}`);
});

test('C2: recalculateAssistantScores sends one POST with no body, and answers a refusal with its status and code instead of throwing (AC-2, AC-3, AC-4)', async () => {
  const m = await clientModule();
  const post = needFn(m, 'recalculateAssistantScores', rel(CLIENT));
  let { result, asked } = await withFetch({ status: 202, body: { success: true, run: 'queued' } }, () => post());
  assert(asked.length === 1, `one request — got ${asked.length}`);
  assert(asked[0].url === F.ROUTES.recalculate, `exactly ${F.ROUTES.recalculate}, no query — got ${asked[0].url}`);
  assert((asked[0].init.method || '').toUpperCase() === 'POST', `a POST — got ${show(asked[0].init.method)}`);
  assert(asked[0].init.body === undefined || asked[0].init.body === null || asked[0].init.body === '' || asked[0].init.body === '{}',
    `the press names nothing: no body — got ${show(asked[0].init.body)}`);
  assert(result && result.status === 202 && result.success === true && result.run === 'queued', `expected { status: 202, success: true, run: 'queued' } — got ${show(result)}`);
  ({ result } = await withFetch({ status: 409, body: { success: false, code: F.CODES.already, run: 'running' } }, () => post()));
  assert(result && result.status === 409 && result.success === false && result.code === F.CODES.already && result.run === 'running',
    `a refusal is answered, not thrown — got ${show(result)}`);
});

test('C3: an answer that is not JSON never reads as a started run (AC-2)', async () => {
  const m = await clientModule();
  const post = needFn(m, 'recalculateAssistantScores', rel(CLIENT));
  let outcome;
  try {
    const { result } = await withFetch({ status: 502, body: undefined }, () => post());
    outcome = result;
  } catch (e) {
    outcome = { threw: true };
  }
  assert(outcome && (outcome.threw === true || outcome.success !== true), `a 502 that is not JSON must throw or answer success !== true — got ${show(outcome)}`);
});

// ── S — the sources ─────────────────────────────────────────────────────────────────────────────────────────────────

test('S1: /assistant/trusted-assertions routes to the Scores page, not the placeholder (AC-1)', () => {
  const c = code(src(APP));
  const imp = c.match(/import\s+(\w+)\s+from\s+['"]\.\/pages\/assistant\/Scores(?:\.jsx)?['"]/);
  assert(imp, "App.jsx must import the page from './pages/assistant/Scores'");
  const entry = new RegExp(`['"]${F.KEY}['"]\\s*:\\s*<${imp[1]}\\s*/>`);
  assert(entry.test(c), `ACTION_PAGES must map '${F.KEY}' to <${imp[1]} />`);
});

test("S2: the page takes its words from scoresCopy.js and its network from assistantScores.js, and never polls (ADR sub-decision 6)", () => {
  const s = src(PAGE, 'ADR § Implementation notes creates ui/src/pages/assistant/Scores.jsx');
  const c = code(s);
  assert(/from\s+['"]\.\/scoresCopy(?:\.js)?['"]/.test(c), "Scores.jsx imports its words from './scoresCopy'");
  assert(/from\s+['"]\.\.\/\.\.\/utils\/assistantScores(?:\.js)?['"]/.test(c), "Scores.jsx imports its calls from '../../utils/assistantScores'");
  assert(/\bfetchAssistantScores\s*\(/.test(c) && /\brecalculateAssistantScores\s*\(/.test(c), 'the page reads with fetchAssistantScores() and presses with recalculateAssistantScores()');
  assert(!/\bfetch\s*\(/.test(c), 'the page never calls fetch() itself');
  assert(!/['"`]\/api\//.test(c), 'the page names no /api/ route itself');
  assert(!/\bsetInterval\s*\(/.test(c), 'no polling (story § Out of scope): no setInterval');
  for (const w of [F.COPY.button, F.COPY.noPipeline, F.COPY.takesAWhile, F.COPY.started, F.COPY.queued, F.COPY.running]) {
    assert(!c.includes(w), `the words live in scoresCopy.js only — Scores.jsx spells out "${w}"`);
  }
});

test("S3: signed out and no Assistant read as on the other hub pages; the card's description and Treasure Map link stay (AC-5, AC-6)", () => {
  const c = code(src(PAGE, 'ADR § Implementation notes creates ui/src/pages/assistant/Scores.jsx'));
  assert(/ASSISTANT_COPY\.signedOutLine/.test(c), 'signed out: ASSISTANT_COPY.signedOutLine');
  assert(/ASSISTANT_COPY\.noAssistantLine/.test(c), 'no Assistant: ASSISTANT_COPY.noAssistantLine');
  assert(/<ActionText\b[^>]*\.description\b/.test(c), "the card's description through <ActionText parts={….description} />");
  assert(/\.editLink\b/.test(c), "the card's editLink (Manage your Treasure Map →) still shows");
  assert(/ASSISTANT_COPY\.backToHub/.test(c), 'the back link to the hub');
});

test("S4: the hub's Scores entry and its check are unchanged (AC-6 — a regression sentinel)", async () => {
  const { ASSISTANT_ACTIONS } = await esm(ACTIONS, 'the hub definition');
  const a = (ASSISTANT_ACTIONS || []).find((x) => x.key === F.KEY);
  assert(a, `actions.js keeps the '${F.KEY}' action`);
  assert(a.path === F.PATH, `its path stays ${F.PATH} — got ${show(a.path)}`);
  assert(a.title === F.ACTION_TITLE, `its title stays "${F.ACTION_TITLE}" — got ${show(a.title)}`);
  assert(a.alertCriteria === F.ACTION_ALERT_CRITERIA, `its alert criteria stay — got ${show(a.alertCriteria)}`);
  assert(a.editLink && a.editLink.text === F.ACTION_EDIT_LINK_TEXT, `its editLink stays "${F.ACTION_EDIT_LINK_TEXT}" — got ${show(a.editLink)}`);
  const tc = require(TRUSTED_CONTENT);
  assert(tc.TRUSTED_CONTENT_ACTIONS && tc.TRUSTED_CONTENT_ACTIONS[F.KEY] === 'scores', `the hub's check still reads '${F.KEY}' as the Scores category`);
});

// ── Round 2 (ADR Amendment 1) ──────────────────────────────────────────────────────────────────────────────────────

test("U7: a press the instance couldn't enqueue reads \"…: this instance couldn't start one.\" (Amendment 1, N2)", async () => {
  const m = await copyModule();
  assert(m.REASONS && m.REASONS.failed === F.AMENDMENT_1.reasonFailed, `REASONS.failed must be "${F.AMENDMENT_1.reasonFailed}" — got ${show(m.REASONS && m.REASONS.failed)}`);
});

test('C4: a signed-out press, refused by the route table with no code, is answered as not-signed-in (Amendment 1, N1)', async () => {
  const m = await clientModule();
  const post = needFn(m, 'recalculateAssistantScores', rel(CLIENT));
  const { result, asked } = await withFetch({ status: 401, body: F.AMENDMENT_1.routeTable401 }, () => post());
  assert(asked.length === 1, 'the path under test ran: one request');
  assert(result && result.status === 401 && result.success === false && result.code === F.CODES.notSignedIn,
    `a 401 with no code must answer { status: 401, success: false, code: '${F.CODES.notSignedIn}' } — got ${show(result)}`);
  const { result: coded } = await withFetch({ status: 409, body: { success: false, code: F.CODES.already, run: 'queued' } }, () => post());
  assert(coded && coded.code === F.CODES.already, `a refusal that carries its own code keeps it — got ${show(coded)}`);
});

// ── runner ──────────────────────────────────────────────────────────────────────────────────────────────────────────

async function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log(`  ✅ ${t.name}`);
    } catch (e) {
      fail++;
      failures.push({ name: t.name, error: e.message });
      console.log(`  ❌ ${t.name}\n      ${e.message}`);
    }
  }
  console.log(`assistant-scores-page: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
