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
