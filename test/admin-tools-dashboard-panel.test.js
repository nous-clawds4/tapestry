/**
 * Story #19 / ADR 0017 — Admin tools panel on the Tapestry dashboard.
 *
 * Three coordinated changes:
 *   1. New <AdminToolsPanel /> in Dashboard.jsx, client-side-gated by
 *      useAuth().user.classification ∈ {owner, admin}; renders BullBoard
 *      and Neo4j Browser as link-cards.
 *   2. ConfigContext extended to fetch /api/status and expose
 *      neo4jBrowserUrl; both the new panel and the existing Neo4j
 *      Overview button consume it.
 *   3. bullBoardMount.js miscLinks gains a "← Tapestry Dashboard"
 *      entry pointing to /tapestry.
 *
 * Source/structural sentinels pin the ADR-required code shape. The
 * behavioral round-trip — signed-in owner sees the panel; non-admin
 * does not; Neo4j Browser link uses the environment-aware URL — is
 * reproducible only with a real session cookie + browser and is the
 * authoritative cycle-staging smoke (operator-required).
 *
 * T1..T7 : FAIL pre-implementation, PASS post.
 * R1, R2 : PASS pre AND post — regression guards on ConfigContext's
 *          existing 3 fields and story #18's requireOwnerOrAdmin
 *          server-side contract.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const DASHBOARD_JSX       = path.join(ROOT, 'ui/src/pages/Dashboard.jsx');
const CONFIG_CONTEXT_JSX  = path.join(ROOT, 'ui/src/context/ConfigContext.jsx');
const NEO4J_OVERVIEW_JSX  = path.join(ROOT, 'ui/src/pages/databases/Neo4jOverview.jsx');
const BULLBOARD_MOUNT     = path.join(ROOT, 'src/manage/taskQueue/queue/bullBoardMount.js');
const ADMIN_INDEX         = path.join(ROOT, 'src/api/admin/index.js');

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (_e) { return null; }
}

/**
 * Extract a substring around the first match of `marker` in `src`. Used to
 * narrow regex assertions to "inside the component body" rather than the
 * whole file, so sentinels don't accidentally match unrelated code elsewhere.
 */
function regionAround(src, marker, before = 0, after = 1500) {
  const idx = src.indexOf(marker);
  if (idx === -1) return '';
  return src.slice(Math.max(0, idx - before), idx + after);
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once story #19 is implemented per ADR 0017.
// ---------------------------------------------------------------------------

test('T1: ui/src/pages/Dashboard.jsx declares function AdminToolsPanel (story #19 / ADR 0017 §Implementation §2)', () => {
  const src = readSafe(DASHBOARD_JSX);
  assert(src !== null, 'Dashboard.jsx missing at expected path — re-baseline.');
  assert(
    /function\s+AdminToolsPanel\b/.test(src),
    'ui/src/pages/Dashboard.jsx does not declare `function AdminToolsPanel` (story #19 / ADR 0017 ' +
      '§Implementation §2). Add the new component adjacent to the other section components ' +
      '(StatsRow, HealthRow, ConstraintsCheck). The component must (1) read useAuth() + useConfig(), ' +
      '(2) gate on classification ∈ {owner, admin}, (3) gate on neo4jBrowserUrl being available, ' +
      '(4) render a .dashboard-card with two link-buttons (BullBoard + Neo4j Browser). Both links ' +
      'target="_blank" with rel="noopener noreferrer".'
  );
});

test('T2: AdminToolsPanel consumes useAuth and gates on owner-or-admin classification (story #19 ACs + ADR 0017 §Implementation §2)', () => {
  const src = readSafe(DASHBOARD_JSX);
  assert(src !== null, 'Dashboard.jsx missing — T1 must pass first.');
  const region = regionAround(src, 'function AdminToolsPanel', 0, 2000);
  assert(
    region.length > 0,
    'AdminToolsPanel function declaration not found — T1 must pass first.'
  );
  assert(
    /useAuth/.test(region),
    'AdminToolsPanel does not call useAuth (story #19 ACs §Panel visibility + ADR 0017 §Implementation §2). ' +
      'The visibility gate must read session.pubkey classification from useAuth() — that hook returns ' +
      '{user: {pubkey, classification, profile}}. Same idiom as Layout.jsx:137 and BrainstormUserMenu.jsx:80.'
  );
  // Must check classification against both 'owner' and 'admin'. Allow either single-quoted, double-quoted,
  // or backticks for the string literals.
  assert(
    /classification[\s\S]{0,100}['"`]owner['"`]/.test(region) &&
    /classification[\s\S]{0,100}['"`]admin['"`]/.test(region),
    'AdminToolsPanel does not check user.classification against both "owner" AND "admin" (story #19 ACs ' +
      '§Panel visibility — both owners and admins see the panel; non-operators do not). The established ' +
      'idiom across Layout.jsx, BrainstormUserMenu.jsx, and Dashboard.jsx (OnboardingChecklist) is ' +
      '`user?.classification === \'owner\' || user?.classification === \'admin\'`. Use the same shape.'
  );
});

test('T3: AdminToolsPanel consumes useConfig and references neo4jBrowserUrl for the env-aware Neo4j Browser link (story #19 ACs + ADR 0017 §Implementation §2)', () => {
  const src = readSafe(DASHBOARD_JSX);
  assert(src !== null, 'Dashboard.jsx missing — T1 must pass first.');
  const region = regionAround(src, 'function AdminToolsPanel', 0, 2000);
  assert(
    /useConfig/.test(region),
    'AdminToolsPanel does not call useConfig (story #19 ACs + ADR 0017 §Implementation §2). The ' +
      'env-aware Neo4j Browser URL must come from useConfig().neo4jBrowserUrl, not from a hardcoded value. ' +
      'This is the same plumbing the fixed Neo4jOverview button uses — single source of truth in ' +
      'ConfigContext.'
  );
  assert(
    /neo4jBrowserUrl/.test(region),
    'AdminToolsPanel does not reference neo4jBrowserUrl (story #19 ACs + ADR 0017 §Implementation §2). ' +
      'The Neo4j Browser card\'s href must be built from useConfig().neo4jBrowserUrl (e.g., ' +
      '`${neo4jBrowserUrl}/browser/preview/`). Hardcoding localhost or any other URL re-creates the bug ' +
      'this story fixes.'
  );
});

test('T4: AdminToolsPanel references both /admin/queues/ (BullBoard) AND browser/preview (Neo4j) — the two card destinations (story #19 ACs + ADR 0017 §Implementation §2)', () => {
  const src = readSafe(DASHBOARD_JSX);
  assert(src !== null, 'Dashboard.jsx missing — T1 must pass first.');
  const region = regionAround(src, 'function AdminToolsPanel', 0, 2000);
  assert(
    /\/admin\/queues\/?/.test(region),
    'AdminToolsPanel does not reference /admin/queues/ (story #19 ACs — BullBoard card). Add a card/link ' +
      'with href="/admin/queues/" (same-origin; relative URL is sufficient — BullBoard mount is on the ' +
      'same Tapestry origin).'
  );
  assert(
    /browser\/preview/.test(region),
    'AdminToolsPanel does not reference browser/preview (story #19 ACs — Neo4j Browser card). Add a ' +
      'card/link whose href is `${neo4jBrowserUrl}/browser/preview/` (Neo4j Browser\'s landing path).'
  );
});

test('T5: ui/src/context/ConfigContext.jsx fetches /api/status and exposes neo4jBrowserUrl (story #19 ACs + ADR 0017 §Implementation §1)', () => {
  const src = readSafe(CONFIG_CONTEXT_JSX);
  assert(src !== null, 'ConfigContext.jsx missing at expected path — re-baseline.');
  assert(
    /['"`]\/api\/status['"`]/.test(src),
    'ConfigContext.jsx does not fetch /api/status (story #19 / ADR 0017 §Implementation §1). Add a 4th ' +
      'parallel fetch alongside the existing three (/api/assistant/pubkey, /api/owner/pubkey, /api/relays). ' +
      'Pluck neo4jBrowserUrl from the response and expose it in the context provider value. This is the ' +
      'centralized source-of-truth for the env-aware Neo4j URL — both AdminToolsPanel and the fixed ' +
      'Neo4jOverview button read from here.'
  );
  assert(
    /neo4jBrowserUrl/.test(src),
    'ConfigContext.jsx does not reference neo4jBrowserUrl (story #19 / ADR 0017 §Implementation §1). The ' +
      'context must add neo4jBrowserUrl to its useState + setter pair AND include it in the provider ' +
      'value object so useConfig() consumers can destructure it. Without exposing it, T3 and T6 cannot ' +
      'pass.'
  );
});

test('T6: ui/src/pages/databases/Neo4jOverview.jsx no longer hardcodes localhost:8080 and consumes useConfig (story #19 bug-fix AC + ADR 0017 §Implementation §3)', () => {
  const src = readSafe(NEO4J_OVERVIEW_JSX);
  assert(src !== null, 'Neo4jOverview.jsx missing — re-baseline.');
  assert(
    !/localhost:8080\/browser\/preview/.test(src),
    'Neo4jOverview.jsx still hardcodes `localhost:8080/browser/preview/` (story #19 bug-fix AC). The ' +
      'fix is to consume useConfig().neo4jBrowserUrl and append `/browser/preview/`. The hardcoded URL ' +
      'is the bug — it points to a port (8080) that does not exist on staging/prod (where Tapestry is ' +
      'on 80/443 via nginx and Neo4j Browser is on 7474). Story #19 explicitly bundles this fix.'
  );
  assert(
    /useConfig/.test(src),
    'Neo4jOverview.jsx does not call useConfig (story #19 / ADR 0017 §Implementation §3). The button\'s ' +
      'href must read from useConfig().neo4jBrowserUrl — same source as AdminToolsPanel. This is the ' +
      'plumbing change that makes the bug fix landed.'
  );
  assert(
    /neo4jBrowserUrl/.test(src),
    'Neo4jOverview.jsx does not reference neo4jBrowserUrl (story #19 / ADR 0017 §Implementation §3). ' +
      'Destructure { neo4jBrowserUrl } from useConfig() and use it to build the button\'s href.'
  );
});

test('T7: src/manage/taskQueue/queue/bullBoardMount.js miscLinks includes a /tapestry back-link (story #19 ACs + ADR 0017 §Implementation §4)', () => {
  const src = readSafe(BULLBOARD_MOUNT);
  assert(src !== null, 'bullBoardMount.js missing — re-baseline.');
  // Find the miscLinks region; assert the /tapestry URL appears within it.
  const miscIdx = src.indexOf('miscLinks');
  assert(
    miscIdx !== -1,
    'bullBoardMount.js no longer references miscLinks (story #18 / ADR 0016 regression). The miscLinks ' +
      'slot was added during story #18; story #19 populates it. Restore the miscLinks key in the ' +
      'uiConfig options.'
  );
  // Allow ~400 chars after miscLinks to find the entry (multi-line arrays).
  const miscRegion = src.slice(miscIdx, miscIdx + 400);
  assert(
    /['"`]\/tapestry['"`]/.test(miscRegion),
    'bullBoardMount.js miscLinks does not contain a /tapestry back-link (story #19 ACs §BullBoard ' +
      'cross-link + ADR 0017 §Implementation §4). Change miscLinks from [] to [{ text: \'← Tapestry ' +
      'Dashboard\', url: \'/tapestry\' }] so operators inside BullBoard can navigate back to the Tapestry ' +
      'dashboard. URL is /tapestry (the canonical dashboard route per App.jsx:108).'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinels — PASS now AND post-implementation.
// ---------------------------------------------------------------------------

test('R1: ConfigContext.jsx still exposes the existing three fields (taPubkey, ownerPubkey, aRelays) — extension is additive (story #19 ADR 0017 §Implementation §1)', () => {
  const src = readSafe(CONFIG_CONTEXT_JSX);
  assert(src !== null, 'ConfigContext.jsx missing — re-baseline.');
  for (const field of ['taPubkey', 'ownerPubkey', 'aRelays']) {
    assert(
      new RegExp('\\b' + field + '\\b').test(src),
      'R1: ConfigContext.jsx no longer references the existing field `' + field + '` (story #19 ' +
        'regression). The story-#19 extension is purely ADDITIVE: it adds a 4th fetch + a 4th field ' +
        '(neo4jBrowserUrl). The existing three fields (taPubkey, ownerPubkey, aRelays) must remain ' +
        'untouched — multiple other pages consume them.'
    );
  }
  // Also pin that the existing three fetches still happen.
  for (const endpoint of ['/api/assistant/pubkey', '/api/owner/pubkey', '/api/relays']) {
    assert(
      new RegExp(endpoint.replace(/\//g, '\\/')).test(src),
      'R1: ConfigContext.jsx no longer fetches `' + endpoint + '` (story #19 regression). The story-#19 ' +
        'extension adds a parallel /api/status fetch; the existing three fetches must remain.'
    );
  }
});

test('R2: src/api/admin/index.js still declares requireOwnerOrAdmin (story #18 / ADR 0016 contract preserved)', () => {
  const src = readSafe(ADMIN_INDEX);
  assert(src !== null, 'src/api/admin/index.js missing — re-baseline.');
  assert(
    /function\s+requireOwnerOrAdmin\b/.test(src),
    'R2: src/api/admin/index.js no longer declares function requireOwnerOrAdmin (story #18 / ADR 0016 ' +
      'regression caused by story #19). The story #18 server-side gate is the REAL access control for ' +
      'BullBoard; the story #19 UI gate is defense-in-depth only. Removing requireOwnerOrAdmin breaks ' +
      'the BullBoard mount\'s auth (Express middleware) AND the privilege-escalation guardrail in ' +
      'test/bullboard-admin-access.test.js T7. Story #19 must NOT touch the server-side auth.'
  );
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail };
}

module.exports = { run };
