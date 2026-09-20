'use strict';
/**
 * Fixture repos for the two scanners that tell a session what is open — the
 * `/whats-open` roll-up (`scripts/whats-open.sh`) and the session-start digest
 * (`scripts/session-start.sh`, via `scripts/lib/collect-meta.sh`). Shared by
 * test/session-start.test.js and test/rollup-scanners.test.js, so "run the roll-up
 * offline in a throwaway repo" is written down once.
 *
 * Story rollup-scanner-fidelity #1, ADR rollup-scanner-fidelity/0001.
 */

const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const ROLLUP = path.join(REPO_ROOT, 'scripts', 'whats-open.sh');
const DIGEST = path.join(REPO_ROOT, 'scripts', 'session-start.sh');

let ghStubDir = null;

/**
 * A PATH with a `gh` that fails at once shadowing the real one: the roll-up prints
 * "(gh error)" and carries on, and a fixture has no `origin`, so its `git fetch` fails
 * just as fast. Nothing leaves the machine.
 */
function offlineEnv(extra = {}) {
  if (!ghStubDir) {
    ghStubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rollup-gh-stub-'));
    fs.writeFileSync(path.join(ghStubDir, 'gh'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  }
  return { ...process.env, ...extra, PATH: `${ghStubDir}${path.delimiter}${process.env.PATH}` };
}

/** Run the full roll-up in a fixture repo, offline. */
function runRollup(cwd, env = {}) {
  const res = spawnSync('bash', [ROLLUP], { cwd, encoding: 'utf8', env: offlineEnv(env) });
  return { code: res.status, out: `${res.stdout || ''}${res.stderr || ''}` };
}

/** Run the session-start digest in a fixture repo. */
function runDigest(cwd) {
  const res = spawnSync('bash', [DIGEST], { cwd, encoding: 'utf8' });
  return { code: res.status, out: `${res.stdout || ''}${res.stderr || ''}` };
}

/**
 * Source a lib from this repo's scripts/lib and run one line of bash against it.
 * The lib path is absolute and `cwd` is the directory the code runs IN — the libs read
 * cwd-relative paths, so a fixture repo is a legitimate cwd. Returns raw stdout.
 */
function libPath(lib) { return path.join(REPO_ROOT, 'scripts', 'lib', lib); }

function inLib(lib, script, { cwd = REPO_ROOT, env = {} } = {}) {
  const res = spawnSync('bash', ['-c', `. "${libPath(lib)}"; ${script}`],
    { cwd, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 16 * 1024 * 1024 });
  return { code: res.status, out: res.stdout || '', err: res.stderr || '' };
}

/** As inLib, but keeps stdout as raw bytes — for asserting on UTF-8 validity. */
function inLibBytes(lib, script, { cwd = REPO_ROOT, env = {} } = {}) {
  const res = spawnSync('bash', ['-c', `. "${libPath(lib)}"; ${script}`],
    { cwd, env: { ...process.env, ...env }, maxBuffer: 16 * 1024 * 1024 });
  return { code: res.status, out: res.stdout || Buffer.alloc(0) };
}

/** A book.md, in the shape the audits folder really uses. `closed: null` leaves the line out. */
function bookDoc({ slug, status = 'Closed', opened = '2026-06-01', closed = '2026-06-10' }) {
  const closedLine = closed === null ? '' : `**Closed:** ${closed}\n`;
  return `# Book of Work: ${slug}\n\n**Slug:** ${slug}\n**Status:** ${status}\n` +
    `**Opened:** ${opened}\n${closedLine}\n## Intent anchor\n\nFixture.\n`;
}

/** An audit.md whose §6 carry-forward register holds the given unticked items. */
function auditDoc(items) {
  const bullets = items.map((t) => `- [ ] ${t}`).join('\n');
  return `# Build audit\n\n## 5. Something else\n\n- [x] ticked elsewhere\n\n` +
    `## 6. Carry-forward register\n\n${bullets}\n\n## 7. After\n\n- [ ] not a carry-forward\n`;
}

/**
 * A throwaway git repo carrying just the surfaces a test needs.
 *
 *   open    — rows of the OPEN.md table (the file is written whenever this is given)
 *   intake  — raw text for engineering-team/stories/_intake.md
 *   books   — [{ slug, status, opened, closed, carry: [item, …] }]; `carry` writes audit.md
 *   ledger  — { '<id>': '<file text>' } under ledger/
 */
function makeRepo({ open = null, intake = null, books = [], ledger = null } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rollup-fixture-'));
  execSync('git init -q', { cwd: dir, shell: '/bin/bash' });
  if (open !== null) {
    fs.writeFileSync(path.join(dir, 'OPEN.md'),
      '# Open Items Ledger\n\n## Items\n\n| # | Type | Item | Opened | Status | Done | Pointer |\n' +
      '|---|---|---|---|---|---|---|\n' + open.join('\n') + '\n');
  }
  if (intake !== null) {
    fs.mkdirSync(path.join(dir, 'engineering-team', 'stories'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'engineering-team', 'stories', '_intake.md'), intake);
  }
  for (const b of books) {
    const bd = path.join(dir, 'engineering-team', 'audits', b.slug);
    fs.mkdirSync(bd, { recursive: true });
    fs.writeFileSync(path.join(bd, 'book.md'), bookDoc(b));
    if (b.carry) fs.writeFileSync(path.join(bd, 'audit.md'), auditDoc(b.carry));
  }
  if (ledger) {
    fs.mkdirSync(path.join(dir, 'ledger'), { recursive: true });
    for (const [id, text] of Object.entries(ledger)) {
      fs.writeFileSync(path.join(dir, 'ledger', `${id}.md`), text);
    }
  }
  return dir;
}

/**
 * The lines of one roll-up section, between its rule and the next. `match` is a substring
 * of the section's heading. Returns [] when the section is absent, so a test can say so
 * in its own words.
 */
function section(out, match) {
  const lines = out.split('\n');
  const start = lines.findIndex((l) => l.startsWith('────────') && l.includes(match));
  if (start < 0) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('────────'));
  return rest.slice(0, end < 0 ? rest.length : end).filter((l) => l.trim() !== '');
}

/** An intake entry, as _intake.md writes them: heading, optional marker, body. */
function entry(heading, { marker = null, body = 'Some body text.', sub = [] } = {}) {
  const subs = sub.map((s) => `### ${s}\n\nBody of ${s}.\n`).join('\n');
  return `## ${heading}\n\n${marker ? marker + '\n\n' : ''}${body}\n\n${subs}`;
}

/** An _intake.md made of entries. */
const intakeDoc = (entries) => `# Intake\n\nPreamble.\n\n${entries.join('\n')}\n`;

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

module.exports = {
  REPO_ROOT, ROLLUP, DIGEST,
  offlineEnv, runRollup, runDigest, inLib, inLibBytes, libPath,
  makeRepo, bookDoc, auditDoc, section, entry, intakeDoc, daysAgo,
};
