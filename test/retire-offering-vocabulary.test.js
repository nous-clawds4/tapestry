/**
 * shared-concepts-seeding #2 — retire "offering"; there is only shared, and
 * didn't-reach.
 * Story: engineering-team/stories/shared-concepts-seeding/2-retire-the-offering-vocabulary.md
 * (Refactor — Architecture skipped; the names were settled with the owner.)
 *
 * The owner ruled on 2026-08-06 that the "auto-b but don't publish" half-state
 * is dropped. The "offering" vocabulary resurrected it as a page title, naming
 * a category the product deliberately does not support. This suite is the
 * standing guard that it stays retired.
 *
 * Division of labour: test/shared-by-me.test.js asserts the BEHAVIOUR is
 * unchanged (story AC-9) and deliberately discovers the names it is agnostic
 * about. THIS suite owns the constraint on what those names may be.
 *
 *   V1..V8 — the vocabulary: both page names, the three row states, no third
 *            noun, the retired stem absent from user-readable strings (V6),
 *            the retired PAGE NAMES absent everywhere including comments
 *            (V6b), and the internal surface clean (V8).
 *   R1     — regression: the tri-state itself is untouched (the values were
 *            always right; only the middle one's LABEL overreached).
 *
 * EXPECTED NOW (pre-implementation): V1–V8 FAIL; R1 PASSES (it guards what must
 * NOT change).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHARED_CONCEPTS_DIR = path.join(ROOT, 'ui/src/pages/shared-concepts');
const LAYOUT_JSX = path.join(ROOT, 'ui/src/components/Layout.jsx');
const APP_JSX = path.join(ROOT, 'ui/src/App.jsx');
const CONCEPT_DETAIL_JSX = path.join(ROOT, 'ui/src/pages/concepts/ConceptDetail.jsx');
const OUTCOME_LIB = path.join(ROOT, 'src/lib/broadcastOutcome.js');
const SHARING_STATE_LIB = path.join(ROOT, 'src/lib/sharingState.js');
const API_DIR = path.join(ROOT, 'src/api/concept');
const API_INDEX_JS = path.join(ROOT, 'src/api/index.js');

// The retired stem. `offer`, `offers`, `offered`, `offering`, `Offerings`…
const RETIRED = /offer(s|ed|ing|ings)?\b/i;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function ls(dir) { try { return fs.readdirSync(dir); } catch { return []; } }
/** Lines of a file that match the retired stem, as "n: text" for the message. */
function retiredHits(file) {
  const src = safeRead(file);
  if (!src) return [];
  return src.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => RETIRED.test(l))
    .map(([n, l]) => `${path.basename(file)}:${n}: ${l.trim().slice(0, 90)}`);
}
/** The page component App.jsx routes a given path to. */
function pageFor(routePath) {
  const app = safeRead(APP_JSX) || '';
  const m = app.match(new RegExp(`path:\\s*['"\`]${routePath}['"\`][^}]*element:\\s*<(\\w+)`));
  if (!m) return null;
  const imp = app.match(new RegExp(`import ${m[1]} from '([^']+)'`));
  return imp ? safeRead(path.join(ROOT, 'ui/src', imp[1].replace(/^\.\//, '') + '.jsx')) : null;
}

// ═══ V — the vocabulary ════════════════════════════════════════════════

test('V1 (AC-1): the page listing what THIS instance has put out is named for sharing', () => {
  const page = pageFor('mine');
  assert(page, "App.jsx must route 'mine' to a findable page component");
  const h1 = page.match(/<h1>([^<]*)<\/h1>/);
  assert(h1, 'the page must have an <h1>');
  assert(/shared/i.test(h1[1]), `the heading must be named for sharing — got ${JSON.stringify(h1[1])}`);
  assert(!RETIRED.test(h1[1]), `the heading must not use the retired vocabulary — got ${JSON.stringify(h1[1])}`);
});

test('V2 (AC-2): the page listing what OTHER instances have put out is named for sharing too, and the two pair', () => {
  const page = pageFor('self-declared');
  assert(page, "App.jsx must route 'self-declared' to a findable page component");
  const h1 = page.match(/<h1>([^<]*)<\/h1>/);
  assert(h1 && /shared/i.test(h1[1]) && !RETIRED.test(h1[1]),
    `the heading must be named for sharing and free of the retired word — got ${JSON.stringify(h1 && h1[1])}`);

  const layout = safeRead(LAYOUT_JSX) || '';
  const navLabels = [...layout.matchAll(/shared-concepts\/(mine|self-declared)',\s*label:\s*'([^']+)'/g)].map((m) => m[2]);
  assert(navLabels.length === 2, `both nav entries must exist — found ${JSON.stringify(navLabels)}`);
  assert(navLabels.every((l) => /shared/i.test(l)),
    `the two nav labels must read as a pair, both named for sharing — got ${JSON.stringify(navLabels)}`);
  assert(navLabels.every((l) => !RETIRED.test(l)),
    `neither nav label may use the retired vocabulary — got ${JSON.stringify(navLabels)}`);
});

test('V3 (AC-4): a share that did not reach the relay reads as a FAILURE with a retry, not as a category', () => {
  const page = pageFor('mine');
  assert(page, 'the page is missing');
  assert(/did ?n[o']?t reach|failed to reach/i.test(page),
    'the middle state must say it did not REACH the community (story AC-4) — a resting-state phrasing like "declared here" names a category the owner dropped on 2026-08-06');
  assert(/again|retry/i.test(page), 'that failure must offer a retry — it is a problem to fix');
  assert(!/not yet sent|declared here/i.test(page),
    'the retired resting-state phrasing must be gone');
});

test('V4 (AC-5): the unconfirmed state survives and stays distinct from the failure', () => {
  const page = pageFor('mine');
  assert(page, 'the page is missing');
  assert(/unconfirmed|could not (be )?confirm/i.test(page),
    'a relay that could not be reached must still read as unconfirmed — it is not the same as a failed send');
});

test('V5 (AC-6): no third noun — the outcome copy DESCRIBES the local half rather than naming it', () => {
  const src = safeRead(OUTCOME_LIB);
  assert(src, 'src/lib/broadcastOutcome.js is missing');
  const strings = [...src.matchAll(/'([^']{20,})'/g)].map((m) => m[1]);
  assert(strings.length >= 6, `expected the six outcome strings, found ${strings.length}`);
  const offending = strings.filter((s) => RETIRED.test(s));
  assert(offending.length === 0,
    `no outcome message may use the retired vocabulary — found ${JSON.stringify(offending)}`);
  // A "third noun" would be a new capitalised category for declared-but-unsent.
  const named = strings.filter((s) => /\b(Declaration|Declarations|Pending|Draft|Drafts)\b/.test(s));
  assert(named.length === 0,
    `the local half must be described, not named — found what looks like a new category noun in ${JSON.stringify(named)}`);
});

test('V6 (AC-7): no user-facing STRING in this feature uses the retired vocabulary', () => {
  // Comments are excluded on purpose. "offered" appears in ordinary English in
  // unrelated comments (AdoptionQueue's picker note, TrustedDictionary's
  // snapshot note); forcing those to be reworded would be scope this story did
  // not ask for. What must be clean is what a USER can read — strings and JSX
  // text. Retired PAGE NAMES are caught everywhere, comments included, by V6b.
  const files = ls(SHARED_CONCEPTS_DIR).filter((f) => f.endsWith('.jsx')).map((f) => path.join(SHARED_CONCEPTS_DIR, f));
  files.push(CONCEPT_DETAIL_JSX, OUTCOME_LIB);
  const hits = [];
  for (const file of files) {
    const src = safeRead(file);
    if (!src) continue;
    src.split('\n').forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, '').replace(/^\s*\*.*$/, '').replace(/\/\*.*?\*\//g, '');
      if (RETIRED.test(code)) hits.push(`${path.basename(file)}:${i + 1}: ${code.trim().slice(0, 90)}`);
    });
  }
  assert(hits.length === 0,
    `no user-readable string may use the retired vocabulary — ${hits.length} hit(s):\n      ${hits.join('\n      ')}`);
});

test('V6b (AC-7): the retired PAGE NAMES appear nowhere at all — comments included', () => {
  // A comment naming a page that no longer exists is the rot the previous
  // vocabulary pass had to sweep twice. Caught here, everywhere.
  const RETIRED_NAMES = /My Offerings|Community Offerings|MyOfferings/;
  const roots = [
    ...ls(SHARED_CONCEPTS_DIR).filter((f) => f.endsWith('.jsx')).map((f) => path.join(SHARED_CONCEPTS_DIR, f)),
    CONCEPT_DETAIL_JSX, OUTCOME_LIB, LAYOUT_JSX, APP_JSX,
    ...ls(API_DIR).map((f) => path.join(API_DIR, f)),
  ];
  const hits = [];
  for (const file of roots) {
    const src = safeRead(file);
    if (!src) continue;
    src.split('\n').forEach((line, i) => {
      if (RETIRED_NAMES.test(line)) hits.push(`${path.basename(file)}:${i + 1}: ${line.trim().slice(0, 90)}`);
    });
  }
  assert(hits.length === 0,
    `the retired page names must survive nowhere, comments included — ${hits.length} hit(s):\n      ${hits.join('\n      ')}`);
});

test('V7 (AC-7): the nav and breadcrumbs carry no retired label', () => {
  for (const [label, file] of [['Layout.jsx', LAYOUT_JSX], ['App.jsx', APP_JSX]]) {
    const src = safeRead(file) || '';
    const scoped = src.split('\n').filter((l) => /shared-concepts|SharedConcept|self-declared|'mine'/.test(l));
    const bad = scoped.filter((l) => RETIRED.test(l));
    assert(bad.length === 0,
      `${label}'s shared-concepts entries must not use the retired vocabulary — found:\n      ${bad.map((l) => l.trim()).join('\n      ')}`);
  }
});

test('V8 (AC-8): the internal surface is clean too — endpoint, response field, filenames', () => {
  const idx = safeRead(API_INDEX_JS) || '';
  const routes = [...idx.matchAll(/app\.get\('(\/api\/[^']+)'/g)].map((m) => m[1]);
  const badRoutes = routes.filter((r) => RETIRED.test(r));
  assert(badRoutes.length === 0, `no registered route may carry the retired vocabulary — found ${JSON.stringify(badRoutes)}`);

  const apiFiles = ls(API_DIR).filter((f) => RETIRED.test(f));
  assert(apiFiles.length === 0, `no handler filename may carry it — found ${JSON.stringify(apiFiles)}`);
  const pageFiles = ls(SHARED_CONCEPTS_DIR).filter((f) => RETIRED.test(f));
  assert(pageFiles.length === 0, `no page filename may carry it — found ${JSON.stringify(pageFiles)}`);
  const testFiles = ls(path.join(ROOT, 'test')).filter((f) => RETIRED.test(f));
  assert(testFiles.length === 0, `no test filename may carry it — found ${JSON.stringify(testFiles)}`);

  // The response field the page reads must not be named for the retired concept.
  const handlerSrcs = ls(API_DIR).map((f) => safeRead(path.join(API_DIR, f)) || '').join('\n');
  assert(!/\bofferings\s*[,:]/.test(handlerSrcs),
    'the response field must be renamed away from `offerings`');
});

// ═══ R — regression: what must NOT change ══════════════════════════════

test('R1 (AC-9, regression, passes pre AND post): the tri-state itself is untouched', () => {
  const src = safeRead(SHARING_STATE_LIB);
  assert(src, 'src/lib/sharingState.js is missing');
  assert(/relayOk === false \? null/.test(src),
    'the tri-state rule must stay exactly where it is — this story relabels the middle value, it does not touch how any of the three is computed');
  const { resolveSharingState } = require(SHARING_STATE_LIB);
  const base = { coord: 'c', disposition: {}, wiredTo: [] };
  assert(resolveSharingState({ ...base, relayOk: false }).published === null, 'unreachable relay must still be null');
  assert(resolveSharingState({ ...base, relayOk: true, relayEvent: null }).published === false, 'reachable-but-absent must still be false');
});

async function run() {
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const t of tests) {
    try {
      const r = await t.fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${t.name}`); skipped++; }
      else { console.log(`  ✓ ${t.name}`); pass++; }
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      failures.push({ name: t.name, message: err.message });
      fail++;
    }
  }
  console.log(`\nretire-offering-vocabulary: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
