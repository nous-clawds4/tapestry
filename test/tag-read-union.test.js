/**
 * Tests for Story 1 (epic: tag-federation) — tag read-union over local + dcosl.
 *
 * ADR: engineering-team/decisions/tag-federation/0001-tag-read-union-local-and-dcosl.md
 *
 * Intentionally failing until the read-union lands. Hand-rolled in the project's
 * existing test style — no new framework.
 *
 * Levels:
 *   - BEHAVIORAL-UNIT: `federatedScan` (with injectable local/remote scanners),
 *     `dlistFetch` (config-driven graceful path), and `dedupeReplaceable` —
 *     all required to be exported "for tests" (ADR testability; same pattern as
 *     prior stories).
 *   - SOURCE-CONTRACT: the visibility read handlers union via federatedScan, not
 *     bare strfryScan; the search/meili path is left untouched (AC-7).
 *
 * The local scan execs `strfry` (absent on host) so federatedScan is tested via
 * injected scanners, never the real binary.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..');
const SRC = 'src/api/profile-tags/index.js';

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg} — got ${JSON.stringify(a)}, expected ${JSON.stringify(b)}`);
}
function readSrc(rel) { return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf-8'); }

const tests = [];
function t(name, fn) { tests.push([name, fn]); }

let mod = null;
function loadMod() {
  if (mod) return mod;
  mod = require('../src/api/profile-tags/index.js');
  return mod;
}

const ev = (id, kind, pubkey, dTag, createdAt, z) => ({
  id, kind, pubkey, created_at: createdAt,
  tags: [['d', dTag], ['z', z || '39998:TA:tag']],
});

/* ─── dedupe core (AC-5) ─── */

t('dedupeReplaceable is exported and collapses a replaceable present in both sources (latest wins)', () => {
  const m = loadMod();
  assert(typeof m.dedupeReplaceable === 'function',
    'dedupeReplaceable must be exported from profile-tags for unit testing (ADR testability)');
  const older = ev('id-old', 39999, 'pkA', 'slug-x', 100);
  const newer = ev('id-new', 39999, 'pkA', 'slug-x', 200); // same (kind,pubkey,d) → replaceable dup
  const other = ev('id-z', 39999, 'pkB', 'slug-y', 150);
  const out = m.dedupeReplaceable([older, other, newer]);
  assertEqual(out.length, 2, 'the replaceable pair collapses to one; the distinct event survives');
  const kept = out.find((e) => e.pubkey === 'pkA');
  assertEqual(kept.created_at, 200, 'the latest created_at wins for the collapsed replaceable');
});

/* ─── federatedScan: union + dedupe + graceful (AC-1, AC-4, AC-5) ─── */

t('federatedScan is exported and accepts injectable local/remote scanners', () => {
  const m = loadMod();
  assert(typeof m.federatedScan === 'function',
    'federatedScan must be exported (ADR: the read-union seam, with injectable scanners for tests)');
});

t('AC-1: federatedScan unions local strfry results with the DList-relay results', async () => {
  const m = loadMod();
  const local = [ev('L1', 39999, 'pk1', 'a', 100)];
  const remote = [ev('R1', 39999, 'pk2', 'b', 100)];
  const out = await m.federatedScan({ kinds: [39999] }, {
    localScan: async () => local,
    remoteScan: async () => remote,
  });
  const ids = out.map((e) => e.id).sort();
  assert(ids.includes('L1') && ids.includes('R1'),
    `federatedScan must return events from BOTH sources; got ${JSON.stringify(ids)}`);
});

t('AC-5: federatedScan dedupes a replaceable present in both local and remote', async () => {
  const m = loadMod();
  const dup = (id, ts) => ev(id, 39999, 'pkA', 'slug-dup', ts);
  const out = await m.federatedScan({ kinds: [39999] }, {
    localScan: async () => [dup('local', 100)],
    remoteScan: async () => [dup('remote', 200)],
  });
  const forPk = out.filter((e) => e.pubkey === 'pkA');
  assertEqual(forPk.length, 1, 'a replaceable in both sources must appear once after federatedScan');
  assertEqual(forPk[0].created_at, 200, 'latest created_at wins across sources');
});

t('AC-4: federatedScan degrades to local-only when the remote source fails', async () => {
  const m = loadMod();
  const local = [ev('L1', 39999, 'pk1', 'a', 100)];
  const out = await m.federatedScan({ kinds: [39999] }, {
    localScan: async () => local,
    remoteScan: async () => { throw new Error('dlist relay unreachable'); },
  });
  assertEqual(out.length, 1, 'remote failure must not fail the read — union degrades to local');
  assertEqual(out[0].id, 'L1', 'local results survive a remote failure');
});

t('federatedScan still rejects when the LOCAL scan fails (do not mask a broken local read)', async () => {
  const m = loadMod();
  let threw = false;
  try {
    await m.federatedScan({ kinds: [39999] }, {
      localScan: async () => { throw new Error('local strfry broken'); },
      remoteScan: async () => [],
    });
  } catch { threw = true; }
  assert(threw, 'a local-scan failure must propagate (only the remote leg is swallowed)');
});

/* ─── dlistFetch: graceful + config-driven (AC-4) ─── */

t('dlistFetch is exported and returns [] (never throws) when no DList relay is configured', async () => {
  const m = loadMod();
  assert(typeof m.dlistFetch === 'function', 'dlistFetch must be exported (ADR testability)');
  // With injectable relay list = [] (no DList relay), it must short-circuit to [].
  const out = await m.dlistFetch({ kinds: [39999] }, { relays: [] });
  assert(Array.isArray(out) && out.length === 0,
    'dlistFetch with no configured DList relay must return [] (degrade to local), never throw');
});

/* ─── source-contract: visibility handlers union; search path untouched ─── */

t('AC-1 (wiring): the visibility read paths scan via federatedScan, not bare strfryScan', () => {
  const src = readSrc(SRC);
  // findTagsByNameSubstring is the canonical tag-element visibility scan (#z:[TAG_Z_TAG]).
  const fn = src.match(/async function findTagsByNameSubstring[\s\S]*?\n\}/);
  assert(fn, 'could not locate findTagsByNameSubstring');
  assert(/federatedScan\s*\(/.test(fn[0]),
    'findTagsByNameSubstring must use federatedScan for its tag-element scan (so DList tags surface)');
  // aggregateProfilesTagged drives the /tags index aggregation.
  const agg = src.match(/async function aggregateProfilesTagged[\s\S]*?\n\}/);
  assert(agg, 'could not locate aggregateProfilesTagged');
  assert(/federatedScan\s*\(/.test(agg[0]),
    'aggregateProfilesTagged must use federatedScan for its assertion scan (AC-1/AC-2)');
});

t('AC-7: the search/meili tag-match path is NOT changed to federate (search gate untouched)', () => {
  // The meili proxy must remain as-is; federation lives in profile-tags reads only.
  const meili = readSrc('src/api/search/profiles/meili/index.js');
  assert(!/federatedScan/.test(meili),
    'the meili search proxy must not be wired to federatedScan — search stays gated/unchanged (AC-7)');
});

/* ─── Run ─── */
async function run() {
  console.log('\n--- tag read-union tests (epic tag-federation, Story 1) ---');
  let pass = 0, fail = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  PASS  ${name}`); pass++; }
    catch (err) { console.log(`  FAIL  ${name}\n        ${err.message}`); failures.push({ name, message: err.message }); fail++; }
  }
  console.log(`\ntag-read-union: ${pass} passed, ${fail} failed`);
  return { pass, fail, failures };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
