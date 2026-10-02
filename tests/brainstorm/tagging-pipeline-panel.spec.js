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
 *   B42 — a failed pass shows its failure code with its failureCode explanation under where it failed (ENOSPC); a
 *         schema refusal for an unreachable Neo4j names Neo4j, not only the Dashboard fix.                [AC-2; Blocking 1, NB2]
 *   B43 — counts taken before the explaining pass ended: no "unexplained" figure, a Recount asked for;
 *         a Recount with newer counts brings the explained and unexplained lines back.                    [AC-4; NB3, T5]
 *   B44 — "applied the confirmed removals" only when confirmed.removalsApplied > 0.                      [AC-2; NB5]
 *   B45 — a catch-up's not-established reason is labelled as "why" only on a not-established outcome.     [AC-3; NB11]
 *   B46 — a re-poll that fails after a good read: error, the earlier figures kept, labelled with their time. [AC-5; ADR § UI "Failure"; F1]
 *   B47 — an answer to an older status request that lands after a newer one is dropped.                    [ADR § UI "Polling"; F1]
 *   B48 — a poll tick is skipped while the previous one is in flight.                                     [ADR § UI "Polling"; F1]
 *   B49 — a pass-minted failure code (plan-error, on a plan failure) shows its own failureCode sentence under
 *         where it failed, never "not recognised".                                                         [AC-2, AC-5; Blocking 1, T12]
 *
 *   Story 5, the real-time path's switch (engineering-team/stories/tagging-edges/5-real-time-path-switch.md; ADR
 *   engineering-team/decisions/tagging-edges/0005-real-time-path-switch.md, § Seams "Browser mocks", "Browser
 *   fixtures", "The 15 s cases"). B38 is revised: its allowed reads gain the switch's record, re-read with the status.
 *   Story 4 review round 2 carry-forwards:
 *   B50 — R2-10: a held list restart whose status re-read is overtaken by a failing poll does not stay loading. [AC-2]
 *   B80 — R2-3: a confirmed pass that never recorded its end words its applied removals as a lower bound.      [AC-2]
 *   B81 — R2-6: failure.message and failure.stderrTail under "Where it failed"; no remedy points at the task log
 *         or strfry-error.log.                                                                                [AC-2]
 *   The switch:
 *   B51 — the control: "Turn off" on, "Turn on" off or unreadable, once the path status has a body.         [AC-1]
 *   B52 — under way: disabled, aria-busy, says so; the new state when the answer comes.                     [AC-1]
 *   B53 — "Turn on" asks nothing: one POST {"on":true}; on and starting, with who, from the reads after it.  [AC-3, AC-5]
 *   B54 — no answer in 15 s (switch, status and record hang): enabled again, "outcome unknown", then the next read. [AC-1]
 *   B55 — the warning beside "Turn on": no finished pass; the report unreadable; none otherwise.             [AC-1]
 *   B56 — the prompt, normally, for each of story 4's schedule states: what keeps the graph in step.         [AC-2]
 *   B57 — the prompt with the schedule unreadable: the backstop could not be checked.                        [AC-2]
 *   B58 — the prompt before the first start has completed.                                                   [AC-2]
 *   B59 — the prompt when the status cannot say whether the first start completed.                           [AC-2]
 *   B60 — Cancel sends nothing and changes nothing.                                                           [AC-2]
 *   B61 — confirming: one POST {"on":false}; off within 10 s, with who.                                       [AC-2, AC-5]
 *   B62 — the prompt closes by itself when a read shows the path off.                                        [AC-2]
 *   B63 — starting within the window, never failed; past it, story 4's "not running".                        [AC-3]
 *   B64 — a viewer who did not press sees it within POLL_MS; a reload in the window still says starting.     [AC-3, AC-5]
 *   B65 — an "on" while the old process still runs: starting, not running.                                   [AC-3]
 *   B66 — an "on" while already on: running, not starting.                                                    [AC-3]
 *   B67 — refused (403, and a lapsed session's 401): why, the status, the state unchanged.                   [AC-4]
 *   B68 — a failed on: unchanged, free space and writable, the code.                                          [AC-4]
 *   B69 — a failed off: not turned off, still on, the code.                                                    [AC-4]
 *   B70 — an admin turns on what the owner turned off: last change wins, both in the history.                 [AC-4, AC-5]
 *   B71 — the latest change and the last 10, newest first.                                                    [AC-5]
 *   B72 — never switched: no change recorded, an empty history.                                               [AC-5]
 *   B73 — an off the server could not record: said so, no who, never an earlier "on" as the latest.           [AC-5]
 *   B74 — a recorded state with no who: who and when not recorded.                                            [AC-5]
 *   B75 — the switch unreadable: no latest who, the stored history still shown.                               [AC-5]
 *   B76 — the history unreadable: said so, the latest change still shown.                                     [AC-5]
 *   B77 — a record that disagrees with the path status shows no who until they agree.                        [AC-5]
 *   B78 — a failed record read after a good one: no kept "who".                                               [AC-5]
 *   B79 — an answer that lands after the panel closed starts no read.                                        [AC-1]
 *   Story 5's review, round 1:
 *   B82 — the prompt while the schedule list's first read loads: still being checked, no verdict and no "could not
 *         be checked"; once the read answers, the verdict, in the prompt already open.                         [AC-2]
 *
 * ── Hermetic by construction ──────────────────────────────────────────────────────────────────────────────────────
 * Every /api route is mocked, story 5's switch included (GET its record, POST a change, on one route; the default
 * POST acts as the server would, so the status and the record follow it). The catch-all is registered FIRST (so every later route wins) and answers 599
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

/*
 * Story 5 (ADR 0005). Matched by idea, as above; the labels the story and ADR fix ("Turn off", "Turn on", "Cancel")
 * are matched as words.
 */
/** A time as its UTC clock time only (24- or 12-hour): for times near NOW, where timeRe's relative forms match other copy. */
function clockRe(iso) {
  const d = new Date(iso);
  const h = d.getUTCHours();
  const mi = String(d.getUTCMinutes()).padStart(2, '0');
  const h12 = h % 12 || 12;
  const hours = [...new Set([String(h).padStart(2, '0'), String(h), String(h12), String(h12).padStart(2, '0')])];
  return new RegExp(`(?<![\\d:])(?:${hours.join('|')})[:.]${mi}(?!\\d)`);
}
/** The sentences of `text` that match every one of `res`. */
const sentencesWith = (text, ...res) => text.split(/(?<=[.?])\s+/).filter((s) => res.every((re) => re.test(s)));
const STARTING_NOTE = /\bstarting\b/i;
const UP_TO_30S = /\b30\s?(?:s|secs?|seconds)\b|\bhalf a minute\b/i;
const IS_RUNNING = /\bis running\b|\bprocess\b[^.]*\brunning\b|\brunning since\b|\bhas run since\b/i;
const UNDER_WAY = /\b(?:turning|switching)\b|\bunder ?way\b|\bin progress\b|\bsending\b|\bwaiting\b/i;
const OUTCOME_UNKNOWN = /\b(?:outcome|result)\b[^.]*\bunknown\b|\bunknown\b[^.]*\b(?:outcome|result|whether)\b|\bnot known whether\b|\b(?:cannot|can't|could not|couldn't) tell whether\b/i;
/** The warning beside "Turn on" (AC-1): taggings already on the relay wait for a pass. */
const relayTaggingsWait = (text) => sentencesWith(text, /\balready\b/i, /\brelay\b/i, /\b(?:wait\w*|until)\b/i, /\bpass\b/i);
/** ... and when the report cannot be read: it could not check. */
const couldNotCheckPass = (text) => sentencesWith(text, /\b(?:could not|couldn't|cannot|can't|unable to)\b[^.]*\bcheck/i, /\b(?:pass\w*|report)\b/i);
const SIGN_IN_AGAIN = /\bsign(?:ed)? in again\b/i;
/** The refusal's own sentence (ADR 0005 D12 "refused", as TV80 reads it): sign in again, as the owner or an admin. */
const OWNER_OR_AN_ADMIN = /\bowner or an admin\b/i;
const refusedSentences = (text) => sentencesWith(text, SIGN_IN_AGAIN, OWNER_OR_AN_ADMIN);
const STATE_UNCHANGED = /\bunchanged\b|\bnot changed\b|\bhas not changed\b|\bdid not change\b|\bdidn't change\b/i;
const FREE_SPACE = /\bfree space\b|\bspace\b[^.]*\bdata volume\b|\bdata volume\b[^.]*\b(?:space|full)\b/i;
const WRITABLE = /\bwritable\b|\bcan be written\b|\bwrite to it\b/i;
const NOT_TURNED_OFF = /\b(?:could not|couldn't|cannot|can't|was not|wasn't|did not|didn't)\b[^.]*\bturn(?:ed)? (?:it |the path )?off\b|\bnot turned off\b/i;
const STILL_ON = /\bstill on\b|\bremains on\b|\bstays on\b/i;
const TURNED_ON = /\b(?:turned|switched) on\b/i;
const TURNED_OFF = /\b(?:turned|switched) off\b/i;
const TURNED_ON_BY = /\b(?:turned|switched) on by\b/i;
const NOT_RECORDED = /\bnot (?:been )?recorded\b|\bunrecorded\b|\b(?:could not|couldn't|cannot|can't) be recorded\b|\bwasn't recorded\b|\bweren't recorded\b/i;
const NO_CHANGE_RECORDED = /\bno change\b[^.]*\brecorded\b|\bno changes? (?:has|have) been recorded\b|\bnothing (?:has been )?recorded\b|\bnever (?:been )?(?:switched|turned|changed)\b/i;
const HISTORY_UNREADABLE = /\bhistory\b[^.]*(?:(?:cannot|could not|can't|couldn't) be read|\bunreadable\b|not readable)|\bunreadable history\b/i;
const RECORD_REFRESHING = /\brefresh\w*\b|\bbeing (?:updated|read|re-?read)\b|\bupdating\b|\bre-?reading\b/i;
/** A sentence that claims how many confirmed removals were applied (R2-3), and the words that make it a lower bound. */
const removalClaims = (text) => sentencesWith(text, /\bappl(?:ied|y)\b/i, /\bconfirm\w*\b/i, /\bremovals?\b/i);
const LOWER_BOUND = /\bat least\b|\bor more\b|\bno fewer than\b|\b(?:may|might|could) have\b|\bpossibly\b|\blast sav(?:e|ed)\b|\bbefore it stopped\b|\bat (?:its|the) last\b/i;
/** Where a remedy must no longer send the owner (R2-6): logs that do not hold a pass's error details. */
const LOG_POINTERS = /\btask(?:'s)? log\b|strfry-error\.log/i;
/** The several-entries backstop warning (B18's idea). */
const SEVERAL_COUNT = /\b(?:2|two)\b[^.]*\b(?:entries|enabled|schedules|backstops)\b|\b(?:entries|enabled|schedules)\b[^.]*\b(?:2|two)\b/i;
/* The off prompt (AC-2; ADR 0005 D13). */
const PROMPT_STOPS = /\bstops?\b[^.]*\b(?:within|in) (?:a few |about \d+ |\d+ )?seconds?\b|\b(?:within|in) (?:a few |about \d+ |\d+ )?seconds?\b[^.]*\bstops?\b/i;
const PROMPT_KEPT = /\bkept\b|\bkeeps\b/i;
const PROMPT_CATCH_UP = /\bcaught up\b|\bcatch(?:es)?[- ]?up\b/i;
const PROMPT_BACK_ON = /\bTurn on\b|\b(?:turned|switched) (?:it |the path )?(?:back )?on\b/i;
const PROMPT_NEXT_PASS = /\bnext pass\b/i;
/** The backstop still being checked: the schedule list's read is still loading (review round 1, requested 5). */
const BACKSTOP_CHECKING = new RegExp('\\b(?:backstop|schedul\\w*)\\b[^.]*'
  + '\\b(?:(?:still )?being (?:checked|read)|(?:still )?loading)\\b'
  + '|\\b(?:still )?(?:checking|reading|loading)\\b[^.]*\\b(?:backstop|schedul\\w*)\\b', 'i');
const BACKSTOP_UNCHECKED = /\bbackstop\b[^.]*(?:could not|couldn't|cannot|can't) be (?:checked|read|confirmed)|\b(?:could not|couldn't|cannot|can't|unable to) (?:check|read|confirm)\b[^.]*\b(?:backstop|schedul\w*)\b/i;
const FIRST_DROPPED = /\b(?:dropped|discarded|thrown away|lost|deleted|cleared)\b/i;
const FIRST_START_AGAIN = /\bfirst start\b[^.]*\bagain\b|\bagain\b[^.]*\bfirst start\b/i;
const PASS_AFTER_LIVE = /\bpass\b[^.]*\b(?:after|once|when)\b[^.]*\blive\b|\b(?:after|once|when)\b[^.]*\blive\b[^.]*\bpass\b/i;
const FIRST_START_UNCHECKED = /\b(?:could not|couldn't|cannot|can't|unable to) (?:check|tell|confirm|be (?:checked|confirmed|sure))\b[^.]*\bfirst start|\bfirst start\b[^.]*(?:could not|couldn't|cannot|can't) be (?:checked|confirmed|read)|\bunknown\b[^.]*\bfirst start|\bfirst start\b[^.]*\bunknown\b/i;
const IF_FIRST_START = /\bif\b[^.]*\b(?:first start|dropped|discarded)\b/i;
/**
 * The normal variant's claims (AC-2 "Normally"), sentence by sentence: what the path holds is kept, and changes stored
 * meanwhile are caught up when it is turned back on. A negated sentence ("nothing it gathered is kept") claims neither.
 */
const keptClaims = (text) => sentencesWith(text, PROMPT_KEPT).filter((s) => !NEGATED.test(s));
const caughtUpOnClaims = (text) => sentencesWith(text, PROMPT_CATCH_UP, PROMPT_BACK_ON).filter((s) => !NEGATED.test(s));

/** An answer that is an HTTP failure: fail(500) → 500 { success: false }. */
const fail = (status, body = { success: false, error: 'fixture failure' }) => ({ __http: status, body });
/** A fixture answer written { status, body } (F.SWITCH_ANSWER) as a mock answer; anything else as it is. */
const answerOf = (a) => (a && !a.__http && typeof a.status === 'number' && Object.prototype.hasOwnProperty.call(a, 'body')
  ? (a.status >= 200 && a.status <= 299 ? a.body : fail(a.status, a.body))
  : a);

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
 * Story 5 (ADR 0005 § Seams "Browser mocks"): the switch path is one route branching on the method. `record` is the
 * GET's answer; left undefined, it is the record that agrees with the current `realtime` body (F.recordFor). `switch`
 * is the POST's answer (a body, fail(…), an F.SWITCH_ANSWER, or a function of (request, theServersChange)); left
 * undefined, the change lands as the server would make it: the record gains the viewer's change and the status
 * follows (F.REALTIME.STARTING after an on, F.REALTIME.OFF_WITH_FIGURES after an off).
 * Returns { log, set }: log.api is every /api request as "METHOD /path?query", log.nonGet every non-GET, and log.sent
 * every non-GET's { method, path, body, contentType }.
 */
async function mock(page, o = {}) {
  const cur = {
    who: 'owner',
    status: F.STATUS.HELD_PENDING,
    realtime: F.REALTIME.ON_LIVE,
    schedule: F.SCHEDULE.ONE,
    drift: F.DRIFT.EXAMPLE,
    heldList: F.HELD_LIST,
    record: undefined,
    switch: undefined,
    ...o,
  };
  const log = { api: [], nonGet: [], sent: [], navigations: 0 };
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) log.api.push(`${req.method()} ${u.pathname}${u.search}`);
    if (u.pathname.startsWith('/api/') && req.method() !== 'GET') {
      log.nonGet.push(`${req.method()} ${u.pathname}`);
      log.sent.push({ method: req.method(), path: u.pathname, body: req.postData(), contentType: req.headers()['content-type'] || null });
    }
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

  // Story 5's route (ADR 0005 D6, D11): GET the switch's record, POST a change.
  const recordNow = () => (cur.record === undefined ? F.recordFor(typeof cur.realtime === 'function' ? null : cur.realtime) : cur.record);
  /** The server's change (ADR 0005 D2, D3, D11): recorded as the viewer's, the status following it. */
  const serverSwitch = (req) => {
    let on = null;
    try { on = JSON.parse(req.postData() || 'null').on; } catch (_) { on = null; }
    if (typeof on !== 'boolean') return fail(400, { success: false, error: 'the body must be {"on": true} or {"on": false}' });
    const w = who();
    const prev = typeof cur.record === 'function' || (cur.record && cur.record.__http) ? null : recordNow();
    cur.record = F.foldRecord(prev, { on, at: F.NOW, role: w ? w.classification : null, key: w ? w.pubkey.slice(0, 8) : null });
    cur.realtime = on ? F.REALTIME.STARTING : F.REALTIME.OFF_WITH_FIGURES;
    return (on ? F.SWITCH_ANSWER.ON : F.SWITCH_ANSWER.OFF).body;
  };
  await page.route('**/api/tagging-edges/realtime/switch', (r) => fulfil(r, async (req) => {
    if (req.method() === 'POST') {
      let v;
      if (typeof cur.switch === 'function') v = await cur.switch(req, () => serverSwitch(req));
      else v = cur.switch === undefined ? serverSwitch(req) : cur.switch;
      return answerOf(v);
    }
    return typeof cur.record === 'function' ? answerOf(await cur.record(req)) : recordNow();
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

/* ── Story 5: the control, the prompt and the record (ADR 0005 D12, D13) ─────────────────────────────────────────── */

const SWITCH_POST = `POST ${F.ROUTES.switch}`;
/** The path section's control, by its label (AC-1: "Turn off" while on, "Turn on" while off). */
const control = (page, name) => section(page, 'tp-path').getByRole('button', { name, exact: true });
const controls = (page) => section(page, 'tp-path').getByRole('button', { name: /^\s*Turn (?:on|off)\s*$/ });
const cancelButton = (page) => section(page, 'tp-path').getByRole('button', { name: 'Cancel', exact: true });
/**
 * The pending control (ADR 0005 D12 "While pending it is disabled … and aria-busy"): a button in tp-path that itself
 * carries aria-busy="true". Other elements of tp-path may be busy too (a re-read, say); they are not counted.
 */
const busyButtons = (page) => section(page, 'tp-path').locator('button[aria-busy="true"]');
/** Press the control labelled `name`; fails by name within 5 s when there is no such control. */
async function press(page, name) {
  const b = control(page, name);
  await expect(b, `the path section has a "${name}" control (AC-1; ADR 0005 D12) — not implemented yet if missing`).toBeVisible({ timeout: 5000 });
  await b.click();
}
/**
 * The off prompt (ADR 0005 D13): the nearest element around its "Cancel" button that also holds its "Turn off" button
 * and a heading — an inline confirmation inside tp-path with "a heading, the variant's text, and the buttons".
 */
const PROMPT_XPATH = 'xpath=.//button[normalize-space(.)="Cancel"]/ancestor::*[.//button[normalize-space(.)="Turn off"]]'
  + '[.//h1 or .//h2 or .//h3 or .//h4 or .//h5 or .//h6 or .//*[@role="heading"]][1]';

/** Press "Turn off" and return the prompt it opens: { prompt, cancel, confirm, text() }. */
async function openPrompt(page) {
  await press(page, 'Turn off');
  const cancel = cancelButton(page);
  await expect(cancel, 'pressing "Turn off" opens a prompt inside the path section, with a "Cancel" button (AC-2; ADR 0005 D13) — not implemented yet').toBeVisible({ timeout: 5000 });
  const prompt = section(page, 'tp-path').locator(PROMPT_XPATH).first();
  await expect(prompt, 'the prompt is one element holding its heading, its text, and its "Turn off" and "Cancel" buttons (ADR 0005 D13 "Layout")').toHaveCount(1);
  expect(await prompt.getAttribute('data-testid'), 'the prompt is its own element inside tp-path, not the whole section (ADR 0005 D13: an inline confirmation inside tp-path)').not.toBe('tp-path');
  return {
    prompt,
    cancel,
    confirm: prompt.getByRole('button', { name: 'Turn off', exact: true }),
    text: async () => squash(await prompt.innerText()),
  };
}

/** The history list: the ordered list of up to 10 changes (ADR 0005 D12), its rows newest first. */
const historyRows = (page) => section(page, 'tp-path').locator('ol > li');
const rowText = async (page, i) => squash(await historyRows(page).nth(i).innerText());
/**
 * tp-path's text as the viewer reads it, with its history list left out: where the latest change shows. One
 * synchronous read in the page (the list hidden, the text read, the list shown again), so no render falls between.
 */
async function outsideHistory(page) {
  return squash(await section(page, 'tp-path').evaluate((el) => {
    const lists = [...el.querySelectorAll('ol')];
    const before = lists.map((o) => o.style.display);
    lists.forEach((o) => { o.style.display = 'none'; });
    try {
      return el.innerText;
    } finally {
      lists.forEach((o, i) => { o.style.display = before[i]; });
    }
  }));
}
/**
 * Wait until a section's text as the viewer reads it matches `re`. (innerText, as textOf reads it: toContainText reads
 * textContent, which runs block elements together — "Turn onNo change" — so a \b-anchored idea could miss.)
 */
async function untilText(page, id, re, message, timeout = 5000) {
  await expect.poll(async () => re.test(await textOf(page, id)), { message: `${message} (${re})`, timeout }).toBe(true);
}
const KEYS = [F.OWNER_KEY, F.ADMIN_KEY];

/** The control while a change is under way: the button carrying aria-busy="true", and disabled (ADR 0005 D12). */
async function busyControl(page) {
  const busy = busyButtons(page).first();
  await expect(busy, 'while a change is under way the control — the button itself — carries aria-busy="true" (ADR 0005 D12 "While pending it is disabled … and aria-busy") — not implemented yet if missing').toBeVisible({ timeout: 5000 });
  await expect(busy, 'and that pending control is disabled (ADR 0005 D12)').toBeDisabled();
  return busy;
}

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
    await expect(page.getByRole('button', { name: /confirm/i }), 'the panel offers no way to confirm (story 6, since story 5\'s Planning split the controls)').toHaveCount(0);
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

  test('B42: a failed pass shows its failure code with its explanation under where it failed (a write on a full disk, ENOSPC); a schema refusal because Neo4j cannot be reached shows ServiceUnavailable and names Neo4j, not only the Dashboard fix [AC-2 "The latest pass"; review round 1 Blocking 1, NB2; ADR 0004 T12]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.WRITE_FAILED });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-pass');
    const stage = explanation('failureStage', 'write');
    // A pass's own failure.code is explained under failureCode, never countCode (ADR 0004 T12).
    const enospc = explanation('failureCode', 'ENOSPC');
    expect(text, 'where it failed (the write stage, explained)').toContain(stage);
    // Not codeRe('ENOSPC') alone: passReason 'write' names ENOSPC in its own sentence ("If the code is ENOSPC, …").
    const shown = new RegExp(`${codeRe('ENOSPC').source}\\W{0,40}${esc(enospc)}`).exec(text);
    expect(shown, `the failure's code ENOSPC is shown beside its explanation, explain('failureCode', 'ENOSPC') ("${enospc}") — review Blocking 1/NB2, T12: "Where it failed" shows failure.code explained under failureCode`).not.toBeNull();
    expect(shown.index, 'the code is shown under where it failed').toBeGreaterThan(text.indexOf(stage));

    await reopenWith(page, m, { status: F.STATUS.SCHEMA_UNREACHABLE });
    text = await textOf(page, 'tp-pass');
    const unavailable = explanation('failureCode', 'ServiceUnavailable');
    expect(text, `the failure's code ServiceUnavailable is shown beside its explanation ("${unavailable}")`).toMatch(new RegExp(`${codeRe('ServiceUnavailable').source}\\W{0,40}${esc(unavailable)}`));
    // Apart from the code's own explanation, the refusal's reason must not send the owner only to the Dashboard's
    // constraints fix: a schema refusal is also Neo4j being down or refusing the password.
    const rest = text.split(unavailable).join(' ');
    expect(rest, 'the schema refusal\'s reason names Neo4j being down or unreachable as a cause (review Blocking 1: passReason.schema names only the Dashboard constraints fix)').toMatch(NEO4J_DOWN);
  });

  test('B49: a pass-minted failure code — plan-error, on a pass that failed at the plan stage — is shown under where it failed with its own failureCode sentence, explain(\'failureCode\', \'plan-error\'), and the pass section never reads "not recognised" [AC-2 "The latest pass", AC-5 "Explanations"; review round 1 Blocking 1; ADR 0004 T12]', async ({ page }) => {
    // The runner's plan failure (reconcileTaggingEdges.js:436): fail('plan', { stage: 'plan', code: 'plan-error', … }).
    const planFailed = F.passRecord({
      startedMinutesAgo: 9,
      suffix: 'b1a4b1a4',
      outcome: 'failed',
      reasonCode: 'plan',
      reason: 'planning failed',
      failure: { stage: 'plan', code: 'plan-error', message: 'a planning step threw' },
      phases: F.clone(F.LATEST_DONE.phases).slice(0, 3),
    });
    await mock(page, { status: F.statusBody({ latest: planFailed, previous: [F.LATEST_DONE] }) });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-pass');
    const stage = explanation('failureStage', 'plan');
    const own = explanation('failureCode', 'plan-error');
    expect(text, 'where it failed (the plan stage, explained)').toContain(stage);
    const shown = new RegExp(`${codeRe('plan-error').source}\\W{0,40}${esc(own)}`).exec(text);
    expect(shown, `the failure's code plan-error is shown beside its own sentence, explain('failureCode', 'plan-error') ("${own}") — T12: a pass mints its own codes, explained under failureCode`).not.toBeNull();
    expect(shown.index, 'the code is shown under where it failed').toBeGreaterThan(text.indexOf(stage));
    expect(text, 'a code the pass mints is never "not recognised" (T12; AC-5)').not.toContain(NOT_RECOGNISED);
  });

  test('B81: a failed pass shows its error details — failure.message and, for a relay read, failure.stderrTail, both redacted by the server — under "Where it failed", and no remedy beside them points at "the task log" or strfry-error.log, which hold none of a pass\'s error details [AC-2 "The latest pass"; story 5 Test tasks (R2-6, added by the Product Owner); story 4 review round 2 R2-6: passReason.error and the failureCode entries plan-error, error, spawn, process-error, exit, unparseable and not-an-event-line]', async ({ page }) => {
    test.setTimeout(150000);
    const relay = (code, suffix, message, stderrTail) => F.passRecord({
      startedMinutesAgo: 7,
      suffix,
      outcome: 'failed',
      reasonCode: 'read',
      reason: 'the relay read failed',
      failure: { stage: 'read', read: 'relay', code, message, ...(stderrTail ? { stderrTail } : {}) },
      phases: F.clone(F.LATEST_DONE.phases).slice(0, 2),
    });
    const CASES = [
      { what: 'a relay read whose strfry command exited with a failure code (exit)', record: F.RELAY_EXIT_RECORD },
      { what: 'a relay read whose output was not JSON (unparseable)', record: relay('unparseable', 'e8e8e8e8', 'strfry scan printed a line that is not JSON', 'strfry error: malformed record in <path>') },
      { what: 'a relay read that printed a line that is not an event (not-an-event-line)', record: relay('not-an-event-line', 'e9e9e9e9', 'strfry scan printed a line that is not an event') },
      { what: 'a relay read whose strfry command could not start (spawn)', record: relay('spawn', 'eaeaeaea', 'could not start strfry scan: ENOENT') },
      { what: 'a relay read whose strfry command could not run (process-error)', record: relay('process-error', 'ebebebeb', 'strfry scan could not be read: EPIPE', 'exit code 141') },
      {
        what: 'a planning fault (plan-error)',
        record: F.passRecord({ startedMinutesAgo: 9, suffix: 'ecececec', outcome: 'failed', reasonCode: 'plan', reason: 'planning failed', failure: { stage: 'plan', code: 'plan-error', message: 'a planning step threw: cannot read the tag address' }, phases: F.clone(F.LATEST_DONE.phases).slice(0, 3) }),
      },
      {
        what: 'a fault in the pass\'s own code (passReason error, failureCode error)',
        record: F.passRecord({ startedMinutesAgo: 9, suffix: 'edededed', outcome: 'failed', reasonCode: 'error', reason: 'an unexpected error ended the pass', failure: { stage: 'unexpected', code: 'error', message: 'Cannot read properties of undefined (reading \'relationships\')' }, phases: F.clone(F.LATEST_DONE.phases).slice(0, 4) }),
      },
    ];
    const m = await mock(page, { status: F.statusBody({ latest: CASES[0].record, previous: [F.LATEST_DONE] }) });
    for (const [i, c] of CASES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reopenWith(page, m, { status: F.statusBody({ latest: c.record, previous: [F.LATEST_DONE] }) });
      const text = await textOf(page, 'tp-pass');
      const stage = explanation('failureStage', c.record.failure.stage);
      expect(text, `${c.what}: where it failed`).toContain(stage);
      for (const field of ['message', 'stderrTail']) {
        const value = c.record.failure[field];
        if (!value) continue;
        const at = text.indexOf(value);
        expect(at, `${c.what}: failure.${field} ("${value}") is shown — review R2-6: a pass's error details are failure.message and, for a relay read, failure.stderrTail, already redacted on the public route`).toBeGreaterThanOrEqual(0);
        expect(at, `${c.what}: failure.${field} is shown under where it failed`).toBeGreaterThan(text.indexOf(stage));
      }
      expect(text, `${c.what}: no remedy points at "the task log" (deleted by launchChildTask.sh) or strfry-error.log (not where a pass's strfry stderr goes) — review R2-6`).not.toMatch(LOG_POINTERS);
    }
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

  test('B80: a confirmed pass that never recorded its end (its pessimistic "stopped" record, kept only at its last save) words how many confirmed removals it applied as a lower bound — 60 "at least", and none never as a flat fact — while a pass that recorded its end states its figure exactly [AC-2 "The latest pass"; story 4 review round 2 R2-3 (a story 5 carry-forward): "word the figure as a lower bound in that case; add a browser case next to B44"]', async ({ page }) => {
    const m = await mock(page, { status: F.STATUS.STOPPED_CONFIRMED });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-pass');
    let claims = removalClaims(text);
    expect(claims.length, 'it says how many of the confirmed removals it applied').toBeGreaterThan(0);
    expect(claims.some((s) => numRe(60).test(s)), 'with the figure its last save holds, 60').toBe(true);
    for (const s of claims) {
      expect(s, 'a pass that never recorded its end may have applied more after its last save: the figure is a lower bound — review R2-3 ("It applied N of the confirmed removals" can be false)').toMatch(LOWER_BOUND);
    }
    await reopenWith(page, m, { status: F.STATUS.STOPPED_CONFIRMED_NONE });
    text = await textOf(page, 'tp-pass');
    claims = removalClaims(text);
    expect(claims.length, 'it says what its last save holds of the confirmed removals').toBeGreaterThan(0);
    for (const s of claims) {
      expect(s, 'none applied by its last save is not "it applied none": it may have applied some after — review R2-3').toMatch(LOWER_BOUND);
    }
    await reopenWith(page, m, { status: F.STATUS.CONFIRMED_APPLIED });
    text = await textOf(page, 'tp-pass');
    claims = removalClaims(text).filter((s) => numRe(F.HELD_TOTAL).test(s));
    expect(claims.length, `a pass that recorded its end says it applied ${F.HELD_TOTAL} of the confirmed removals`).toBeGreaterThan(0);
    for (const s of claims) expect(s, 'a pass that recorded its end states its figure exactly, not as a lower bound').not.toMatch(LOWER_BOUND);
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

  test('B50: when the held list\'s restart re-reads the status and that answer is overtaken by a poll tick whose own status read then fails, the held list does not stay loading — it shows its own failure [AC-2 "Held removals", AC-5 "States"; story 4 review round 2 R2-10 (a story 5 carry-forward), round 1 friction 3; ADR 0004 § UI "The held list"; TaggingPipelinePanel.jsx useRead\'s `kept`]', async ({ page }) => {
    const NEWER_ID = F.runIdAt(F.at(2), '5e5e5e5e');
    const newer = F.clone(F.STATUS.HELD_PENDING);
    newer.latest.runId = NEWER_ID;
    newer.previous = [F.clone(F.HELD_RECORD), ...newer.previous];
    newer.confirmationPending = null;
    let releaseHeld;
    let releaseStatus;
    const heldGate = new Promise((resolve) => { releaseHeld = resolve; });
    const statusGate = new Promise((resolve) => { releaseStatus = resolve; });
    // before: the report as first read. reread: the first status read after the held list's 404 (the restart's own),
    // held until released, then naming the newer run. overtaken: every later status read fails.
    let phase = 'before';
    let restartReads = 0;
    let heldCalls = 0;
    const m = await mock(page, {
      status: () => {
        if (phase === 'before') return F.STATUS.HELD_PENDING;
        if (phase === 'reread') {
          phase = 'overtaken';
          restartReads += 1;
          return statusGate.then(() => newer);
        }
        return fail(500);
      },
      held: (req, dflt) => {
        heldCalls += 1;
        if (heldCalls > 1) return dflt();
        return heldGate.then(() => {
          phase = 'reread';
          return fail(404, { success: false, error: 'that run is not the latest report', latestRunId: NEWER_ID });
        });
      },
    });
    try {
      await openPanel(page);
      await expect.poll(() => heldCalls, { message: 'the held list of the latest run is read' }).toBe(1);
      await pauseClock(page); // no poll tick but the one the test runs
      releaseHeld();
      await expect.poll(() => restartReads, { message: 'the 404 naming a newer run makes the panel re-read the status' }).toBe(1);
      await expect(section(page, 'tp-held'), 'while that re-read is in flight, the held list is loading').toHaveAttribute('data-state', 'loading');
      await page.clock.runFor(POLL_MS);
      await expect(section(page, 'tp-pass'), 'a poll tick\'s newer status read fails, and it is the answer the panel keeps').toHaveAttribute('data-state', 'error', { timeout: 5000 });
    } finally {
      releaseHeld();
      releaseStatus(); // the restart's status answer now arrives, older than the poll's: it is dropped
    }
    await expect(section(page, 'tp-held'), 'the restart\'s status answer was dropped, so the held list falls through to its own failure instead of waiting on loading for a restart that never comes — review R2-10, friction 3').toHaveAttribute('data-state', /^(ready|empty|error)$/, { timeout: 5000 });
    await wait(600);
    await expect(section(page, 'tp-held'), 'and it stays out of loading').not.toHaveAttribute('data-state', 'loading');
  });

  /* ── AC-1: it changes nothing ────────────────────────────────────────────────────────────────────────────────── */

  test('B38: open for a minute with two Recounts and then closed, by a viewer who never presses the switch, the panel sends only GETs, exactly three counts, and no read after it closes; it reads its five routes and story 5\'s switch record, which it re-reads with the status [AC-1 "It changes nothing", AC-4 "Reads only"; story 5 AC-6 "The panel\'s reads still change nothing", Test tasks "the browser spec\'s non-GET log allow[s] exactly this control\'s request"; ADR 0005 D12 "The record read … polled with the status reads", § Consequences "B38\'s allowed set gains the record read", § Seams "log.nonGet … [] … for a viewer who never presses"; ADR 0004 § Seams page.clock]', async ({ page }) => {
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
    // Story 5 (ADR 0005 § Consequences): the allowed reads gain the switch's record, GET on the switch path.
    const allowed = new Set([F.ROUTES.status, F.ROUTES.realtime, F.ROUTES.schedule, F.ROUTES.drift, F.ROUTES.held, F.ROUTES.switch]);
    expect([...new Set(reads)].filter((p) => !allowed.has(p)), 'the panel reads only its five routes and the switch\'s record').toEqual([]);
    expect(requestsTo({ api: open }, F.ROUTES.status).length, 'the pass status is re-read at least every 10 s while open (≥ 6 in a minute)').toBeGreaterThanOrEqual(6);
    expect(requestsTo({ api: open }, F.ROUTES.realtime).length, 'the path status is re-read at least every 10 s while open (≥ 6 in a minute)').toBeGreaterThanOrEqual(6);
    expect(requestsTo({ api: open }, F.ROUTES.switch).filter((l) => l.startsWith('GET ')).length,
      'the switch\'s record is read and re-read with the status, at least every 10 s while open (≥ 6 in a minute), so other viewers see a change within POLL_MS (ADR 0005 D12)').toBeGreaterThanOrEqual(6);
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

/* ══ Story 5: the real-time path's switch (ADR 0005) ═════════════════════════════════════════════════════════════ */

test.describe('The real-time path\'s switch on the panel (tagging-edges #5, ADR 0005)', () => {
  test.use({ timezoneId: 'UTC', locale: 'en-GB' });

  test.beforeAll(async () => { await loadView(); });

  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip(true, 'Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    if (RECORDING) test.skip(true, 'TP_RECORD_BASELINE=1: only the AC-6 baseline is recorded');
    await page.clock.install({ time: new Date(F.NOW) });
  });

  /* ── AC-1: the control ──────────────────────────────────────────────────────────────────────────────────────── */

  test('B51: the owner sees one control in the path section once the path status has a body — "Turn off" while the path is on (its process running or not), "Turn on" while it is off, and "Turn on" when the switch cannot be read, which counts as off [AC-1 "What it shows"; ADR 0005 D12 "The control": "It renders only once the path status has a body"]', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const m = await mock(page, { realtime: async () => { await gate; return F.REALTIME.ON_LIVE; } });
    try {
      await openPanel(page);
      await expect(section(page, 'tp-path')).toHaveAttribute('data-state', 'loading');
      await expect(controls(page), 'no control while the path status has no body').toHaveCount(0);
    } finally {
      release();
    }
    await settled(page, 'tp-path');
    const CASES = [
      [null, 'Turn off', 'on and running'],
      [F.REALTIME.ON_NOT_RUNNING, 'Turn off', 'on, its process not running'],
      [F.REALTIME.OFF_WITH_FIGURES, 'Turn on', 'off'],
      [F.REALTIME.NEVER_STARTED, 'Turn on', 'off, never started'],
      [F.REALTIME.SWITCH_UNREADABLE, 'Turn on', 'its switch cannot be read, so it counts as off'],
    ];
    for (const [rt, name, why] of CASES) {
      if (rt) await reopenWith(page, m, { realtime: rt });
      await expect(control(page, name), `${why}: the control reads "${name}" — not implemented yet if missing (ADR 0005 D12)`).toBeVisible({ timeout: 5000 });
      await expect(control(page, name), `${why}: and is enabled`).toBeEnabled();
      await expect(controls(page), `${why}: one control`).toHaveCount(1);
    }
    expect(m.log.nonGet, 'showing the control sends nothing').toEqual([]);
  });

  test('B52: while a change is under way the control is disabled and says so, with aria-busy, and no control is enabled; when the answer comes the panel shows the new state [AC-1 "While a change is under way, the control is disabled and says so"; ADR 0005 D12 "While pending it is disabled, with text such as Turning the path off… and aria-busy"]', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const m = await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES });
    m.set({ switch: async (req, server) => { await gate; return server(); } });
    await openAndSettle(page);
    try {
      await press(page, 'Turn on');
      await expect.poll(() => m.log.nonGet, { message: 'pressing "Turn on" sends the change' }).toEqual([SWITCH_POST]);
      const busy = await busyControl(page);
      await expect(busy, 'the control is disabled while the change is under way').toBeDisabled();
      expect(squash(await busy.innerText()), 'and the control says the change is under way').toMatch(UNDER_WAY);
      for (const b of await controls(page).all()) await expect(b, 'no "Turn on" / "Turn off" is enabled meanwhile').toBeDisabled();
    } finally {
      release();
    }
    await expect(control(page, 'Turn off'), 'the answer came: the panel shows the path on').toBeVisible({ timeout: 10000 });
    await expect(control(page, 'Turn off')).toBeEnabled();
    await expect(busyButtons(page), 'the control is no longer busy').toHaveCount(0);
    expect(m.log.nonGet, 'one change, sent once').toEqual([SWITCH_POST]);
  });

  test('B53: pressing "Turn on" asks nothing: it sends one POST {"on":true} as JSON to the switch path, and the panel shows the path on and starting, with the owner\'s change as the latest, from the reads that follow the answer — with the page clock stopped, so no poll [AC-3 "Pressing Turn on asks nothing. Within 10 seconds the panel shows the path on"; AC-5; ADR 0005 D12 "sendSwitch … POST … Content-Type: application/json, the body {"on":…}", "When the server answered … await Promise.allSettled([readRealtime(), readRecord()])"]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES });
    await openAndSettle(page);
    await pauseClock(page);
    const mark = m.log.api.length;
    await press(page, 'Turn on');
    await expect(control(page, 'Turn off'), 'within 10 s, with no poll, the panel shows the path on').toBeVisible({ timeout: 10000 });
    await expect(cancelButton(page), '"Turn on" asks nothing: no prompt').toHaveCount(0);
    expect(m.log.nonGet, 'exactly one request that is not a GET: the switch\'s POST').toEqual([SWITCH_POST]);
    const sent = m.log.sent[0];
    expect(JSON.parse(sent.body || 'null'), 'its body is {"on":true}').toEqual({ on: true });
    expect(sent.contentType || '', 'sent as JSON').toMatch(/^application\/json\b/i);
    const reread = m.log.api.slice(mark).filter((l) => l.startsWith('GET ')).map((l) => l.split(' ')[1].split('?')[0]);
    expect(reread, 'the path status is read again after the answer').toContain(F.ROUTES.realtime);
    expect(reread, 'and the switch\'s record').toContain(F.ROUTES.switch);
    await untilText(page, 'tp-path', STARTING_NOTE, 'the path is starting');
    const latest = await outsideHistory(page);
    expect(latest, 'the latest change names the owner\'s shortened key').toContain(F.OWNER_KEY);
    expect(latest, 'as the owner').toMatch(/\bowner\b/i);
    expect(latest, 'turning it on').toMatch(TURNED_ON);
    // The start completes: a process started after the "on" is alive, and the server's window verdict is false.
    m.set({ realtime: F.REALTIME.STARTED });
    await page.clock.runFor(POLL_MS);
    // Wait for the running state's own sentence — that the process is running, with its running-since time (12:00,
    // apart from onSince's 11:59) — which D7 never prints while starting; the bare word "running" is not enough.
    const since = F.REALTIME.STARTED.runningSince;
    await expect.poll(async () => sentencesWith(await textOf(page, 'tp-path'), IS_RUNNING, clockRe(since)).length, {
      message: `once a process started after the "on" is alive, a sentence says the process is running, since ${since} (story 4's on-and-running line; ${IS_RUNNING} with ${clockRe(since)})`,
      timeout: 5000,
    }).toBeGreaterThan(0);
    const text = await textOf(page, 'tp-path');
    expect(text, 'no longer starting').not.toMatch(STARTING_NOTE);
    expect(text, 'never "not running" on the way').not.toMatch(NOT_RUNNING_STRICT);
  });

  test('B54: when the server does not answer a change within 15 s — the switch, the path status and the record all hang — the control is enabled again and the panel says the outcome is unknown; it then shows the state from its next read [AC-1 "If the server has not answered within 15 seconds"; ADR 0005 D12 "When the answer is unknown … clear pending at once … Then start the re-reads without waiting for them"; § Seams "The 15 s cases"]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.OFF_BY_OWNER });
    await openAndSettle(page);
    await expect(control(page, 'Turn on'), 'the path is off — not implemented yet if missing (ADR 0005 D12)').toBeEnabled({ timeout: 5000 });
    await pauseClock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({
      switch: async () => { await gate; return F.SWITCH_ANSWER.ON; },
      realtime: async () => { await gate; return F.REALTIME.STARTING; },
      record: async () => { await gate; return F.RECORD.STARTING; },
    });
    try {
      await press(page, 'Turn on');
      await expect.poll(() => m.log.nonGet, { message: 'the change is sent' }).toEqual([SWITCH_POST]);
      await expect(await busyControl(page), 'under way').toBeDisabled();
      await page.clock.runFor(15000);
      await expect(controls(page).first(), 'after 15 s with no answer, the control is enabled again').toBeEnabled({ timeout: 5000 });
      await expect(busyButtons(page), 'and the control is no longer busy').toHaveCount(0);
      await untilText(page, 'tp-path', OUTCOME_UNKNOWN, 'and the panel says the outcome is unknown', 5000);
    } finally {
      release();
    }
    await expect(control(page, 'Turn off'), 'it then shows the state from its next read: on').toBeVisible({ timeout: 10000 });
    await untilText(page, 'tp-path', STARTING_NOTE, 'and it reads starting');
    expect(m.log.nonGet, 'the change was sent once and never retried').toEqual([SWITCH_POST]);
    await wait(300);
  });

  test('B55: beside "Turn on", a warning shows when the report holds no finished pass — taggings already on the relay wait for a pass — and, when the report cannot be read, one that says it could not check; none when a finished pass exists, and none while the path is on [AC-1 "A warning beside Turn on"; ADR 0005 D14 turnOnWarning]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES, status: F.STATUS.NO_PASS });
    await openAndSettle(page);
    let text = await textOf(page, 'tp-path');
    expect(relayTaggingsWait(text).length, `no pass in the report: a warning says taggings already on the relay wait for a pass; tp-path reads ${JSON.stringify(text.slice(0, 300))}`).toBeGreaterThan(0);
    await reopenWith(page, m, { status: F.STATUS.NO_FINISHED });
    text = await textOf(page, 'tp-path');
    expect(relayTaggingsWait(text).length, 'passes in the report, none finished: the warning shows').toBeGreaterThan(0);
    await reopenWith(page, m, { status: F.STATUS.LATEST_AND_NINE });
    await expect(control(page, 'Turn on')).toBeVisible({ timeout: 5000 });
    expect(relayTaggingsWait(await textOf(page, 'tp-path')), 'a finished pass in the report: no warning').toEqual([]);
    await reopenWith(page, m, { realtime: F.REALTIME.ON_LIVE, status: F.STATUS.NO_PASS });
    await expect(control(page, 'Turn off')).toBeVisible({ timeout: 5000 });
    expect(relayTaggingsWait(await textOf(page, 'tp-path')), 'the path on: no "Turn on", so no warning').toEqual([]);
    m.set({ realtime: F.REALTIME.OFF_WITH_FIGURES, status: fail(500) });
    await openAndSettle(page, ['tp-held']);
    text = await textOf(page, 'tp-path');
    expect(couldNotCheckPass(text).length, 'the report cannot be read: the warning says it could not check for a finished pass').toBeGreaterThan(0);
    expect(m.log.nonGet).toEqual([]);
  });

  /* ── AC-2: turning off asks first ──────────────────────────────────────────────────────────────────────────── */

  const BACKSTOP_STATES = [
    { name: 'no enabled entry', schedule: F.SCHEDULE.NONE, has: [NO_BACKSTOP] },
    { name: 'no enabled entry, a disabled one', schedule: F.SCHEDULE.NONE_WITH_DISABLED, has: [NO_BACKSTOP] },
    { name: 'one entry, every 6 hours', schedule: F.SCHEDULE.ONE, has: [/\b6\s?(?:hours?|hrs?|h)\b/i, clockRe(F.SCHEDULE.ONE.entries[1].timer.nextRunAt)], lacks: [NO_BACKSTOP, NOT_SCHEDULED, WEAKER_THAN_DAILY] },
    { name: 'one entry, not scheduled', schedule: F.SCHEDULE.ONE_UNSCHEDULED, has: [NOT_SCHEDULED], lacks: [NO_BACKSTOP] },
    { name: 'one entry, every 2 days', schedule: F.SCHEDULE.ONE_WEAKER_INTERVAL, has: [WEAKER_THAN_DAILY, /\b2\s?(?:days?|d)\b/i], lacks: [NO_BACKSTOP] },
    { name: 'one entry, a weekly cron', schedule: F.SCHEDULE.ONE_WEAKER_CRON, has: [WEAKER_THAN_DAILY, /0 3 \* \* 0/], lacks: [NO_BACKSTOP] },
    { name: 'two enabled entries', schedule: F.SCHEDULE.SEVERAL, has: [SEVERAL_COUNT], lacks: [NO_BACKSTOP] },
  ];

  test('B56: pressing "Turn off" opens a prompt inside the path section — a heading, focus on Cancel, one "Turn off" on the page — that says the path stops reflecting changes within seconds, that what it holds is kept and changes stored meanwhile are caught up when it is turned back on (story 3\'s few cases aside, for the next pass), and what keeps the graph in step meanwhile, described as the backstop section describes each of story 4\'s schedule states [AC-2 "Normally, the prompt says"; ADR 0005 D13 "The normal variant", "Layout", BackstopVerdict]', async ({ page }) => {
    test.setTimeout(150000);
    const m = await mock(page, { schedule: BACKSTOP_STATES[0].schedule });
    for (const [i, c] of BACKSTOP_STATES.entries()) {
      if (i === 0) await openAndSettle(page);
      else await reopenWith(page, m, { schedule: c.schedule });
      const before = await textOf(page, 'tp-path');
      const p = await openPrompt(page);
      await expect(p.cancel, `${c.name}: focus moves to Cancel when the prompt opens`).toBeFocused();
      await expect(page.getByRole('button', { name: 'Turn off', exact: true }), `${c.name}: one "Turn off" at a time — the prompt replaces the control`).toHaveCount(1);
      await expect(controls(page), `${c.name}: the control is replaced while the prompt is open`).toHaveCount(1);
      const text = await p.text();
      const sched = await textOf(page, 'tp-schedule');
      for (const re of c.has) {
        expect(before, `${c.name}: before the prompt opens, the path section does not say it (${re})`).not.toMatch(re);
        expect(sched, `${c.name}: the backstop section says it (${re})`).toMatch(re);
        expect(text, `${c.name}: the prompt says what keeps the graph in step, as the backstop section does (${re})`).toMatch(re);
      }
      for (const re of c.lacks || []) expect(text, `${c.name}: the prompt does not say ${re}`).not.toMatch(re);
      expect(text, `${c.name}: the path stops reflecting changes within seconds`).toMatch(PROMPT_STOPS);
      expect(text, `${c.name}: what it holds is kept`).toMatch(PROMPT_KEPT);
      expect(text, `${c.name}: changes stored meanwhile are caught up`).toMatch(PROMPT_CATCH_UP);
      expect(text, `${c.name}: when it is turned back on`).toMatch(PROMPT_BACK_ON);
      expect(text, `${c.name}: apart from the few cases left to the next pass`).toMatch(PROMPT_NEXT_PASS);
      expect(text, `${c.name}: not the first-start variant`).not.toMatch(FIRST_START_AGAIN);
      await p.cancel.click();
      await expect(control(page, 'Turn off'), `${c.name}: Cancel closes the prompt`).toBeVisible({ timeout: 5000 });
    }
    expect(m.log.nonGet, 'opening and cancelling the prompt sends nothing').toEqual([]);
  });

  test('B57: with the schedule list unreadable, the prompt says the backstop could not be checked, and claims no backstop state [AC-2 "When the schedule cannot be read, it says the backstop could not be checked"; ADR 0005 D13 "With no schedule view, it says the backstop could not be checked"]', async ({ page }) => {
    const m = await mock(page, { schedule: fail(500) });
    await openAndSettle(page);
    await expect(section(page, 'tp-schedule')).toHaveAttribute('data-state', 'error');
    const p = await openPrompt(page);
    const text = await p.text();
    expect(text, 'the backstop could not be checked').toMatch(BACKSTOP_UNCHECKED);
    expect(text, 'no "no backstop" claim from an unread list').not.toMatch(NO_BACKSTOP);
    expect(text, 'the rest of the normal prompt stands: it stops within seconds').toMatch(PROMPT_STOPS);
    expect(text, 'and what it holds is kept').toMatch(PROMPT_KEPT);
    await p.cancel.click();
    expect(m.log.nonGet).toEqual([]);
  });

  test('B82: while the schedule list\'s first read is still loading, the prompt neither says the backstop could not be checked nor claims any verdict, and says the backstop is still being checked; once the read answers, the prompt already open shows the real verdict, without being reopened [AC-2 "When the schedule cannot be read, it says the backstop could not be checked"; ADR 0005 D13 (a pending read, review round 1), D14 "none while loading"; story 5\'s review, round 1, requested 5]', async ({ page }) => {
    // The schedule list's read is held, then released. It must settle well within readSection's own 15 s time-out
    // (taggingPipelineFetch.js), which would turn the held read into a failed one.
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const one = F.SCHEDULE.ONE;
    const ONE_VERDICT = [/\b6\s?(?:hours?|hrs?|h)\b/i, clockRe(one.entries[1].timer.nextRunAt)];
    const VERDICTS = [NO_BACKSTOP, NOT_SCHEDULED, WEAKER_THAN_DAILY, SEVERAL_COUNT, ...ONE_VERDICT];
    const m = await mock(page, { schedule: () => gate.then(() => one) });
    let p;
    try {
      await openAndSettle(page, ['tp-schedule']);
      await expect(section(page, 'tp-schedule'), 'the schedule list\'s first read is still in flight')
        .toHaveAttribute('data-state', 'loading');
      p = await openPrompt(page);
      const text = await p.text();
      expect(text, 'a read still loading has not failed: the prompt does not say the backstop could not be checked')
        .not.toMatch(BACKSTOP_UNCHECKED);
      for (const re of VERDICTS) expect(text, `no verdict from a list not yet read (${re})`).not.toMatch(re);
      expect(text, 'it says the backstop is still being checked').toMatch(BACKSTOP_CHECKING);
      expect(text, 'the rest of the normal prompt stands: it stops within seconds').toMatch(PROMPT_STOPS);
      expect(text, 'and what it holds is kept').toMatch(PROMPT_KEPT);
    } finally {
      release();
    }
    await expect(section(page, 'tp-schedule'), 'the schedule list answers once released')
      .toHaveAttribute('data-state', 'ready', { timeout: 10000 });
    await expect(p.cancel, 'the prompt is still open: nothing closed it').toBeVisible();
    for (const re of ONE_VERDICT) {
      const message = `the open prompt now shows the real verdict (${re}), without being reopened`;
      await expect.poll(() => p.text(), { message, timeout: 5000 }).toMatch(re);
    }
    const after = await p.text();
    expect(after, 'no longer "still being checked"').not.toMatch(BACKSTOP_CHECKING);
    expect(after, 'and never "could not be checked"').not.toMatch(BACKSTOP_UNCHECKED);
    for (const re of [NO_BACKSTOP, NOT_SCHEDULED, WEAKER_THAN_DAILY]) {
      expect(after, `the verdict is one entry's, not another (${re})`).not.toMatch(re);
    }
    await p.cancel.click();
    expect(m.log.nonGet, 'opening and cancelling the prompt sends nothing').toEqual([]);
  });

  test('B58: before the path has completed its first start, the prompt says instead that what it has gathered so far is dropped, that the next "Turn on" is a first start again, and that a pass should run after the path shows live [AC-2 "Before the path has completed its first start"; ADR 0005 D8 offPromptVariant "first-start" (firstStartedAt not served), D13; OPERATIONS §12.9\'s order]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.FIRST_STARTING });
    await openAndSettle(page);
    const p = await openPrompt(page);
    const text = await p.text();
    expect(text, 'what it has gathered so far is dropped').toMatch(FIRST_DROPPED);
    expect(text, 'the next "Turn on" is a first start again').toMatch(FIRST_START_AGAIN);
    expect(text, 'whatever the relay holds then waits for a pass, so one should run after the path shows live').toMatch(PASS_AFTER_LIVE);
    // "Says instead": the normal variant's claims are absent.
    expect(keptClaims(text), 'not the normal variant: no claim that what the path holds is kept').toEqual([]);
    expect(caughtUpOnClaims(text), 'not the normal variant: no claim that changes stored meanwhile are caught up when it is turned back on').toEqual([]);
    await p.cancel.click();
    expect(m.log.nonGet).toEqual([]);
  });

  test('B59: when the path\'s status cannot be read, the prompt is the normal one plus a line that it could not check whether the first start completed, with the first-start consequences stated as a condition [AC-2; ADR 0005 D8 offPromptVariant "unknown" (statusUnreadable)]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.STATUS_UNREADABLE });
    await openAndSettle(page);
    const p = await openPrompt(page);
    const text = await p.text();
    expect(text, 'the normal prompt: it stops within seconds').toMatch(PROMPT_STOPS);
    expect(text, 'the normal prompt: what it holds is kept').toMatch(PROMPT_KEPT);
    expect(text, 'it could not check whether the first start completed').toMatch(FIRST_START_UNCHECKED);
    expect(text, 'the first-start consequences, as a condition').toMatch(IF_FIRST_START);
    await p.cancel.click();
    expect(m.log.nonGet).toEqual([]);
  });

  test('B60: Cancel closes the prompt and sends nothing: the control is back, the path still on, and no request but GETs [AC-2 "Cancelling sends nothing and changes nothing"; ADR 0005 D13 "Cancel sends nothing"; § Seams "log.nonGet … [] after a cancel"]', async ({ page }) => {
    const m = await mock(page);
    await openAndSettle(page);
    const p = await openPrompt(page);
    await p.cancel.click();
    await expect(cancelButton(page), 'the prompt is closed').toHaveCount(0, { timeout: 5000 });
    await expect(control(page, 'Turn off'), 'the control is back').toBeEnabled();
    await wait(1000);
    expect(m.log.nonGet, 'Cancel sends nothing').toEqual([]);
    expect(noOnOff(await textOf(page, 'tp-path')), 'the path is still on').toMatch(ON);
  });

  test('B61: confirming the prompt sends one POST {"on":false} as JSON to the switch path, and within 10 s — with no poll — the panel shows the path off, with "Turned off by the owner" and its shortened key as the latest change [AC-2 "Confirming turns the path off, and within 10 seconds the panel shows it off"; AC-5; ADR 0005 D12, D13; § Seams "log.nonGet equals exactly [\'POST /api/tagging-edges/realtime/switch\'] after a confirm"]', async ({ page }) => {
    const m = await mock(page);
    await openAndSettle(page);
    const p = await openPrompt(page);
    await pauseClock(page);
    await p.confirm.click();
    await expect(control(page, 'Turn on'), 'within 10 s the panel shows the path off').toBeVisible({ timeout: 10000 });
    await expect(cancelButton(page), 'the prompt is closed').toHaveCount(0);
    expect(m.log.nonGet, 'exactly one request that is not a GET: the switch\'s POST').toEqual([SWITCH_POST]);
    expect(JSON.parse(m.log.sent[0].body || 'null'), 'its body is {"on":false}').toEqual({ on: false });
    expect(m.log.sent[0].contentType || '', 'sent as JSON').toMatch(/^application\/json\b/i);
    expect(noOnOff(await textOf(page, 'tp-path')), 'the path reads off').toMatch(/\boff\b/i);
    const latest = await outsideHistory(page);
    expect(latest, 'the latest change names the owner\'s shortened key').toContain(F.OWNER_KEY);
    expect(latest, 'as the owner').toMatch(/\bowner\b/i);
    expect(latest, 'turning it off').toMatch(TURNED_OFF);
    expect(latest, `when (${F.NOW})`).toMatch(clockRe(F.NOW));
    expect(await rowText(page, 0), 'the history\'s first row is that change').toContain(F.OWNER_KEY);
    expect(await rowText(page, 0)).toMatch(/\boff\b/i);
  });

  test('B62: the prompt closes by itself when a read shows the path off — another viewer turned it off — and nothing is sent [AC-2; ADR 0005 D13 "It closes by itself if a read shows the path off"]', async ({ page }) => {
    const m = await mock(page);
    await openAndSettle(page);
    await openPrompt(page);
    await pauseClock(page);
    m.set({ realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.OFF_BY_ADMIN });
    await page.clock.runFor(POLL_MS);
    await expect(cancelButton(page), 'the prompt closed by itself').toHaveCount(0, { timeout: 5000 });
    await expect(control(page, 'Turn on'), 'the control reads "Turn on"').toBeVisible();
    expect(m.log.nonGet, 'nothing was sent').toEqual([]);
  });

  /* ── AC-3: turning on, without a false alarm ──────────────────────────────────────────────────────────────── */

  test('B63: within the starting window the path section says the path is starting — switched on at its time, which can take up to about 30 seconds — and never that it has failed: no "not running" by B20\'s patterns, no stored state shown, no red, across polls; past the window, with no process, it shows story 4\'s "on, but its process is not running" [AC-3 "Within the window … never that it has failed", "Past 60 seconds"; ADR 0005 D7 "OnLine checks starting first", "B20\'s patterns"; § Seams STARTING, ON_NOT_RUNNING]', async ({ page }) => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    // The record is held at first, so the only time printed in the section is the path's own "switched on at".
    const m = await mock(page, { realtime: F.REALTIME.STARTING, record: async () => { await gate; return F.RECORD.STARTING; } });
    let text;
    try {
      // tp-path is read by its text, not its data-state: ADR 0005 does not say whether that state also waits for the
      // record read (held here), only that the control adds no new data-state value (D12, PS12).
      await openAndSettle(page, ['tp-path']);
      await untilText(page, 'tp-path', STARTING_NOTE, 'it says the path is starting', 10000);
      text = await textOf(page, 'tp-path');
      expect(text, `that it was switched on at ${F.SWITCH_TIMES.startOnAt}`).toMatch(clockRe(F.SWITCH_TIMES.startOnAt));
      expect(text, 'which can take up to about 30 seconds').toMatch(UP_TO_30S);
      expect(text, 'never "not running" (B20\'s NOT_RUNNING, matched over the whole section)').not.toMatch(NOT_RUNNING);
      expect(text, 'nor B19\'s strict form').not.toMatch(NOT_RUNNING_STRICT);
      expect(text, 'the old status.json\'s stored "off" is not shown as its state').not.toContain(explanation('pathState', 'off'));
      expect(await section(page, 'tp-path').getAttribute('style') || '', 'not in the bad tone').not.toMatch(/--red/);
      await expect(control(page, 'Turn off'), 'it is on: the control reads "Turn off"').toBeVisible();
    } finally {
      release();
    }
    await expect.poll(async () => (await textOf(page, 'tp-path')).includes(F.OWNER_KEY), { message: 'the record shows' }).toBe(true);
    text = await textOf(page, 'tp-path');
    expect(text, 'the whole section, the record included, never matches NOT_RUNNING').not.toMatch(NOT_RUNNING);
    expect(text).not.toMatch(NOT_RUNNING_STRICT);
    await pauseClock(page);
    for (let i = 1; i <= 2; i += 1) {
      await page.clock.runFor(POLL_MS);
      await wait(300);
      text = await textOf(page, 'tp-path');
      expect(text, `poll ${i}, still inside the window: still starting`).toMatch(STARTING_NOTE);
      expect(text, `poll ${i}: never "not running"`).not.toMatch(NOT_RUNNING);
    }
    m.set({ realtime: F.REALTIME.ON_NOT_RUNNING });
    await page.clock.runFor(POLL_MS);
    await untilText(page, 'tp-path', NOT_RUNNING, 'past 60 s with no process: story 4\'s "on, but its process is not running"', 5000);
  });

  test('B64: a viewer who did not press sees another viewer\'s "on" within POLL_MS — starting, and the admin who turned it on — and a reload inside the window still says starting; that viewer sends nothing [AC-3 "Every viewer sees it, and it survives a reload"; AC-5; ADR 0005 D7 (a verdict in the body), D12 "polled with the status reads, so other viewers see a change within POLL_MS"; § Seams "A reload and a second viewer see the same"]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.OFF_BY_OWNER });
    await openAndSettle(page);
    await expect(control(page, 'Turn on'), 'the path is off — not implemented yet if missing (ADR 0005 D12)').toBeVisible({ timeout: 5000 });
    await pauseClock(page);
    m.set({ realtime: F.REALTIME.STARTING, record: F.RECORD.STARTING_BY_ADMIN });
    await page.clock.runFor(POLL_MS);
    await untilText(page, 'tp-path', STARTING_NOTE, 'within POLL_MS the path shows starting', 3000);
    await expect(control(page, 'Turn off')).toBeVisible({ timeout: 3000 });
    await expect.poll(async () => (await outsideHistory(page)).includes(F.ADMIN_KEY), { message: 'within POLL_MS the admin\'s change is the latest', timeout: 3000 }).toBe(true);
    const latest = await outsideHistory(page);
    expect(latest, 'by an admin').toMatch(/\badmin\b/i);
    expect(latest, 'turning it on').toMatch(TURNED_ON);
    await page.clock.resume();
    await openAndSettle(page); // a reload inside the window
    const text = await textOf(page, 'tp-path');
    expect(text, 'after a reload, still starting').toMatch(STARTING_NOTE);
    expect(text, 'never "not running"').not.toMatch(NOT_RUNNING);
    expect(text).not.toMatch(NOT_RUNNING_STRICT);
    expect(m.log.nonGet, 'a viewer who did not press sends nothing').toEqual([]);
  });

  test('B65: an "on" while the process from before is still stopping (a quick off then on) shows starting, not running: no sentence that a process is running, no running-since time, and the old process\'s stored "live" not shown as current [AC-3 "A process that started before that on does not count as running, so a quick off-then-on shows starting"; ADR 0005 D7 "Within the window it never prints that the process is running, and never shows runningSince"; § Seams STARTING_OLD_PROCESS]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.STARTING_OLD_PROCESS, record: F.RECORD.STARTING_OLD_PROCESS });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-path');
    expect(text, 'starting').toMatch(STARTING_NOTE);
    expect(text, 'no sentence that a process is running').not.toMatch(IS_RUNNING);
    expect(text, `no running-since time (${F.PATH_TIMES.runningSince})`).not.toMatch(clockRe(F.PATH_TIMES.runningSince));
    expect(text, 'the old process\'s stored "live" is not shown as the state now').not.toContain(explanation('pathState', 'live'));
    expect(text, 'never "not running"').not.toMatch(NOT_RUNNING);
    expect(text).not.toMatch(NOT_RUNNING_STRICT);
    expect(await section(page, 'tp-path').getAttribute('style') || '', 'not in the bad tone').not.toMatch(/--red/);
  });

  test('B66: an "on" while the path is already on does not restart the window: the path shows on and running, not starting, and the record shows that latest "on" [AC-3 "An on while the path is already on does not restart the window"; AC-5; ADR 0005 D4; § Seams "An on while already on: the same onSince, and not in the window"]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.ON_WHILE_ON, record: F.RECORD.ON_WHILE_ON });
    await openAndSettle(page);
    const text = await textOf(page, 'tp-path');
    expect(text, 'running').toMatch(/\brunning\b/i);
    expect(text, 'not starting').not.toMatch(STARTING_NOTE);
    expect(text, 'not "not running"').not.toMatch(NOT_RUNNING_STRICT);
    const latest = await outsideHistory(page);
    expect(latest, 'the latest change is the admin\'s "on"').toContain(F.ADMIN_KEY);
    expect(latest).toMatch(TURNED_ON);
    expect(latest, `at ${F.SWITCH_TIMES.onWhileOnAt}`).toMatch(clockRe(F.SWITCH_TIMES.onWhileOnAt));
  });

  /* ── AC-4: refused or failed ──────────────────────────────────────────────────────────────────────────────── */

  test('B67: a refused change shows why — sign in again as the owner or an admin — with the HTTP status beside it, and the path\'s state unchanged: a 403 on "Turn off", and a lapsed session\'s 401 on "Turn on" [AC-4 "Refused or failed"; ADR 0005 D12 switchOutcome "refused": "Its own sentence says to sign in again as the owner or an admin, from the instance\'s own address. The HTTP status is shown beside it."]', async ({ page }) => {
    const m = await mock(page, { switch: F.SWITCH_ANSWER.REFUSED_403 });
    await openAndSettle(page);
    const p = await openPrompt(page);
    await p.confirm.click();
    await expect.poll(async () => refusedSentences(await textOf(page, 'tp-path')).length, {
      message: `a 403: one sentence says to sign in again as the owner or an admin (ADR 0005 D12 "refused"; TV80) (${SIGN_IN_AGAIN}, ${OWNER_OR_AN_ADMIN})`,
      timeout: 10000,
    }).toBeGreaterThan(0);
    let text = await textOf(page, 'tp-path');
    expect(text, 'the HTTP status beside it').toMatch(/\b403\b/);
    await expect(control(page, 'Turn off'), 'the state unchanged: still on').toBeEnabled({ timeout: 5000 });
    await reopenWith(page, m, { realtime: F.REALTIME.OFF_WITH_FIGURES, switch: F.SWITCH_ANSWER.REFUSED_401 });
    await press(page, 'Turn on');
    await expect.poll(async () => refusedSentences(await textOf(page, 'tp-path')).length, {
      message: `a lapsed session's 401: one sentence says to sign in again as the owner or an admin (ADR 0005 D12 "refused"; TV80) (${SIGN_IN_AGAIN}, ${OWNER_OR_AN_ADMIN})`,
      timeout: 10000,
    }).toBeGreaterThan(0);
    text = await textOf(page, 'tp-path');
    expect(text, 'the HTTP status beside it').toMatch(/\b401\b/);
    await expect(control(page, 'Turn on'), 'the state unchanged: still off').toBeEnabled({ timeout: 5000 });
    expect(m.log.nonGet, 'one POST each, nothing retried').toEqual([SWITCH_POST, SWITCH_POST]);
  });

  test('B68: a failed "Turn on" says the path\'s state is unchanged and to check that the data volume has free space and is writable, with the failure\'s code; the path stays off [AC-4 "Turning on fails, for example, when the server cannot write the switch"; ADR 0005 D11 (500s gain code), D12 switchOutcome "failed": "A failed on says the path\'s state is unchanged, and to check that the data volume has free space and is writable"]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.OFF_WITH_FIGURES, switch: F.SWITCH_ANSWER.FAILED_ON });
    await openAndSettle(page);
    await press(page, 'Turn on');
    await untilText(page, 'tp-path', FREE_SPACE, 'the failure shows', 10000);
    const text = await textOf(page, 'tp-path');
    expect(text, 'the state is unchanged').toMatch(STATE_UNCHANGED);
    expect(text, 'and writable').toMatch(WRITABLE);
    expect(text, 'with the failure\'s code').toMatch(codeRe('ENOSPC'));
    await expect(control(page, 'Turn on'), 'still off').toBeEnabled({ timeout: 5000 });
    expect(m.log.nonGet).toEqual([SWITCH_POST]);
  });

  test('B69: a failed "Turn off" says the path could not be turned off and is still on as before, with the failure\'s code [AC-4 "When the server … cannot make the change, the panel shows the reason and the path\'s state unchanged"; ADR 0005 D11, D12 "A failed off says the path could not be turned off and is still on as before"]', async ({ page }) => {
    const m = await mock(page, { switch: F.SWITCH_ANSWER.FAILED_OFF });
    await openAndSettle(page);
    const p = await openPrompt(page);
    await p.confirm.click();
    await untilText(page, 'tp-path', NOT_TURNED_OFF, 'the failure shows', 10000);
    const text = await textOf(page, 'tp-path');
    expect(text, 'and it is still on').toMatch(STILL_ON);
    expect(text, 'with the failure\'s code').toMatch(codeRe('EIO'));
    await expect(control(page, 'Turn off'), 'still on').toBeEnabled({ timeout: 5000 });
    expect(m.log.nonGet).toEqual([SWITCH_POST]);
  });

  test('B70: an admin may turn back on what the owner turned off — the last change wins — and the record shows the admin\'s "on" as the latest, the owner\'s "off" below it [AC-4 "Last change wins, whoever made it"; AC-5 "Every change records who made it"; ADR 0005 D3, D5]', async ({ page }) => {
    const m = await mock(page, { who: 'admin', realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.OFF_BY_OWNER });
    await openAndSettle(page);
    await press(page, 'Turn on');
    await expect(control(page, 'Turn off'), 'the admin\'s change took effect').toBeVisible({ timeout: 10000 });
    const latest = await outsideHistory(page);
    expect(latest, 'the latest change is the admin\'s').toContain(F.ADMIN_KEY);
    expect(latest).toMatch(/\badmin\b/i);
    expect(latest).toMatch(TURNED_ON);
    expect(await rowText(page, 0), 'the history\'s first row: the admin\'s on').toContain(F.ADMIN_KEY);
    expect(await rowText(page, 1), 'below it: the owner\'s off').toContain(F.OWNER_KEY);
    expect(await rowText(page, 1)).toMatch(/\boff\b/i);
    expect(await rowText(page, 1)).toMatch(clockRe(F.SWITCH_TIMES.offAt));
    expect(m.log.nonGet).toEqual([SWITCH_POST]);
  });

  /* ── AC-5: who did it ─────────────────────────────────────────────────────────────────────────────────────── */

  test('B71: the latest change shows who made it — owner or admin and a shortened key — and when, and the last 10 changes show newest first, each with its own who, when and on or off [AC-5 "What the panel shows"; ADR 0005 D12 switchRecordView "recorded, with a role", "an ordered list of up to 10"]', async ({ page }) => {
    await mock(page, { realtime: F.rtBody({ onSince: F.at(3) }), record: F.RECORD.HISTORY_TEN });
    await openAndSettle(page);
    const first = F.HISTORY_TEN[0];
    await expect.poll(async () => (await outsideHistory(page)).includes(first.key), { message: 'the latest change names its shortened key — not implemented yet if missing (ADR 0005 D12)' }).toBe(true);
    const latest = await outsideHistory(page);
    expect(latest, 'by the owner').toMatch(/\bowner\b/i);
    expect(latest, 'turned on').toMatch(TURNED_ON);
    expect(latest, `when (${first.at})`).toMatch(clockRe(first.at));
    await expect(historyRows(page), 'the last 10 changes').toHaveCount(10);
    for (const [i, e] of F.HISTORY_TEN.entries()) {
      const row = await rowText(page, i);
      expect(row, `row ${i + 1}: its key`).toContain(e.key);
      expect(row, `row ${i + 1}: ${e.role}`).toMatch(new RegExp(`\\b${e.role}\\b`, 'i'));
      expect(row, `row ${i + 1}: ${e.on ? 'on' : 'off'}`).toMatch(e.on ? /\bon\b/i : /\boff\b/i);
      expect(row, `row ${i + 1}: when (${e.at})`).toMatch(clockRe(e.at));
    }
  });

  test('B72: with no change recorded — an instance never switched — the panel says no change has been recorded, and the history is empty [AC-5 "When no change is recorded"; ADR 0005 D3 never-switched, D12]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.NEVER_STARTED, record: F.RECORD.NEVER_SWITCHED });
    await openAndSettle(page);
    await untilText(page, 'tp-path', NO_CHANGE_RECORDED, 'no change has been recorded', 5000);
    await expect(historyRows(page), 'the history is empty').toHaveCount(0);
    const text = await textOf(page, 'tp-path');
    for (const k of KEYS) expect(text, 'no who').not.toContain(k);
    await expect(control(page, 'Turn on')).toBeVisible();
  });

  test('B73: an off the server could not record takes effect and says so; the panel then shows the path off with no who or when for that change, never an earlier "Turned on by …" as the latest, and the history recorded before it below — after a reload too [AC-4 "An off still takes effect"; AC-5 "The one exception"; ADR 0005 D3 unrecorded-off, D11, D12 switchOutcome "done-unrecorded"]', async ({ page }) => {
    const m = await mock(page);
    m.set({
      switch: () => {
        m.set({ realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.UNRECORDED_OFF });
        return F.SWITCH_ANSWER.OFF_UNRECORDED;
      },
    });
    await openAndSettle(page);
    const p = await openPrompt(page);
    await p.confirm.click();
    await expect(control(page, 'Turn on'), 'the off took effect').toBeVisible({ timeout: 10000 });
    expect(await textOf(page, 'tp-path'), 'the answer said the change could not be recorded').toMatch(NOT_RECORDED);
    for (const when of ['after the change', 'after a reload']) {
      if (when === 'after a reload') await openAndSettle(page);
      const latest = await outsideHistory(page);
      expect(latest, `${when}: the latest change says it was not recorded`).toMatch(NOT_RECORDED);
      for (const k of KEYS) expect(latest, `${when}: no who for that change`).not.toContain(k);
      expect(latest, `${when}: never an earlier "Turned on by …" as the latest change`).not.toMatch(TURNED_ON_BY);
      expect(await rowText(page, 0), `${when}: the history's first row is the off`).toMatch(/\boff\b/i);
      for (const k of KEYS) expect(await rowText(page, 0), `${when}: without who`).not.toContain(k);
      expect(await rowText(page, 1), `${when}: the history recorded before it survives`).toContain(F.OWNER_KEY);
    }
    expect(m.log.nonGet).toEqual([SWITCH_POST]);
  });

  test('B74: a record that holds the state but not who or when shows the change with "who and when were not recorded", and no who [AC-5; ADR 0005 D3 (a version 2 record without a role), D12 switchRecordView "recorded, with a null role"]', async ({ page }) => {
    await mock(page, { record: F.RECORD.NULL_ROLE });
    await openAndSettle(page);
    await untilText(page, 'tp-path', NOT_RECORDED, 'who and when were not recorded', 5000);
    const latest = await outsideHistory(page);
    expect(latest, 'the latest change says who and when were not recorded').toMatch(NOT_RECORDED);
    for (const k of KEYS) expect(latest, 'no who for it').not.toContain(k);
    expect(await rowText(page, 1), 'the recorded changes before it keep their who').toContain(F.OWNER_KEY);
  });

  test('B75: with the switch unreadable (counting as off), the record shows no latest who and still shows the stored history [AC-5; ADR 0005 D3 switch-unreadable ("the stored history is still returned"), D12 "switch-unreadable: the on/off record cannot be read"]', async ({ page }) => {
    await mock(page, { realtime: F.REALTIME.SWITCH_UNREADABLE, record: F.RECORD.SWITCH_UNREADABLE });
    await openAndSettle(page);
    await expect(control(page, 'Turn on'), 'it counts as off').toBeVisible({ timeout: 5000 });
    await expect(historyRows(page), 'the stored history still shows').toHaveCount(2, { timeout: 5000 });
    expect(await rowText(page, 0)).toContain(F.OWNER_KEY);
    expect(await rowText(page, 1)).toContain(F.ADMIN_KEY);
    const latest = await outsideHistory(page);
    for (const k of KEYS) expect(latest, 'no latest who').not.toContain(k);
    expect(latest, 'the on/off record cannot be read').toMatch(SWITCH_UNREADABLE);
  });

  test('B76: with the history unreadable, the panel says the history cannot be read and still shows the latest change [AC-5; ADR 0005 D3 historyUnreadable, D12 "historyUnreadable: the history cannot be read, with the latest change still shown"]', async ({ page }) => {
    await mock(page, { record: F.RECORD.HISTORY_UNREADABLE });
    await openAndSettle(page);
    await untilText(page, 'tp-path', HISTORY_UNREADABLE, 'the history cannot be read', 5000);
    const latest = await outsideHistory(page);
    expect(latest, 'the latest change still shows its who').toContain(F.OWNER_KEY);
    expect(latest).toMatch(/\bowner\b/i);
    expect(latest).toMatch(TURNED_ON);
  });

  test('B77: a record that disagrees with the path status — its on, or its switchUnreadable — shows no who: the panel says the record is being refreshed until a read brings them into step [AC-5 "never an earlier Turned on by … as the latest change"; ADR 0005 D12 switchRecordView "only when … its on equals rtBody.on, and its switchUnreadable agrees. Otherwise it says the record is being refreshed"]', async ({ page }) => {
    const m = await mock(page, { realtime: F.REALTIME.ON_LIVE, record: F.RECORD.OFF_BY_ADMIN });
    await openAndSettle(page);
    await untilText(page, 'tp-path', RECORD_REFRESHING, 'the record is being refreshed', 5000);
    let text = await textOf(page, 'tp-path');
    for (const k of KEYS) expect(text, 'a record whose on disagrees shows no who, latest or history').not.toContain(k);
    await pauseClock(page);
    m.set({ record: F.RECORD.ON_BY_OWNER });
    await page.clock.runFor(POLL_MS);
    await expect.poll(async () => (await outsideHistory(page)).includes(F.OWNER_KEY), { message: 'once they agree, the latest change shows', timeout: 5000 }).toBe(true);
    await page.clock.resume();
    await reopenWith(page, m, { realtime: F.REALTIME.OFF_WITH_FIGURES, record: F.RECORD.SWITCH_UNREADABLE });
    await untilText(page, 'tp-path', RECORD_REFRESHING, 'a record whose switchUnreadable disagrees: being refreshed', 5000);
    text = await textOf(page, 'tp-path');
    for (const k of KEYS) expect(text, 'and no who').not.toContain(k);
  });

  test('B78: a record read that fails after a good one shows no kept who — neither the latest change nor the history — and says the record could not be read, with its code [AC-5; ADR 0005 D12 switchRecordView "it never renders a kept body\'s latest line after a failed record read", "it has its own ReadFailed"]', async ({ page }) => {
    const m = await mock(page);
    await openAndSettle(page);
    await expect.poll(async () => (await outsideHistory(page)).includes(F.OWNER_KEY), { message: 'the latest change shows — not implemented yet if missing (ADR 0005 D12)', timeout: 5000 }).toBe(true);
    await pauseClock(page);
    m.set({ record: fail(500) });
    await page.clock.runFor(POLL_MS);
    await expect.poll(async () => (await textOf(page, 'tp-path')).includes(F.OWNER_KEY), { message: 'after the failed read, no kept who', timeout: 5000 }).toBe(false);
    const text = await textOf(page, 'tp-path');
    expect(text, 'the record could not be read').toMatch(UNREADABLE);
    expect(text, 'with its code').toMatch(codeRe('http-500'));
    await expect(control(page, 'Turn off'), 'the path itself still reads on').toBeVisible();
  });

  test('B79: when a change\'s answer lands after the panel has closed, no read follows it [AC-1; ADR 0005 D12 "After an unmount, no re-read is sent"]', async ({ page }) => {
    const m = await mock(page);
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    m.set({ switch: async (req, server) => { await gate; return server(); } });
    await openAndSettle(page);
    const p = await openPrompt(page);
    await p.confirm.click();
    let closedAt;
    try {
      await expect.poll(() => m.log.nonGet, { message: 'the change is sent' }).toEqual([SWITCH_POST]);
      await subTab(page, EXISTING_TABS[3]).click(); // close the panel: open Streaming ETL
      await expect(section(page, 'tp-path'), 'the panel is closed').toHaveCount(0);
      closedAt = m.log.api.length;
    } finally {
      release();
    }
    await wait(1500);
    const after = m.log.api.slice(closedAt).filter((l) => /\/api\/tagging-edges\//.test(l));
    expect(after, 'no read after the panel closed, though the answer came after').toEqual([]);
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
