/**
 * Story harness-self-improvement #5: harness-stats — the retro runs on
 * measurement, not anecdote. ADR 0005 (harness-self-improvement). See
 * engineering-team/stories/harness-self-improvement/5-harness-stats.test-plan.md
 *
 * ADR 0005 chose Option A: scripts/harness-stats.sh derives (a) phase-commit
 * counts, (b) review verdicts via the SHARED last-token parser
 * (scripts/lib/review-verdict.awk, also consumed by harness-lint — resolved
 * script-relative via BASH_SOURCE so fixture cwds don't break it), (c) book
 * throughput from audits/<slug>/book.md dates, and (d) story cycle times by
 * kebab-slug matching against commit subjects with an HONEST coverage line
 * ("matched N of M stories" — unmatched stories counted, never dropped).
 * The script ALWAYS exits 0: it is an instrument, not a gate.
 *
 * Fixtures use GIT_AUTHOR_DATE/GIT_COMMITTER_DATE to control commit
 * timestamps, so cycle-time and duration math is deterministic. The script
 * does not exist pre-implementation, so every test fails now (spawn of a
 * missing script) and passes once built; the real-repo smoke additionally
 * pins the summary-block contract.
 */

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const REPO_ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'harness-stats.sh');

// ---------- fixture machinery ----------

function writeTree(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
}

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-stats-'));
  execSync('git init -q', { cwd: dir, shell: '/bin/bash' });
  return dir;
}

/** Commit everything staged + new, with a controlled timestamp. */
function commitAt(dir, msg, isoDate) {
  execSync(
    `git add -A && git -c user.email=f@t -c user.name=f commit -q --allow-empty -m '${msg}'`,
    {
      cwd: dir, shell: '/bin/bash',
      env: { ...process.env, GIT_AUTHOR_DATE: `${isoDate}T12:00:00Z`, GIT_COMMITTER_DATE: `${isoDate}T12:00:00Z` },
    }
  );
}

function stats(dir) {
  const res = spawnSync('bash', [SCRIPT], { cwd: dir, encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout || ''}${res.stderr || ''}` };
}

/** A small but complete harness tree: 2 epics, 3 reviews, 2 books, 2 stories. */
function seedFixture() {
  const dir = makeRepo();
  writeTree(dir, {
    'engineering-team/epics/foo.md': '# Epic: Foo\n\n**Status:** Active\n',
    'engineering-team/epics/bar.md': '# Epic: Bar\n\n**Status:** Active\n',
    'engineering-team/stories/foo/1-alpha-widget.md': '# Story 1\n\n**Status:** Done\n',
    'engineering-team/stories/foo/9-never-mentioned.md': '# Story 9\n\n**Status:** Done\n',
    // verdicts: one clean PASS, one PASS→CR (CR-final), a churn pair on #3
    'engineering-team/reviews/foo/1-alpha-widget.md':
      '# Review\n\n## Verdict\n**PASS** — clean.\n',
    'engineering-team/reviews/foo/2-beta.md':
      '# Review\n\n**PASS** (pre-smoke).\n\n### Revised verdict\n**CHANGES_REQUESTED** — smoke failed.\n',
    'engineering-team/reviews/foo/3-gamma.md':
      '# Review\n\n**CHANGES_REQUESTED** — fix X.\n',
    'engineering-team/reviews/foo/3-gamma-amended.md':
      '# Re-review\n\n## Verdict\n**PASS** — fixed.\n',
    // books: one Closed (10d), one Open
    'engineering-team/audits/done/oldbook/book.md':
      '# Book\n\n**Status:** Closed\n**Opened:** 2026-01-01\n**Closed:** 2026-01-11\n',
    'engineering-team/audits/newbook/book.md':
      '# Book\n\n**Status:** Open\n**Opened:** 2026-06-01\n**Closed:** —\n',
  });
  commitAt(dir, 'story: alpha-widget (foo #1)', '2026-02-01');
  commitAt(dir, 'impl: alpha-widget (foo #1)', '2026-02-03');
  commitAt(dir, 'review: alpha-widget — PASS (foo #1)', '2026-02-04');
  commitAt(dir, 'story: something for bar (bar #1)', '2026-02-05');
  commitAt(dir, 'chore: unrelated non-phase commit', '2026-02-06');
  return dir;
}

// ---------- tests ----------

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('the script always exits 0 — even in an empty, git-less directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-stats-empty-'));
  const { code, out } = stats(dir);
  assert.strictEqual(code, 0, out);
});

test('phase commits are counted per prefix, with per-epic attribution and an unattributed bucket', () => {
  const { code, out } = stats(seedFixture());
  assert.strictEqual(code, 0, out);
  assert.match(out, /story:\s*2\b/, out);       // alpha-widget + bar story
  assert.match(out, /impl:\s*1\b/, out);
  assert.match(out, /review:\s*1\b/, out);
  assert.match(out, /foo\b.*3|foo:\s*3/, out);  // 3 foo-attributed phase commits
  assert.match(out, /bar\b.*1|bar:\s*1/, out);
});

test('review verdicts use the shared last-token rule: PASS-final and CR-final both classified', () => {
  const { code, out } = stats(seedFixture());
  assert.strictEqual(code, 0, out);
  // 4 review files: 1-alpha PASS, 2-beta CR-final, 3-gamma CR, 3-gamma-amended PASS
  assert.match(out, /final PASS:\s*2\b/, out);
  assert.match(out, /final CHANGES_REQUESTED:\s*2\b/, out);
  assert.match(out, /kick-back rate:\s*50%/, out);
});

test('re-review churn counts story numbers with more than one review file', () => {
  const { out } = stats(seedFixture());
  assert.match(out, /churn.*:\s*1\b/i, 'story #3 has two review files\n' + out);
});

test('book throughput: closed-book duration is exact; open-book age is reported', () => {
  const { out } = stats(seedFixture());
  assert.match(out, /oldbook.*10d/, out);            // 2026-01-01 → 2026-01-11
  assert.match(out, /newbook.*\d+d/, out);           // age vs today — format-pinned
  assert.match(out, /open:\s*1\b/i, out);
  assert.match(out, /closed:\s*1\b/i, out);
});

test('cycle time: story→review elapsed from controlled timestamps, and the coverage line is honest', () => {
  const { out } = stats(seedFixture());
  assert.match(out, /alpha-widget.*3d/, '2026-02-01 → 2026-02-04 is 3 days\n' + out);
  assert.match(out, /matched 1 of 2 stories/, '9-never-mentioned must count in the denominator\n' + out);
});

test('a summary block closes the report (the paste-into-the-retro unit)', () => {
  const { out } = stats(seedFixture());
  assert.match(out, /──── summary ────/, out);
  assert.match(out, /kick-back rate/, out);
});

test('the real repo: runs, exits 0, prints the summary block', () => {
  const { code, out } = stats(REPO_ROOT);
  assert.strictEqual(code, 0, out.slice(-2000));
  assert.match(out, /──── summary ────/, out.slice(-2000));
  assert.match(out, /matched \d+ of \d+ stories/, out.slice(-2000));
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
