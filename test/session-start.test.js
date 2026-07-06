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
