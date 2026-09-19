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

function digest(cwd) {
  const res = spawnSync('bash', [SCRIPT], { cwd, encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout || ''}${res.stderr || ''}` };
}

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

const ROLLUP = path.join(REPO_ROOT, 'scripts', 'whats-open.sh');
let ghStubDir = null;

/**
 * Run the full /whats-open roll-up in a fixture repo, offline: a `gh` that fails at once
 * shadows the real one on PATH (the script prints "(gh error)" and carries on), and a
 * fixture has no `origin`, so its `git fetch` fails just as fast. Nothing leaves the machine.
 */
function rollup(cwd) {
  if (!ghStubDir) {
    ghStubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-start-gh-stub-'));
    fs.writeFileSync(path.join(ghStubDir, 'gh'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  }
  const env = { ...process.env, PATH: `${ghStubDir}${path.delimiter}${process.env.PATH}` };
  const res = spawnSync('bash', [ROLLUP], { cwd, encoding: 'utf8', env });
  return { code: res.status, out: `${res.stdout || ''}${res.stderr || ''}` };
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
  const dir = metaFixture(['| 1 | meta | plain lesson | 2020-01-01 | DONE | 2020-01-02 (the cell read `DONE | OPEN | DONE` for a day) | |']);
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

test('the six writing product agents carry allow-list-only Write/Edit scoping (product-team + OPEN.md, no ask/deny)', () => {
  for (const name of WRITING_PRODUCT_AGENTS) {
    const fm = frontmatter(name);
    assert.match(fm, /permissions:/, `${name}: no permissions block`);
    for (const rule of [
      'Write(./product-team/**)', 'Edit(./product-team/**)',
      'Write(./OPEN.md)', 'Edit(./OPEN.md)',
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
