/**
 * Story 4 (epic: shared-concepts-seeding) — reach the not-yet-shared list from
 * the page about what I've shared.
 *
 * Story: engineering-team/stories/shared-concepts-seeding/4-share-from-shared-by-me.md
 * ADR:   engineering-team/decisions/shared-concepts-seeding/0002-the-route-and-its-count-reuse-the-shipped-predicate.md
 *
 * Two things are being built, and they fail differently.
 *
 * The ROUTE is markup and navigation — a source audit can tell whether the page
 * reads its state from the address and whether it stopped giving stale advice.
 *
 * The COUNT is decision logic, and it is the part ADR 0002 flags as most likely
 * to be got wrong: **zero is a claim of completion.** "0 waiting" tells the
 * owner she has shared everything, which is exactly the kind of statement this
 * book exists to stop the product making carelessly. There are three ways to
 * reach a wrong zero — the graph read failed, the relay could not be asked (so
 * the honest count is only a lower bound), or the number really is zero — and
 * only the third may be rendered as done. A grep cannot tell those apart, so
 * the U-class drives the decision directly.
 *
 * Two test classes:
 *
 *   U-class (pure, stack-free, always gates) — drives
 *     `summarizeNotYetShared(rows, ctx)` from ui/src/utils/conceptStateFilter.js
 *     over fabricated populations, one case per honesty rule. Loaded by dynamic
 *     import (ui/ is "type": "module"), the loadEsm idiom of
 *     test/firmware-concept-elements-sets.test.js:58-66.
 *
 *   S-class (source assertions, stack-free) — the structural claims: the
 *     destination takes its state from the address and survives a bad value,
 *     the origin page carries a route, the stale empty-state advice is gone,
 *     and neither page re-implements the predicate.
 *
 * No H-class: this story adds no server surface, and the one thing worth
 * checking live — that the number on one page equals the rows on the other —
 * is a rendered check, not an HTTP one. It is protocol V1 in the test plan,
 * and it is required rather than optional.
 *
 * ALL U and S tests FAIL until the feature lands. That is the point.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const FILTER_UTIL_JS = path.join(ROOT, 'ui/src/utils/conceptStateFilter.js');
const CONCEPT_LIST_JSX = path.join(ROOT, 'ui/src/pages/concepts/ConceptList.jsx');
const SHARED_BY_ME_JSX = path.join(ROOT, 'ui/src/pages/shared-concepts/SharedByMe.jsx');

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }
function short(x, n = 220) {
  const s = typeof x === 'string' ? x : JSON.stringify(x);
  return s == null ? String(s) : (s.length > n ? `${s.slice(0, n)}…` : s);
}

async function loadFilterUtil() {
  try {
    return await import(pathToFileURL(FILTER_UTIL_JS).href);
  } catch (e) {
    throw new Error(`ui/src/utils/conceptStateFilter.js failed to import as ESM: ${e.message}`);
  }
}

async function summarize(rows, ctx) {
  const mod = await loadFilterUtil();
  assert(typeof mod.summarizeNotYetShared === 'function',
    'conceptStateFilter.js must export summarizeNotYetShared(rows, ctx) — the single place that ' +
    'decides whether the route shows a number, shows nothing, or reports the backlog clear ' +
    '(ADR shared-concepts-seeding/0002, "Honesty rules for the count"). It is not implemented.');
  return mod.summarizeNotYetShared(rows, ctx);
}

/* ── Fixtures: rows shaped like the Concepts list's enriched rows ────────── */

const TA = 'cc'.repeat(32);
const coord = (slug, pk = TA) => `39998:${pk}:${slug}`;
const disp = (o = {}) => ({ wired: false, selfDeclared: false, deferred: false, ...o });

const WAITING_A = { uuid: coord('undecided-a'), name: 'undecided a', author: TA, _disp: disp() };
const WAITING_B = { uuid: coord('undecided-b'), name: 'undecided b', author: TA, _disp: disp() };
const SHARED = { uuid: coord('dog'), name: 'dog', author: TA, _disp: disp({ selfDeclared: true }) };
const WIRED = { uuid: coord('adopted'), name: 'adopted', author: TA, _disp: disp({ wired: true }) };
const PRIVATE = { uuid: coord('secret'), name: 'secret', author: TA, _disp: disp({ deferred: true }) };

const POPULATION = [WAITING_A, WAITING_B, SHARED, WIRED, PRIVATE];
const publishedByCoord = new Map([[SHARED.uuid, true]]);
const ctx = (over = {}) => ({ taPubkey: TA, publishedByCoord, relayOk: true, ...over });

/* ══════════ U-class — one case per honesty rule ══════════ */

test('U1 (ADR rule 3): with both sources good, the route reports how many are waiting', async () => {
  const s = await summarize(POPULATION, ctx());
  assert(s && s.kind === 'waiting',
    `two concepts are undecided and neither source failed, so the route must offer an errand — ` +
    `expected kind "waiting", got ${short(s)}.`);
  assert(s.count === 2,
    `the count must be the number actually waiting (2 of this population: shared, wired and private ` +
    `are all excluded). Got ${short(s.count)}.`);
});

test('U2 (AC-5, ADR rule 4): a genuinely empty backlog reports CLEAR, not an errand with nothing in it', async () => {
  const s = await summarize([SHARED, WIRED, PRIVATE], ctx());
  assert(s && s.kind === 'clear',
    'when nothing is waiting, the owner has reached the state she is working toward. The route must ' +
    `say so rather than pointing at an empty list (AC-5) — expected kind "clear", got ${short(s)}.`);
  assert(s.count === 0, `a clear backlog counts zero. Got ${short(s.count)}.`);
});

test('U3 (ADR rule 1): when the population could not be read, the route shows NO number — never zero', async () => {
  const s = await summarize(null, ctx());
  assert(s && s.kind === 'unknown',
    'a failed graph read means the population is unknown. Reporting "clear" or any number would be a ' +
    `claim built on a check that did not run — expected kind "unknown", got ${short(s)}.`);
  assert(s.count === null,
    `an unknown backlog must carry no number at all — not 0, which asserts "you have shared ` +
    `everything". Got ${short(s.count)}.`);
});

test('U4 (ADR rule 2): when the relay could not be asked, the route shows NO number — the honest count is only a lower bound', async () => {
  // relayOk:false is how /api/shared-by-me reports an unreachable relay; every
  // declared concept comes back published:null, and story #3's predicate
  // withholds those — so any count here undercounts.
  const nulls = new Map([[SHARED.uuid, null]]);
  const s = await summarize(POPULATION, ctx({ relayOk: false, publishedByCoord: nulls }));
  assert(s && s.kind === 'unknown',
    'with publication unconfirmed, concepts that may still need sharing are withheld from the count, ' +
    'so any number shown would be a lower bound. Showing it would read as "you are closer to done ' +
    `than you are" — expected kind "unknown", got ${short(s)}.`);
  assert(s.count === null, `an unconfirmable backlog must carry no number. Got ${short(s.count)}.`);
});

test('U5: the number the route advertises equals the list it points at — one function, not two', async () => {
  const { matchesState } = await loadFilterUtil();
  const c = ctx();
  const listed = POPULATION.filter((r) => matchesState(r, 'not-yet-shared', c));
  const s = await summarize(POPULATION, c);
  assert(s.count === listed.length,
    `the count must equal what the destination actually lists — that agreement is the whole reason ` +
    `ADR 0002 computes it with matchesState rather than by any other means. Route says ${short(s.count)}, ` +
    `the predicate selects ${listed.length} (${short(listed.map((r) => r.name))}).`);
});

test('U6: an empty population is CLEAR, but a missing one is UNKNOWN — the two must not collapse', async () => {
  const empty = await summarize([], ctx());
  const missing = await summarize(null, ctx());
  assert(empty.kind === 'clear',
    `a graph with no concepts at all is a genuinely clear backlog. Got ${short(empty)}.`);
  assert(missing.kind === 'unknown',
    `a population that could not be read is NOT the same as one that is empty; collapsing them is how ` +
    `"we could not check" turns into "you are done". Got ${short(missing)}.`);
});

/* ══════════ S-class — the destination, the route, the stale advice ══════════ */

test('U7 (AC-2): a state read from the address maps to itself when it is one the page knows', async () => {
  const mod = await loadFilterUtil();
  assert(typeof mod.normalizeState === 'function',
    'conceptStateFilter.js must export normalizeState(raw) — the one place that turns whatever arrives ' +
    'in the address into a state the page can render. Grepping the page for a membership check cannot ' +
    'tell a real fallback from an accidental one, so the decision belongs here where it can be driven.');
  for (const id of ['not-yet-shared', 'undispositioned', 'shared', 'wired', 'private']) {
    assert(mod.normalizeState(id) === id,
      `a link carrying "${id}" must arrive on that state — it is one of STATES. Got ${short(mod.normalizeState(id))}.`);
  }
});

test('U8 (AC-2, edge): an unrecognised state falls back to All — never to a state that renders nothing', async () => {
  const mod = await loadFilterUtil();
  assert(typeof mod.normalizeState === 'function', 'normalizeState(raw) is not implemented.');
  for (const junk of ['nonsense', 'NOT-YET-SHARED', 'not_yet_shared', '../evil', '']) {
    const got = mod.normalizeState(junk);
    assert(got === '',
      `a stale bookmark or typo'd link carrying ${JSON.stringify(junk)} must fall back to All states, ` +
      `so the owner sees her concepts rather than an empty table reading as "you have none". Got ${short(got)}.`);
  }
});

test('U9 (AC-2, edge): a missing state is All, and "all" is not a state the address needs to carry', async () => {
  const mod = await loadFilterUtil();
  assert(typeof mod.normalizeState === 'function', 'normalizeState(raw) is not implemented.');
  for (const nothing of [null, undefined]) {
    assert(mod.normalizeState(nothing) === '',
      `an ordinary visit carries no state parameter and must show everything. Got ${short(mod.normalizeState(nothing))}.`);
  }
  assert(mod.normalizeState('all') === '',
    'the default state normalises to the empty string, so the page can omit the parameter entirely ' +
    'rather than writing ?state=all into the address on every ordinary visit (ADR 0002).');
});

test('S1 (AC-2): the Concepts list takes its state from the address, so a link can arrive narrowed', () => {
  const src = safeRead(CONCEPT_LIST_JSX);
  assert(src !== null, 'ui/src/pages/concepts/ConceptList.jsx is unreadable.');
  assert(/useSearchParams/.test(src),
    'ConceptList.jsx must read its state filter from the address via useSearchParams (ADR 0002). ' +
    'While the filter lives only in component state it resets on every visit and no link can set it, ' +
    'so the owner lands on every concept with a control to find and set herself — which is the larger ' +
    'half of what AC-2 removes.');
  assert(/['"`]state['"`]/.test(src),
    'ConceptList.jsx must read the `state` query parameter — the name the route links with.');
});

test('S2 (AC-2, edge): the Concepts list runs what it reads from the address through normalizeState', () => {
  const src = safeRead(CONCEPT_LIST_JSX);
  assert(src !== null, 'ui/src/pages/concepts/ConceptList.jsx is unreadable.');
  assert(/normalizeState/.test(src),
    'ConceptList.jsx must pass the incoming state through normalizeState (conceptStateFilter.js) rather ' +
    'than trusting the address. U8 pins what that function does with a bad value; this pins that the ' +
    'page actually uses it. Validating inline would work too — and would drift from the list of states ' +
    'it is validating against, which is why ADR 0002 keeps one home.');
});

test('S3 (AC-1): Shared by me carries a route to the not-yet-shared concepts', () => {
  const src = safeRead(SHARED_BY_ME_JSX);
  assert(src !== null, 'ui/src/pages/shared-concepts/SharedByMe.jsx is unreadable.');
  assert(/tapestry\/concepts/.test(src),
    'SharedByMe.jsx must link to the Concepts page — today the page is a dead end, with nothing on it ' +
    'leading to the concepts that have NOT been shared (AC-1).');
  assert(/not-yet-shared/.test(src),
    'the route must target the not-yet-shared state specifically, not the bare Concepts page. Linking ' +
    'without the state satisfies AC-1 while failing AC-2 — the owner arrives at everything.');
});

test('S4 (AC-4): the empty state stops telling first-time owners to go to a concept page', () => {
  const src = safeRead(SHARED_BY_ME_JSX);
  assert(src !== null, 'ui/src/pages/shared-concepts/SharedByMe.jsx is unreadable.');
  assert(!/Submit one from its concept page/.test(src),
    'the empty state still reads "You haven\'t shared any concepts yet. Submit one from its concept ' +
    'page." That names the slowest route, and it is the first thing a brand-new owner reads — the ' +
    'exact moment this story exists for (AC-4). Point it at the route this story adds.');
});

test('S5 (ADR 0002): neither page re-implements the count or the predicate', () => {
  const shared = safeRead(SHARED_BY_ME_JSX);
  assert(shared !== null, 'ui/src/pages/shared-concepts/SharedByMe.jsx is unreadable.');
  assert(/summarizeNotYetShared|conceptStateFilter/.test(shared),
    'SharedByMe.jsx must get its number from conceptStateFilter.js — the same module the destination ' +
    'filters with. A count computed any other way is a second implementation of the same question and ' +
    'is free to drift from the list it advertises (ADR 0002, Decision).');
  for (const forbidden of ['carriesSelfPointer', 'resolveSharingState']) {
    assert(!shared.includes(forbidden),
      `SharedByMe.jsx must not reference ${forbidden} — the sharing rule has one home in ` +
      'src/lib/sharingState.js and reaches this page already resolved.');
  }
});

// PRE-SATISFIED by design, like relationship-primitives-probe H3: SharedByMe
// does not mention the label today because it does not mention the state at
// all. It becomes a real guard the moment the route is written — the tempting
// implementation is to paste the label next to the link.
test('S6 (pre-satisfied guard): the route does not hardcode the state\'s display label', () => {
  const shared = safeRead(SHARED_BY_ME_JSX);
  const mod = safeRead(FILTER_UTIL_JS);
  assert(shared !== null && mod !== null, 'source unreadable.');
  assert(/Not yet shared \(mine\)/.test(mod),
    'sanity: conceptStateFilter.js should still carry the human label for the not-yet-shared state.');
  // The link may name the state id (a URL contract) but should not duplicate the
  // display label, which belongs to STATES and can change without touching this page.
  assert(!/Not yet shared \(mine\)/.test(shared),
    'SharedByMe.jsx should not hardcode the state\'s display label — that string belongs to STATES in ' +
    'conceptStateFilter.js. Copying it here means a rename silently leaves the two surfaces disagreeing ' +
    'about what the same state is called.');
});

/* ─────────────── Run ─────────────── */

async function run() {
  console.log('\n--- share-from-shared-by-me tests (epic shared-concepts-seeding, Story 4) ---');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\nshare-from-shared-by-me: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
