/**
 * Story ledger-row-identity #1: ledger row ids that cannot collide. ADR
 * ledger-row-identity/0001 (Option C). See
 * engineering-team/stories/ledger-row-identity/1-collision-free-ledger-row-ids.test-plan.md
 *
 * The rule: a new ledger row gets the id `YYYY-MM-DD-<slug>` and a file of its own,
 * ledger/<id>.md. Minting reads no shared state, so two sessions cannot collide by
 * counting; creating two different files never conflicts; and the numbered table in
 * OPEN.md stays where it is, frozen, so every number cited anywhere keeps resolving.
 *
 * This suite holds the story-level tests: two checkouts minting offline and merging both
 * ways (AC-1, AC-2), the freeze marker on the real table (AC-3), and the one written rule
 * (AC-6). The lint check is tested in test/harness-lint.test.js (L15, AC-4) and the two
 * readers in test/session-start.test.js (AC-5). No stack, no network: every git command
 * here runs between directories under the OS temp folder.
 */

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const { ledgerDoc, tableRow } = require('./helpers/ledgerFixtures');

const REPO_ROOT = path.join(__dirname, '..');
const LINT = path.join(REPO_ROOT, 'scripts', 'harness-lint.sh');
const DIGEST = path.join(REPO_ROOT, 'scripts', 'session-start.sh');
const TEMPLATE_REL = 'engineering-team/templates/open-row.md';
const TEMPLATE = path.join(REPO_ROOT, TEMPLATE_REL);
const ID_PATTERN = /^20[0-9]{2}-[0-9]{2}-[0-9]{2}-[a-z0-9]+(-[a-z0-9]+){1,5}$/; // ADR 0001 § "The rule"

// ---------- helpers ----------

const GIT_ID = '-c user.email=fixture@test -c user.name=fixture';

function git(cwd, args) {
  const res = spawnSync('bash', ['-c', `git ${GIT_ID} ${args}`], { cwd, encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout || ''}${res.stderr || ''}`.trim() };
}

function run(script, cwd) {
  const res = spawnSync('bash', [script], { cwd, encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout || ''}${res.stderr || ''}` };
}

/**
 * A committed repo whose ledger is a frozen table of two closed rows (so the only open
 * lessons a test sees are the ones it mints), and two clones of it that never talk again.
 */
function twoCheckouts() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-row-ids-base-'));
  fs.writeFileSync(path.join(base, 'OPEN.md'), ledgerDoc([tableRow(1), tableRow(2)], { frozenAt: 2 }));
  execSync(`git init -q && git add -A && git ${GIT_ID} commit -qm base`, { cwd: base, shell: '/bin/bash' });
  return ['a', 'b'].map((name) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), `ledger-row-ids-${name}-`));
    execSync(`git clone -q "${base}" "${dir}"`, { shell: '/bin/bash' });
    return dir;
  });
}

/**
 * Mint a row the documented way, with nothing fetched and nothing counted: the id is the
 * UTC day plus a slug that says what the row is about; the row is a copy of the template
 * with its header filled in, saved as ledger/<id>.md. Commits it on a branch named `minted`.
 */
function mint(dir, slug, title, body = 'What was seen, and the fix shape.') {
  assert.ok(fs.existsSync(TEMPLATE), `${TEMPLATE_REL} does not exist — the documented way to mint a row is to copy it`);
  const id = `${execSync('date -u +%F', { encoding: 'utf8' }).trim()}-${slug}`;
  assert.match(id, ID_PATTERN, `the fixture's own id must be well formed: ${id}`);
  const text = fs.readFileSync(TEMPLATE, 'utf8')
    .replace(/^# .*$/m, `# ${title}`)
    .replace(/^\*\*Id:\*\*.*$/m, `**Id:** ${id}`)
    .replace(/^\*\*Type:\*\*.*$/m, '**Type:** meta')
    .replace(/^\*\*Opened:\*\*.*$/m, `**Opened:** ${id.slice(0, 10)} (fixture session)`)
    .replace(/^\*\*Status:\*\*.*$/m, '**Status:** OPEN')
    + `\n${body}\n`;
  fs.mkdirSync(path.join(dir, 'ledger'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'ledger', `${id}.md`), text);
  const c = git(dir, `add -A && git ${GIT_ID} commit -qm "ledger: ${id}" && git branch minted`);
  assert.strictEqual(c.code, 0, c.out);
  return id;
}

/** Merge the other checkout's `minted` branch into this one. */
function mergeFrom(dir, other) {
  const f = git(dir, `fetch -q "${other}" minted`);
  assert.strictEqual(f.code, 0, f.out);
  return git(dir, 'merge -q --no-edit FETCH_HEAD');
}

// ---------- tests ----------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('two checkouts that share a base and exchange nothing each mint a row for a different finding: the ids differ, merging in either order leaves nothing to resolve, and the merged ledger lints clean and counts both rows (ledger-row-identity #1 AC-1, AC-2)', () => {
  const [a, b] = twoCheckouts();
  const idA = mint(a, 'agent-worktrees-outlive-books', 'Agent worktrees outlive their books');
  const idB = mint(b, 'digest-hides-lint-failures', 'The digest hides lint failures');
  assert.notStrictEqual(idA, idB, 'two findings, two ids — and neither checkout looked at the other to get one');

  for (const [dir, other, order] of [[a, b, 'b into a'], [b, a, 'a into b']]) {
    const m = mergeFrom(dir, other);
    assert.strictEqual(m.code, 0, `merging ${order} stopped: ${m.out.split('\n')[0]} — adding two different row files must never conflict`);
    assert.strictEqual(git(dir, 'status --porcelain').out, '', `merging ${order} left something to resolve`);
    assert.deepStrictEqual(fs.readdirSync(path.join(dir, 'ledger')).sort(), [`${idA}.md`, `${idB}.md`].sort(),
      `merging ${order}: both rows are there, under the ids they were minted with`);
    const lint = run(LINT, dir);
    assert.strictEqual(lint.code, 0, `merging ${order}: the merged ledger must lint clean\n${lint.out}`);
    const digest = run(DIGEST, dir).out;
    assert.match(digest, /meta inbox: 2 open/,
      `merging ${order}: got "${(digest.split('\n').find((l) => /meta inbox|META ESCALATION/.test(l)) || '(no meta line)').trim()}" — both minted rows are open harness lessons, and the digest must count the two of them`);
  }
  assert.strictEqual(git(a, 'rev-parse HEAD^{tree}').out, git(b, 'rev-parse HEAD^{tree}').out,
    'the merged tree is the same whichever side merged first');
});

test('two checkouts that mint the SAME id for different findings cannot merge silently: git stops with an add/add conflict on ledger/<id>.md (ADR 0001 § "The rule")', () => {
  const [a, b] = twoCheckouts();
  const id = mint(a, 'same-slug-twice', 'A finding', 'Seen on this machine.');
  assert.strictEqual(mint(b, 'same-slug-twice', 'A different finding', 'Seen on the laptop.'), id);
  const m = mergeFrom(a, b);
  assert.notStrictEqual(m.code, 0, 'two different rows under one id merged without a word — the collision the numbered table allowed');
  assert.match(git(a, 'status --porcelain').out, new RegExp(`^AA ledger/${id}\\.md$`, 'm'),
    'the conflict must be on the row file itself, where "which row owns this id?" is asked at merge time');
});

test('the real OPEN.md table is frozen where it stands: one freeze marker, and its number is the highest id in the table (ledger-row-identity #1 AC-3; ADR 0001 step 2)', () => {
  const lines = fs.readFileSync(path.join(REPO_ROOT, 'OPEN.md'), 'utf8').split('\n');
  const markers = lines.map((l) => l.match(/^<!-- ledger-table-frozen: highest-number=(\d+) -->$/)).filter(Boolean);
  assert.strictEqual(markers.length, 1,
    `found ${markers.length} freeze marker(s) in OPEN.md — want exactly one line "<!-- ledger-table-frozen: highest-number=<N> -->"`);
  const header = lines.findIndex((l) => /^\|\s*#\s*\|/.test(l));
  assert.ok(header >= 0, 'OPEN.md has no "| # | …" header row');
  const numbers = lines.slice(header + 1)
    .map((l) => l.match(/^\|\s*(\d+)\s*\|/))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  // 343 numbered lines on 2026-09-20, one of them the second row 329, which ADR step 1 moves.
  assert.ok(numbers.length >= 342, `the numbered rows are still in the table, where every citation of a number points: found ${numbers.length}, want 342 or more`);
  assert.strictEqual(Number(markers[0][1]), Math.max(...numbers),
    `the marker says ${markers[0][1]}; the highest number in the table is ${Math.max(...numbers)}`);
});

test('OPEN.md § "How to use this ledger" says how to mint an id and how to cite one (ledger-row-identity #1 AC-6)', () => {
  const text = fs.readFileSync(path.join(REPO_ROOT, 'OPEN.md'), 'utf8');
  const section = (text.match(/^## How to use this ledger\n([\s\S]*?)^## /m) || [])[1];
  assert.ok(section, 'OPEN.md has no "## How to use this ledger" section');
  for (const [what, re] of [
    ['the shape of an id, `YYYY-MM-DD-<slug>`', /YYYY-MM-DD-<slug>/],
    ['where the date comes from, `date -u +%F`', /date -u \+%F/],
    ['where a new row goes, `ledger/<id>.md`', /ledger\/<id>\.md/],
    ['the template to copy, as a link', /\]\(engineering-team\/templates\/open-row\.md\)/],
    ['how to cite a row — by id, in the phrase "OPEN.md row"', /[Cc]ite[\s\S]*OPEN\.md row/],
    ['what to do when two branches mint the same id', /same id/],
  ]) {
    assert.match(section, re, `the section does not give ${what}`);
  }
});

test('the row template exists and carries the fielded header the readers and L15 look for (ADR 0001 step 4)', () => {
  assert.ok(fs.existsSync(TEMPLATE), `${TEMPLATE_REL} does not exist`);
  const text = fs.readFileSync(TEMPLATE, 'utf8');
  assert.match(text, /^# \S/, 'the template must open with a "# <title>" line: the title stands in for a table row\'s bold lead sentence');
  const fields = [...text.matchAll(/^\*\*([A-Za-z]+):\*\*/gm)].map((m) => m[1]);
  assert.deepStrictEqual(fields, ['Id', 'Type', 'Opened', 'Status', 'Done', 'Pointer'],
    `header fields, in the table's column order, then the pointer; got: ${JSON.stringify(fields)}`);
});

test('the interim "allocate the next number off origin" guidance is retired where it was taught, and the instruction to push stays (ledger-row-identity #1 AC-6)', () => {
  for (const rel of ['engineering-team/workflows/6-book-close.md', '.claude/commands/close-book.md']) {
    const text = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
    assert.doesNotMatch(text, /row numbers are allocated/i,
      `${rel} still teaches that OPEN.md row numbers are allocated off origin — no number is allocated any more`);
    assert.doesNotMatch(text, /mint the same numbers/i, `${rel} still describes the number race as a live risk`);
    assert.match(text, /push\*{0,2} the branch the close landed on/i,
      `${rel} must still say to push the branch the close landed on: sibling sessions read origin`);
  }
});

// ---------- runner ----------

async function runAll() {
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

module.exports = { run: runAll };
