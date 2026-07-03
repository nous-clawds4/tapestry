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
  };
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
