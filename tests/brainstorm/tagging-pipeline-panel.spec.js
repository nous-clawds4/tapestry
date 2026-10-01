const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const F = require('../../test/helpers/taggingPipelineFixtures');

/**
 * tagging-edges #4: the tagging pipeline panel — the browser class.
 *
 * Story: engineering-team/stories/tagging-edges/4-tagging-pipeline-panel.md
 * ADR:   engineering-team/decisions/tagging-edges/0004-tagging-pipeline-panel.md
 *        (§ UI, § Seams for Test Design "The browser spec", § Clarifications T9 and T10)
 * Answers: test/helpers/taggingPipelineFixtures.js. Node halves: the view, fetch, codes, drift-route and countStrict
 * suites under test/.
 *
 *   B0  — the served origin runs a build that contains the panel.                                     [prerequisite]
 *   B1  — the owner: the sub-tab directly after Streaming ETL, the other five unchanged, five sections ready. [AC-1, AC-6]
 *   B2  — an admin sees and opens it too.                                                              [AC-1]
 *   B3  — a customer and a signed-out visitor see no panel (passes today: Settings' own gate).         [AC-1]
 *   B4  — while loading, each section says what it is loading.                                        [AC-5]
 *   B5  — a running pass: running, no result, the held list waits for its end.                          [AC-2]
 *   B6  — a running first pass is not "no pass yet".                                                   [AC-2; T1]
 *   B7  — the latest pass explained, its times and figures, and nine earlier passes newest first.       [AC-2]
 *   B8  — an outcome the panel does not know reads "not recognised" beside its code.                   [AC-2; explanations]
 *   B9  — no pass yet: says so, and names the two ways one starts.                                     [AC-2]
 *   B10 — the held list pages to every item, matches the report, gives reasons; pending until when.     [AC-2]
 *   B11 — an expired confirmation is shown as expired, not pending.                                    [AC-2]
 *   B12 — an unreadable confirmation is shown as unreadable.                                           [AC-2]
 *   B13 — schedule: none enabled, a disabled one mentioned, the button opens Scheduled Tasks.          [AC-2]
 *   B14 — schedule: none at all, no disabled one to mention.                                           [AC-2]
 *   B15 — schedule: one, its interval and next run, no warning; a disabled one mentioned, not counted. [AC-2]
 *   B16 — schedule: one, enabled but not scheduled.                                                    [AC-2]
 *   B17 — schedule: one, weaker than daily (an interval, and a weekly cron).                           [AC-2]
 *   B18 — schedule: several, how many.                                                                 [AC-2]
 *   B19 — the path on and live: state explained, times, counts, failed reads, refusals, gauges, catch-up. [AC-3]
 *   B20 — the path on but not running: said so, the stored 'live' not shown as current.               [AC-3]
 *   B21 — the eight states, each with its code and its explanation; an unknown state.                  [AC-3]
 *   B22 — the three warnings: stale, status unreadable, switch unreadable.                             [AC-3]
 *   B23 — before the first start: "not yet available", never 0.                                        [AC-3]
 *   B24 — the path off: its last figures, labelled so, with their time.                                [AC-3]
 *   B25 — counts reset: said so.                                                                       [AC-3]
 *   B26 — a setup problem and a last error, with their codes and explanations.                         [AC-3]
 *   B27 — drift: the story's example, difference 3, explained 3, unexplained 0, the pass named.        [AC-4]
 *   B28 — drift: an unexplained remainder, and the addresses left to the next pass.                    [AC-4]
 *   B29 — drift: a clean pass, unexplained 0.                                                          [AC-4]
 *   B30 — drift: an unknown count reads "unknown", no difference, never 0.                             [AC-4]
 *   B31 — drift: the latest pass not finished, the finished pass it used instead named.                [AC-4]
 *   B32 — drift: no finished pass, no explained part, the whole difference unexplained, and why.       [AC-4]
 *   B33 — drift: path on names its refused taggings and parked; path off says changes wait for a pass. [AC-4]
 *   B34 — drift: Recount counts again.                                                                 [AC-4]
 *   B35 — refresh: a status change shows after POLL_MS, without a reload.                              [AC-5; page.clock]
 *   B36 — a failed read (path status, pass report, schedule list, held list) names itself, its code,
 *         Retry; the others stay ready; Retry (not a poll) recovers.                                   [AC-5; page.clock]
 *   B37 — a failed drift read: both counts unknown, the read named, Retry.                            [AC-5, AC-4]
 *   B38 — a minute open, two Recounts, closed: only GETs, exactly three counts, no reads after close.   [AC-1, AC-4; page.clock]
 *   B40 — the held list of a run that is no longer the latest: re-read the status, restart, no error.   [AC-2; ADR § UI "The held list"]
 *   B39 — the five existing sub-tabs send the requests of the baseline (T10).                          [AC-6]
 *
 *   Story 4 review round 1 (engineering-team/reviews/tagging-edges/4-tagging-pipeline-panel.md):
 *   B41 — drift while a pass runs says a pass is running, never that the latest pass did not finish.     [AC-4; NB1]
 *   B42 — a failed pass shows its failure code with its explanation under where it failed (ENOSPC); a
 *         schema refusal for an unreachable Neo4j names Neo4j, not only the Dashboard fix.                [AC-2; Blocking 1, NB2]
 *   B43 — counts taken before the explaining pass ended: no "unexplained" figure, a Recount asked for;
 *         a Recount with newer counts brings the explained and unexplained lines back.                    [AC-4; NB3, T5]
 *   B44 — "applied the confirmed removals" only when confirmed.removalsApplied > 0.                      [AC-2; NB5]
 *   B45 — a catch-up's not-established reason is labelled as "why" only on a not-established outcome.     [AC-3; NB11]
 *   B46 — a re-poll that fails after a good read: error, the earlier figures kept, labelled with their time. [AC-5; ADR § UI "Failure"; F1]
 *   B47 — an answer to an older status request that lands after a newer one is dropped.                    [ADR § UI "Polling"; F1]
 *   B48 — a poll tick is skipped while the previous one is in flight.                                     [ADR § UI "Polling"; F1]
 *
 * ── Hermetic by construction ──────────────────────────────────────────────────────────────────────────────────────
 * Every /api route is mocked. The catch-all is registered FIRST (so every later route wins) and answers 599
 * { success: false }: readSection treats any 2xx JSON object as good, so an unmocked route must never look like a good
 * answer (ADR 0004 § Seams). App routes (/tapestry/**) are answered with the served app shell, so client routing works
 * on a static server. The panel's tests run in UTC with the en-GB locale and a page clock that starts at the fixtures'
 * NOW and flows in real time, so every printed time is known.
 *
 * ── What the copy checks read ─────────────────────────────────────────────────────────────────────────────────────
 * Only T9's words are matched as words (Tagging pipeline, not yet available, unknown, not recognised, Recount, Retry).
 * Every other note is matched by its idea (the regexes below accept several phrasings), and each is checked against a
 * state where it must NOT show, so a heading or a label that is always there cannot satisfy it. Explanations are read
 * from the panel's own view module (ui/src/utils/taggingPipelineView.js's explain()), so no sentence is pinned here.
 * Times are matched as the clock time (24- or 12-hour) or as the time relative to the fixtures' NOW.
 *
 * ── Running it ────────────────────────────────────────────────────────────────────────────────────────────────────
 * Build the UI under test into the gitignored repo tmp dir (never dist/, which the local stack serves), inside the
 * container (the repo is bind-mounted at /usr/local/lib/node_modules/brainstorm):
 *   docker exec tapestry sh -c 'cd /usr/local/lib/node_modules/brainstorm/ui && npx vite build --outDir ../tmp/tp-dist --emptyOutDir'
 * Serve it (background):   cd tmp/tp-dist && python3 -m http.server 4174 --bind 127.0.0.1
 * Run (Node 22 on PATH):   BRAINSTORM_BASE_URL=http://localhost:4174 npx playwright test \
 *                            tests/brainstorm/tagging-pipeline-panel.spec.js --project=chromium
 * Record AC-6's baseline:  the same with TP_RECORD_BASELINE=1, on the UI before the change (88af7df3). It writes
 *                          tests/brainstorm/fixtures/relay-subtab-requests.json and skips every other test. It refuses
 *                          to record from a build that already contains the panel.
 * Afterwards: stop the server, rm -rf tmp/tp-dist.
 */

const POLL_MS = 5000; // ADR 0004 § UI: taggingPipelineView.js's POLL_MS
const TAB = 'Tagging pipeline'; // T9
const SECTIONS = ['tp-pass', 'tp-held', 'tp-schedule', 'tp-path', 'tp-drift'];
const EXISTING_TABS = ['🔄 Router Management', '🔃 Negentropy Sync', '📡 Relay Configuration', '⚡ Streaming ETL', '📅 Scheduled Tasks'];
const BASELINE_FILE = path.join(__dirname, 'fixtures', 'relay-subtab-requests.json');
const VIEW_MODULE = path.join(__dirname, '..', '..', 'ui', 'src', 'utils', 'taggingPipelineView.js');
const RECORDING = process.env.TP_RECORD_BASELINE === '1';
const SETTLE_MS = 3000;

/* ── Small helpers ─────────────────────────────────────────────────────────────────────────────────────────────── */

const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A whole number as the panel may print it (with or without a thousands separator), never part of a longer token. */
function numSrc(n) {
  const s = String(n);
  let p = '';
  for (let i = 0; i < s.length; i += 1) {
    p += s[i];
    const rest = s.length - 1 - i;
    if (rest > 0 && rest % 3 === 0) p += '[,.\\u00a0\\u202f ]?';
  }
  return `(?<![\\w.,])${p}(?![\\w]|[.,]\\d)`;
}
const numRe = (n) => new RegExp(numSrc(n));
/** A number within 40 non-digit characters of a label, on either side ("unexplained 0", "3 unexplained"). */
const near = (label, n) => new RegExp(`(?:${label})\\D{0,40}${numSrc(n)}|${numSrc(n)}\\D{0,40}(?:${label})`, 'i');
/** A code as a word of its own (codes hold hyphens and dots). */
const codeRe = (code) => new RegExp(`(?<![\\w-])${esc(code)}(?![\\w-])`);
/** The text without an "on/off" label, so 'on' and 'off' are read as values. */
const noOnOff = (s) => s.replace(/\bon\s*\/\s*off\b/gi, ' ');

/**
 * A time as the panel may print it: its UTC clock time (24- or 12-hour, the page runs in UTC), or its distance from
 * the fixtures' NOW (the page clock starts there) in minutes or hours.
 */
function timeRe(iso) {
  const d = new Date(iso);
  const h = d.getUTCHours();
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const h12 = h % 12 || 12;
  const hours = [...new Set([String(h).padStart(2, '0'), String(h), String(h12), String(h12).padStart(2, '0')])];
  const alts = [`(?<![\\d:])(?:${hours.join('|')})[:.]${mi}(?!\\d)`];
  const diff = Math.abs(Date.parse(iso) - Date.parse(F.NOW)) / 60000;
  if (diff < 1) alts.push('just now', '\\bnow\\b', '\\bseconds?\\b', '\\b0\\s?(?:m|min|mins|minutes?)\\b');
  const m = Math.floor(diff);
  if (diff < 120) for (const x of [m - 1, m, m + 1]) if (x >= 1) alts.push(`\\b${x}\\s?(?:m|min|mins|minutes?)\\b`);
  if (diff >= 60) alts.push(`\\b${Math.floor(diff / 60)}\\s?(?:h|hr|hrs|hours?)\\b`);
  return new RegExp(alts.join('|'), 'i');
}

const NOT_RECOGNISED = 'not recognised'; // T6 / T9
const NOT_YET = 'not yet available'; // T9

/* The notes, by idea. Each is also checked absent where it must not show. */
const NO_PASS_YET = /no pass\b[^.]*\b(?:yet|so far)\b|\bno pass (?:has|have) (?:ever )?run\b|(?:has|have) not (?:yet )?run\b|hasn't (?:yet )?run\b|\bnever (?:been )?run\b/i;
const NO_BACKSTOP = /\bno backstop\b|without (?:a |any )?backstop|backstop\b[^.]{0,30}\b(?:missing|absent)\b|\bno (?:enabled )?(?:scheduled tasks? )?(?:entry|entries)\b[^.]{0,60}\b(?:runs?|running|schedules?)\b[^.]{0,30}\bpass\b|\bnothing\b[^.]{0,30}\b(?:schedules|runs)\b[^.]{0,20}\bpass\b/i;
const DISABLED_MENTION = /(?<!\b(?:no|0|zero|without) )\bdisabled\b(?![^.]{0,6}\b(?:0|none|no)\b)|\b(?:entry|entries)\b[^.]{0,40}\b(?:turned|switched) off\b/i;
const NOT_SCHEDULED = /not scheduled|\bno next run\b|(?:is not|isn't|not) (?:yet )?(?:due|planned|set) to run|scheduler has no/i;
const WEAKER_THAN_DAILY = /weaker than daily|less (?:often|frequently) than (?:daily|once a day|every day)|\bnot (?:even )?(?:daily|every day|once a day)\b|(?:runs?|running) less than (?:daily|once a day)/i;
const SEVERAL = /\b(?:2|two)\b[^.]*\b(?:entries|enabled|schedules|backstops)\b|\b(?:entries|enabled|schedules)\b[^.]*\b(?:2|two)\b|\bmore than one\b|\bseveral\b/i;
const PENDING = /\bpending\b|\bawaiting\b|waits? for the next pass|will be (?:used|honou?red|applied)|\bconfirm\w*\b[^.]*\b(?:until|expires?|valid)\b/i;
const PENDING_STRICT = /\bpending until\b|\bis pending\b/i; // absent when expired (the reviewer's check)
const EXPIRED = /\bexpired\b|no longer valid|\blapsed\b/i;
const EXPIRED_STAYS = /until the next pass|next pass\b[^.]*\b(?:not|never|won't|doesn't|ignores?)\b|\b(?:not|never|won't|doesn't)\b[^.]*\b(?:honou?r|use|apply|act on)\w*\b[^.]*\bnext pass\b/i;
const UNREADABLE = /unreadable|(?:cannot|could not|can't|couldn't) be read|not readable/i;
const RUNNING_WAITS = /\b(?:ends|finishes|ended|finished|done|completes?|completed)\b/i;
const ON = /\b(?:is|path|switch(?:ed)?|turned) on\b|\bswitch\b[^.]{0,20}\bon\b|\bon\b[^.]{0,20}\brunning\b/i;
const NOT_RUNNING = /not running|\bisn't running\b|(?:process|path)\b[^.]*\b(?:stopped|not alive|isn't alive|has stopped|is down|not started)\b/i;
const NOT_RUNNING_STRICT = /\bnot running\b|\bis not alive\b|\bisn't (?:running|alive)\b/i;
const STALE = /\bstale\b|not (?:been )?(?:re)?written|not (?:been )?updated|out of date|hasn't (?:been )?(?:updated|rewritten)|(?:over|more than) a minute (?:old|ago)/i;
const STATUS_UNREADABLE = /status\b[^.]*(?:(?:cannot|could not|can't|couldn't) be (?:read|parsed)|unreadable|not readable)|unreadable status/i;
const SWITCH_UNREADABLE = /(?:switch|on\s*\/\s*off|on-off)\b[^.]*(?:(?:cannot|could not|can't|couldn't) be read|unreadable|not readable)|unreadable (?:switch|on\s*\/\s*off)/i;
const FIRST_START = /\bfirst\b[^.]{0,20}\bstart|\bsince\b[^.]{0,30}\bstart/i;
const COUNTS_RESET = /(?:since|from|after) (?:the |a |their |its )?reset\b|\bwere reset\b|\bhave been reset\b|\bwas reset\b|\breset (?:at|on|when|because)\b/i;
const LAST_FIGURES = /last figures|figures (?:it )?(?:produced|recorded|written|from|before)|last (?:recorded|written|known|produced)|(?:before|when) (?:it was |the path was )?(?:switched|turned) off|previous figures/i;
const CATCH_UP = /catch[- ]?up/i;
const INSTEAD = /\binstead\b|not the latest|latest pass\b[^.]*\b(?:not|did not|didn't|has not|hasn't|never)\b[^.]*\bfinish|\b(?:older|earlier|previous) (?:finished )?pass\b/i;
const NO_FINISHED_WHY = /no finished pass|not finished|no pass (?:has )?finished|none (?:of the passes )?(?:has )?finished|no pass\b[^.]*\bfinished\b/i;
const WAITS_FOR_PASS = /\b(?:changes|anything|edits|taggings)\b[^.]*\bsince\b[^.]*\b(?:wait|next pass)|\bwait\w*\b[^.]*\bfor the next pass|until the next pass|next pass will (?:pick|catch|reflect)/i;
const EXPLAINED_NUM = /(?<![Uu]n)explained\W{0,5}-?\d/i;
const LOADING = /loading|reading|fetching|waiting for|asking/i;
// Story 4 review round 1.
const DID_NOT_FINISH = /\b(?:did not|didn't|failed to|never|could not) (?:finish|complete|end)\w*\b|\blatest pass\b[^.]*\b(?:failed|was stopped|stopped)\b/i;
const PASS_RUNNING = /\bpass is (?:still )?(?:running|under ?way|in progress)\b|\brunning pass\b|\bpass (?:that is |which is )?(?:still )?running\b/i;
const NEWEST_FINISHED_EXPLAINS = /\b(?:newest|latest|last|most recent|previous|earlier) (?:finished|completed) pass\b|\bfinished pass\b[^.]*\bexplain|\bexplain\w*\b[^.]*\bfinished pass\b/i;
const NEO4J_DOWN = /\bNeo4j\b[^.]*\b(?:down|unreachable|not running|not answering|not reachable|unavailable|(?:could not|cannot|can't|couldn't) be reached|not up|refus\w*|stopped)\b|\b(?:reach|connect(?:ed)? to|contact)\w*\b[^.]*\bNeo4j\b/i;
const COUNTS_PREDATE = /\bbefore\b[^.]*\bpass\b[^.]*\b(?:ended|finished|completed|ran)\b|\bpredat\w*\b|\b(?:older|earlier) than\b[^.]*\bpass\b|\bpass\b[^.]*\b(?:ended|finished)\b[^.]*\bafter\b[^.]*\b(?:counts?|counted|taken|counting)\b/i;
const ASK_RECOUNT = /\b(?:press|click|use|run|ask for|do|choose|select|try|needs?|request)\b[^.]{0,30}\bRecount\b|\bRecount\b[^.]{0,60}\b(?:to|for|so)\b[^.]{0,40}\b(?:count|figures?|explain\w*|current|fresh|new|up to date)\b/i;
const APPLIED_REMOVALS = /\bapplied\b[^.]*\bremovals?\b|\bremovals?\b[^.]*\b(?:were|was|been|are) applied\b/i;
const NEGATED = /\b(?:no|none|not|never|nothing|without|0)\b/i;
/** The sentences that claim confirmed removals were applied (a negated sentence, "applied none of …", is no claim). */
const appliedClaims = (text) => text.split(/(?<=\.)\s+/).filter((x) => APPLIED_REMOVALS.test(x) && !NEGATED.test(x));
/** A code labelled as the reason ("Why: record-missing", "because record-missing", "Reason: record-missing"). */
const whyLabel = (code) => new RegExp(`\\b(?:why|because|reason)\\b\\W{0,15}${esc(code)}(?![\\w-])`, 'i');
/** A label that dates figures read earlier ("read at 12:00", "as of 12:00"), at the time `iso`. */
const readAtLabel = (iso) => new RegExp(`\\b(?:read|fetched|loaded|received|as of|from)\\b[^.]{0,60}?(?:${timeRe(iso).source})`, 'i');

/** An answer that is an HTTP failure: fail(500) → 500 { success: false }. */
const fail = (status, body = { success: false, error: 'fixture failure' }) => ({ __http: status, body });

async function fulfil(route, spec) {
  let v = typeof spec === 'function' ? spec(route.request()) : spec;
  if (v && typeof v.then === 'function') v = await v;
  if (v && v.__http) return route.fulfill({ status: v.__http, contentType: 'application/json', body: JSON.stringify(v.body) });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
}

/* ── The panel's own explanations (no sentence is pinned here) ─────────────────────────────────────────────────── */

let VIEW = null;
let VIEW_ERROR = null;
async function loadView() {
  if (VIEW || VIEW_ERROR) return;
  try {
    VIEW = await import(pathToFileURL(VIEW_MODULE).href);
    if (typeof VIEW.explain !== 'function') throw new Error('it has no explain() export');
  } catch (e) {
    VIEW = null;
    VIEW_ERROR = e;
  }
}
/** explain(kind, code).text from the panel's view module; fails by name while the module does not exist. */
function explanation(kind, code) {
  expect(VIEW, `${path.relative(process.cwd(), VIEW_MODULE)} loads and exports explain() (ADR 0004 § UI) — not implemented yet: ${VIEW_ERROR && VIEW_ERROR.message}`).toBeTruthy();
  const e = VIEW.explain(kind, code);
  expect(e.recognised, `explain('${kind}', '${code}') is recognised`).toBe(true);
  return squash(e.text);
}

/* ── The mocks ─────────────────────────────────────────────────────────────────────────────────────────────────── */

const WHO = {
  owner: { pubkey: F.OWNER, classification: 'owner' },
  admin: { pubkey: F.ADMIN, classification: 'admin' },
  customer: { pubkey: F.CUSTOMER, classification: 'customer' },
  visitor: null,
};

/**
 * Mock every route. Each answer is a body, fail(status), or a function of the request returning either (or a promise
 * of either), evaluated per request, so a test can change it mid-run through the returned `set`. `held` answers from
 * the current status body; a `held` function gets (request, theDefaultAnswer).
 * Returns { log, set }: log.api is every /api request as "METHOD /path?query", log.nonGet every non-GET.
 */
async function mock(page, o = {}) {
  const cur = {
    who: 'owner',
    status: F.STATUS.HELD_PENDING,
    realtime: F.REALTIME.ON_LIVE,
    schedule: F.SCHEDULE.ONE,
    drift: F.DRIFT.EXAMPLE,
    heldList: F.HELD_LIST,
    ...o,
  };
  const log = { api: [], nonGet: [], navigations: 0 };
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) log.api.push(`${req.method()} ${u.pathname}${u.search}`);
    if (u.pathname.startsWith('/api/') && req.method() !== 'GET') log.nonGet.push(`${req.method()} ${u.pathname}`);
  });
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) log.navigations += 1; });

  const shellRes = await page.request.get('/');
  const shell = await shellRes.text();

  // The catch-all FIRST: every route registered after it wins. 599, so it is never a good answer.
  await page.route('**/api/**', (r) => r.fulfill({ status: 599, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'not mocked by tagging-pipeline-panel.spec.js' }) }));
  await page.route('**/tapestry/**', (r) => (r.request().resourceType() === 'document'
    ? r.fulfill({ status: 200, contentType: 'text/html', body: shell })
    : r.fallback()));

  const who = () => WHO[cur.who];
  /** The current answer for key k: a function stored in `cur` is called per request. */
  const pick = (k) => (req) => (typeof cur[k] === 'function' ? cur[k](req) : cur[k]);
  await page.route('**/api/auth/status', (r) => fulfil(r, () => (who()
    ? { authenticated: true, pubkey: who().pubkey }
    : { authenticated: false, pubkey: null })));
  await page.route('**/api/auth/user-classification', (r) => fulfil(r, () => (who()
    ? { success: true, classification: who().classification, pubkey: who().pubkey }
    : { success: true, classification: 'unauthenticated', pubkey: null })));
  await page.route('**/api/profiles**', (r) => fulfil(r, { success: true, profiles: {} }));
  await page.route('**/api/settings', (r) => fulfil(r, { success: true, settings: {}, defaults: {}, overrides: {} }));
  // The Scheduled Tasks sub-tab (the schedule warning's button opens it; AC-6 opens it).
  await page.route('**/api/scheduled-tasks/history**', (r) => fulfil(r, { success: true, runs: [] }));
  await page.route('**/api/get-customers', (r) => fulfil(r, { success: true, customers: [] }));
  await page.route('**/api/grapevine/preferences', (r) => fulfil(r, { success: true, preferences: { povPubkey: 'f'.repeat(64) } }));
  // The panel's five reads.
  await page.route('**/api/tagging-edges/status', (r) => fulfil(r, pick('status')));
  await page.route('**/api/tagging-edges/realtime/status', (r) => fulfil(r, pick('realtime')));
  await page.route('**/api/scheduled-tasks/list', (r) => fulfil(r, pick('schedule')));
  await page.route('**/api/tagging-edges/drift-counts**', (r) => fulfil(r, pick('drift')));
  const heldDefault = (req) => {
    const s = typeof cur.status === 'function' ? null : cur.status;
    if (!s || s.__http) return fail(404, { success: false, error: 'no report yet' });
    const a = F.heldAnswer(s, cur.heldList, req.url());
    return a.status === 200 ? a.body : fail(a.status, a.body);
  };
  await page.route('**/api/tagging-edges/held**', (r) => fulfil(r, (req) => {
    if (typeof cur.held === 'function') return cur.held(req, () => heldDefault(req));
    if (cur.held && cur.held.__http) return cur.held;
    return heldDefault(req);
  }));

  const set = (patch) => Object.assign(cur, patch);
  return { log, set };
}

/** Record every data-state each section takes, from the page's first paint (window.__tpStates). */
async function trackStates(page) {
  await page.addInitScript(() => {
    window.__tpStates = [];
    const note = (el) => {
      const id = el.getAttribute && el.getAttribute('data-testid');
      if (id && /^tp-/.test(id)) window.__tpStates.push(`${id}:${el.getAttribute('data-state')}`);
    };
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes') note(r.target);
        for (const n of r.addedNodes || []) {
          if (n.nodeType !== 1) continue;
          note(n);
          n.querySelectorAll('[data-testid^="tp-"]').forEach(note);
        }
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
  });
}
const statesOf = async (page, id) => (await page.evaluate(() => window.__tpStates || []))
  .filter((s) => s.startsWith(`${id}:`)).map((s) => s.slice(id.length + 1));

/* ── Opening things ────────────────────────────────────────────────────────────────────────────────────────────── */

const relayTabBar = (page) => page.locator('.tab-bar', { has: page.getByRole('button', { name: /Streaming ETL/ }) }).first();
const subTab = (page, name, exact = true) => relayTabBar(page).getByRole('button', { name, exact });
const section = (page, id) => page.getByTestId(id);
const textOf = async (page, id) => squash(await section(page, id).innerText());

async function openRelays(page) {
  await page.goto('/tapestry/settings/relays');
  await expect(page.getByRole('button', { name: /Streaming ETL/ }).first(), 'Settings › Relays renders its tab bar').toBeVisible({ timeout: 20000 });
}

/** Open Settings › Relays › Tagging pipeline. Fails by name while the sub-tab does not exist. */
async function openPanel(page) {
  await openRelays(page);
  const tab = subTab(page, TAB);
  await expect(tab, `Settings › Relays has a "${TAB}" sub-tab (AC-1; T9) — not implemented yet: no such button in the Relays tab bar`).toBeVisible({ timeout: 5000 });
  await tab.click();
  await expect(section(page, 'tp-pass'), 'the panel renders its pass section (data-testid tp-pass, ADR 0004 § UI)').toBeVisible({ timeout: 10000 });
}

/** Wait until a section has left `loading` (ready, empty or error). */
async function settled(page, id) {
  await expect(section(page, id), `${id} finishes loading`).toHaveAttribute('data-state', /^(ready|empty|error)$/, { timeout: 10000 });
}

async function openAndSettle(page, except = []) {
  await openPanel(page);
  for (const id of SECTIONS) if (!except.includes(id)) await settled(page, id);
}

/** Load a fresh page state for one variant: set the answers, reload, reopen the panel. */
async function reopenWith(page, m, patch) {
  m.set(patch);
  await openAndSettle(page);
}

/** Stop the page clock (after a real second has passed since opening), so no poll runs until the test says so. */
async function pauseClock(page) {
  const t = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(t + 1000);
}

const requestsTo = (log, route) => log.api.filter((l) => l.split(' ')[1].split('?')[0] === route);

/* ── B0 ─────────────────────────────────────────────────────────────────────────────────────────────────────────── */

async function bundleContains(request, needles) {
  const index = await request.get('/');
  if (!index.ok()) return { missing: needles, why: `the app shell answered HTTP ${index.status()}` };
  const html = await index.text();
  const queue = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
  if (queue.length === 0) return { missing: needles, why: 'no built JS is referenced from the app shell — is this a built UI?' };
  const left = new Set(needles);
  const seen = new Set();
  while (queue.length && seen.size < 400 && left.size) {
    const asset = queue.shift();
    if (seen.has(asset)) continue;
    seen.add(asset);
    const res = await request.get(asset);
    if (!res.ok()) continue;
    const js = await res.text();
    for (const n of [...left]) if (js.includes(n)) left.delete(n);
    for (const m of js.matchAll(/["'(](\.{0,2}\/?(?:assets\/)?[\w.-]+\.js)["')]/g)) {
      const ref = m[1];
      const resolved = ref.startsWith('assets/') ? `/${ref}` : new URL(ref, new URL(asset, 'http://origin')).pathname;
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }
  return { missing: [...left], why: `searched ${seen.size} JS chunks` };
}

/* ══ The panel ═══════════════════════════════════════════════════════════════════════════════════════════════════ */

test.describe('The tagging pipeline panel (tagging-edges #4, ADR 0004)', () => {
  // Every printed time is known: UTC, a 24-hour locale, and a page clock that starts at the fixtures' NOW and flows.
  test.use({ timezoneId: 'UTC', locale: 'en-GB' });

  test.beforeAll(async () => { await loadView(); });

  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip(true, 'Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    if (RECORDING) test.skip(true, 'TP_RECORD_BASELINE=1: only the AC-6 baseline is recorded');
    await page.clock.install({ time: new Date(F.NOW) });
  });

  test('B0: the served origin runs a build that contains the panel — its sub-tab label and its section hooks [prerequisite; ADR 0004 § Seams/T9]', async ({ request, baseURL }) => {
    const { missing, why } = await bundleContains(request, [TAB, 'tp-drift', 'tp-held']);
    expect(missing, `the bundle served by ${baseURL} does not contain ${JSON.stringify(missing)} (${why}). Rebuild the UI, or the panel is not built yet — B1–B40 say so directly.`).toEqual([]);
  });

  /* ── AC-1: where it is and who sees it ──────────────────────────────────────────────────────────────────────── */

  test('B1: a signed-in owner sees "Tagging pipeline" directly after Streaming ETL, the other five sub-tabs unchanged, and it opens the panel with its five sections ready [AC-1, AC-6; ADR 0004 § UI/T9]', async ({ page }) => {
    await mock(page);
    await openRelays(page);
    const labels = (await relayTabBar(page).getByRole('button').allInnerTexts()).map(squash);
    const expected = [...EXISTING_TABS.slice(0, 4), TAB, EXISTING_TABS[4]];
    expect(labels, `the Relays tab bar reads ${JSON.stringify(expected)} — the new sub-tab directly after ⚡ Streaming ETL, the other five as before`).toEqual(expected);
    await openPanel(page);
    for (const id of SECTIONS) {
      await expect(section(page, id), `${id} is ready`).toHaveAttribute('data-state', 'ready', { timeout: 10000 });
      expect((await textOf(page, id)).length, `${id} is never blank`).toBeGreaterThan(0);
    }
  });

  test('B2: a signed-in admin sees the sub-tab and opens the panel [AC-1]', async ({ page }) => {
    await mock(page, { who: 'admin' });
    await openAndSettle(page);
    await expect(section(page, 'tp-drift')).toHaveAttribute('data-state', 'ready');
  });

  test('B3: a signed-in customer and a signed-out visitor see no panel and no sub-tab, as for the rest of Settings [AC-1]', async ({ page }) => {
    const m = await mock(page, { who: 'customer' });
    for (const who of ['customer', 'visitor']) {
      m.set({ who });
      await page.goto('/tapestry/settings/relays');
      await expect(page.getByText(/Settings are only available to the owner/i), `${who}: Settings' gate shows`).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole('button', { name: TAB, exact: true }), `${who}: no "${TAB}" sub-tab`).toHaveCount(0);
      for (const id of SECTIONS) await expect(section(page, id), `${who}: no ${id}`).toHaveCount(0);
    }
    expect(requestsTo(m.log, F.ROUTES.drift), 'nobody but an owner or admin asks for a count').toEqual([]);
  });

  /* ── AC-5: loading ──────────────────────────────────────────────────────────────────────────────────────────── */

  test('B4: while its read is in flight, each section says what it is loading — never a blank area [AC-5; ADR 0004 § UI "Loading"]', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const later = (body) => async () => { await gate; return body; };
    await mock(page, {
      status: later(F.STATUS.HELD_PENDING),
      realtime: later(F.REALTIME.ON_LIVE),
      schedule: later(F.SCHEDULE.ONE),
      drift: later(F.DRIFT.EXAMPLE),
    });
    try {
      await openPanel(page);
      const names = { 'tp-pass': /pass|report/i, 'tp-path': /path|real-time/i, 'tp-schedule': /schedul/i, 'tp-drift': /count|drift|relay|graph/i };
      for (const [id, what] of Object.entries(names)) {
        await expect(section(page, id), `${id} is loading`).toHaveAttribute('data-state', 'loading');
        const text = await textOf(page, id);
        expect(text, `${id} says it is loading`).toMatch(LOADING);
        expect(text, `${id} names what it loads`).toMatch(what);
      }
      expect((await textOf(page, 'tp-held')).length, 'tp-held is never blank while the report loads').toBeGreaterThan(0);
    } finally {
      release();
    }
    for (const id of SECTIONS) await settled(page, id);
    await expect(section(page, 'tp-pass'), 'the pass section is ready once its read answers').toHaveAttribute('data-state', 'ready');
  });

  /* ── AC-2: the pass ─────────────────────────────────────────────────────────────────────────────────────────── */

  test('B5: a running pass whose stored record reads failed/stopped is shown as running, with no result, and the held list waits for its end [AC-2 "Running now"; ADR 0004 § UI passView/T1]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.RUNNING });
    await openAndSettle(page);
    const pass = await textOf(page, 'tp-pass');
    expect(pass, 'the pass is shown as running').toMatch(/running/i);
    expect(pass, 'the stored pessimistic reason is never shown as its result').not.toContain(F.STOPPED_REASON);
    expect(pass, 'the stored outcome "failed" is not shown as its result (its explanation)').not.toContain(explanation('passOutcome', 'failed'));
    expect(pass, 'the stored reason "stopped" is not shown as its result (its explanation)').not.toContain(explanation('passReason', 'stopped'));
    await expect(section(page, 'tp-pass')).toHaveAttribute('data-state', 'ready');
    await expect(section(page, 'tp-held'), 'nothing is held while the pass runs').toHaveAttribute('data-state', 'empty');
    expect(await textOf(page, 'tp-held'), 'the held section says the list returns when the pass ends').toMatch(RUNNING_WAITS);
    expect(requestsTo(m.log, F.ROUTES.held), 'the held list is not read while a pass runs').toEqual([]);
  });

  test('B6: a running first pass (nothing in the report before it) is running, not "no pass yet" [AC-2; T1 empty]', async ({ page }) => {
    await mock(page, { status: F.STATUS.RUNNING_FIRST });
    await openAndSettle(page);
    await expect(section(page, 'tp-pass')).toHaveAttribute('data-state', 'ready');
    const pass = await textOf(page, 'tp-pass');
    expect(pass).toMatch(/running/i);
    expect(pass, 'not the no-pass-yet text').not.toMatch(NO_PASS_YET);
  });

  test('B7: the latest pass shows its outcome and reason explained, when it ran and how long it took, what it did, and the nine earlier passes newest first [AC-2 "The latest pass"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.LATEST_AND_NINE });
    await openAndSettle(page);
    const pass = await textOf(page, 'tp-pass');
    expect(pass, 'its outcome code').toMatch(codeRe('done'));
    expect(pass, 'its outcome explained').toContain(explanation('passOutcome', 'done'));
    expect(pass, 'its reason explained').toContain(explanation('passReason', 'done'));
    expect(pass, 'a known outcome and reason are explained, not "not recognised"').not.toContain(NOT_RECOGNISED);
    const D = F.LATEST_DONE;
    expect(pass, `when it started (${D.startedAt})`).toMatch(timeRe(D.startedAt));
    expect(pass, `when it ended (${D.endedAt})`).toMatch(timeRe(D.endedAt));
    expect(pass, 'how long it took (83 s)').toMatch(/\b83\s?s(?:ec\w*)?\b|\b1\s?min\w*,?\s?23\s?s|\b1m\s?23s\b|\b1:23\b|\b83,?000\s?ms\b/i);
    const L = F.LATEST_FIGURES;
    for (const [what, n] of [['taggings read', L.taggingsRead], ['added', L.added], ['changed', L.changed], ['removed', L.removed],
      ['unchanged', L.unchanged], ['refused taggings', L.refused], ['left in place', L.leftInPlace], ['people added', L.peopleAdded]]) {
      expect(pass, `the latest pass's ${what} (${n})`).toMatch(numRe(n));
    }
    // Each earlier pass is found by what it did: its own "added" figure (200 + i, newest first), with its time.
    let last = -1;
    for (const [i, rec] of F.EARLIER_NINE.entries()) {
      const n = rec.relationships.added;
      const m = numRe(n).exec(pass);
      expect(m, `earlier pass ${i + 1} of 9 is listed with what it did (added ${n})`).not.toBeNull();
      expect(m.index, `earlier pass ${i + 1} comes after the one newer than it (newest first)`).toBeGreaterThan(last);
      last = m.index;
      expect(pass, `earlier pass ${i + 1} of 9 shows its time (${rec.startedAt})`).toMatch(new RegExp(`${timeRe(rec.startedAt).source}|${timeRe(rec.endedAt).source}`, 'i'));
    }
    expect((pass.match(new RegExp(codeRe('done').source, 'g')) || []).length, 'each of the ten passes shows its outcome').toBeGreaterThanOrEqual(10);
  });

  test('B8: an outcome and reason code the panel does not know are shown as they are, with "not recognised" beside them [AC-2; story "Explanations"; T6/T9]', async ({ page }) => {
    await mock(page, { status: F.STATUS.UNKNOWN_OUTCOME });
    await openAndSettle(page);
    const pass = await textOf(page, 'tp-pass');
    expect(pass, 'the unknown outcome as it is').toMatch(codeRe(F.UNKNOWN_OUTCOME_RECORD.outcome));
    expect(pass, 'the unknown reason code as it is').toMatch(codeRe(F.UNKNOWN_OUTCOME_RECORD.reasonCode));
    expect(pass).toContain(NOT_RECOGNISED);
  });

  test('B9: with no pass in the report, the panel says no pass has run yet and names the two ways one starts [AC-2 "No pass yet"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.NO_PASS });
    await openAndSettle(page);
    await expect(section(page, 'tp-pass')).toHaveAttribute('data-state', 'empty');
    const pass = await textOf(page, 'tp-pass');
    expect(pass, 'no pass has run yet').toMatch(NO_PASS_YET);
    expect(pass, 'an enabled Scheduled Tasks entry').toMatch(/Scheduled Tasks/i);
    expect(pass, 'or the Task Explorer').toMatch(/Task Explorer/i);
  });

  test('B10: the held list pages to every held removal, the count matches the report, each shows why, a pending confirmation is said with its end, and nothing offers to confirm [AC-2 "Held removals"]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.HELD_PENDING });
    await openAndSettle(page);
    const held = section(page, 'tp-held');
    await expect(held).toHaveAttribute('data-state', 'ready');
    const seen = new Set();
    const reasons = new Set();
    let text = await textOf(page, 'tp-held');
    expect(text, `the report's held total (${F.HELD_TOTAL})`).toMatch(numRe(F.HELD_TOTAL));
    expect(text, 'the owner\'s confirmation is pending').toMatch(PENDING);
    const expiresAt = F.STATUS.HELD_PENDING.confirmationPending.expiresAt;
    expect(text, `and until when (${expiresAt})`).toMatch(timeRe(expiresAt));
    for (let i = 0; i < 10; i += 1) {
      text = await textOf(page, 'tp-held');
      for (const x of text.matchAll(/held-address-(\d{3})/g)) seen.add(x[1]);
      for (const r of ['not-on-relay', 'non-tagging']) if (codeRe(r).test(text)) reasons.add(r);
      const next = held.getByRole('button', { name: /^\s*Next\b/i });
      if ((await next.count()) === 0 || !(await next.isEnabled())) break;
      const before = [...text.matchAll(/held-address-(\d{3})/g)].map((x) => x[1]).join(',');
      await next.click();
      // The section may show a loading state between pages: wait for the next page's addresses, not just a change.
      await expect.poll(async () => {
        const now = [...(await textOf(page, 'tp-held')).matchAll(/held-address-(\d{3})/g)].map((x) => x[1]).join(',');
        return now !== '' && now !== before;
      }, { message: 'Next shows another page' }).toBe(true);
    }
    expect(seen.size, `every one of the ${F.HELD_TOTAL} held removals is reachable by paging`).toBe(F.HELD_TOTAL);
    expect([...reasons].sort(), 'each held removal shows why it was held').toEqual(['non-tagging', 'not-on-relay']);
    expect(requestsTo(m.log, F.ROUTES.held).every((l) => l.includes(`runId=${F.HELD_RECORD.runId}`)), 'the held list is read for the latest run id').toBe(true);
    await expect(page.getByRole('button', { name: /confirm/i }), 'the panel offers no way to confirm (story 5)').toHaveCount(0);
  });

  test('B11: an expired confirmation is shown as expired, not as pending [AC-2 "Confirmation"; ADR 0004 § UI passView]', async ({ page }) => {
    await mock(page, { status: F.STATUS.HELD_EXPIRED });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-held');
    expect(text).toMatch(EXPIRED);
    expect(text, 'it stays until the next pass, which does not honour it').toMatch(EXPIRED_STAYS);
    expect(text, 'not shown as pending').not.toMatch(PENDING_STRICT);
  });

  test('B12: a confirmation that cannot be read is shown as unreadable, with its code [AC-2 "Confirmation"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.HELD_UNREADABLE });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-held');
    expect(text).toMatch(UNREADABLE);
    expect(text).toMatch(codeRe('EACCES'));
    expect(text, 'not shown as pending').not.toMatch(PENDING_STRICT);
  });

  test('B42: a failed pass shows its failure code with its explanation under where it failed (a write on a full disk, ENOSPC); a schema refusal because Neo4j cannot be reached shows ServiceUnavailable and names Neo4j, not only the Dashboard fix [AC-2 "The latest pass"; review round 1 Blocking 1, NB2]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.WRITE_FAILED });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-pass');
    const stage = explanation('failureStage', 'write');
    const enospc = explanation('countCode', 'ENOSPC');
    expect(text, 'where it failed (the write stage, explained)').toContain(stage);
    // Not codeRe('ENOSPC') alone: passReason 'write' names ENOSPC in its own sentence ("If the code is ENOSPC, …").
    const shown = new RegExp(`${codeRe('ENOSPC').source}\\W{0,40}${esc(enospc)}`).exec(text);
    expect(shown, `the failure's code ENOSPC is shown beside its explanation, explain('countCode', 'ENOSPC') ("${enospc}") — review Blocking 1/NB2: PassSection's "Where it failed" shows no failure.code yet`).not.toBeNull();
    expect(shown.index, 'the code is shown under where it failed').toBeGreaterThan(text.indexOf(stage));

    await reopenWith(page, m, { status: F.STATUS.SCHEMA_UNREACHABLE });
    text = await textOf(page, 'tp-pass');
    const unavailable = explanation('countCode', 'ServiceUnavailable');
    expect(text, `the failure's code ServiceUnavailable is shown beside its explanation ("${unavailable}")`).toMatch(new RegExp(`${codeRe('ServiceUnavailable').source}\\W{0,40}${esc(unavailable)}`));
    // Apart from the code's own explanation, the refusal's reason must not send the owner only to the Dashboard's
    // constraints fix: a schema refusal is also Neo4j being down or refusing the password.
    const rest = text.split(unavailable).join(' ');
    expect(rest, 'the schema refusal\'s reason names Neo4j being down or unreachable as a cause (review Blocking 1: passReason.schema names only the Dashboard constraints fix)').toMatch(NEO4J_DOWN);
  });

  test('B44: a pass says it applied the owner\'s confirmed removals only when it applied some (confirmed.removalsApplied > 0): a confirmed run that failed before applying any does not claim it [AC-2 "The latest pass"; review round 1 NB5]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.CONFIRMED_APPLIED });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-pass');
    expect(appliedClaims(text).length, `a confirmed run that applied ${F.CONFIRMED_APPLIED_RECORD.confirmed.removalsApplied} removals says it applied the confirmed removals`).toBeGreaterThan(0);
    await reopenWith(page, m, { status: F.STATUS.CONFIRMED_FAILED });
    text = await textOf(page, 'tp-pass');
    expect(appliedClaims(text), 'a confirmed run that failed with confirmed.removalsApplied 0 (confirmation.honoured still true) does not say it applied the confirmed removals — review NB5: build the sentence from latest.confirmed').toEqual([]);
  });

  /* ── AC-2: the backstop schedule ─────────────────────────────────────────────────────────────────────────────── */

  test('B13: with no enabled entry and a disabled one, the schedule warns the path has no backstop, mentions the disabled entry, and its button opens Scheduled Tasks [AC-2 "None enabled"]', async ({ page }) => {
    await mock(page, { schedule: F.SCHEDULE.NONE_WITH_DISABLED });
    await openAndSettle(page);
    await expect(section(page, 'tp-schedule'), 'a warning is a ready state').toHaveAttribute('data-state', 'ready');
    const text = await textOf(page, 'tp-schedule');
    expect(text, 'no backstop').toMatch(NO_BACKSTOP);
    expect(text, 'the disabled entry is mentioned').toMatch(DISABLED_MENTION);
    await section(page, 'tp-schedule').getByRole('button', { name: /schedul/i }).first().click();
    await expect(page.getByText('Schedule any parameterized task'), 'the Scheduled Tasks sub-tab opens').toBeVisible({ timeout: 10000 });
  });

  test('B14: with no entry at all, the schedule warns of no backstop and mentions no disabled entry [AC-2 "None enabled"]', async ({ page }) => {
    await mock(page, { schedule: F.SCHEDULE.NONE });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-schedule');
    expect(text).toMatch(NO_BACKSTOP);
    expect(text, 'no disabled entry exists to mention').not.toMatch(DISABLED_MENTION);
    await expect(section(page, 'tp-schedule').getByRole('button', { name: /schedul/i }).first()).toBeVisible();
  });

  test('B15: one enabled entry shows its interval and next run with no warning, and the disabled one is mentioned but not counted [AC-2 "One"]', async ({ page }) => {
    await mock(page, { schedule: F.SCHEDULE.ONE });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-schedule');
    expect(text, 'its interval').toMatch(/\b6\s?(?:hours?|hrs?|h)\b/i);
    const next = F.SCHEDULE.ONE.entries[1].timer.nextRunAt;
    expect(text, `when it runs next (${next})`).toMatch(timeRe(next));
    expect(text, 'the disabled entry is mentioned').toMatch(DISABLED_MENTION);
    expect(text, 'no "no backstop" warning').not.toMatch(NO_BACKSTOP);
    expect(text, 'not "enabled but not scheduled"').not.toMatch(NOT_SCHEDULED);
    expect(text, 'not weaker than daily').not.toMatch(WEAKER_THAN_DAILY);
    expect(text, 'the disabled entry is not counted (no "2 entries" / "more than one")').not.toMatch(SEVERAL);
  });

  test('B16: one enabled entry with no next run warns that it is enabled but not scheduled [AC-2 "One"]', async ({ page }) => {
    await mock(page, { schedule: F.SCHEDULE.ONE_UNSCHEDULED });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-schedule');
    expect(text).toMatch(NOT_SCHEDULED);
    expect(text, 'an entry exists: not "no backstop"').not.toMatch(NO_BACKSTOP);
  });

  test('B17: one enabled entry running less often than daily warns that the backstop is weaker than daily — an interval and a weekly cron [AC-2 "One"; ADR 0004 § UI scheduleView]', async ({ page }) => {
    const m = await mock(page, { schedule: F.SCHEDULE.ONE_WEAKER_INTERVAL });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-schedule');
    expect(text, 'every 2 days').toMatch(WEAKER_THAN_DAILY);
    expect(text).toMatch(/\b2\s?(?:days?|d)\b/i);
    expect(text, 'an entry exists: not "no backstop"').not.toMatch(NO_BACKSTOP);
    await reopenWith(page, m, { schedule: F.SCHEDULE.ONE_WEAKER_CRON });
    text = await textOf(page, 'tp-schedule');
    expect(text, 'a weekly cron').toMatch(WEAKER_THAN_DAILY);
    expect(text, 'the cron is its interval text').toContain('0 3 * * 0');
    expect(text, 'an entry exists: not "no backstop"').not.toMatch(NO_BACKSTOP);
  });

  test('B18: more than one enabled entry warns, naming how many [AC-2 "More than one"]', async ({ page }) => {
    await mock(page, { schedule: F.SCHEDULE.SEVERAL });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-schedule');
    expect(text, 'how many: 2').toMatch(/\b(?:2|two)\b[^.]*\b(?:entries|enabled|schedules|backstops)\b|\b(?:entries|enabled|schedules)\b[^.]*\b(?:2|two)\b/i);
    expect(text, 'entries exist: not "no backstop"').not.toMatch(NO_BACKSTOP);
  });

  /* ── AC-3: the real-time path ────────────────────────────────────────────────────────────────────────────────── */

  test('B19: the path on and running shows its state explained, when it first started and last reflected a change, its counts, failed reads, database refusals, changes left to the next pass, gauges and last catch-up [AC-3]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.ON_LIVE });
    await openAndSettle(page);
    await expect(section(page, 'tp-path')).toHaveAttribute('data-state', 'ready');
    const text = await textOf(page, 'tp-path');
    expect(text, 'the state code').toMatch(codeRe('live'));
    expect(text, 'the state explained').toContain(explanation('pathState', 'live'));
    expect(text, 'a known state is explained').not.toContain(NOT_RECOGNISED);
    expect(noOnOff(text), 'on').toMatch(ON);
    expect(text, 'running').toMatch(/running/i);
    expect(text, 'not "not running"').not.toMatch(NOT_RUNNING_STRICT);
    const P = F.PATH_FIGURES;
    const fr = P.failedReads;
    for (const [what, n] of [['added', P.added], ['changed', P.changed], ['removed', P.removed], ['unchanged', P.unchanged],
      ['people added', P.peopleAdded], ['refused taggings', P.refused], ['failed relay reads', fr.relay], ['failed graph reads', fr.graph],
      ['failed element reads', fr.element], ['failed catch-up reads', fr.catchUp], ['failed reads in all', fr.relay + fr.graph + fr.element + fr.catchUp],
      ['database refusals', P.dbRefused], ['removals not prompted', P.removalsNotPrompted], ['dropped over the backlog', P.droppedOverBacklog],
      ['parked', P.parked], ['pending', P.pending]]) {
      expect(text, `${what} (${n})`).toMatch(numRe(n));
    }
    const T = F.PATH_TIMES;
    expect(text, 'the counts run from the first start').toMatch(FIRST_START);
    expect(text, `when it first started (${T.firstStartedAt})`).toMatch(timeRe(T.firstStartedAt));
    expect(text, `when it last reflected a change (${T.lastReflectedAt})`).toMatch(timeRe(T.lastReflectedAt));
    expect(text, 'its last catch-up').toMatch(CATCH_UP);
    expect(text, 'the catch-up\'s outcome explained').toContain(explanation('catchUpOutcome', 'done'));
    expect(text, `when the catch-up ran (${T.catchUpStartedAt})`).toMatch(timeRe(T.catchUpStartedAt));
    expect(text, 'how long the catch-up took (4200 ms)').toMatch(/\b4[.,]2\s?s(?:ec\w*)?\b|\b4,?200\s?ms\b|\b4\s?s(?:ec\w*)?\b/i);
    expect(text, 'no "not yet available" once started').not.toContain(NOT_YET);
    expect(text, 'no stale warning while the status is fresh').not.toMatch(STALE);
    expect(text, 'no unreadable warning').not.toMatch(UNREADABLE);
    expect(text, 'no reset note: the counts were not reset').not.toMatch(COUNTS_RESET);
  });

  test('B20: the path on but not running says so, and does not show the stored "live" as current [AC-3 "On but not running"]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.ON_NOT_RUNNING });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-path');
    expect(text).toMatch(NOT_RUNNING);
    // 'live' may appear only as the last stored state, labelled so ("last stored state: live"), never as the state now.
    for (const x of text.matchAll(new RegExp(codeRe('live').source, 'g'))) {
      const before = text.slice(Math.max(0, x.index - 60), x.index);
      expect(before, 'the stored state "live" is not shown as current — only as the last stored state').toMatch(/\b(?:last|stored|previous|was|before)\b/i);
    }
    expect(text, 'nor explained as the state now').not.toContain(explanation('pathState', 'live'));
  });

  test('B21: each of the eight path states is shown with its code and its explanation, and an unknown state reads "not recognised" [AC-3 "Running"; story "Explanations"]', async ({ page }) => {
    test.setTimeout(150000);
    const m = await mock(page, { realtime: F.realtimeInState(F.PATH_STATES[0]) });
    for (const state of F.PATH_STATES) {
      await reopenWith(page, m, { realtime: F.realtimeInState(state) });
      const text = await textOf(page, 'tp-path');
      expect(noOnOff(text), `state ${state} shown`).toMatch(codeRe(state));
      expect(text, `state ${state} explained`).toContain(explanation('pathState', state));
      expect(text, `state ${state} is recognised`).not.toContain(NOT_RECOGNISED);
    }
    await reopenWith(page, m, { realtime: F.REALTIME.UNKNOWN_STATE });
    const text = await textOf(page, 'tp-path');
    expect(text).toMatch(codeRe('hibernating'));
    expect(text).toContain(NOT_RECOGNISED);
  });

  test('B22: the path warns when its status is stale, when its status cannot be read, and when its on/off record cannot be read (then counting as off) [AC-3 "Warnings"]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.STALE });
    await openAndSettle(page);
    expect(await textOf(page, 'tp-path'), 'stale').toMatch(STALE);
    await reopenWith(page, m, { realtime: F.REALTIME.STATUS_UNREADABLE });
    expect(await textOf(page, 'tp-path'), 'status unreadable').toMatch(STATUS_UNREADABLE);
    await reopenWith(page, m, { realtime: F.REALTIME.SWITCH_UNREADABLE });
    const text = await textOf(page, 'tp-path');
    expect(text, 'switch unreadable').toMatch(SWITCH_UNREADABLE);
    expect(noOnOff(text), 'the path then counts as off').toMatch(/\boff\b/i);
    expect(text, 'the switch warning is not the stale one').not.toMatch(STALE);
  });

  test('B23: before the path\'s first start its figures read "not yet available", never 0 [AC-3 "Values not yet produced"; T9]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.NEVER_STARTED });
    await openAndSettle(page);
    await expect(section(page, 'tp-path'), 'before the first start').toHaveAttribute('data-state', 'empty');
    const text = await textOf(page, 'tp-path');
    expect(text).toContain(NOT_YET);
    expect(text, 'no figure reads 0').not.toMatch(numRe(0));
  });

  test('B24: the path off shows the figures it produced before, labelled as its last figures, with the time they were written [AC-3 "Values not yet produced"]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-path');
    expect(text).toMatch(LAST_FIGURES);
    expect(text, `the time they were written (${F.REALTIME.OFF_WITH_FIGURES.updatedAt})`).toMatch(timeRe(F.REALTIME.OFF_WITH_FIGURES.updatedAt));
    expect(text).toMatch(numRe(F.PATH_FIGURES.added));
    expect(noOnOff(text)).toMatch(codeRe('off'));
  });

  test('B25: counts reset because the path\'s status was lost are said to be reset, running from the reset [AC-3 "What it has done"]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.COUNTS_RESET });
    await openAndSettle(page);
    expect(await textOf(page, 'tp-path')).toMatch(COUNTS_RESET);
  });

  test('B26: a setup problem and a last error are shown with their codes and explanations [AC-3 "Problems"]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.WAITING_SETUP });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-path');
    expect(text).toMatch(codeRe('waiting-setup'));
    expect(text, 'the state explained').toContain(explanation('pathState', 'waiting-setup'));
    expect(text, 'the schema rule').toContain('tags_address');
    expect(text, 'the problem').toMatch(codeRe('not-online'));
    expect(text, 'the setup problem explained').toContain(explanation('setupProblem', 'schema:tags_address:not-online'));
    expect(text, 'the last error\'s code').toMatch(codeRe('ServiceUnavailable'));
    expect(text, 'the last error\'s stage').toMatch(codeRe('graph-read'));
    expect(text, 'the last error explained').toContain(explanation('lastErrorStage', 'graph-read'));
    expect(text, 'every code here is known').not.toContain(NOT_RECOGNISED);
  });

  test('B45: the last catch-up\'s not-established reason is labelled as why only when its outcome is not-established; a failed catch-up carrying one does not label it as why it failed [AC-3 "Catch-up"; review round 1 NB11]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.CATCH_UP_NOT_ESTABLISHED });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-path');
    expect(text, 'a not-established catch-up gives its reason as why').toMatch(whyLabel('record-missing'));
    await reopenWith(page, m, { realtime: F.REALTIME.CATCH_UP_FAILED_WITH_REASON });
    text = await textOf(page, 'tp-path');
    expect(text, 'the failed catch-up\'s stage').toMatch(codeRe('stamp-scan'));
    expect(text, 'a failed catch-up carrying a not-established reason still to report does not label it as why it failed — review NB11: PathSection labels catchUp.last.reason "Why:" whatever the outcome').not.toMatch(whyLabel('record-missing'));
  });

  /* ── AC-4: drift ─────────────────────────────────────────────────────────────────────────────────────────────── */

  test('B27: the story\'s example — relay 7032, graph 7029: difference 3, explained 5 − 1 − 1 = 3 by the named pass, unexplained 0 [AC-4 "Example"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.DRIFT_EXAMPLE, drift: F.DRIFT.EXAMPLE, realtime: F.REALTIME.OFF_WITH_FIGURES });
    await openAndSettle(page);
    await expect(section(page, 'tp-drift')).toHaveAttribute('data-state', 'ready');
    const text = await textOf(page, 'tp-drift');
    expect(text, 'relay taggings').toMatch(numRe(7032));
    expect(text, 'graph relationships').toMatch(numRe(7029));
    expect(text, `when the counts were taken (${F.DRIFT.EXAMPLE.relay.takenAt})`).toMatch(timeRe(F.DRIFT.EXAMPLE.relay.takenAt));
    expect(text, 'the difference, 3').toMatch(near('differen\\w*', 3));
    expect(text, 'the explained part, 3').toMatch(near('(?<![Uu]n)explained', 3));
    const R = F.DRIFT_EXAMPLE_RECORD;
    expect(text, 'labelled with the explaining pass\'s run id').toContain(R.runId);
    expect(text, 'and its time').toMatch(new RegExp(`${timeRe(R.startedAt).source}|${timeRe(R.endedAt).source}`, 'i'));
    expect(text, '"unexplained" reads 0').toMatch(near('unexplained', 0));
    expect(text, 'the latest pass explains: nothing says another pass was used instead').not.toMatch(INSTEAD);
  });

  test('B28: a remainder is shown as unexplained, beside the addresses the pass left to the next one [AC-4 "What it names"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.LEFT_TO_NEXT, drift: F.DRIFT.UNEXPLAINED_8 });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-drift');
    expect(text, 'the difference 7040 − 7029 = 11').toMatch(near('differen\\w*', 11));
    expect(text, '"unexplained" reads 8').toMatch(near('unexplained', 8));
    expect(text, `lost races and conflicting addresses left to the next pass (${F.EXPECTED_DRIFT.LEFT_TO_NEXT.leftToNextPass})`).toMatch(numRe(F.EXPECTED_DRIFT.LEFT_TO_NEXT.leftToNextPass));
  });

  test('B29: after a clean pass with nothing changed since, "unexplained" reads 0 [AC-4 "A clean pass"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.CLEAN, drift: F.DRIFT.CLEAN });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-drift');
    expect(text).toMatch(numRe(7027));
    expect(text).toMatch(near('unexplained', 0));
  });

  test('B30: a count that failed or took too long reads "unknown" with its code, and no difference is shown from it [AC-4 "Unknown, never 0"; T9]', async ({ page }) => {
    await mock(page, { status: F.STATUS.DRIFT_EXAMPLE, drift: F.DRIFT.RELAY_TIMEOUT });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-drift');
    expect(text).toMatch(/\bunknown\b/);
    expect(text, 'the count\'s code').toMatch(codeRe('timeout'));
    expect(text, 'the known graph count').toMatch(numRe(7029));
    expect(text, 'the unknown relay count never reads 0').not.toMatch(near('relay', 0));
    expect(text, 'no difference is shown from an unknown count').not.toMatch(/difference\W{0,5}-?\d/i);
    expect(text, 'and no unexplained remainder either').not.toMatch(/unexplained\W{0,5}-?\d/i);
  });

  test('B31: when the latest pass is not finished, the panel says which finished pass it used instead [AC-4 "No finished pass"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.LATEST_FAILED, drift: F.DRIFT.EXAMPLE });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-drift');
    expect(text, 'the finished pass used').toContain(F.DRIFT_EXAMPLE_RECORD.runId);
    expect(text, 'said to be used instead of the latest').toMatch(INSTEAD);
    expect(text).toMatch(near('unexplained', 0));
  });

  test('B32: with no finished pass in the report, there is no explained part, the whole difference is "unexplained", and the panel says why [AC-4 "No finished pass"]', async ({ page }) => {
    await mock(page, { status: F.STATUS.NO_FINISHED, drift: F.DRIFT.EXAMPLE });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-drift');
    expect(text, '"unexplained" reads the whole difference, 3').toMatch(near('unexplained', 3));
    expect(text, 'and says why').toMatch(NO_FINISHED_WHY);
    expect(text, 'no explained part is shown').not.toMatch(EXPLAINED_NUM);
  });

  test('B33: with the path on, drift names the path\'s refused taggings and parked addresses; with it off, it says changes since the pass wait for the next pass [AC-4 "What it names"]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.DRIFT_EXAMPLE, drift: F.DRIFT.EXAMPLE, realtime: F.REALTIME.ON_LIVE });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-drift');
    expect(text, `the path's refused taggings (${F.PATH_FIGURES.refused})`).toMatch(numRe(F.PATH_FIGURES.refused));
    expect(text, `the path's parked addresses (${F.PATH_FIGURES.parked})`).toMatch(numRe(F.PATH_FIGURES.parked));
    expect(text, 'named, not subtracted: "unexplained" still reads 0').toMatch(near('unexplained', 0));
    expect(text, 'the path is on: no "changes wait for the next pass" note').not.toMatch(WAITS_FOR_PASS);
    await reopenWith(page, m, { realtime: F.REALTIME.OFF_WITH_FIGURES });
    text = await textOf(page, 'tp-drift');
    expect(text, 'changes since that pass wait for the next pass').toMatch(WAITS_FOR_PASS);
  });

  test('B34: Recount counts again and shows the new counts [AC-4 "When it counts"; T9 Recount]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.DRIFT_EXAMPLE, drift: F.DRIFT.EXAMPLE });
    await openAndSettle(page);
    expect(requestsTo(m.log, F.ROUTES.drift).length, 'counted once on opening').toBe(1);
    m.set({ drift: F.DRIFT.RECOUNT });
    await section(page, 'tp-drift').getByRole('button', { name: 'Recount', exact: true }).click();
    await expect.poll(() => textOf(page, 'tp-drift'), { message: 'the recount\'s relay count shows' }).toMatch(numRe(7051));
    expect(await textOf(page, 'tp-drift')).toMatch(numRe(7043));
    expect(requestsTo(m.log, F.ROUTES.drift).length, 'one more count').toBe(2);
  });

  test('B41: drift while a pass is running says a pass is running and that the newest finished pass explains the difference, never that the latest pass did not finish [AC-4; ADR 0004 T5 usedInsteadOfLatest; review round 1 NB1]', async ({ page }) => {
    await mock(page, { status: F.STATUS.RUNNING, drift: F.DRIFT.EXAMPLE });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-drift');
    expect(text, 'the explaining pass is the newest finished one').toContain(F.LATEST_DONE.runId);
    expect(text, 'a pass is running').toMatch(PASS_RUNNING);
    expect(text, 'the newest finished pass explains the difference').toMatch(NEWEST_FINISHED_EXPLAINS);
    expect(text, 'while a pass runs, drift does not say the latest pass did not finish — review NB1: DriftSection shows "did not finish" whenever usedInsteadOfLatest, a running pass included').not.toMatch(DID_NOT_FINISH);
  });

  test('B43: counts taken before the explaining pass ended show no "unexplained" figure: the panel says they predate that pass and asks for a Recount; a Recount with newer counts brings the explained and unexplained lines back [AC-4; ADR 0004 T5 countsPredatePass; review round 1 NB3]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.DRIFT_EXAMPLE, drift: F.DRIFT.PREDATING });
    await openAndSettle(page);
    const drift = section(page, 'tp-drift');
    await expect(drift).toHaveAttribute('data-state', 'ready');
    let text = await textOf(page, 'tp-drift');
    expect(text, `the counts are shown (relay 7032, taken ${F.DRIFT.PREDATING.relay.takenAt})`).toMatch(numRe(7032));
    expect(text, `the counts were taken before pass ${F.DRIFT_EXAMPLE_RECORD.runId} ended (T5 countsPredatePass) — review NB3: the panel presents them as unexplained instead`).toMatch(COUNTS_PREDATE);
    expect(text, 'and it asks for a Recount').toMatch(ASK_RECOUNT);
    expect(text, `no "unexplained" figure (arithmetic alone reads ${F.EXPECTED_DRIFT.PREDATING.unexplained})`).not.toMatch(/unexplained\W{0,5}-?\d/i);
    expect(text, 'nor the arithmetic\'s remainder beside "unexplained"').not.toMatch(near('unexplained', F.EXPECTED_DRIFT.PREDATING.unexplained));
    expect(await drift.getAttribute('style') || '', 'not in the warn tone (T5: tone neutral)').not.toMatch(/--orange|--red/);

    m.set({ drift: F.DRIFT.EXAMPLE });
    await drift.getByRole('button', { name: 'Recount', exact: true }).click();
    await expect.poll(async () => near('unexplained', 0).test(await textOf(page, 'tp-drift')), { message: 'after a Recount with counts newer than the pass, "unexplained" reads 0 again' }).toBe(true);
    text = await textOf(page, 'tp-drift');
    expect(text, 'the explained part is shown again').toMatch(near('(?<![Uu]n)explained', 3));
    expect(text, 'no "counts predate the pass" note any more').not.toMatch(COUNTS_PREDATE);
  });

  /* ── AC-5: refresh and failures ──────────────────────────────────────────────────────────────────────────────── */

  test('B35: a change on the status routes shows within POLL_MS, without a reload [AC-5 "Refresh"; ADR 0004 § UI "Polling", § Seams page.clock]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.NO_PASS, realtime: F.REALTIME.ON_LIVE });
    await openAndSettle(page);
    await expect(section(page, 'tp-pass')).toHaveAttribute('data-state', 'empty');
    expect(await textOf(page, 'tp-path'), 'no stale warning before the change').not.toMatch(STALE);
    const navigations = m.log.navigations;
    m.set({ status: F.STATUS.CLEAN, realtime: F.REALTIME.STALE });
    await page.clock.runFor(POLL_MS);
    await expect(section(page, 'tp-pass'), 'the new pass shows').toHaveAttribute('data-state', 'ready', { timeout: 3000 });
    await expect(section(page, 'tp-pass')).toContainText(codeRe('done'), { timeout: 3000 });
    await expect(section(page, 'tp-path'), 'the path\'s new warning shows').toContainText(STALE, { timeout: 3000 });
    expect(m.log.navigations, 'no reload').toBe(navigations);
  });

  // Each failed read: the answers that fail it, the section, the read it names, the code, and the sections that must
  // keep what they loaded. The page clock is paused before Retry, so only Retry (never a poll) can read it again.
  const FAILURES = [
    { read: 'the path status', mocks: { realtime: fail(500) }, recover: { realtime: F.REALTIME.ON_LIVE }, id: 'tp-path', names: /path(?:'s)? status|status of the (?:real-time )?path/i, code: 'http-500', others: ['tp-pass', 'tp-held', 'tp-schedule', 'tp-drift'] },
    { read: 'the pass report', mocks: { status: fail(500) }, recover: { status: F.STATUS.HELD_PENDING }, id: 'tp-pass', names: /\breport\b|pass(?:es)?(?:'s)? status|status of the pass/i, code: 'http-500', others: ['tp-path', 'tp-schedule', 'tp-drift'], unsettled: ['tp-held'] },
    { read: 'the schedule list', mocks: { schedule: fail(500) }, recover: { schedule: F.SCHEDULE.ONE }, id: 'tp-schedule', names: /schedul\w*\b[^.]*\b(?:list|entries)\b|\b(?:list|entries)\b[^.]*\bschedul/i, code: 'http-500', others: ['tp-pass', 'tp-held', 'tp-path', 'tp-drift'] },
    { read: 'the held list', mocks: { held: fail(502) }, recover: { held: undefined }, id: 'tp-held', names: /held list|list of (?:the )?held/i, code: 'http-502', others: ['tp-pass', 'tp-schedule', 'tp-path', 'tp-drift'] },
  ];
  for (const [i, c] of FAILURES.entries()) {
    test(`B36${'abcd'[i]}: a failed read of ${c.read} names itself, shows its code and offers Retry, while the other sections keep what they loaded; Retry recovers [AC-5 "States"; T9 Retry]`, async ({ page }) => {
      const m = await mock(page, c.mocks);
      await openAndSettle(page, c.unsettled || []);
      const failed = section(page, c.id);
      await expect(failed).toHaveAttribute('data-state', 'error');
      const text = await textOf(page, c.id);
      expect(text, `names the read (${c.read})`).toMatch(c.names);
      expect(text, 'shows the code').toMatch(codeRe(c.code));
      expect(text, 'never a raw JSON body').not.toMatch(/[{}]|"success"|fixture failure/);
      expect(text, 'never a stack trace').not.toMatch(/\bat [\w.]+ \(|TypeError|SyntaxError/);
      for (const id of c.others) await expect(section(page, id), `${id} keeps what it loaded`).toHaveAttribute('data-state', 'ready');
      await pauseClock(page);
      m.set(c.recover);
      await wait(1200);
      await expect(failed, 'with the clock paused and Retry not clicked, it stays failed').toHaveAttribute('data-state', 'error');
      await failed.getByRole('button', { name: 'Retry', exact: true }).click();
      await expect(failed, 'Retry reads it again').toHaveAttribute('data-state', 'ready', { timeout: 10000 });
    });
  }

  test('B37: a failed drift read makes both counts unknown, names the relay and graph counts, shows its code and offers Retry [AC-5 "States", AC-4]', async ({ page }) => {
    const m = await mock(page, { drift: fail(503) });
    await openAndSettle(page);
    const drift = section(page, 'tp-drift');
    await expect(drift).toHaveAttribute('data-state', 'error');
    const text = await textOf(page, 'tp-drift');
    expect(text, 'names the read: the relay and graph counts').toMatch(/relay (?:and|or|&) (?:the )?graph/i);
    expect(text).toMatch(codeRe('http-503'));
    expect((text.match(/\bunknown\b/g) || []).length, 'both counts read "unknown"').toBeGreaterThanOrEqual(2);
    expect(text, 'the relay count never reads 0').not.toMatch(near('relay', 0));
    expect(text, 'the graph count never reads 0').not.toMatch(near('graph', 0));
    expect(text, 'no difference is shown from unknown counts').not.toMatch(/difference\W{0,5}-?\d/i);
    for (const id of ['tp-pass', 'tp-path', 'tp-schedule']) await expect(section(page, id)).toHaveAttribute('data-state', 'ready');
    m.set({ drift: F.DRIFT.EXAMPLE });
    await drift.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(drift).toHaveAttribute('data-state', 'ready', { timeout: 10000 });
  });

  /* ── Polling (ADR 0004 § UI "Polling", "Failure"; review round 1 friction 1). These pin behaviour the panel has. ── */

  test('B46: a re-poll that fails after a good read sets the pass section to error, keeps the earlier figures, and labels them with the time they were read [AC-5 "States"; ADR 0004 § UI "Failure"; review friction 1]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.LATEST_AND_NINE });
    await openAndSettle(page);
    const pass = section(page, 'tp-pass');
    await expect(pass).toHaveAttribute('data-state', 'ready');
    const readAt = await page.evaluate(() => new Date().toISOString()); // the page clock, a moment after the good read
    expect(await textOf(page, 'tp-pass'), 'no "read at" label while the read is good').not.toMatch(readAtLabel(readAt));
    await pauseClock(page);
    m.set({ status: fail(500) });
    await page.clock.runFor(POLL_MS);
    await expect(pass, 'the failed re-poll sets error').toHaveAttribute('data-state', 'error', { timeout: 5000 });
    const text = await textOf(page, 'tp-pass');
    expect(text, 'the failure\'s code').toMatch(codeRe('http-500'));
    const L = F.LATEST_FIGURES;
    for (const [what, n] of [['taggings read', L.taggingsRead], ['added', L.added], ['removed', L.removed], ['unchanged', L.unchanged]]) {
      expect(text, `the earlier read's ${what} (${n}) is kept`).toMatch(numRe(n));
    }
    expect(text, 'the earlier read\'s outcome is kept').toContain(explanation('passOutcome', 'done'));
    expect(text, `the kept figures are labelled with the time they were read (${readAt})`).toMatch(readAtLabel(readAt));
    await expect(section(page, 'tp-path'), 'the path section is untouched').toHaveAttribute('data-state', 'ready');
  });

  test('B47: an answer to an older status request that arrives after a newer one is dropped — the section shows the newer answer [ADR 0004 § UI "Polling"; review friction 1]', async ({ page }) => {
    await trackStates(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let calls = 0;
    let firstReq = null;
    // The first status read (on opening) answers late with "no pass yet"; every later one answers at once, a clean pass.
    await mock(page, {
      status: (req) => {
        calls += 1;
        if (calls === 1) {
          firstReq = req;
          return gate.then(() => F.STATUS.NO_PASS);
        }
        return F.STATUS.CLEAN;
      },
    });
    try {
      await openPanel(page);
      await expect.poll(() => calls, { message: 'the opening status read is in flight' }).toBeGreaterThanOrEqual(1);
      await pauseClock(page);
      await page.clock.runFor(POLL_MS);
      await expect.poll(() => calls, { message: 'a poll tick sends a newer status read' }).toBeGreaterThanOrEqual(2);
      await expect(section(page, 'tp-pass'), 'the newer answer (a clean pass) shows').toHaveAttribute('data-state', 'ready', { timeout: 5000 });
      await expect(section(page, 'tp-pass')).toContainText(codeRe('done'));
    } finally {
      release();
    }
    await firstReq.response(); // the older answer has now reached the page
    await wait(800);
    await expect(section(page, 'tp-pass'), 'the older answer did not replace the newer one').toHaveAttribute('data-state', 'ready');
    expect(await textOf(page, 'tp-pass'), 'the older answer ("no pass yet") is not shown').not.toMatch(NO_PASS_YET);
    expect(await statesOf(page, 'tp-pass'), 'the section never took the older answer\'s state (empty), even briefly').not.toContain('empty');
  });

  test('B48: a poll tick is skipped while the previous one is in flight — no second status read starts until the first settles [ADR 0004 § UI "Polling"; review friction 1]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.CLEAN });
    await openAndSettle(page);
    await pauseClock(page);
    await wait(300);
    const mark = m.log.api.length;
    const since = (route) => requestsTo({ api: m.log.api.slice(mark) }, route).length;
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    // The read hangs for longer than POLL_MS, until released. Two more ticks run while it hangs: a third would reach
    // readSection's own 15 s time-out (taggingPipelineFetch.js), which settles the read as 'timeout'.
    m.set({ status: () => gate.then(() => F.STATUS.CLEAN) });
    try {
      await page.clock.runFor(POLL_MS);
      await expect.poll(() => since(F.ROUTES.status), { message: 'the first tick reads the status' }).toBe(1);
      for (let i = 0; i < 2; i += 1) {
        await page.clock.runFor(POLL_MS);
        await wait(250);
      }
      expect(since(F.ROUTES.status), 'two more ticks while the first read hangs start no second status read').toBe(1);
      expect(since(F.ROUTES.realtime), 'the whole tick is skipped: the path status is not re-read either').toBe(1);
    } finally {
      release();
    }
    await expect(section(page, 'tp-pass')).toHaveAttribute('data-state', 'ready');
    await wait(500);
    await page.clock.runFor(POLL_MS);
    await expect.poll(() => since(F.ROUTES.status), { message: 'once the first read settles, the next tick reads again' }).toBe(2);
  });

  /* ── AC-2: the held list of a run that is no longer the latest ──────────────────────────────────────────────── */

  test('B40: a held list answer of 404 carrying latestRunId makes the panel re-read the status and restart the list, never showing a failure [AC-2 "Held removals"; ADR 0004 § UI "The held list"]', async ({ page }) => {
    await trackStates(page);
    const NEWER_ID = F.runIdAt(F.at(2), '5e5e5e5e');
    const newer = F.clone(F.STATUS.HELD_PENDING);
    newer.latest.runId = NEWER_ID;
    newer.previous = [F.clone(F.HELD_RECORD), ...newer.previous];
    newer.confirmationPending = null;
    let first = true;
    const m = await mock(page, { status: F.STATUS.HELD_PENDING });
    m.set({
      held: (req, dflt) => {
        if (first) {
          first = false;
          m.set({ status: newer }); // a newer pass has written the report since the panel read it
          return fail(404, { success: false, error: 'that run is not the latest report', latestRunId: NEWER_ID });
        }
        return dflt();
      },
    });
    await openAndSettle(page);
    const held = section(page, 'tp-held');
    await expect(held, 'the list of the newer run shows').toHaveAttribute('data-state', 'ready', { timeout: 10000 });
    await expect.poll(async () => (await textOf(page, 'tp-held')).match(/held-address-\d{3}/g)?.length || 0, { message: 'the newer run\'s items show' }).toBeGreaterThan(0);
    const heldReads = requestsTo(m.log, F.ROUTES.held);
    expect(heldReads.some((l) => l.includes(`runId=${NEWER_ID}`)), 'the list is restarted for the newer run id').toBe(true);
    const firstHeld = m.log.api.findIndex((l) => l.split(' ')[1].startsWith(F.ROUTES.held));
    expect(m.log.api.slice(firstHeld + 1).some((l) => l.split(' ')[1] === F.ROUTES.status), 'the status is re-read after the 404').toBe(true);
    expect(await statesOf(page, 'tp-held'), 'the held section never shows a failure').not.toContain('error');
  });

  /* ── AC-1: it changes nothing ────────────────────────────────────────────────────────────────────────────────── */

  test('B38: open for a minute with two Recounts and then closed, the panel sends only GETs, exactly three counts, and no read after it closes [AC-1 "It changes nothing", AC-4 "Reads only"; ADR 0004 § Seams page.clock]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.CLEAN, realtime: F.REALTIME.OFF_WITH_FIGURES, schedule: F.SCHEDULE.ONE, drift: F.DRIFT.CLEAN });
    await openRelays(page);
    await wait(1500);
    const start = m.log.api.length;
    const startNonGet = m.log.nonGet.length;
    await openAndSettle(page);
    const recount = section(page, 'tp-drift').getByRole('button', { name: 'Recount', exact: true });
    const counts = () => requestsTo({ api: m.log.api.slice(start) }, F.ROUTES.drift).length;
    // A minute, one poll period at a time (a short real wait lets each tick's reads answer), with a Recount at 20 s
    // and at 40 s.
    for (let step = 1; step <= 60000 / POLL_MS; step += 1) {
      await page.clock.runFor(POLL_MS);
      await wait(150);
      if (step * POLL_MS === 20000 || step * POLL_MS === 40000) {
        const before = counts();
        await recount.click();
        await expect.poll(counts, { message: `the Recount at ${step * POLL_MS / 1000} s counts` }).toBe(before + 1);
      }
    }
    await settled(page, 'tp-drift');
    const open = m.log.api.slice(start);
    expect(m.log.nonGet.slice(startNonGet), 'every request the panel sends is a GET').toEqual([]);
    expect(requestsTo({ api: open }, F.ROUTES.drift).length, 'exactly three counts: on opening and on each Recount, none on a timer').toBe(3);
    const reads = open.map((l) => l.split(' ')[1].split('?')[0]).filter((p) => /^\/api\/(tagging-edges|scheduled-tasks)\//.test(p));
    const allowed = new Set([F.ROUTES.status, F.ROUTES.realtime, F.ROUTES.schedule, F.ROUTES.drift, F.ROUTES.held]);
    expect([...new Set(reads)].filter((p) => !allowed.has(p)), 'the panel reads only its five routes').toEqual([]);
    expect(requestsTo({ api: open }, F.ROUTES.status).length, 'the pass status is re-read at least every 10 s while open (≥ 6 in a minute)').toBeGreaterThanOrEqual(6);
    expect(requestsTo({ api: open }, F.ROUTES.realtime).length, 'the path status is re-read at least every 10 s while open (≥ 6 in a minute)').toBeGreaterThanOrEqual(6);
    // Close it: open another sub-tab, and let the clock run on.
    await subTab(page, EXISTING_TABS[3]).click();
    const closedAt = m.log.api.length;
    await page.clock.runFor(POLL_MS * 3);
    await wait(500);
    const after = m.log.api.slice(closedAt).filter((l) => /\/api\/tagging-edges\//.test(l));
    expect(after, 'no read after the panel closes (its timer is cleared)').toEqual([]);
    expect(m.log.nonGet, 'nothing but GETs in the whole visit').toEqual([]);
  });
});

/* ══ AC-6: the existing sub-tabs send the same requests as before (T10) ═══════════════════════════════════════════ */

const TAB_KEYS = { '🔄 Router Management': 'router', '🔃 Negentropy Sync': 'sync', '📡 Relay Configuration': 'config', '⚡ Streaming ETL': 'etl', '📅 Scheduled Tasks': 'schedule' };

/**
 * The distinct API requests one existing sub-tab sends from its click until the set has not grown for 1 s, at least
 * SETTLE_MS and at most SETTLE_MS × 2 after the click, sorted.
 */
async function requestsOfSubTab(page, m, label) {
  await openRelays(page);
  await wait(SETTLE_MS);
  // Start from another sub-tab, so the one under test mounts on its click (Router Management is open by default).
  const from = label === EXISTING_TABS[2] ? EXISTING_TABS[0] : EXISTING_TABS[2];
  await subTab(page, from).click();
  await wait(1000);
  const mark = m.log.api.length;
  await subTab(page, label).click();
  const distinct = () => new Set(m.log.api.slice(mark)).size;
  const t0 = Date.now();
  let size = -1;
  let stableSince = Date.now();
  while (Date.now() - t0 < SETTLE_MS * 2) {
    await wait(200);
    const now = distinct();
    if (now !== size) { size = now; stableSince = Date.now(); }
    if (Date.now() - t0 >= SETTLE_MS && Date.now() - stableSince >= 1000) break;
  }
  return [...new Set(m.log.api.slice(mark))].sort();
}

test.describe('AC-6: nothing else moves (tagging-edges #4, T10)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip(true, 'Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('B39: each existing Relays sub-tab — Router Management, Negentropy Sync, Relay Configuration, Streaming ETL, Scheduled Tasks — sends the same API requests as the recorded baseline, and keeps its label and order [AC-6 "The tab bar"; T10]', async ({ page, request }) => {
    test.setTimeout(150000);
    if (RECORDING) {
      const { missing } = await bundleContains(request, [TAB]);
      expect(missing, 'refusing to record the AC-6 baseline from a build that already contains the panel (T10: record before the change)').toEqual([TAB]);
    }
    const m = await mock(page);
    await openRelays(page);
    const labels = (await relayTabBar(page).getByRole('button').allInnerTexts()).map(squash);
    const observed = { tabs: labels.filter((l) => l !== TAB), subTabs: {} };
    for (const label of EXISTING_TABS) observed.subTabs[TAB_KEYS[label]] = await requestsOfSubTab(page, m, label);

    if (RECORDING) {
      let commit = null;
      try { commit = require('child_process').execSync('git rev-parse --short HEAD', { cwd: path.join(__dirname, '..', '..') }).toString().trim(); } catch (_) { commit = null; }
      const record = {
        note: 'AC-6 baseline (ADR 0004 T10): the distinct API requests each existing Relays sub-tab sends from its click until '
          + `the set has not grown for 1 s (at least ${SETTLE_MS} ms, at most ${SETTLE_MS * 2} ms), under `
          + 'tests/brainstorm/tagging-pipeline-panel.spec.js\'s mocks (catch-all 599). Recorded with TP_RECORD_BASELINE=1 '
          + 'against the UI before story 4.',
        recordedAt: commit,
        settleMs: SETTLE_MS,
        ...observed,
      };
      fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
      fs.writeFileSync(BASELINE_FILE, `${JSON.stringify(record, null, 2)}\n`);
      test.info().annotations.push({ type: 'recorded', description: BASELINE_FILE });
      return;
    }

    expect(fs.existsSync(BASELINE_FILE), `the AC-6 baseline ${path.relative(process.cwd(), BASELINE_FILE)} exists — record it with TP_RECORD_BASELINE=1 against the UI before story 4 (T10)`).toBe(true);
    const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    expect(observed.tabs, 'the five existing sub-tabs keep their labels and order').toEqual(baseline.tabs);
    for (const key of Object.values(TAB_KEYS)) {
      expect(observed.subTabs[key], `the ${key} sub-tab sends the same API requests as before`).toEqual(baseline.subTabs[key]);
    }
  });
});
