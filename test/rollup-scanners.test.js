'use strict';
/**
 * Story rollup-scanner-fidelity #1 — the roll-up's scanners report what is there.
 * ADR rollup-scanner-fidelity/0001. See
 * engineering-team/stories/rollup-scanner-fidelity/1-scanners-report-what-is-there.test-plan.md
 *
 * Six defects, each measured on origin/staging a55b9631 (2026-09-20):
 *   1. `cut -c1-150` cuts by byte, so a line can come out as invalid UTF-8 (OPEN.md row 290).
 *   2. open-book ages use GNU `date -d`, which BSD/macOS `date` rejects outright (row 19's sibling).
 *   3. `collect-meta.sh` matches its intake markers unanchored, so `**NOT PICKED UP**` retires
 *      an entry — the bug `whats-open.sh` fixed on 2026-09-13 and its sibling did not.
 *   4. a marker that says work remains (`(partial)`, `(Part A)`, `(in progress)`) still retires
 *      the whole entry (row 208).
 *   5. `**DONE**` and `**REASSIGNED**` are not recognised as markers at all.
 *   6. a `###` sub-entry vanishes with its retired parent, silently.
 * Plus the closed-book carry-forward section, which prints an unbounded stale register.
 *
 * Pre-implementation every test here fails: scripts/lib/utf8-trim.sh and
 * scripts/lib/collect-intake.sh do not exist, and the two scanners still carry their own
 * copies of the rules above.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const {
  REPO_ROOT, runRollup, runDigest, inLib, inLibBytes,
  makeRepo, section, entry, intakeDoc, daysAgo,
} = require('./helpers/rollupFixtures');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/** Is this byte string valid UTF-8? */
function isUtf8(buf) {
  try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return true; } catch { return false; }
}

/** utf8_trim's answer for one string, as raw bytes. */
function trim(maxBytes, s) {
  const { code, out } = inLibBytes('utf8-trim.sh', `utf8_trim ${maxBytes} "$1"`, {});
  assert.strictEqual(code, 0, 'scripts/lib/utf8-trim.sh did not load — the lib ADR 0001 specifies is missing');
  return out;
}
/** utf8_trim with the string passed as $1 and the locale controlled. */
function trimIn(maxBytes, s, locale) {
  const env = locale === null
    ? { LC_ALL: '', LANG: '' }
    : { LC_ALL: locale, LANG: locale };
  const { spawnSync } = require('child_process');
  const res = spawnSync('bash', ['-c', '. scripts/lib/utf8-trim.sh; utf8_trim "$1" "$2"', 'x', String(maxBytes), s],
    { cwd: REPO_ROOT, env: { ...process.env, ...env } });
  assert.strictEqual(res.status, 0,
    `scripts/lib/utf8-trim.sh did not load or utf8_trim failed: ${res.stderr}`);
  return res.stdout;
}

// ---------- the trim (AC-1, AC-2, AC-3) ----------

const EM_DASH = '\u2014';            // 3 bytes: e2 80 94
const PARTY = '\u{1F389}';           // 4 bytes: f0 9f 8e 89

test('AC-1 a cut that lands inside a multi-byte character yields valid UTF-8, not a half character', () => {
  // 'a'*148 + em-dash: byte 149 is the dash's first byte, so a 150-byte cut splits it.
  const s = 'a'.repeat(148) + EM_DASH + 'tail';
  const got = trimIn(150, s, null);
  assert.ok(isUtf8(got), `utf8_trim emitted invalid UTF-8: ${got.toString('hex')}`);
  assert.ok(got.length <= 150, `the byte budget must hold; got ${got.length} bytes`);
  assert.strictEqual(got.toString('utf8'), 'a'.repeat(148),
    'the partial character must be dropped whole, leaving the 148 bytes before it');
});

test('AC-1 the answer is the same with no locale set, under LC_ALL=C, and under a UTF-8 locale', () => {
  const s = 'a'.repeat(148) + EM_DASH + 'tail';
  const bare = trimIn(150, s, null).toString('hex');
  const c = trimIn(150, s, 'C').toString('hex');
  const utf8 = trimIn(150, s, 'en_US.UTF-8').toString('hex');
  assert.strictEqual(c, bare, 'LC_ALL=C must not change the answer');
  assert.strictEqual(utf8, bare,
    'a UTF-8 locale must not change the answer either — GNU `cut -c` counts bytes under every locale, which is why the fix cannot be a locale (OPEN.md row 290 refinement (a))');
});

test('AC-3 a cut that lands exactly on a character boundary keeps that whole character', () => {
  const s = 'abc' + EM_DASH + 'def';            // bytes: 61 62 63 e2 80 94 64 65 66
  assert.strictEqual(trimIn(6, s, null).toString('utf8'), 'abc' + EM_DASH,
    'six bytes is exactly abc + the em-dash; a walk-back that fires unconditionally eats a complete character');
  assert.strictEqual(trimIn(5, s, null).toString('utf8'), 'abc',
    'five bytes splits the dash, so the dash goes');
});

test('AC-3 a string within the budget comes back whole, and an empty string is empty', () => {
  const s = 'abc' + EM_DASH + 'def';
  assert.strictEqual(trimIn(150, s, null).toString('utf8'), s, 'nothing to trim');
  assert.strictEqual(trimIn(150, '', null).toString('utf8'), '', 'an empty string trims to itself');
});

test('AC-1 a 4-byte character is never half-emitted, at any offset into it', () => {
  const s = 'ab' + PARTY + 'cd';                 // 61 62 f0 9f 8e 89 63 64
  for (const n of [2, 3, 4, 5]) {
    const got = trimIn(n, s, null);
    assert.ok(isUtf8(got), `cut at ${n} bytes gave invalid UTF-8: ${got.toString('hex')}`);
    assert.strictEqual(got.toString('utf8'), 'ab', `cut at ${n} bytes must drop the whole emoji`);
  }
  assert.strictEqual(trimIn(6, s, null).toString('utf8'), 'ab' + PARTY, 'six bytes is exactly ab + the emoji');
});

test('AC-2 on this repo\'s real OPEN.md, no line of META_LINES is invalid UTF-8 (row 193 is the one that fails today)', () => {
  const { code, out } = inLibBytes('collect-meta.sh',
    'collect_meta; printf "%s" "$META_LINES"', { cwd: REPO_ROOT });
  assert.strictEqual(code, 0, 'collect_meta failed');
  const bad = out.toString('latin1').split('\n')
    .map((l, i) => [i, Buffer.from(l, 'latin1')])
    .filter(([, b]) => b.length && !isUtf8(b));
  assert.deepStrictEqual(bad.map(([, b]) => b.toString('latin1').slice(0, 60)), [],
    `${bad.length} line(s) of the meta list are invalid UTF-8 — harmless to a terminal, fatal to a strict decoder (OPEN.md row 290)`);
});

// ---------- open-book ages (AC-4, AC-5) ----------

test('AC-4 an open book prints its opened date and a real age, on a `date` that rejects -d', () => {
  const dir = makeRepo({ open: [], books: [{ slug: 'ancient-book', status: 'Open', opened: '2020-01-01', closed: null }] });
  const { code, out } = runRollup(dir);
  assert.strictEqual(code, 0, out);
  const lines = section(out, 'Open books');
  assert.ok(lines.some((l) => /ancient-book \(opened 2020-01-01, \d{4,}d ago\)/.test(l)),
    `the open-books section must carry the age; got: ${JSON.stringify(lines)} — GNU \`date -d\` is the only converter here and macOS \`date\` answers "illegal option -- d", so no age has ever printed on a Mac (OPEN.md row 19 fixed the sibling in collect-meta.sh)`);
});

test('AC-5 an open book whose Opened line holds no date is still listed, without an age', () => {
  const dir = makeRepo({ open: [], books: [{ slug: 'undated-book', status: 'Open', opened: 'sometime in the spring', closed: null }] });
  const { code, out } = runRollup(dir);
  assert.strictEqual(code, 0, out);
  const lines = section(out, 'Open books');
  assert.ok(lines.some((l) => l.includes('undated-book')), `the book must still be listed; got: ${JSON.stringify(lines)}`);
  assert.ok(!lines.some((l) => /undated-book.*\dd ago/.test(l)), `no age may be invented; got: ${JSON.stringify(lines)}`);
});

// ---------- the intake marker grammar (AC-6 … AC-9) ----------

/** intake_entries' classification of a fixture file, as { heading: state }. */
function classify(intakeText) {
  const dir = makeRepo({ intake: intakeText });
  const { code, out } = inLib('collect-intake.sh', 'intake_entries', { cwd: dir });
  assert.strictEqual(code, 0,
    'scripts/lib/collect-intake.sh did not load — the one reader of _intake.md that ADR 0001 specifies is missing');
  const map = {};
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [state, , heading] = line.split('\t');
    map[heading] = state;
  }
  return map;
}

const MARKER_CASES = [
  ['**PICKED UP**', 'retired'],
  ['**PICKED UP** 2026-05-25 → `stories/x/1.md`', 'retired'],
  ['**PICKED UP 2026-05-25** — captured as story #27', 'retired'],
  ['**RESOLVED**', 'retired'],
  ['**RESOLVED** — shipped in `ffd0febb`', 'retired'],
  ['**DONE** 2026-07-17 — discharged by ADR 0003 D5', 'retired'],
  ['**REASSIGNED (2026-08-27)** — David is building it separately', 'retired'],
  ['**NOT PICKED UP** — parked deliberately', 'open'],
  ['**NOT PICKED UP.** Filed so it is not rediscovered', 'open'],
  ['**PICKED UP** (partial) → `epics/search-quality.md`', 'partial'],
  ['**PICKED UP** (Part A) → PR #222. **Part B still OPEN**', 'partial'],
  ['**PICKED UP** (in progress) — #31 Done; broader protocol drafted', 'partial'],
  ['**PICKED UP** (Tier 1–2; Tier 3–4 open) → two stories', 'partial'],
];

for (const [marker, want] of MARKER_CASES) {
  test(`AC-6/7/8/9 marker \`${marker.slice(0, 44)}\` classifies the entry as ${want}`, () => {
    const h = '2026-01-01 — A fixture entry';
    const got = classify(intakeDoc([entry(h, { marker })]));
    assert.strictEqual(got[`## ${h}`], want,
      `got "${got[`## ${h}`]}" for marker line: ${marker}`);
  });
}

test('AC-8 the word "partial" in prose after the marker does not make the entry partial (_intake.md:1847)', () => {
  const h = '2026-01-01 — A fully picked up entry';
  const marker = '**PICKED UP** 2026-08-04 → book `engineering-team/audits/blinding-rebuild/book.md` ' +
    '(epic `harness-gate-integrity` reactivation, story #2). Scope note at pickup: the "frame-only ' +
    'reads" bullet is partially delivered by the 2026-08-04 ratification.';
  const got = classify(intakeDoc([entry(h, { marker })]));
  assert.strictEqual(got[`## ${h}`], 'retired',
    'the qualifier must sit in the marker\'s own parenthetical, in the first 60 characters — otherwise every entry whose prose says "partially" reopens');
});

test('AC-6 both readers agree: a `— Meta:` entry marked **NOT PICKED UP** is counted by the digest', () => {
  const h = '2026-01-01 — Meta: a lesson nobody has acted on';
  const dir = makeRepo({ intake: intakeDoc([entry(h, { marker: '**NOT PICKED UP** — still open' })]) });
  const { code, out } = runDigest(dir);
  assert.strictEqual(code, 0, out);
  assert.match(out, /meta inbox: 1 open|META ESCALATION — 1 open/,
    `got "${(out.split('\n').find((l) => /meta inbox|META ESCALATION/.test(l)) || '').trim()}" — collect-meta.sh matches PICKED UP unanchored, so **NOT PICKED UP** retires the entry; whats-open.sh fixed exactly this on 2026-09-13 and the sibling was left\n${out}`);
});

test('AC-6 both readers agree on this repo\'s real _intake.md: nothing whose marker starts **NOT is retired', () => {
  const { code, out } = inLib('collect-intake.sh', 'intake_entries', { cwd: REPO_ROOT });
  assert.strictEqual(code, 0, 'scripts/lib/collect-intake.sh did not load');
  const raw = fs.readFileSync(path.join(REPO_ROOT, 'engineering-team', 'stories', '_intake.md'), 'utf8').split('\n');
  const wrong = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [state, lineNo, heading] = line.split('\t');
    if (state !== 'retired') continue;
    // The marker the reader used sits below the heading; a **NOT … line must never be one.
    const body = raw.slice(Number(lineNo), Number(lineNo) + 8).find((l) => /^\*\*NOT /.test(l));
    if (body) wrong.push(heading);
  }
  assert.deepStrictEqual(wrong, [], `entries retired by a **NOT … line: ${JSON.stringify(wrong)}`);
});

test('AC-7 the real entry that says "Part B still OPEN" in its own marker is listed as partly picked up', () => {
  const { code, out } = inLib('collect-intake.sh', 'intake_entries', { cwd: REPO_ROOT });
  assert.strictEqual(code, 0, 'scripts/lib/collect-intake.sh did not load');
  const row = out.split('\n').find((l) => l.includes('per-task `forceKill: false` overrides'));
  assert.ok(row, 'the 2026-05-25 forceKill entry is gone from _intake.md — if it was fully resolved, retire this assertion with it');
  assert.strictEqual(row.split('\t')[0], 'partial',
    'its marker reads "**PICKED UP** (Part A) … **Part B still OPEN**" and it has been invisible to every roll-up since 2026-07-02');
});

test('AC-7 a partly picked up entry is listed by /whats-open, under its own heading', () => {
  const partial = '2026-01-01 — Half-built thing';
  const done = '2026-01-02 — Finished thing';
  const dir = makeRepo({
    intake: intakeDoc([
      entry(partial, { marker: '**PICKED UP** (Part A) → PR #1. **Part B still OPEN**' }),
      entry(done, { marker: '**PICKED UP** → PR #2' }),
    ]),
  });
  const { code, out } = runRollup(dir);
  assert.strictEqual(code, 0, out);
  assert.ok(out.includes(partial), `the partly picked up entry must appear somewhere in the roll-up:\n${out}`);
  assert.ok(!out.includes(done), `a fully picked up entry must not be listed:\n${out}`);
  assert.match(out, /partly picked up|partly|Partly/,
    'the roll-up must say these entries are partly picked up, not lump them in with untouched ones');
});

// ---------- nested sub-entries (AC-10, AC-11) ----------

test('AC-10 a retired entry that still carries ### sub-headings is named in a warning, with them', () => {
  const h = '2026-01-01 — A parent that swallowed its children';
  const dir = makeRepo({
    intake: intakeDoc([entry(h, { marker: '**RESOLVED** → shipped', sub: ['An untriaged security note', 'A second concern'] })]),
  });
  const { code, out } = runRollup(dir);
  assert.strictEqual(code, 0, out);
  assert.ok(out.includes(h),
    `the roll-up must name the retired entry that still holds ### blocks; a ### block under a marked parent is invisible to every reader, which is how a security note was lost:\n${out}`);
  assert.ok(out.includes('An untriaged security note') && out.includes('A second concern'),
    `both sub-headings must be named:\n${out}`);
});

test('AC-11 a retired entry with no ### blocks, and an open entry with them, raise no warning', () => {
  const clean = '2026-01-01 — A clean retired entry';
  const openOne = '2026-01-02 — An open entry with structure';
  const dir = makeRepo({
    intake: intakeDoc([
      entry(clean, { marker: '**RESOLVED** → shipped' }),
      entry(openOne, { sub: ['Findings', 'Feature list'] }),
    ]),
  });
  const { code, out } = runRollup(dir);
  assert.strictEqual(code, 0, out);
  assert.ok(!out.includes(clean), `a cleanly retired entry must raise nothing:\n${out}`);
  assert.ok(!out.includes('Findings'),
    `an OPEN entry's sub-headings are not a loss — the entry itself is already listed:\n${out}`);
});

// ---------- the closed-book carry-forward section (AC-12) ----------

const carryBooks = (n, dayStep = 1) => Array.from({ length: n }, (_, i) => ({
  slug: `book-${String(i).padStart(2, '0')}`,
  status: 'Closed',
  opened: daysAgo(200),
  closed: daysAgo(1 + i * dayStep),
  carry: [`item one of book ${i}`, `item two of book ${i}`],
}));

test('AC-12 the section lists at most WHATS_OPEN_CARRY_BOOKS books and says what it suppressed', () => {
  const dir = makeRepo({ books: carryBooks(12) });
  const { code, out } = runRollup(dir);
  assert.strictEqual(code, 0, out);
  const lines = section(out, 'carry-forward');
  const listed = lines.filter((l) => /^\s{2}book-\d\d:/.test(l));
  assert.ok(listed.length > 0 && listed.length <= 8,
    `the section must be bounded at 8 books by default; it listed ${listed.length}: ${JSON.stringify(listed)}`);
  assert.ok(lines.some((l) => /\b12\b/.test(l) && /\b24\b/.test(l)),
    `one line must state the true totals — 12 books, 24 unticked items — so nothing is silently hidden; got: ${JSON.stringify(lines)}`);
  assert.ok(listed[0] && listed[0].includes('book-00'),
    `the most recently closed book must come first; got: ${JSON.stringify(listed)}`);
});

test('AC-12 a book closed outside the recency window is suppressed, and the window is named', () => {
  const dir = makeRepo({
    books: [
      { slug: 'recent-book', status: 'Closed', opened: daysAgo(200), closed: daysAgo(5), carry: ['a live carry-forward'] },
      { slug: 'ancient-book', status: 'Closed', opened: daysAgo(900), closed: daysAgo(400), carry: ['an ancient carry-forward'] },
    ],
  });
  const { code, out } = runRollup(dir);
  assert.strictEqual(code, 0, out);
  const lines = section(out, 'carry-forward');
  assert.ok(lines.some((l) => l.includes('recent-book')), `the recent book must be listed; got: ${JSON.stringify(lines)}`);
  assert.ok(!lines.some((l) => l.includes('an ancient carry-forward')),
    `a book closed 400 days ago is outside the 90-day window; got: ${JSON.stringify(lines)}`);
  assert.ok(lines.some((l) => /90/.test(l)),
    `the section must name the window that suppressed it; got: ${JSON.stringify(lines)}`);
});

test('AC-12 a book whose close date cannot be read is listed, never suppressed', () => {
  const dir = makeRepo({
    books: [{ slug: 'undated-close', status: 'Closed', opened: daysAgo(400), closed: null, carry: ['an undated carry-forward'] }],
  });
  const { code, out } = runRollup(dir);
  assert.strictEqual(code, 0, out);
  const lines = section(out, 'carry-forward');
  assert.ok(lines.some((l) => l.includes('an undated carry-forward')),
    `the section must not hide a book it failed to date — fail open; got: ${JSON.stringify(lines)}`);
});

test('AC-12 WHATS_OPEN_CARRY_DAYS and WHATS_OPEN_CARRY_BOOKS widen the section beyond its defaults', () => {
  const dir = makeRepo({ books: carryBooks(12) });
  const bookLines = (o) => section(o, 'carry-forward').filter((l) => /^\s{2}book-\d\d:/.test(l));
  const dflt = runRollup(dir);
  const wide = runRollup(dir, { WHATS_OPEN_CARRY_BOOKS: '12', WHATS_OPEN_CARRY_DAYS: '365' });
  assert.strictEqual(dflt.code, 0, dflt.out);
  assert.strictEqual(wide.code, 0, wide.out);
  assert.strictEqual(bookLines(wide.out).length, 12,
    `a session that asks for the whole register must get it; got ${bookLines(wide.out).length}`);
  assert.ok(bookLines(dflt.out).length < bookLines(wide.out).length,
    `the override must actually widen something — the default run listed ${bookLines(dflt.out).length} of 12 books and the widened run ${bookLines(wide.out).length}; equal counts mean no budget is being applied at all`);
});

test('AC-13 6-book-close.md tells a closer to tick a §6 item when it is resolved elsewhere', () => {
  const wf = fs.readFileSync(path.join(REPO_ROOT, 'engineering-team', 'workflows', '6-book-close.md'), 'utf8');
  assert.match(wf, /tick/i,
    'the carry-forward register rots because nothing ever ticks an item: 359 unticked items across 55 closed books on 2026-09-20');
  assert.match(wf, /resolved elsewhere|elsewhere/i,
    'the rule must name the case it exists for — an item closed by some other book or row');
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
