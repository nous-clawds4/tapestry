/**
 * Story harness-self-improvement #6: enforcement — the claims and the tools
 * finally agree. ADR 0006 (harness-self-improvement). See
 * engineering-team/stories/harness-self-improvement/6-enforcement.test-plan.md
 *
 * ADR 0006 chose Option A: a SessionStart hook in .claude/settings.json runs
 * scripts/session-start.sh — a compact digest (harness-lint output, the
 * meta-escalation state via the SHARED scripts/lib/collect-meta.sh also
 * consumed by whats-open.sh, a ≤2s stack probe) that ALWAYS exits 0 (the
 * ADR-0004 advisory principle: a red lint informs the session, never bricks
 * it). The six writing product agents carry allow-list-ONLY permission rules
 * (Write/Edit scoped to product-team/** + OPEN.md; no ask/deny rules — out-of-
 * tree writes fall to the platform's default ask, so nothing hinges on
 * contested ask-vs-allow precedence). The pure-advisory agents lose Bash.
 *
 * Pre-implementation none of this exists: settings.json is absent, the digest
 * script is absent, the agents carry no permissions blocks and the advisory
 * agents still list Bash — so every test fails now and passes once built.
 * Fixture repos pin that the meta state the digest reports is the fixture's,
 * not this repo's (cwd-derived, lib resolved script-relative — the same
 * BASH_SOURCE discipline as scripts/lib/review-verdict.awk).
 */

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const { rowFile } = require('./helpers/ledgerFixtures');
// The roll-up/digest runners live in one place now (ADR rollup-scanner-fidelity/0001 —
// two copies of a rule is how three of that story's six defects were born).
const { runRollup: rollup, runDigest: digest } = require('./helpers/rollupFixtures');

const REPO_ROOT = path.join(__dirname, '..');
const SETTINGS = path.join(REPO_ROOT, '.claude', 'settings.json');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'session-start.sh');
const AGENTS_DIR = path.join(REPO_ROOT, '.claude', 'agents');

const WRITING_PRODUCT_AGENTS = [
  'product-strategist', 'ux-researcher', 'product-manager',
  'domain-modeler', 'product-designer', 'product-lead',
];
const ADVISORY_AGENTS = ['product-advisor', 'product-expert'];

// ---------- helpers ----------

/** Frontmatter block of an agent file (between the first two `---` lines). */
function frontmatter(agentName) {
  const raw = fs.readFileSync(path.join(AGENTS_DIR, `${agentName}.md`), 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(m, `${agentName}.md has no frontmatter block`);
  return m[1];
}

/** A temp git repo whose OPEN.md carries the given meta rows (and nothing else). */
function metaFixture(rows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-start-'));
  execSync('git init -q', { cwd: dir, shell: '/bin/bash' });
  fs.writeFileSync(
    path.join(dir, 'OPEN.md'),
    '# Ledger\n\n| # | Type | Item | Opened | Status | Owner | Notes |\n|---|---|---|---|---|---|---|\n' +
      rows.join('\n') + '\n'
  );
  return dir;
}

/** The lines of the roll-up's "Meta items" section (between its rule and the next one). */
function metaItems(out) {
  const lines = out.split('\n');
  const start = lines.findIndex((l) => l.includes('Meta items (harness lessons)'));
  assert.ok(start >= 0, 'the roll-up printed no "Meta items" section\n' + out);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('────────'));
  return rest.slice(0, end < 0 ? rest.length : end).filter((l) => l.trim() !== '');
}

/** The one line that carries the meta state (the banner, or the quiet "meta inbox" line). */
function metaLine(out) {
  const l = out.split('\n').find((x) => /META ESCALATION|meta inbox/.test(x)) || '(no meta line at all)';
  return l.trim().replace(/ \(trigger:.*$/, '');
}

/** Ids of the ledger-table rows in a list of "Meta items" lines: `  [12d] | 70 | meta | …`. */
function listedIds(lines) {
  return lines
    .map((l) => l.match(/^\s*\[[^\]]*\] \|\s*(\d+)\s*\|/))
    .filter(Boolean)
    .map((m) => m[1]);
}

// ---------- tests ----------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('.claude/settings.json is valid JSON whose SessionStart hook invokes scripts/session-start.sh', () => {
  assert.ok(fs.existsSync(SETTINGS), '.claude/settings.json does not exist');
  const cfg = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')); // throws on invalid JSON
  const entries = (cfg.hooks && cfg.hooks.SessionStart) || [];
  const commands = entries.flatMap((e) => (e.hooks || []).map((h) => h.command || ''));
  assert.ok(
    commands.some((c) => c.includes('scripts/session-start.sh')),
    `no SessionStart command names scripts/session-start.sh: ${JSON.stringify(cfg.hooks)}`
  );
});

test('settings.json is git-tracked and carries ONLY the SessionStart hook wiring — nothing personal (story test-hermeticity-ci #3, OPEN.md row 20)', () => {
  assert.ok(fs.existsSync(SETTINGS),
    '.claude/settings.json does not exist — the hook never shipped (OPEN.md row 20: gitignored, zero git history)');
  const cfg = JSON.parse(fs.readFileSync(SETTINGS, 'utf8'));
  const topKeys = Object.keys(cfg).filter((k) => k !== '$schema');
  assert.deepStrictEqual(topKeys, ['hooks'],
    `the tracked settings.json must carry only the hooks block — personal state stays in settings.local.json (ignored); found keys: ${Object.keys(cfg).join(', ')}`);
  assert.deepStrictEqual(Object.keys(cfg.hooks), ['SessionStart'],
    `only the SessionStart digest hook is ratified (ADR 0006); found hooks: ${Object.keys(cfg.hooks).join(', ')}`);
  if (fs.existsSync(path.join(REPO_ROOT, '.git'))) {
    const tracked = execSync('git ls-files .claude/settings.json', { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    assert.ok(tracked,
      '.claude/settings.json exists but is not git-tracked — .gitignore\'s .claude/* rule still eats it (needs the un-ignore; see .gitignore:106 comment for the pattern)');
  }
});

test('one meta row older than 30 days fires the escalation banner via the AGE trigger alone — on BSD date too (story test-hermeticity-ci #3, OPEN.md row 19)', () => {
  const dir = metaFixture(['| 1 | meta | ancient fixture lesson | 2020-01-01 | OPEN | | |']);
  const { code, out } = digest(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /META ESCALATION/,
    'a single >30d-old meta row must fire the banner via the age trigger alone (count=1 < 3); on BSD date the age computes as "?" today and the trigger is dead (OPEN.md row 19)\n' + out);
  assert.match(out, /oldest \d{3,}d/,
    'the banner must carry the real computed age (a 2020-01-01 row is >2000 days old), not 0 or "?"\n' + out);
});

test('scripts/session-start.sh exists and is executable', () => {
  assert.ok(fs.existsSync(SCRIPT), 'scripts/session-start.sh does not exist');
  assert.ok(fs.statSync(SCRIPT).mode & 0o111, 'scripts/session-start.sh is not executable');
});

test('the digest in this repo: exits 0 and carries the lint, meta, and stack lines', () => {
  const { code, out } = digest(REPO_ROOT);
  assert.strictEqual(code, 0, out.slice(-2000));
  assert.match(out, /harness-lint/, out);
  assert.match(out, /meta inbox: \d+ open|META ESCALATION/, out);
  assert.match(out, /stack present at :\d+|stack absent/, out);
  assert.match(out, /whats-open/, 'the digest must point at the full roll-up\n' + out);
});

test('the digest never bricks a session: exit 0 even in an empty, git-less directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-start-empty-'));
  const { code, out } = digest(dir);
  assert.strictEqual(code, 0, out);
});

test('a firing meta inbox (3 open rows) surfaces the escalation banner in the digest', () => {
  const dir = metaFixture([
    '| 1 | meta | first fixture lesson | 2026-06-01 | OPEN | | |',
    '| 2 | meta | second fixture lesson | 2026-06-02 | OPEN | | |',
    '| 3 | meta | third fixture lesson | 2026-06-03 | OPEN | | |',
  ]);
  const { code, out } = digest(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /META ESCALATION/, out);
  assert.match(out, /3 open/, out);
});

test('a quiet meta inbox (1 recent row) reports the count without the banner — even with no lint script in the repo', () => {
  const recent = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const dir = metaFixture([`| 1 | meta | young fixture lesson | ${recent} | OPEN | | |`]);
  const { code, out } = digest(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /meta inbox: 1 open/, out);
  assert.doesNotMatch(out, /META ESCALATION/, out);
});

// ---------- story ledger-row-identity #2: a pipe inside the Item cell (OPEN.md row 290) ----------
// The meta reader found a row's Opened and Status cells by counting pipes from the left, so
// a literal pipe in the Item cell pushed both out of reach: an open lesson vanished from the
// count, the list and the age trigger, and a closed one could be counted. See
// engineering-team/stories/ledger-row-identity/2-meta-count-pipes.test-plan.md

const PIPED_ITEMS = [
  ['inside a code span', 'lesson: `a|b` splits wrong'],
  ['escaped with a backslash', 'lesson: a \\| b splits wrong'],
  ['three times in one cell', 'lesson: `a|b` and `c|d|e` split wrong'],
];
for (const [how, item] of PIPED_ITEMS) {
  test(`an open meta row with a pipe ${how} still counts: alone and >30d old, it fires the banner with its real age (ledger-row-identity #2 AC-1, OPEN.md row 290)`, () => {
    const dir = metaFixture([`| 1 | meta | ${item} | 2020-01-01 | OPEN | | |`]);
    const { code, out } = digest(dir);
    assert.strictEqual(code, 0, out);
    assert.match(out, /META ESCALATION — 1 open harness lesson/,
      `got "${metaLine(out)}" — the only open lesson here has a pipe in its Item cell; a reader that finds Status by counting pipes never sees it, so the inbox reads clear and the age trigger is dead for it (OPEN.md row 290)\n${out}`);
    assert.match(out, /oldest \d{4,}d/,
      `got "${metaLine(out)}" — the age must come from the row's Opened cell (2020-01-01, >2000 days), wherever the pipes pushed that cell\n${out}`);
  });
}

test('/whats-open lists a piped open meta row under "Meta items" with its age, and its banner agrees with the digest (ledger-row-identity #2 AC-2)', () => {
  const dir = metaFixture(['| 1 | meta | lesson: `a|b` splits wrong | 2020-01-01 | OPEN | | |']);
  const { code, out } = rollup(dir);
  assert.strictEqual(code, 0, out);
  const items = metaItems(out);
  assert.ok(items.some((l) => /^\s*\[\d{4,}d\] \| 1 \| meta \|/.test(l)),
    `"Meta items" must list row 1 with its age in days; got: ${JSON.stringify(items)}`);
  assert.match(out, /META ESCALATION — 1 open harness lesson/,
    `got "${metaLine(out)}" — the roll-up and the digest share one reader, so the roll-up's banner must count the row too`);
});

test('a DONE meta row is never counted or listed, even when pipes in its Item put a mention of OPEN.md where the Status used to be read (ledger-row-identity #2 AC-3)', () => {
  const dir = metaFixture(['| 1 | meta | lesson: `x|y|z` in OPEN.md handling | 2020-01-01 | DONE | 2020-01-02 | |']);
  const { code, out } = digest(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /meta inbox: 0 open \(clear\)/,
    `got "${metaLine(out)}" — the row is DONE; testing a shifted cell for the substring "OPEN" counts it, because its Item names OPEN.md (OPEN.md row 290)\n${out}`);
  const items = metaItems(rollup(dir).out);
  assert.deepStrictEqual(listedIds(items), [], `a closed row must not be listed; got: ${JSON.stringify(items)}`);
});

test('a DONE meta row stays closed when a later cell holds a fragment that is exactly OPEN: the first status cell is the row\'s Status (ledger-row-identity #2 AC-3)', () => {
  // The quoted fragment ENDS on the OPEN cell, so a reader that took the last status-like cell
  // would read this row as open (review finding 5: with `DONE | OPEN | DONE` first and last agreed).
  const dir = metaFixture(['| 1 | meta | plain lesson | 2020-01-01 | DONE | 2020-01-02 (the cell read `DONE | OPEN |` for a day) | |']);
  const { code, out } = digest(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /meta inbox: 0 open \(clear\)/,
    `got "${metaLine(out)}" — the row's Status is the FIRST cell after Type that reads OPEN or starts with DONE; a later fragment must not reopen it\n${out}`);
});

test('an open row of another type is not a meta row, whatever its Item says (ledger-row-identity #2 AC-3)', () => {
  const dir = metaFixture(['| 1 | bug | the meta counter splits `a|b` wrong | 2020-01-01 | OPEN | | |']);
  const { code, out } = digest(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /meta inbox: 0 open \(clear\)/,
    `got "${metaLine(out)}" — the row's Type cell reads bug; only the Type cell decides whether a row is a meta row\n${out}`);
});

// Added at Implementation, not by the Tester — it pins the one judgment call logged in the
// story's § Deviations: the scan for the Status cell starts at the sixth field.
test('an open meta row whose Item begins with the word DONE is still open: the Item cell is never read as a Status (ledger-row-identity #2, story § Deviations)', () => {
  const dir = metaFixture([
    '| 1 | meta | DONE rows with pipes were counted as open | 2020-01-01 | OPEN | | |',
    '| 2 | meta | DONE-LOCAL is not a status `a|b` the counter knows | 2020-01-01 | OPEN | | |',
  ]);
  const { code, out } = digest(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /META ESCALATION — 2 open harness lesson/,
    `got "${metaLine(out)}" — both rows are open; a Status can sit no earlier than the sixth field (Type, then at least an Item cell and an Opened cell), so text at the start of the Item must never be taken for one\n${out}`);
});

test('a malformed DONE row (a second row\'s tail fused on, as in OPEN.md row 157) is not counted and does not stop the reader: the open rows after it are all counted and listed (ledger-row-identity #2 AC-4)', () => {
  const fused = '| 1 | meta | **Piping a run through `tail` hides its verdict.** `npm test | tail -35` reported FAIL | 2020-01-01 (fixture review) | DONE | 2020-02-01 (fixed) | `audits/x/audit.md`; and `npm test | tail -1 && git commit` took the exit status of tail | 2020-01-01 (fixture review) | DONE (see above) | |';
  const dir = metaFixture([
    fused,
    '| 2 | meta | plain lesson after the malformed row | 2026-06-01 | OPEN | | |',
    '| 3 | meta | piped lesson `a|b` after the malformed row | 2026-06-02 | OPEN | | |',
    '| 4 | meta | another plain lesson | 2026-06-03 | OPEN | | |',
  ]);
  const { code, out } = rollup(dir);
  assert.strictEqual(code, 0, out);
  const items = metaItems(out);
  assert.deepStrictEqual(listedIds(items), ['2', '3', '4'],
    `listed ${JSON.stringify(listedIds(items))}, want ["2","3","4"] — rows 2, 3 and 4 are open (3 has a pipe in its Item) and row 1 is DONE`);
  assert.match(out, /META ESCALATION — 3 open harness lesson/, `got "${metaLine(out)}"`);
});

test('a piped open meta row whose Opened cell holds no date still counts, with its age unknown (ledger-row-identity #2, ADR harness-self-improvement/0004: "still count it")', () => {
  const dir = metaFixture([
    '| 1 | meta | lesson: `a|b` splits wrong | sometime in the summer | OPEN | | |',
    '| 2 | meta | second fixture lesson | 2026-06-02 | OPEN | | |',
    '| 3 | meta | third fixture lesson | 2026-06-03 | OPEN | | |',
  ]);
  const { code, out } = digest(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /META ESCALATION — 3 open harness lesson/,
    `got "${metaLine(out)}" — three open lessons fire the count trigger; the undated, piped one must be among them\n${out}`);
});

test('a date inside the Item text is not the row\'s Opened date: a piped row opened 2 days ago stays quiet (ledger-row-identity #2 AC-1)', () => {
  const recent = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const dir = metaFixture([`| 1 | meta | lesson: \`a|b\` seen since 2019-01-01 | ${recent} | OPEN | | |`]);
  const { code, out } = digest(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /meta inbox: 1 open, oldest \dd\b/,
    `got "${metaLine(out)}" — the row is open and two days old; its age must come from the Opened cell, not from the 2019 date that the pipe pushed into the old Opened position\n${out}`);
});

test('on this repo\'s real ledger the meta list holds exactly the meta rows that have an OPEN cell: none dropped, none extra (ledger-row-identity #2 AC-5; rows 70 and 244 were dropped)', () => {
  // Oracle, independent of the reader: the whole-line test the roll-up's ledger section
  // uses (scripts/whats-open.sh, "OPEN.md ledger") — a meta row that has a cell reading OPEN.
  const expected = fs.readFileSync(path.join(REPO_ROOT, 'OPEN.md'), 'utf8').split('\n')
    .filter((l) => /^\|\s*\d+\s*\|\s*meta\s*\|/.test(l) && /\|\s*OPEN\s*\|/.test(l))
    .map((l) => l.match(/^\|\s*(\d+)\s*\|/)[1]);
  // The reader's documented interface (scripts/lib/collect-meta.sh header): META_LINES.
  const res = spawnSync('bash', ['-c', '. scripts/lib/collect-meta.sh; collect_meta; printf "%s" "$META_LINES"'],
    { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr);
  const listed = listedIds(res.stdout.split('\n'));
  const minus = (a, b) => { const pool = [...b]; return a.filter((x) => { const i = pool.indexOf(x); if (i < 0) return true; pool.splice(i, 1); return false; }); };
  const dropped = minus(expected, listed);
  const extra = minus(listed, expected);
  assert.ok(dropped.length === 0 && extra.length === 0,
    `dropped rows: [${dropped.join(', ')}]; extra rows: [${extra.join(', ')}] (the reader lists ${listed.length}, the ledger holds ${expected.length}) — the meta reader and the ledger section disagree about which meta rows are open. "dropped": open rows the escalation never sees (a pipe in a cell?). "extra": rows the reader counts although no cell of theirs reads OPEN. If a DONE row quotes a table cell \`| OPEN |\` in its text, it is the ledger section that misreads it: reword the row.`);
});

// ---------- story ledger-row-identity #1: rows that are files (ADR ledger-row-identity/0001) ----------
// A new ledger row is a file, ledger/<id>.md, with a fielded header. The meta reader and the
// roll-up's ledger section read those files as well as the table. A tree with no ledger/
// directory reads exactly as before: every test above runs on one, and none was changed.
// See engineering-team/stories/ledger-row-identity/1-collision-free-ledger-row-ids.test-plan.md

const LEDGER_LIB = path.join(REPO_ROOT, 'scripts', 'lib', 'collect-ledger.sh');
const DONE_TABLE_ROW = '| 1 | meta | a closed table lesson | 2026-06-01 | DONE | 2026-06-02 | |';
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/** metaFixture plus row files: `files` maps an id to the text of ledger/<id>.md. */
function ledgerFixture(rows, files = {}) {
  const dir = metaFixture(rows);
  fs.mkdirSync(path.join(dir, 'ledger'));
  for (const [id, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'ledger', `${id}.md`), text);
  return dir;
}

/** The lines of the roll-up's "OPEN.md ledger" section (between its rule and the next one). */
function ledgerSection(out) {
  const lines = out.split('\n');
  const start = lines.findIndex((l) => l.startsWith('────────') && l.includes('OPEN.md ledger'));
  assert.ok(start >= 0, 'the roll-up printed no "OPEN.md ledger" section\n' + out);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('────────'));
  return rest.slice(0, end < 0 ? rest.length : end).map((l) => l.trim()).filter((l) => l !== '');
}

/** Ids of the row files in a list of "Meta items" lines: `  [12d] 2026-09-19-some-slug — Title`. */
function listedFileIds(lines) {
  return lines
    .map((l) => l.match(/^\s*\[[^\]]*\] (20\d{2}-\d{2}-\d{2}-[a-z0-9-]+) — /))
    .filter(Boolean)
    .map((m) => m[1]);
}

/** The one summary line the ledger section prints for an open row file (ADR 0001 step 6). */
const summaryLine = (id, type, title, opened) => `| ${id} | ${type} | **${title}** → ledger/${id}.md | ${opened} | OPEN | | |`;

test('an open meta row that is a file counts: alone and >30d old, it fires the banner with its real age (ledger-row-identity #1 AC-5)', () => {
  const id = '2020-01-01-ancient-file-lesson';
  const dir = ledgerFixture([], { [id]: rowFile(id, { opened: '2020-01-01 (session close; worktree sweep)' }) });
  const { code, out } = digest(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /META ESCALATION — 1 open harness lesson/,
    `got "${metaLine(out)}" — the only open lesson here is a file, ledger/${id}.md; a reader that knows only the table never sees it\n${out}`);
  assert.match(out, /oldest \d{4,}d/,
    `got "${metaLine(out)}" — the age comes from the first ISO date in the file's Opened field (2020-01-01, >2000 days)\n${out}`);
});

test('/whats-open shows an open file row where it shows a table row: one summary line in the ledger section that points at the file, and — a meta row — under "Meta items" with its age (ledger-row-identity #1 AC-5)', () => {
  const id = '2020-01-01-ancient-file-lesson';
  const title = 'Agent worktrees outlive their books';
  const dir = ledgerFixture(['| 1 | meta | a table lesson | 2026-06-01 | OPEN | | |'],
    { [id]: rowFile(id, { title, opened: '2020-01-01 (session close)' }) });
  const { code, out } = rollup(dir);
  assert.strictEqual(code, 0, out);
  const ledger = ledgerSection(out);
  const want = summaryLine(id, 'meta', title, '2020-01-01');
  assert.ok(ledger.includes(want), `the ledger section must hold the line ${JSON.stringify(want)}; got: ${JSON.stringify(ledger)}`);
  assert.ok(ledger.some((l) => l.startsWith('| 1 | meta | a table lesson |')), `the table row must still be printed whole; got: ${JSON.stringify(ledger)}`);
  const items = metaItems(out);
  assert.ok(items.some((l) => new RegExp(`^\\s*\\[\\d{4,}d\\] ${id} — ${title}$`).test(l)),
    `"Meta items" must list the file row as "[<age>d] ${id} — ${title}"; got: ${JSON.stringify(items)}`);
  assert.deepStrictEqual(listedIds(items), ['1'], `the table's meta row is listed as before; got: ${JSON.stringify(items)}`);
  assert.match(out, /META ESCALATION — 2 open harness lesson/, `got "${metaLine(out)}" — one table lesson and one file lesson are open`);
});

test('a DONE file row is never counted or listed — also when a note follows the word DONE — while the open row beside it is (ledger-row-identity #1 AC-5)', () => {
  const open = `${daysAgo(2)}-young-file-lesson`;
  const dir = ledgerFixture([], {
    [open]: rowFile(open, { opened: daysAgo(2) }),
    '2020-01-01-closed-plainly': rowFile('2020-01-01-closed-plainly', { opened: '2020-01-01', status: 'DONE', done: '2020-01-02' }),
    '2020-01-03-closed-with-a-note': rowFile('2020-01-03-closed-with-a-note', { opened: '2020-01-03', status: 'DONE (2020-01-04, PR #1)', done: '2020-01-04 (PR #1)' }),
  });
  const d = digest(dir);
  assert.strictEqual(d.code, 0, d.out);
  assert.match(d.out, /meta inbox: 1 open, oldest \dd\b/,
    `got "${metaLine(d.out)}" — one file row is open and two days old; the two DONE rows (opened in 2020) must not be counted or aged\n${d.out}`);
  const r = rollup(dir);
  assert.deepStrictEqual(listedFileIds(metaItems(r.out)), [open], `"Meta items" lists the open row only; got: ${JSON.stringify(metaItems(r.out))}`);
  const fileLines = ledgerSection(r.out).filter((l) => l.includes('ledger/'));
  assert.ok(fileLines.length === 1 && fileLines[0].startsWith(`| ${open} |`), `the ledger section lists the open row only; got: ${JSON.stringify(ledgerSection(r.out))}`);
});

test('the first word of a row file\'s Type and Status is what counts: "meta (harness lesson)" is a meta row, and "OPEN — waiting on the operator" is open (ADR 0001 step 5)', () => {
  const id = '2020-01-01-decorated-header-fields';
  const dir = ledgerFixture([], {
    [id]: rowFile(id, { title: 'Decorated fields', type: 'meta (harness lesson)', opened: '2020-01-01', status: 'OPEN — waiting on the operator' }),
  });
  const d = digest(dir);
  assert.match(d.out, /META ESCALATION — 1 open harness lesson/, `got "${metaLine(d.out)}"\n${d.out}`);
  const ledger = ledgerSection(rollup(dir).out);
  const want = summaryLine(id, 'meta', 'Decorated fields', '2020-01-01');
  assert.ok(ledger.includes(want), `the summary line carries the first word of each field: ${JSON.stringify(want)}; got: ${JSON.stringify(ledger)}`);
});

test('an open file row of another type is listed in the ledger section and is not a harness lesson (ledger-row-identity #1 AC-5)', () => {
  const id = '2020-01-01-prune-stale-branches';
  const dir = ledgerFixture([], { [id]: rowFile(id, { title: 'Prune the stale branches', type: 'cleanup', opened: '2020-01-01' }) });
  const d = digest(dir);
  assert.match(d.out, /meta inbox: 0 open \(clear\)/, `got "${metaLine(d.out)}" — the row's Type reads cleanup\n${d.out}`);
  const r = rollup(dir);
  const want = summaryLine(id, 'cleanup', 'Prune the stale branches', '2020-01-01');
  assert.ok(ledgerSection(r.out).includes(want), `the ledger section must hold ${JSON.stringify(want)}; got: ${JSON.stringify(ledgerSection(r.out))}`);
  assert.deepStrictEqual(listedFileIds(metaItems(r.out)), [], `got: ${JSON.stringify(metaItems(r.out))}`);
});

test('table rows and file rows are one inbox: two young table lessons and one young file lesson fire the count trigger together (ledger-row-identity #1 AC-5)', () => {
  const id = `${daysAgo(1)}-third-lesson-is-a-file`;
  const dir = ledgerFixture([
    `| 1 | meta | first fixture lesson | ${daysAgo(3)} | OPEN | | |`,
    `| 2 | meta | second fixture lesson | ${daysAgo(2)} | OPEN | | |`,
  ], { [id]: rowFile(id, { opened: daysAgo(1) }) });
  const { code, out } = digest(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /META ESCALATION — 3 open harness lesson\(s\), oldest \dd\b/,
    `got "${metaLine(out)}" — no row is a month old, so only the count can fire, and it takes all three\n${out}`);
});

test('the ledger section says "(no OPEN rows in the ledger)" only when the table and ledger/ are both without an open row (ADR 0001 step 6)', () => {
  const id = '2020-01-01-prune-stale-branches';
  const open = rowFile(id, { type: 'cleanup', opened: '2020-01-01' });
  const done = rowFile(id, { type: 'cleanup', opened: '2020-01-01', status: 'DONE', done: '2020-01-02' });
  const onlyFileOpen = ledgerSection(rollup(ledgerFixture([DONE_TABLE_ROW], { [id]: open })).out);
  assert.ok(onlyFileOpen.some((l) => l.startsWith(`| ${id} |`)) && !onlyFileOpen.some((l) => /no OPEN rows/.test(l)),
    `an open file row is an open row: list it, and do not say there is none; got: ${JSON.stringify(onlyFileOpen)}`);
  const noneOpen = ledgerSection(rollup(ledgerFixture([DONE_TABLE_ROW], { [id]: done })).out);
  assert.deepStrictEqual(noneOpen, ['(no OPEN rows in the ledger)'], `got: ${JSON.stringify(noneOpen)}`);
});

test('an empty ledger/ directory reads as no directory at all', () => {
  const rows = ['| 1 | meta | a table lesson | 2020-01-01 | OPEN | | |'];
  const [withDir, without] = [ledgerFixture(rows), metaFixture(rows)];
  assert.strictEqual(metaLine(digest(withDir).out), metaLine(digest(without).out));
  const [a, b] = [rollup(withDir).out, rollup(without).out];
  assert.deepStrictEqual(ledgerSection(a), ledgerSection(b));
  assert.deepStrictEqual(metaItems(a), metaItems(b));
});

test('ledger_file_rows prints one tab-separated line per row file — id, type, opened, status, title — and nothing, with exit 0, where there is no ledger/ directory (ADR 0001 step 5)', () => {
  const dir = ledgerFixture([], {
    '2020-01-01-ancient-file-lesson': rowFile('2020-01-01-ancient-file-lesson', {
      title: 'Agent worktrees outlive their books', type: 'meta (harness lesson)', opened: '2020-01-01 (session close; seen again 2020-02-02)',
    }),
    '2020-01-03-closed-with-a-note': rowFile('2020-01-03-closed-with-a-note', {
      title: 'Closed with a note', type: 'cleanup', opened: '2020-01-03', status: 'DONE (2020-01-04, PR #1)', done: '2020-01-04 (PR #1)',
    }),
  });
  const read = (cwd) => spawnSync('bash', ['-c', '. "$1"; ledger_file_rows', '_', LEDGER_LIB], { cwd, encoding: 'utf8' });
  const res = read(dir);
  assert.strictEqual(res.status, 0, `exit ${res.status}: ${res.stderr.trim().split('\n')[0]}`);
  assert.deepStrictEqual(res.stdout.split('\n').filter(Boolean).sort(), [
    '2020-01-01-ancient-file-lesson\tmeta\t2020-01-01\tOPEN\tAgent worktrees outlive their books',
    '2020-01-03-closed-with-a-note\tcleanup\t2020-01-03\tDONE\tClosed with a note',
  ]);
  const none = read(metaFixture([]));
  assert.strictEqual(none.status, 0, `exit ${none.status} with no ledger/ directory: ${none.stderr.trim().split('\n')[0]}`);
  assert.strictEqual(none.stdout, '', 'no ledger/ directory: nothing to print');
});

test('on this repo\'s real ledger the meta list holds exactly the open meta rows that are files: none dropped, none extra (ledger-row-identity #1 AC-5)', () => {
  // Oracle, independent of the reader: the header fields of each ledger/*.md, read here.
  const dir = path.join(REPO_ROOT, 'ledger');
  const field = (text, name) => ((text.match(new RegExp(`^\\*\\*${name}:\\*\\*[ \\t]*(\\S+)`, 'm')) || [])[1] || '');
  const expected = (fs.existsSync(dir) ? fs.readdirSync(dir) : [])
    .filter((n) => n.endsWith('.md'))
    .filter((n) => { const t = fs.readFileSync(path.join(dir, n), 'utf8'); return /meta/.test(field(t, 'Type')) && field(t, 'Status') === 'OPEN'; })
    .map((n) => n.slice(0, -3))
    .sort();
  const res = spawnSync('bash', ['-c', '. scripts/lib/collect-meta.sh; collect_meta; printf "%s" "$META_LINES"'],
    { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.strictEqual(res.status, 0, res.stderr);
  const listed = listedFileIds(res.stdout.split('\n')).sort();
  assert.deepStrictEqual(listed, expected,
    `the reader lists ${JSON.stringify(listed)}; ledger/ holds ${JSON.stringify(expected)} as open meta rows — the meta reader and the row files disagree`);
});

test('the six writing product agents carry allow-list-only Write/Edit scoping (product-team + the ledger\'s two homes, OPEN.md and ledger/; no ask/deny)', () => {
  for (const name of WRITING_PRODUCT_AGENTS) {
    const fm = frontmatter(name);
    assert.match(fm, /permissions:/, `${name}: no permissions block`);
    for (const rule of [
      'Write(./product-team/**)', 'Edit(./product-team/**)',
      'Write(./OPEN.md)', 'Edit(./OPEN.md)',
      // ledger-row-identity #1 (ADR 0001 step 9): a new row is a file under ledger/, so a
      // role that may file a loose end must be able to create one there.
      'Write(./ledger/**)', 'Edit(./ledger/**)',
    ]) {
      assert.ok(fm.includes(rule), `${name}: missing allow rule ${rule}\n${fm}`);
    }
    assert.doesNotMatch(fm, /^\s*deny:/m, `${name}: ADR 0006 forbids deny rules (allow-only shape)`);
    assert.doesNotMatch(fm, /^\s*ask:/m, `${name}: ADR 0006 forbids ask rules (allow-only shape)`);
  }
});

test('the pure-advisory agents have neither Bash nor Write in their tool lists', () => {
  for (const name of ADVISORY_AGENTS) {
    const toolsLine = (frontmatter(name).match(/^tools:.*$/m) || [''])[0];
    assert.ok(toolsLine, `${name}: no tools line`);
    assert.doesNotMatch(toolsLine, /\bBash\b/, `${name}: Bash must be removed\n${toolsLine}`);
    assert.doesNotMatch(toolsLine, /\bWrite\b/, `${name}: advisory roles have no Write\n${toolsLine}`);
  }
});

// ---------- runner ----------

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message.split('\n')[0]}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
