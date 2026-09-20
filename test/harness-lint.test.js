/**
 * Story harness-self-improvement #1: harness-lint — the harness checks its own
 * invariants. ADR 0001 (harness-self-improvement). See
 * engineering-team/stories/harness-self-improvement/1-harness-lint.test-plan.md
 *
 * ADR 0001 chose Option A: a bash script scripts/harness-lint.sh, one function
 * per invariant (L1–L9), emitting one `VIOLATION <id> <path> — <msg>` line per
 * hit, exit 0/1, with a waiver file (scripts/harness-lint-waivers.txt: id, path
 * glob, citation) whose hits print `WAIVED …` and whose unused rows print
 * `STALE-WAIVER …`. Non-numbered review files print `INFO non-numbered-review`
 * (not a violation). L1 verdict parsing: the LAST verdict-shaped line in the
 * review wins (operator-ratified). L9: flag hand-maintained `**Last updated:**`
 * headers >14 days behind `git log -1` for that file; skip silently when git
 * history is absent.
 *
 * These tests run the script against SYNTHETIC fixture trees (one seeded
 * violation each, built in a temp dir, git-inited so L9 can consult history)
 * plus one run against the real repo, which must be lint-clean modulo shipped
 * waivers. No stack, no network. The script does not exist pre-implementation,
 * so T1–T17 FAIL now (spawn of a missing script) and PASS once built; T18
 * additionally requires the first-run findings dispositioned per ADR 0001.
 */

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const REPO_ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'harness-lint.sh');
const { rowFile, tableRow, ledgerDoc, REAL_SHAPE_ROWS, NOTE_LINE } = require('./helpers/ledgerFixtures');

// ---------- fixture machinery ----------

/** The smallest tree that satisfies every invariant. Mutate per test. */
function cleanFiles() {
  return {
    // L7's four verdict-bearing files, canonical two-valued enum
    '.claude/commands/review-changes.md':
      'Verdict: **PASS** or **CHANGES_REQUESTED**.\n',
    'engineering-team/roles/reviewer.md':
      'State the verdict plainly: **PASS** or **CHANGES_REQUESTED**.\n',
    'engineering-team/workflows/5-review.md':
      'Each review ends **PASS** or **CHANGES_REQUESTED**.\n',
    'engineering-team/templates/review-checklist.md':
      '## Verdict\n**PASS** | **CHANGES_REQUESTED**\n',
    // one healthy epic: story Done, review PASS, epic Done, book Closed
    'engineering-team/epics/foo.md': '# Epic: Foo\n\n**Status:** Done\n',
    'engineering-team/stories/foo/1-alpha.md':
      '# Story 1: alpha\n\n**Status:** Done\n',
    'engineering-team/reviews/foo/1-alpha.md':
      '# Review\n\n## Verdict\n**PASS** — all good.\n',
    'engineering-team/audits/foobook/book.md':
      '# Book\n\n**Status:** Closed\n\n## Epics in this book\n- `foo` — the epic\n',
    // orientation docs with only valid links; no Last-updated headers
    'CLAUDE.md': 'See [AGENTS.md](AGENTS.md).\n',
    'AGENTS.md': 'Discover the port here. Use `localhost:$TAPESTRY_PORT`.\n',
    'engineering-team/README.md': 'See [roles/reviewer.md](roles/reviewer.md).\n',
    'product-team/README.md': 'Product side.\n',
    // story 2 (ADR 0002): the ratified-change record + the shared def-path set.
    // The single fixture commit touches def paths AND the changelog, so L10 is
    // satisfied by construction for every story-1 fixture.
    'engineering-team/CHANGELOG.md':
      '# Harness Changelog\n\n| Date | Change | Why | Origin |\n|---|---|---|---|\n| 2026-07-02 | fixture seed | test | fixture |\n',
    'scripts/harness-def-paths.txt':
      '# harness-definition paths (fixture)\nengineering-team/roles\n.claude/commands\nengineering-team/CHANGELOG.md\nscripts/harness-def-paths.txt\n',
  };
}

/** Add a follow-up commit to an existing fixture (for L10's latest-commit checks). */
function addCommit(dir, files, msg = 'follow-up') {
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  execSync(
    `git add -A && git -c user.email=fixture@test -c user.name=fixture commit -qm '${msg}'`,
    { cwd: dir, shell: '/bin/bash' }
  );
}

function makeFixture(files, { git = true } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-lint-'));
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  if (git) {
    execSync(
      'git init -q && git add -A && ' +
        'git -c user.email=fixture@test -c user.name=fixture commit -qm fixture',
      { cwd: dir, shell: '/bin/bash' }
    );
  }
  return dir;
}

function lint(dir) {
  const res = spawnSync('bash', [SCRIPT], { cwd: dir, encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout || ''}${res.stderr || ''}` };
}

function withClean(mutations, opts) {
  return makeFixture({ ...cleanFiles(), ...mutations }, opts);
}

// ---------- tests ----------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('a fully consistent tree lints clean: exit 0 and a clean summary line', () => {
  const { code, out } = lint(withClean({}));
  assert.strictEqual(code, 0, `expected exit 0, got ${code}\n${out}`);
  assert.match(out, /clean/i, 'expected a clean summary line');
  assert.doesNotMatch(out, /VIOLATION/, 'clean tree must produce no violations');
});

test('L1: a PASS-final review whose story is not Done is a violation', () => {
  const { code, out } = lint(withClean({
    'engineering-team/stories/foo/1-alpha.md': '# Story 1\n\n**Status:** Approved\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L1 .*stories\/foo\/1-alpha/, out);
});

test('L1 last-verdict-wins: PASS earlier but CHANGES_REQUESTED final → story may stay open', () => {
  const { code, out } = lint(withClean({
    'engineering-team/stories/foo/1-alpha.md': '# Story 1\n\n**Status:** Approved\n',
    'engineering-team/reviews/foo/1-alpha.md':
      '# Review\n\n**PASS** (pre-smoke).\n\n### Revised verdict\n**CHANGES_REQUESTED** — smoke failed.\n',
  }));
  assert.strictEqual(code, 0, out);
  assert.doesNotMatch(out, /VIOLATION L1/, out);
});

test('L1 last-verdict-wins: CHANGES_REQUESTED earlier but PASS final → violation fires', () => {
  const { code, out } = lint(withClean({
    'engineering-team/stories/foo/1-alpha.md': '# Story 1\n\n**Status:** Approved\n',
    'engineering-team/reviews/foo/1-alpha.md':
      '# Review\n\n**CHANGES_REQUESTED** — fix X.\n\n### Re-review\n**PASS** — fixed.\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L1 .*stories\/foo\/1-alpha/, out);
});

test('L2: a Closed book listing an epic that is not Done is a violation', () => {
  const { code, out } = lint(withClean({
    'engineering-team/epics/foo.md': '# Epic: Foo\n\n**Status:** Active\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L2 .*foo/, out);
});

test('L3: an active story folder without an epic umbrella file is a violation', () => {
  const { code, out } = lint(withClean({
    'engineering-team/stories/bar/1-beta.md': '# Story 1\n\n**Status:** Done\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L3 .*stories\/bar/, out);
});

test('L4: a numbered review with no matching story is a violation (and not double-reported as L1)', () => {
  const { code, out } = lint(withClean({
    'engineering-team/reviews/foo/2-gamma.md': '# Review\n\n**PASS**.\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L4 .*reviews\/foo\/2-gamma/, out);
  assert.doesNotMatch(out, /VIOLATION L1 .*2-gamma/, 'L1 must skip stories L4 already flagged');
});

test('a non-numbered review is INFO, not a violation, and does not affect the exit code', () => {
  const { code, out } = lint(withClean({
    'engineering-team/reviews/foo/odd-one-out.md': '# Review\n\n**PASS**.\n',
  }));
  assert.strictEqual(code, 0, out);
  assert.match(out, /INFO non-numbered-review .*odd-one-out/, out);
});

test('L5: a hardcoded localhost port in a wiring file is a violation; $TAPESTRY_PORT is not', () => {
  const { code, out } = lint(withClean({
    'engineering-team/roles/reviewer.md':
      'Verdict: **PASS** or **CHANGES_REQUESTED**. API at `localhost:8877`.\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L5 .*roles\/reviewer\.md/, out);
});

test('L5 catches any literal port, not just 8877', () => {
  const { code, out } = lint(withClean({
    'engineering-team/workflows/5-review.md':
      'Each review ends **PASS** or **CHANGES_REQUESTED**. Probe `localhost:9999`.\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L5 .*workflows\/5-review\.md/, out);
});

test('L6: a machine-local absolute path in a wiring file is a violation', () => {
  const { code, out } = lint(withClean({
    '.claude/skills/cycle-x/SKILL.md': 'WT=/Users/somebody/repos/tapestry\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L6 .*cycle-x\/SKILL\.md/, out);
});

test('L7: a verdict-bearing file offering FAIL as a verdict is a violation', () => {
  const { code, out } = lint(withClean({
    '.claude/commands/review-changes.md':
      'Verdict: **PASS**, **FAIL**, or **CHANGES REQUESTED**.\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L7 .*review-changes\.md/, out);
});

test('L8: a dead relative link in an orientation/wiring file is a violation', () => {
  const { code, out } = lint(withClean({
    'CLAUDE.md': 'See [AGENTS.md](AGENTS.md) and [the missing doc](docs/NOPE.md).\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L8 .*CLAUDE\.md/, out);
  assert.match(out, /NOPE\.md/, 'the dead target should be named');
});

test('L9: a Last-updated header more than 14 days behind git history is a violation', () => {
  const { code, out } = lint(withClean({
    'BIBLE.md': '# BIBLE\n\n**Last updated:** 2020-01-01\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L9 .*BIBLE\.md/, out);
});

test('L12: a def-path row naming a file that does not exist is a violation naming the path (story test-hermeticity-ci #3 — the blind spot that hid the unshipped hook, OPEN.md row 20)', () => {
  const { code, out } = lint(withClean({
    'scripts/harness-def-paths.txt':
      '# harness-definition paths (fixture)\nengineering-team/roles\n.claude/commands\nengineering-team/CHANGELOG.md\nscripts/harness-def-paths.txt\nscripts/ghost-not-here.sh\n',
  }));
  assert.notStrictEqual(code, 0,
    `a def-path row whose file is missing must FAIL the lint — silently dropping it is how a gitignored enforcement artifact stayed invisible (OPEN.md row 20)\n${out}`);
  assert.match(out, /VIOLATION L12 .*ghost-not-here\.sh/,
    'the violation must name the missing path so the drift is actionable\n' + out);
});

test('L13: an active ADR missing the template-required ## Consequences section is a violation (harness-gate-integrity #1 / #46 — the build-audit §5 debt roll-up harvests that section)', () => {
  const { code, out } = lint(withClean({
    'engineering-team/decisions/foo/0001-thing.md':
      '# ADR 0001: thing\n\n**Status:** Accepted\n\n## Context\nx\n\n## Decision\ny\n',
  }));
  assert.notStrictEqual(code, 0,
    `an active ADR with no ## Consequences must FAIL the lint — templates/build-audit.md:42 harvests \`Consequences → new debt\`, so a missing section silently under-reports debt at book close\n${out}`);
  assert.match(out, /VIOLATION L13 .*decisions\/foo\/0001-thing\.md/,
    `the violation must name the offending ADR so it is actionable\n${out}`);
});

test('L13 scope A (active-only): an active ADR WITH ## Consequences is clean, and a retired ADR under decisions/done/ WITHOUT it does NOT fire (mirrors the check_reviews/check_L2 done/-skip)', () => {
  const { code, out } = lint(withClean({
    'engineering-team/decisions/foo/0001-thing.md':
      '# ADR 0001: thing\n\n**Status:** Accepted\n\n## Decision\ny\n\n## Consequences\n- enables x.\n',
    'engineering-team/decisions/done/bar/0001-old.md':
      '# ADR 0001: old\n\n**Status:** Superseded\n\n## Decision\nz\n',
  }));
  assert.strictEqual(code, 0,
    `L13 must pass when active ADRs carry ## Consequences and must NOT scan the retired done/ tree (scope A)\n${out}`);
  assert(!/VIOLATION L13/.test(out),
    `L13 must not fire on a done/ ADR — active-only scope, consistent with check_reviews (:94) and check_L2 (:130)\n${out}`);
});

test('L8/#21: check_L8 does not crash on a tree with zero wiring/link-doc files under bash 3.2 (empty `${files[@]}` under set -u)', () => {
  // The empty-array-under-`set -u` error only occurs on bash < 4.4 (macOS ships
  // /bin/bash 3.2); bash >= 4.4 tolerates it, so reproduce on the oldest bash.
  const OLD_BASH = '/bin/bash';
  let ver = '';
  try { ver = execSync(`${OLD_BASH} -c 'echo "$BASH_VERSION"'`, { encoding: 'utf8' }).trim(); } catch { ver = ''; }
  const [major, minor] = ver.split('.').map((n) => parseInt(n, 10));
  const pre44 = ver && (major < 4 || (major === 4 && (minor || 0) < 4));
  if (!pre44) {
    console.log(`      (note) ${OLD_BASH} is ${ver || 'unavailable'} — the #21 crash only reproduces on bash <4.4; the length-guard is verified structurally here`);
    return; // vacuously pass on modern bash (e.g. Linux CI)
  }
  const dir = makeFixture({ 'placeholder.txt': 'not a wiring or link-doc file\n' }); // zero wiring/link-doc files
  const res = spawnSync(OLD_BASH, [SCRIPT], { cwd: dir, encoding: 'utf8' });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  assert(!/unbound variable/.test(out),
    `check_L8 crashed on an empty wiring set under bash ${ver} (set -u + empty "\${files[@]}") — guard the expansion with the length-check precedent (violation():67, whats-open.sh:166):\n${out}`);
});

test('L9 is skipped silently when the tree has no git history', () => {
  const { code, out } = lint(withClean(
    { 'BIBLE.md': '# BIBLE\n\n**Last updated:** 2020-01-01\n' },
    { git: false }
  ));
  assert.strictEqual(code, 0, out);
  assert.doesNotMatch(out, /VIOLATION L9/, out);
});

test('a waiver suppresses its violation visibly, with the citation, and restores exit 0', () => {
  const dir = withClean({
    'engineering-team/stories/foo/1-alpha.md': '# Story 1\n\n**Status:** Approved\n',
    'scripts/harness-lint-waivers.txt':
      'L1\tengineering-team/stories/foo/1-alpha.md\tOPEN.md row 99 (test)\n',
  });
  const { code, out } = lint(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /WAIVED L1 .*1-alpha/, out);
  assert.match(out, /OPEN\.md row 99/, 'the waiver citation must be printed');
});

test('a waiver that matches nothing is flagged STALE-WAIVER (non-fatal)', () => {
  const dir = withClean({
    'scripts/harness-lint-waivers.txt':
      'L1\tengineering-team/stories/foo/999-nothing.md\tOPEN.md row 99 (test)\n',
  });
  const { code, out } = lint(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /STALE-WAIVER .*999-nothing/, out);
});

test('L10: the latest commit touching a def path without touching the CHANGELOG is a violation', () => {
  const dir = withClean({});
  addCommit(dir, {
    'engineering-team/roles/reviewer.md':
      'Verdict: **PASS** or **CHANGES_REQUESTED**. Amended rule.\n',
  }, 'harness change without changelog');
  const { code, out } = lint(dir);
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L10 commit:[0-9a-f]+/, out);
});

test('L10 is quiet when the same commit touches both the def path and the CHANGELOG', () => {
  const dir = withClean({});
  addCommit(dir, {
    'engineering-team/roles/reviewer.md':
      'Verdict: **PASS** or **CHANGES_REQUESTED**. Amended rule.\n',
    'engineering-team/CHANGELOG.md':
      '# Harness Changelog\n\n| Date | Change | Why | Origin |\n|---|---|---|---|\n| 2026-07-02 | fixture seed | test | fixture |\n| 2026-07-02 | amended rule | test | fixture |\n',
  }, 'harness change with changelog row');
  const { code, out } = lint(dir);
  assert.strictEqual(code, 0, out);
  assert.doesNotMatch(out, /VIOLATION L10/, out);
});

test('L10: a missing CHANGELOG.md (while def paths exist) is itself a violation', () => {
  const files = { ...cleanFiles() };
  delete files['engineering-team/CHANGELOG.md'];
  const { code, out } = lint(makeFixture(files));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L10 engineering-team\/CHANGELOG\.md/, out);
});

test('L10 waiver: a commit:<sha> waiver suppresses the violation visibly', () => {
  const dir = withClean({
    'scripts/harness-lint-waivers.txt':
      'L10\tcommit:*\tOPEN.md row 99 (test) — historical commit predates the convention\n',
  });
  addCommit(dir, {
    'engineering-team/roles/reviewer.md':
      'Verdict: **PASS** or **CHANGES_REQUESTED**. Amended rule.\n',
  }, 'harness change without changelog');
  const { code, out } = lint(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /WAIVED L10 commit:[0-9a-f]+/, out);
});

test('L10 is skipped silently when the tree has no git history', () => {
  const files = { ...cleanFiles() };
  delete files['engineering-team/CHANGELOG.md'];   // would violate if checked
  // Fixture reconciliation (story test-hermeticity-ci #3): L12 now rightly
  // flags def-path rows whose file is missing, so this git-gate fixture must
  // not LIST the deliberately-deleted changelog — L10's own missing-changelog
  // branch still would-fire-if-checked (def paths remain non-empty).
  files['scripts/harness-def-paths.txt'] =
    '# harness-definition paths (fixture)\nengineering-team/roles\n.claude/commands\nscripts/harness-def-paths.txt\n';
  const { code, out } = lint(makeFixture(files, { git: false }));
  assert.strictEqual(code, 0, out);
  assert.doesNotMatch(out, /VIOLATION L10/, out);
});

test('L10 reports INFO and skips when the def-paths data file is missing', () => {
  const files = { ...cleanFiles() };
  delete files['scripts/harness-def-paths.txt'];
  const dir = makeFixture(files);
  addCommit(dir, {
    'engineering-team/roles/reviewer.md':
      'Verdict: **PASS** or **CHANGES_REQUESTED**. Amended rule.\n',
  }, 'harness change, no def-path file');
  const { code, out } = lint(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /INFO .*harness-def-paths/, out);
  assert.doesNotMatch(out, /VIOLATION L10/, out);
});

// ---------- L11: line budgets (story 7, ADR 0007) ----------
// scripts/harness-budgets.txt caps the always-loaded files (CLAUDE.md,
// AGENTS.md) at their post-restructure sizes. Over-cap → violation quoting the
// R-S4 rule; at-cap → clean (exact caps, no headroom — gate decision 1);
// missing budgets file → INFO skip (L10's missing-def-file semantics). The
// shared cleanFiles() tree deliberately has NO budgets file, so every
// pre-existing fixture doubles as the missing-file path.

test('L11: a file over its line budget is a violation naming the cap; a file exactly at its cap is not', () => {
  const { code, out } = lint(withClean({
    'scripts/harness-budgets.txt':
      '# line budgets (fixture): <path>\\t<max-lines>\nCLAUDE.md\t2\nAGENTS.md\t1\n',
    'CLAUDE.md': 'one\ntwo\nthree\nfour\nfive\n', // 5 lines, cap 2 → violation
    // AGENTS.md stays the 1-line cleanFiles() default: exactly at cap 1 → clean
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L11 CLAUDE\.md/, out);
  assert.match(out, /5 lines.*cap 2/, 'message must name the measured count and the cap\n' + out);
  assert.match(out, /harness-budgets\.txt/, 'message must point at the rule source\n' + out);
  assert.doesNotMatch(out, /VIOLATION L11 AGENTS\.md/, 'at-cap is not over-cap\n' + out);
});

test('L11 reports INFO and skips when the budgets data file is missing', () => {
  const { code, out } = lint(withClean({}));
  assert.strictEqual(code, 0, out);
  assert.match(out, /INFO .*harness-budgets/, out);
  assert.doesNotMatch(out, /VIOLATION L11/, out);
});

test('the real repo declares budgets for CLAUDE.md and AGENTS.md, and both hold', () => {
  const budgets = fs.readFileSync(path.join(REPO_ROOT, 'scripts', 'harness-budgets.txt'), 'utf8');
  for (const name of ['CLAUDE.md', 'AGENTS.md']) {
    const row = budgets.split('\n').find((l) => l.startsWith(`${name}\t`));
    assert.ok(row, `no budget row for ${name}`);
    const cap = parseInt(row.split('\t')[1], 10);
    assert.ok(Number.isInteger(cap) && cap > 0, `unparseable cap for ${name}: ${row}`);
    const lines = fs.readFileSync(path.join(REPO_ROOT, name), 'utf8').split('\n').length - 1;
    assert.ok(lines <= cap, `${name} is ${lines} lines, over its declared cap ${cap}`);
  }
});

test('the script needs no network or stack: it succeeds with no env beyond PATH/HOME', () => {
  const res = spawnSync('bash', [SCRIPT], {
    cwd: withClean({}),
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: process.env.HOME },
  });
  assert.strictEqual(res.status, 0, `${res.stdout}${res.stderr}`);
});

test('the real repo lints clean (violations fixed or waived with citations)', () => {
  const { code, out } = lint(REPO_ROOT);
  assert.strictEqual(code, 0, `real repo not lint-clean:\n${out}`);
});

// ---------- L14: verdict-vocabulary hygiene (harness-gate-integrity #2, ADR 0002) ----------
// Gate history must not live in judge-read artifacts. Active-path stories,
// decisions, and epics may not carry the two known leak shapes — (i) a
// `Supersedes` reference bearing a verdict token, (ii) gate/round history
// bearing KICK_BACK/CHANGES_REQUESTED — with inline-code and fenced-code
// MENTIONS exempt (an artifact about the mechanism names tokens in backticks),
// and done/ + stories/_intake.md excluded (grandfather by location).
// Calibration bar: the real repo is L14-silent with zero waivers.

test('L14: a bare Supersedes+verdict line in an active story is a violation', () => {
  const { code, out } = lint(withClean({
    'engineering-team/stories/foo/2-beta.md':
      '# Story 2: beta\n\n**Status:** Approved\n\n**Supersedes:** round 1 — KICK_BACK at Gate 1.\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L14 .*stories\/foo\/2-beta/, out);
});

test('L14: gate/round history with a verdict token in an active ADR is a violation', () => {
  const { code, out } = lint(withClean({
    'engineering-team/decisions/foo/0001-thing.md':
      '# ADR 0001: thing\n\n**Status:** Accepted\n\n## Context\nThis epic already spent two rounds: Gate 2 KICK_BACK, then rework.\n\n## Decision\ny\n\n## Consequences\n- x.\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L14 .*decisions\/foo\/0001-thing/, out);
});

test('L14: an epic file accumulating verdict history is a violation (the Gate-1 channel)', () => {
  const { code, out } = lint(withClean({
    'engineering-team/epics/foo.md':
      '# Epic: Foo\n\n**Status:** Done\n\n## Stories\n\n1. alpha — Round 2 after a KICK_BACK at Gate 3.\n',
  }));
  assert.strictEqual(code, 1, out);
  assert.match(out, /VIOLATION L14 .*epics\/foo\.md/, out);
});

test('L14 mention-vs-use: backticked tokens and fenced blocks are exempt', () => {
  const { code, out } = lint(withClean({
    'engineering-team/stories/foo/2-beta.md':
      '# Story 2: beta\n\n**Status:** Approved\n\nThe `Supersedes: … KICK_BACK` form is the leak shape this story bans.\n\n```\nSupersedes: round 1 — KICK_BACK (fenced example)\n```\n',
  }));
  assert.strictEqual(code, 0, out);
  assert.doesNotMatch(out, /VIOLATION L14/, out);
});

test('L14 narrowness: a bare token outside both shapes does not fire — even beside substring-hazard words like "Background"', () => {
  const { code, out } = lint(withClean({
    'engineering-team/stories/foo/2-beta.md':
      '# Story 2: beta\n\n**Status:** Approved\n\nBackground: the KICK_BACK vocabulary is discussed here in isolation.\n',
  }));
  assert.strictEqual(code, 0, out);
  assert.doesNotMatch(out, /VIOLATION L14/,
    '"Background" contains the substring "round" — shape (ii) must require a standalone gate/round word\n' + out);
});

test('L14 scope: done/ paths and stories/_intake.md are exempt (grandfather by location)', () => {
  const { code, out } = lint(withClean({
    'engineering-team/stories/done/old/1-x.md':
      '# Story 1\n\n**Status:** Done\n\n**Supersedes:** round 1 — KICK_BACK.\n',
    'engineering-team/stories/_intake.md':
      '# Intake\n\nProposal about the Supersedes KICK_BACK leak shape, bare on purpose.\n',
  }));
  assert.strictEqual(code, 0, out);
  assert.doesNotMatch(out, /VIOLATION L14/, out);
});

test('L14 waiver: routes through the standard waiver machinery', () => {
  const { code, out } = lint(withClean({
    'engineering-team/stories/foo/2-beta.md':
      '# Story 2: beta\n\n**Status:** Approved\n\n**Supersedes:** round 1 — KICK_BACK at Gate 1.\n',
    'scripts/harness-lint-waivers.txt':
      'L14\tengineering-team/stories/foo/2-beta.md\tOPEN.md row 99 (test)\n',
  }));
  assert.strictEqual(code, 0, out);
  assert.match(out, /WAIVED L14 .*2-beta/, out);
});

test('L14 exists and the real repo is L14-silent with zero waivers (corpus-silence calibration bar)', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.match(src, /check_L14/, 'check_L14 must exist in scripts/harness-lint.sh');
  const { out } = lint(REPO_ROOT);
  assert.doesNotMatch(out, /VIOLATION L14/, 'the shipped corpus must be L14-silent\n' + out);
  assert.doesNotMatch(out, /WAIVED L14/, 'corpus silence must not be waiver-bought\n' + out);
});

// ---------- AC-4: partial-read instruction phrasing is extinct (ADR 0002) ----------

test('the harness definition no longer instructs judges to read "the acceptance frame section only" — pinned commands instead', () => {
  const director = fs.readFileSync(path.join(REPO_ROOT, 'engineering-team', 'roles', 'director.md'), 'utf8');
  assert.doesNotMatch(director, /the instruction to read \*the acceptance frame section only\*/,
    'director.md still carries the stop-at-a-section instruction phrasing (:83) — ADR 0002 replaces it with the pinned frame-read command');
  assert.match(director, /pinned frame-read command/,
    'director.md must name the pinned frame-read command in the every-gate spawn-prompt item');
});

// ---------- L15: ledger ids (ledger-row-identity #1, ADR ledger-row-identity/0001) ----------
// A ledger row's id has one of two homes: a number in OPEN.md's table, which is frozen
// where it stands, or a date+slug id that is the name of a file under ledger/. L15 checks
// (a) no id twice in the table, (b) nothing in the table above the freeze marker, (c) every
// row file is named by a well-formed id and carries its header fields. The OPEN.md these
// fixtures use (helpers/ledgerFixtures.js) has the real file's shape — a second table in
// the preamble, notes between chunks of rows, pipes inside cells — because a reader that
// takes every `|` line for a row, or reads any cell but the first, fails on the real ledger.
// See engineering-team/stories/ledger-row-identity/1-collision-free-ledger-row-ids.test-plan.md

/** The L15 lines of a lint run. Failure messages lead with them: the runner prints a message's first line only. */
function l15(out) {
  const lines = out.split('\n').filter((l) => /\bL15\b/.test(l));
  return lines.length ? lines.join(' ⏎ ') : '(no L15 line in the output)';
}
const GOOD_ID = '2026-09-01-agent-worktrees-outlive-books';
// ADR 0001 § "The rule": "Whole id at most 64 characters." Two words, so only the length differs.
const ID_OF_64 = `2026-09-01-boundary-${'x'.repeat(44)}`;
const ID_OF_65 = `2026-09-01-boundary-${'x'.repeat(45)}`;
const OLD_RULE_ROW = tableRow(10, 'minted under the old rule, from a prompt copied before the freeze', { type: 'meta', status: 'OPEN' });

test('L15: a ledger shaped like the real one is clean — a second table in the preamble, notes between chunks of rows, ids out of order, a gap, a row that quotes another row\'s id cell, and three well-formed row files (one closed with a note after DONE, one with an id of exactly 64 characters)', () => {
  const { code, out } = lint(withClean({
    'OPEN.md': ledgerDoc(REAL_SHAPE_ROWS, { frozenAt: 9, notes: [NOTE_LINE] }),
    [`ledger/${GOOD_ID}.md`]: rowFile(GOOD_ID),
    'ledger/2026-09-02-closed-with-a-note.md': rowFile('2026-09-02-closed-with-a-note', {
      type: 'cleanup', status: 'DONE (2026-09-03, PR #1)', done: '2026-09-03 (PR #1)',
    }),
    [`ledger/${ID_OF_64}.md`]: rowFile(ID_OF_64),
  }));
  assert.strictEqual(ID_OF_64.length, 64);
  assert.strictEqual(code, 0, `got: ${l15(out)} — nothing here breaks the rule: every id in the Items table is a number, used once, no higher than the marker's 9, and the three row files are well formed (one id is exactly 64 characters long)\n${out}`);
  assert.doesNotMatch(out, /(VIOLATION|WAIVED) L15/, `got: ${l15(out)}`);
  assert.doesNotMatch(out, /INFO .*L15/, `got: ${l15(out)} — the freeze marker is present, so L15(b) must run, not skip`);
});

test('L15(a): an id that appears more than once in the table is a violation that names the id — every such id (ledger-row-identity #1 AC-4)', () => {
  const rows = [
    ...REAL_SHAPE_ROWS,
    tableRow(4242, 'a finding', { status: 'OPEN' }),
    tableRow(4242, 'a different finding, minted in parallel from the same "highest plus one"', { type: 'meta', status: 'OPEN' }),
    tableRow(5150, 'once'), tableRow(5150, 'twice'), tableRow(5150, 'three times'),
  ];
  const { code, out } = lint(withClean({ 'OPEN.md': ledgerDoc(rows, { frozenAt: 5150 }) }));
  assert.strictEqual(code, 1, `got exit ${code}: ${l15(out)} — two rows are numbered 4242 and three are numbered 5150; a duplicated id must fail the lint\n${out}`);
  for (const id of ['4242', '5150']) {
    assert.match(out, new RegExp(`VIOLATION L15 OPEN\\.md .*\\b${id}\\b`), `got: ${l15(out)} — the violation must name the duplicated id ${id}`);
  }
});

test('L15(a) needs no freeze marker: a duplicated id is a violation in a ledger that was never frozen', () => {
  const rows = [...REAL_SHAPE_ROWS, tableRow(4242, 'a finding'), tableRow(4242, 'another')];
  const { code, out } = lint(withClean({ 'OPEN.md': ledgerDoc(rows) }));
  assert.strictEqual(code, 1, `got exit ${code}: ${l15(out)}\n${out}`);
  assert.match(out, /VIOLATION L15 OPEN\.md .*\b4242\b/, `got: ${l15(out)}`);
});

for (const [where, doc] of [
  ['as the last row of the table', ledgerDoc([...REAL_SHAPE_ROWS, OLD_RULE_ROW], { frozenAt: 9 })],
  ['at the end of the file, below the marker', `${ledgerDoc(REAL_SHAPE_ROWS, { frozenAt: 9 })}${OLD_RULE_ROW}\n`],
]) {
  test(`L15(b): a numbered row above the frozen maximum, added ${where}, is a violation whose message says where a new row goes`, () => {
    const { code, out } = lint(withClean({ 'OPEN.md': doc }));
    assert.strictEqual(code, 1, `got exit ${code}: ${l15(out)} — row 10 was added to a table frozen at 9\n${out}`);
    const line = out.split('\n').find((l) => /^VIOLATION L15 OPEN\.md /.test(l) && /\b10\b/.test(l)) || '';
    assert.ok(line, `got: ${l15(out)} — the violation must name row 10`);
    assert.match(line, /highest-number=9/, `got: ${line} — the message must say where the table is frozen`);
    assert.match(line, /ledger\//, `got: ${line} — the message must send the session to ledger/, because a session working from an older prompt learns the rule from this line`);
  });
}

test('L15(b): a date+slug id inside the frozen table is a violation — a new row is a file, not a table line', () => {
  const rows = [...REAL_SHAPE_ROWS, tableRow(GOOD_ID, 'a new-style id, but appended to the table', { type: 'meta', status: 'OPEN' })];
  const { code, out } = lint(withClean({ 'OPEN.md': ledgerDoc(rows, { frozenAt: 9 }) }));
  assert.strictEqual(code, 1, `got exit ${code}: ${l15(out)}\n${out}`);
  assert.match(out, new RegExp(`VIOLATION L15 OPEN\\.md .*${GOOD_ID}`), `got: ${l15(out)} — the violation must name the row`);
});

test('L15(b) reports INFO and skips when OPEN.md has no freeze marker, the way L10 and L11 degrade', () => {
  const { code, out } = lint(withClean({ 'OPEN.md': ledgerDoc([...REAL_SHAPE_ROWS, OLD_RULE_ROW]) }));
  assert.strictEqual(code, 0, `got exit ${code}: ${l15(out)} — with no marker there is no frozen maximum to hold row 10 to\n${out}`);
  assert.match(out, /INFO .*L15\(b\).*skipped/, `got: ${l15(out)}`);
  assert.doesNotMatch(out, /VIOLATION L15/, `got: ${l15(out)}`);
});

const BAD_ROW_FILES = [
  ['a filename that is not a date+slug id', 'Row_One', {}],
  ['a number for a filename (the old rule, carried into the new home)', '344', {}],
  ['capital letters in the slug', '2026-09-01-Agent-Worktrees', {}],
  ['a slug of one word', '2026-09-01-oops', {}],
  ['a slug of seven words', '2026-09-01-one-two-three-four-five-six-seven', {}],
  ['an id of 65 characters (the rule allows 64)', ID_OF_65, {}],
  ['an Id field that names a different row', GOOD_ID, { id: '2026-09-01-some-other-finding' }],
  ['no Id field', GOOD_ID, { id: null }],
  ['no Type field', GOOD_ID, { type: null }],
  ['no Opened field', GOOD_ID, { opened: null }],
  ['an Opened field with no ISO date in it', GOOD_ID, { opened: 'sometime in the summer' }],
  ['no Status field', GOOD_ID, { status: null }],
  ['a Status that is neither OPEN nor DONE', GOOD_ID, { status: 'WIP' }],
];
for (const [what, name, over] of BAD_ROW_FILES) {
  test(`L15(c): a row file with ${what} is a violation that names the file`, () => {
    const rel = `ledger/${name}.md`;
    const { code, out } = lint(withClean({
      'OPEN.md': ledgerDoc(REAL_SHAPE_ROWS, { frozenAt: 9 }),
      [rel]: rowFile(name, over),
    }));
    assert.strictEqual(code, 1, `got exit ${code}: ${l15(out)} — ${rel} has ${what}\n${out}`);
    assert.ok(out.split('\n').some((l) => l.startsWith(`VIOLATION L15 ${rel} `)), `got: ${l15(out)} — want a line starting "VIOLATION L15 ${rel} "`);
  });
}

test('L15 waiver: routes through the standard waiver machinery', () => {
  const { code, out } = lint(withClean({
    'OPEN.md': ledgerDoc(REAL_SHAPE_ROWS, { frozenAt: 9 }),
    'ledger/2026-09-01-oops.md': rowFile('2026-09-01-oops'),
    'scripts/harness-lint-waivers.txt': 'L15\tledger/2026-09-01-oops.md\tOPEN.md row 99 (test)\n',
  }));
  assert.strictEqual(code, 0, `got exit ${code}: ${l15(out)}\n${out}`);
  assert.match(out, /WAIVED L15 ledger\/2026-09-01-oops\.md/, `got: ${l15(out)}`);
});

test('L15 exists and the real repo is L15-silent with zero waivers: no id twice, nothing above the freeze, every row file well formed (ledger-row-identity #1 AC-4)', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.match(src, /check_L15/, 'check_L15 must exist in scripts/harness-lint.sh');
  const { out } = lint(REPO_ROOT);
  assert.doesNotMatch(out, /VIOLATION L15/, `got: ${l15(out)} — the real ledger must hold the rule as this change leaves it`);
  assert.doesNotMatch(out, /WAIVED L15/, `got: ${l15(out)} — a duplicated id is settled, not waived`);
  assert.doesNotMatch(out, /INFO .*L15/, `got: ${l15(out)} — the real OPEN.md carries the freeze marker, so L15(b) runs`);
});

// ---------- L16: the table stays a table (ledger-row-identity follow-up) ----------
// OPEN.md's Items table rendered broken on GitHub for 67 days — 37 rows as a table, 305 as
// raw text — and nothing saw it, because every reader filters to `^|` lines and is
// deliberately layout-blind. L15 checks ids; L16 checks that the lines between the
// "| # |" header and the freeze marker are ALL rows, because anything else ends the
// rendered table. See ledger/2026-09-20-nothing-guards-table-contiguity.md.

/** The L16 lines of a lint run, for failure messages. */
function l16(out) {
  const lines = out.split('\n').filter((l) => /\bL16\b/.test(l));
  return lines.length ? lines.join(' ⏎ ') : '(no L16 line in the output)';
}

test('L16: a table whose rows are contiguous, with its notes below the freeze marker, is clean', () => {
  const { code, out } = lint(withClean({
    'OPEN.md': ledgerDoc(REAL_SHAPE_ROWS, { frozenAt: 9, notes: [NOTE_LINE, NOTE_LINE] }),
  }));
  assert.strictEqual(code, 0, `got: ${l16(out)} — every line between the header and the marker is a row here; the two notes sit below it, where the real ones now are\n${out}`);
  assert.doesNotMatch(out, /(VIOLATION|WAIVED|INFO).*L16/, `got: ${l16(out)}`);
});

const BREAKERS = [
  ['a blank line', ''],
  ['a numbering note', NOTE_LINE],
  ['a heading', '## Some heading'],
  ['a line of plain prose', 'A sentence that wandered into the table.'],
];
for (const [what, line] of BREAKERS) {
  test(`L16: ${what} between two rows is a violation that names the line number and says where it belongs`, () => {
    const rows = [...REAL_SHAPE_ROWS.slice(0, 4), line, ...REAL_SHAPE_ROWS.slice(4)];
    const doc = ledgerDoc(rows, { frozenAt: 9 });
    // Derived, not hard-coded: the breaker sits one line above the row that follows it.
    const at = doc.split('\n').indexOf(REAL_SHAPE_ROWS[4]);
    const { code, out } = lint(withClean({ 'OPEN.md': doc }));
    assert.strictEqual(code, 1, `got exit ${code}: ${l16(out)} — ${what} between rows ends the rendered table, and every row below it stops being a table row\n${out}`);
    const v = out.split('\n').find((l) => l.startsWith('VIOLATION L16 OPEN.md ')) || '';
    assert.ok(v, `got: ${l16(out)} — want a line starting "VIOLATION L16 OPEN.md "`);
    assert.match(v, new RegExp(`line ${at}\\b`), `got: ${v} — the message must name the line number of the first offender (${at} here), because the reader cannot see the break itself`);
    assert.match(v, /below the table|Numbering notes/, `got: ${v} — the message must say where such a line belongs`);
  });
}

test('L16 counts every offender but names the first: three breaks report one violation saying "and 2 more"', () => {
  const rows = [...REAL_SHAPE_ROWS.slice(0, 2), '', ...REAL_SHAPE_ROWS.slice(2, 4), NOTE_LINE, ...REAL_SHAPE_ROWS.slice(4, 5), '', ...REAL_SHAPE_ROWS.slice(5)];
  const { code, out } = lint(withClean({ 'OPEN.md': ledgerDoc(rows, { frozenAt: 9 }) }));
  assert.strictEqual(code, 1, `got exit ${code}: ${l16(out)}\n${out}`);
  assert.strictEqual(out.split('\n').filter((l) => l.startsWith('VIOLATION L16')).length, 1, `one violation per file, not one per line\n${out}`);
  assert.match(l16(out), /and 2 more/, `got: ${l16(out)} — the message must say how many other lines break it`);
});

test('L16 ignores everything outside the table: the preamble table, the prose above it, the freeze prose and the notes below the marker', () => {
  const doc = ledgerDoc(REAL_SHAPE_ROWS, { frozenAt: 9, notes: [NOTE_LINE] });
  assert.ok(doc.includes('## How to use this ledger') && doc.includes('| Kind of open work |'), 'the fixture must carry a preamble table and prose');
  const { code, out } = lint(withClean({ 'OPEN.md': doc }));
  assert.strictEqual(code, 0, `got: ${l16(out)} — only the lines between the Items header and the marker are the table\n${out}`);
});

test('L16 with no freeze marker: the table ends at its last row, and a break before it still fires', () => {
  const clean = lint(withClean({ 'OPEN.md': ledgerDoc(REAL_SHAPE_ROWS) }));
  assert.strictEqual(clean.code, 0, `an unfrozen but contiguous table is clean: ${l16(clean.out)}\n${clean.out}`);
  const rows = [...REAL_SHAPE_ROWS.slice(0, 4), '', ...REAL_SHAPE_ROWS.slice(4)];
  const doc = ledgerDoc(rows);
  const at = doc.split('\n').indexOf(REAL_SHAPE_ROWS[4]);
  const broken = lint(withClean({ 'OPEN.md': doc }));
  assert.strictEqual(broken.code, 1, `got exit ${broken.code}: ${l16(broken.out)} — no marker is not a reason to stop checking; the table ends at its last row\n${broken.out}`);
  assert.match(l16(broken.out), new RegExp(`line ${at}\\b`), `got: ${l16(broken.out)}`);
});

test('L16 says nothing about a tree with no OPEN.md at all', () => {
  const { code, out } = lint(withClean({}));
  assert.strictEqual(code, 0, out);
  assert.doesNotMatch(out, /L16/, `got: ${l16(out)} — most fixture trees have no ledger; L16 must be silent there, not INFO-noisy`);
});

test('L16 waiver: routes through the standard waiver machinery', () => {
  const rows = [...REAL_SHAPE_ROWS.slice(0, 4), '', ...REAL_SHAPE_ROWS.slice(4)];
  const { code, out } = lint(withClean({
    'OPEN.md': ledgerDoc(rows, { frozenAt: 9 }),
    'scripts/harness-lint-waivers.txt': 'L16\tOPEN.md\tOPEN.md row 99 (test)\n',
  }));
  assert.strictEqual(code, 0, `got exit ${code}: ${l16(out)}\n${out}`);
  assert.match(out, /WAIVED L16 OPEN\.md/, `got: ${l16(out)}`);
});

test('L15 and L16 are independent: a note between rows breaks the render but L15 still reads the ids correctly', () => {
  const rows = [...REAL_SHAPE_ROWS.slice(0, 4), NOTE_LINE, ...REAL_SHAPE_ROWS.slice(4), tableRow(4242, 'once'), tableRow(4242, 'twice')];
  const { out } = lint(withClean({ 'OPEN.md': ledgerDoc(rows, { frozenAt: 5150 }) }));
  assert.match(out, /VIOLATION L15 OPEN\.md .*\b4242\b/, `L15 must still name the duplicated id: ${l16(out)}\n${out}`);
  assert.doesNotMatch(out, /VIOLATION L15 OPEN\.md .*(Numbering note|renumbered)/, `the note is not a row, so L15 must not read an id out of it\n${out}`);
  assert.match(out, /VIOLATION L16 OPEN\.md /, `and L16 must fire on the same tree\n${out}`);
});

test('L16 exists and the real repo is L16-silent with zero waivers: OPEN.md\'s table is one table', () => {
  const src = fs.readFileSync(SCRIPT, 'utf8');
  assert.match(src, /check_L16/, 'check_L16 must exist in scripts/harness-lint.sh');
  const { out } = lint(REPO_ROOT);
  assert.doesNotMatch(out, /VIOLATION L16/, `got: ${l16(out)} — the real table must be contiguous`);
  assert.doesNotMatch(out, /WAIVED L16/, `got: ${l16(out)} — contiguity is not waiver-bought`);
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
