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

// ---------- (b2) Direction-mode gate outcomes (harness-gate-integrity #2, ADR 0002) ----------
// The blinding rebuild makes journals the SOLE store of gate history, so the
// instrument must read them or Direction rework stays invisible (store-and-show
// scored "kick-back rate 0" against a journal holding 8 KICK_BACKs). Contract:
// a "Direction-mode gate outcomes" section tallies `**Decision:**` lines per
// journal-bearing book (APPROVE/KICK_BACK/ANSWER/HALT/INFO); journalless books
// are absent, zero-decision journals print all-zero counts, exit 0 always.

/** Structure-bounded section extraction — never byte windows (OPEN.md #109). */
function sectionOf(out, title) {
  const lines = out.split('\n');
  const start = lines.findIndex((l) => l.includes(title));
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /────────/.test(l));
  return rest.slice(0, end === -1 ? rest.length : end).join('\n');
}

function journalFixture() {
  const dir = seedFixture();
  writeTree(dir, {
    'engineering-team/audits/newbook/journal.md': [
      '# Journal',
      '## 2026-06-02T01:00:00Z — Gate 1',
      '**Decision:** APPROVE',
      '## 2026-06-02T02:00:00Z — Gate 2',
      '**Decision:** KICK_BACK',
      '## 2026-06-02T03:00:00Z — Gate 2 re-judge',
      '**Decision:** APPROVE',
      '## 2026-06-02T04:00:00Z — a question answered',
      '**Decision:** ANSWER',
      '## 2026-06-02T05:00:00Z — deadline trip',
      '**Decision:** HALT',
      '## 2026-06-02T06:00:00Z — note',
      '**Decision:** INFO',
      '',
    ].join('\n'),
  });
  commitAt(dir, 'journal: gate decisions (fixture)', '2026-06-02');
  return dir;
}

test('(b2) per-book gate tally from journal Decision lines, with controlled counts', () => {
  const { code, out } = stats(journalFixture());
  assert.strictEqual(code, 0, out);
  const sec = sectionOf(out, 'Direction-mode gate outcomes');
  assert.ok(sec !== null, 'a "Direction-mode gate outcomes" section must exist\n' + out);
  assert.match(sec, /newbook: APPROVE 2 · KICK_BACK 1 · ANSWER 1 · HALT 1 · INFO 1/, sec);
});

test('(b2) books without a journal are absent from the section, not zero-filled', () => {
  const { out } = stats(journalFixture());
  const sec = sectionOf(out, 'Direction-mode gate outcomes');
  assert.ok(sec !== null, 'section must exist\n' + out);
  assert.doesNotMatch(sec, /oldbook/, 'journalless books must not appear in (b2)\n' + sec);
});

test('(b2) a journal with zero Decision lines prints all-zero counts and the script still exits 0', () => {
  const dir = seedFixture();
  writeTree(dir, { 'engineering-team/audits/newbook/journal.md': '# Journal\n\nno decisions yet\n' });
  commitAt(dir, 'journal: empty (fixture)', '2026-06-02');
  const { code, out } = stats(dir);
  assert.strictEqual(code, 0, out);
  const sec = sectionOf(out, 'Direction-mode gate outcomes');
  assert.ok(sec !== null, 'section must exist even with an empty journal\n' + out);
  assert.match(sec, /newbook: APPROVE 0 · KICK_BACK 0 · ANSWER 0 · HALT 0 · INFO 0/, sec);
});

test('(b2) real repo: the store-and-show tally is exact (frozen history) and the summary carries direction gates', () => {
  const { code, out } = stats(REPO_ROOT);
  assert.strictEqual(code, 0, out.slice(-2000));
  const sec = sectionOf(out, 'Direction-mode gate outcomes');
  assert.ok(sec !== null, 'section must exist in the real-repo run\n' + out.slice(-2000));
  assert.match(sec, /store-and-show-the-prompt-and-the-estimate: APPROVE 17 · KICK_BACK 8 · ANSWER 5 · HALT 3 · INFO 15/,
    'the store-and-show tally must match its journal exactly (counted directly 2026-08-04)\n' + sec);
  assert.match(out, /direction gates — approve: \d+ · kick-back: \d+ · halt: \d+/,
    'the summary block must carry the direction-gate line\n' + out.slice(-2000));
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
