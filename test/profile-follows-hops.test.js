/**
 * Story #38 (profile epic): "Follows-hops to this profile" stat.
 * ADR 0034. See engineering-team/stories/profile/38-profile-follows-hops.test-plan.md
 *
 * A new HOPS stat in the profile `bsp-counts` row showing the LIVE directed
 * FOLLOWS shortest-path distance from a source pubkey (logged-in user, else the
 * instance Owner) to the viewed profile. Backed by a new public endpoint
 * GET /api/get-follows-hops?source=&target= running parameterized native
 * shortestPath (cap 20) via the pooled Bolt driver. 3-state contract:
 *   {success:true, hops:<0..20>}  → number  (incl. self-view 0)
 *   {success:true, hops:null}     → ∞       (confirmed no path within cap)
 *   {success:false, error}        → "—"     (bad input / lookup error / timeout)
 *
 * These are SOURCE-REGEX SENTINELS — the project convention for this feature
 * family (#33–#36): no React render harness, no live DB (the local neo4j stack
 * is stale/near-empty per OPEN.md #6). Browser-level behavior (placement,
 * not-an-anchor, rendered states) is additionally covered by the supplementary
 * live-data Playwright spec tests/brainstorm/profile-follows-hops.spec.js.
 *
 * FALSE-POSITIVE AVOIDANCE: BrainstormProfile.jsx ALREADY contains `label: 'Hops'`
 * (a TRUST_METRICS card, "Degrees of separation", in the Reputation grid). Every
 * counts-row sentinel below therefore targets the `bsp-count-label` span class
 * specifically — the trust card uses a different class and a JS object literal,
 * so it cannot match.
 *
 * T* must FAIL pre-implementation and PASS post-implementation.
 * R* are regression/guard sentinels — they must PASS both before and after.
 */

const fs = require('fs');
const path = require('path');

const DRIVER      = path.resolve(__dirname, '../src/lib/neo4j-driver.js');
const HANDLER     = path.resolve(__dirname, '../src/api/export/users/queries/follows-hops.js');
const USERS_INDEX = path.resolve(__dirname, '../src/api/export/users/index.js');
const API_INDEX   = path.resolve(__dirname, '../src/api/index.js');
const AUTH        = path.resolve(__dirname, '../src/middleware/auth.js');
const HOOK        = path.resolve(__dirname, '../ui/src/hooks/useFollowsHops.js');
const PAGE        = path.resolve(__dirname, '../ui/src/pages/BrainstormProfile.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

// Index of a counts-row label span with the given text (-1 if absent).
// Targets `bsp-count-label">Label` so the TRUST_METRICS `label: 'Hops'` cannot match.
function countsLabelIndex(src, label) {
  const re = new RegExp('bsp-count-label"[^>]*>\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const m = src.match(re);
  return m ? m.index : -1;
}

// ── Backend: handler GET /api/get-follows-hops (src/api/export/users/queries/follows-hops.js) ──

test('T1: a follows-hops handler module exists and exports handleGetFollowsHops', () => {
  const src = safeRead(HANDLER);
  assert(src.length > 0,
    'expected a new handler at src/api/export/users/queries/follows-hops.js (does not exist yet).');
  assert(/handleGetFollowsHops/.test(src) && /module\.exports/.test(src),
    'the handler file must define and export `handleGetFollowsHops` (mirror handleGetUserCounts).');
});

test('T2: the handler validates source/target as 64-char hex and 400s with {success:false} on bad input (AC graceful-failure)', () => {
  const src = safeRead(HANDLER);
  assert(/\{\s*64\s*\}/.test(src),
    'the handler must validate the pubkeys are 64-char hex (expected a `{64}` length check in a regex). Missing/malformed input is a client error, not ∞.');
  assert(/\.status\(\s*400\s*\)/.test(src),
    'the handler must respond HTTP 400 for missing/malformed source or target.');
  assert(/\.status\(\s*400\s*\)[\s\S]{0,250}success:\s*false/.test(src),
    'the 400 response body must be {success:false, error} so the UI shows "—" (unavailable), not ∞ or a number.');
});

test('T3: the handler short-circuits source===target to hops:0 WITHOUT querying (AC self-view)', () => {
  const src = safeRead(HANDLER);
  assert(/(source|src)\s*===\s*(target|tgt)|(target|tgt)\s*===\s*(source|src)/.test(src),
    'the handler must special-case source === target (a node has no 1+-hop path to itself under [:FOLLOWS*..20], which would wrongly yield ∞).');
  assert(/hops:\s*0\b/.test(src),
    'the source===target short-circuit must return {success:true, hops:0} (self-view shows 0).');
});

test('T4: the handler runs a DIRECTED, length-capped (..20) native shortestPath over FOLLOWS (AC live + directionality + cap)', () => {
  const src = safeRead(HANDLER);
  assert(/shortestPath\s*\(/.test(src),
    'the handler must compute distance with a native Cypher shortestPath (live), not a precomputed property.');
  assert(/:FOLLOWS\*[0-9]?\.\.20\]\s*->/.test(src),
    'the traversal must be DIRECTED and capped at 20: `-[:FOLLOWS*..20]->` (the `->` encodes directionality so hops(A→B) ≠ hops(B→A); cap = 20).');
  assert(/length\(\s*p\s*\)/.test(src),
    'the hop count must be the shortest-path length `length(p)` — NOT a precomputed n.hops node property (AC: always live, no precomputed read).');
});

test('T5: the handler parameterizes the pubkeys via runCypher params (no string interpolation / injection)', () => {
  const src = safeRead(HANDLER);
  assert(/runCypher\s*\(/.test(src),
    'the handler must execute via the pooled Bolt helper runCypher (src/lib/neo4j-driver.js), not cypher-shell/execSync.');
  assert(/\$src|\$source/.test(src) && /\$tgt|\$target/.test(src),
    'the pubkeys must be BOUND parameters ($src/$tgt) passed to runCypher — not interpolated into the Cypher string.');
});

test('T6: the handler passes a numeric query timeout to runCypher so a view never hangs (AC graceful-failure)', () => {
  const src = safeRead(HANDLER);
  assert(/runCypher\s*\([\s\S]{0,400}\btimeout\s*:/.test(src),
    'the runCypher call must pass a transaction config with a numeric `timeout:` (3rd arg) — a high-cap shortestPath on the prod-scale graph must be deadline-bounded.');
});

test('T7: the handler maps no-path-within-cap to {success:true, hops:null} (AC ∞)', () => {
  const src = safeRead(HANDLER);
  assert(/hops:\s*null/.test(src),
    'when shortestPath returns no row (no path within cap), respond {success:true, hops:null} — the UI renders ∞. (Distinct from a lookup error.)');
});

test('T8: the handler maps lookup errors/timeouts to {success:false} in a catch (AC graceful-failure, NOT a false ∞)', () => {
  const src = safeRead(HANDLER);
  assert(/catch\s*\([\s\S]{0,300}success:\s*false/.test(src),
    'a query error/timeout must be caught and returned as {success:false, error} so the UI shows "—" (unavailable) — never a false ∞ or number.');
});

// ── Backend: shared driver extension (src/lib/neo4j-driver.js) ──

test('T9: runCypher accepts an optional 3rd transaction-config arg and forwards it to session.run (AC timeout plumbing)', () => {
  const src = safeRead(DRIVER);
  assert(/function\s+runCypher\s*\(\s*cypher\s*,\s*params\s*=\s*\{\}\s*,\s*\w+/.test(src),
    'runCypher must gain an optional 3rd parameter (e.g. `runCypher(cypher, params = {}, txConfig)`) for the per-query timeout.');
  assert(/session\.run\(\s*cypher\s*,\s*params\s*,\s*\w+\s*\)/.test(src),
    'runCypher must forward that 3rd arg to session.run(cypher, params, txConfig) so the Neo4j-layer deadline actually applies.');
});

// ── Backend: route registration + export ──

test('T10: GET /api/get-follows-hops is registered to handleGetFollowsHops (src/api/index.js) (AC endpoint)', () => {
  const src = safeRead(API_INDEX);
  assert(/app\.get\(\s*['"]\/api\/get-follows-hops['"]/.test(src),
    'src/api/index.js must register `app.get(\'/api/get-follows-hops\', ...)`.');
  assert(/handleGetFollowsHops/.test(src),
    'the route must be wired to users.handleGetFollowsHops.');
});

test('T11: handleGetFollowsHops is re-exported from src/api/export/users/index.js', () => {
  const src = safeRead(USERS_INDEX);
  assert(/handleGetFollowsHops/.test(src),
    'src/api/export/users/index.js must re-export handleGetFollowsHops (mirror handleGetUserCounts).');
});

// ── Frontend: hook (ui/src/hooks/useFollowsHops.js) ──

test('T12: a useFollowsHops hook exists, default-exported (mirrors useUserCounts)', () => {
  const src = safeRead(HOOK);
  assert(src.length > 0, 'expected a new hook at ui/src/hooks/useFollowsHops.js (does not exist yet).');
  assert(/export default function useFollowsHops/.test(src),
    'useFollowsHops must be the default export (mirror useUserCounts).');
});

test('T13: the hook fetches /api/get-follows-hops with source and target params, with AbortController (AC async)', () => {
  const src = safeRead(HOOK);
  assert(/\/api\/get-follows-hops\?source=/.test(src) && /target=/.test(src),
    'the hook must fetch `/api/get-follows-hops?source=${source}&target=${target}`.');
  assert(/AbortController/.test(src),
    'the hook must use an AbortController (its own async lifecycle) so it never blocks the page (mirror useUserCounts).');
});

test('T14: the hook exposes hops/noPath/loading/error, with noPath derived from a successful null result (AC 3-state)', () => {
  const src = safeRead(HOOK);
  for (const field of ['hops', 'noPath', 'loading', 'error']) {
    assert(new RegExp('\\b' + field + '\\b').test(src),
      `the hook must expose \`${field}\` so the page can render number / ∞ / "—" distinctly.`);
  }
  assert(/===\s*null/.test(src) && /success/.test(src),
    'noPath must be derived from a SUCCESSFUL null result (success && hops === null) — so ∞ is never shown for a lookup error.');
});

// ── Frontend: profile page (ui/src/pages/BrainstormProfile.jsx) ──

test('T15: BrainstormProfile imports useFollowsHops and useConfig (for the Owner fallback source)', () => {
  const src = safeRead(PAGE);
  assert(/import\s+useFollowsHops\s+from/.test(src),
    'the page must import the useFollowsHops hook.');
  assert(/useConfig/.test(src),
    'the page must use useConfig() to read ownerPubkey for the logged-out source.');
});

test('T16: the hops source is the logged-in user else the Owner (AC source selection, logged-in + logged-out)', () => {
  const src = safeRead(PAGE);
  assert(/useFollowsHops\(/.test(src),
    'the page must call useFollowsHops(source, target).');
  assert(/user\?\.pubkey/.test(src) && /ownerPubkey/.test(src),
    'the source must be `user?.pubkey || ownerPubkey` (logged-in viewer; else the instance Owner).');
});

test('T17: a HOPS counter is rendered in the bsp-counts row (AC label)', () => {
  const src = safeRead(PAGE);
  assert(countsLabelIndex(src, 'Hops') !== -1,
    'a `bsp-count-label` span labeled "Hops" must be added to the bsp-counts row. (The existing `label: \'Hops\'` is a TRUST_METRICS card, not a counts-row label.)');
});

test('T18: the HOPS counter sits between Verified Followers and Verified Reporters (AC placement)', () => {
  const src = safeRead(PAGE);
  const vf = countsLabelIndex(src, 'Verified Followers');
  const hops = countsLabelIndex(src, 'Hops');
  const vr = countsLabelIndex(src, 'Verified Reporters');
  assert(hops !== -1, 'the HOPS counts-row label was not found (see T17).');
  assert(vf !== -1 && vr !== -1, 'the Verified Followers / Verified Reporters counts-row labels must exist.');
  assert(vf < hops && hops < vr,
    `HOPS must render AFTER Verified Followers and BEFORE Verified Reporters. Got indices VF=${vf}, HOPS=${hops}, VR=${vr}.`);
});

test('T19: the HOPS counter is a non-link <span>, not a <Link> (AC present-but-not-clickable)', () => {
  const src = safeRead(PAGE);
  const hops = countsLabelIndex(src, 'Hops');
  assert(hops !== -1, 'the HOPS counts-row label was not found (see T17).');
  const before = src.slice(0, hops);
  const lastSpan = before.lastIndexOf('<span');
  const lastLink = before.lastIndexOf('<Link');
  assert(lastSpan > lastLink,
    'the HOPS counter must be wrapped in a <span> (not a <Link>) — the click-through page is deferred, so the stat is present but not clickable. The closest opening tag before the Hops label is a <Link>, which means it is rendered as a link.');
});

test('T20: the page renders ∞ for the no-path state, keyed on noPath (AC ∞)', () => {
  const src = safeRead(PAGE);
  assert(/∞/.test(src),
    'the page must render the infinity symbol ∞ for the no-path state.');
  assert(/noPath/.test(src),
    'the ∞ branch must be keyed on the hook\'s `noPath` (a confirmed no-path), not on an error — so a lookup failure shows "—", not ∞.');
});

test('T21: the no-path tooltip copy is present (AC ∞ tooltip)', () => {
  const src = safeRead(PAGE);
  assert(/There is no follow path from /.test(src),
    'the no-path tooltip must read "There is no follow path from <source> to <target>." — exact lead-in string not found.');
});

test('T22: the N-hops tooltip copy is present with singular/plural handling (AC finite-N tooltip + copy notes)', () => {
  const src = safeRead(PAGE);
  assert(/ away from /.test(src) && /by follows/.test(src),
    'the finite tooltip must read "<target> is N hop(s) away from <source> by follows." — "away from" / "by follows" not found.');
  assert(/hop\$\{[^}]*'s'|'hop'\s*:\s*'hops'|'hops'\s*:\s*'hop'/.test(src),
    'the tooltip must pluralize: "1 hop" vs "N hops" (e.g. `hop${n === 1 ? \'\' : \'s\'}` or `n === 1 ? \'hop\' : \'hops\'`).');
});

// ── Regression / guard sentinels (must PASS before AND after) ──

test('R1: the existing Following / Verified Followers / Verified Reporters counters are intact (regression)', () => {
  const src = safeRead(PAGE);
  assert(/\/user\/\$\{pubkey\}\/follows/.test(src), 'the Following → /follows link must remain.');
  assert(/\/user\/\$\{pubkey\}\/followers/.test(src), 'the Verified Followers → /followers link must remain.');
  assert(/\/user\/\$\{pubkey\}\/reporters/.test(src), 'the Verified Reporters → /reporters link must remain.');
  assert(/useUserCounts/.test(src), 'the page must keep useUserCounts for the existing three counts.');
});

test('R2: runCypher keeps its `params = {}` default so existing 2-arg callers are unaffected (regression)', () => {
  const src = safeRead(DRIVER);
  assert(/runCypher\s*\(\s*cypher\s*,\s*params\s*=\s*\{\}/.test(src),
    'runCypher must keep `params = {}` as a default — the new 3rd arg must be additive, not break existing 2-arg calls.');
});

test('R3 (guard): /api/get-follows-hops is NOT added to any auth gate — it must stay publicly readable for logged-out viewers', () => {
  const src = safeRead(AUTH);
  assert(!/get-follows-hops/.test(src),
    'the endpoint must remain public (logged-out viewers use the Owner source). It must NOT appear in any allowlist in src/middleware/auth.js. Found a reference — it has been gated.');
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  ✓ ${t.name}`);
      pass++;
    } catch (err) {
      console.log(`  ✗ ${t.name}`);
      console.log(`      ${err.message}`);
      fail++;
    }
  }
  return { pass, fail };
}

module.exports = { run };
