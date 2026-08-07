/**
 * shared-concepts-adoption #9 — clickable queue rows → raw header event view.
 * Story: engineering-team/stories/shared-concepts-adoption/9-adoption-row-raw-event-view.md
 * (fast-track: no ADR; UI-only — no server change, so the pins are structural)
 *
 *   S1 — the page exists (fetches the public strfry scan, reads the :coord
 *        param) and its route is registered under shared-concepts.
 *   S2 — all four queue tables are row-clickable to the header path, with
 *        declined rows navigating by their `target`.
 *   S3 (regression, passes pre AND post) — the queue's action affordances
 *        keep their stopPropagation (button clicks must not trigger the row
 *        navigation).
 *
 * EXPECTED NOW (pre-implementation): S1, S2 FAIL; S3 PASS.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APP_JSX = path.join(ROOT, 'ui/src/App.jsx');
const QUEUE_PAGE_JSX = path.join(ROOT, 'ui/src/pages/shared-concepts/AdoptionQueue.jsx');
const EVENT_PAGE_JSX = path.join(ROOT, 'ui/src/pages/shared-concepts/HeaderEvent.jsx');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

test('S1: the header-event page exists and its route is registered', () => {
  const page = safeRead(EVENT_PAGE_JSX);
  assert(page, 'ui/src/pages/shared-concepts/HeaderEvent.jsx is missing');
  assert(/api\/strfry\/scan/.test(page), 'the page must fetch the event via the public /api/strfry/scan');
  assert(/useParams/.test(page), 'the page must read its coordinate from the route param');
  assert(/JSON\.stringify\([^)]*,\s*null,\s*2\)/.test(page), 'the page must pretty-print the raw event JSON');
  const app = safeRead(APP_JSX);
  assert(app, 'App.jsx unreadable');
  assert(/path:\s*['"`]header\/:coord['"`]/.test(app) && /HeaderEvent/.test(app),
    "App.jsx must register 'header/:coord' under shared-concepts (story #9)");
});

test('S2: all four queue tables are row-clickable to the header path (declined by target)', () => {
  const page = safeRead(QUEUE_PAGE_JSX);
  assert(page, 'AdoptionQueue.jsx unreadable');
  const clicks = (page.match(/onRowClick=/g) || []).length;
  assert(clicks >= 4,
    `all four tables (nominations, declined, mine, kept-private reveal) must carry onRowClick — found ${clicks}`);
  assert(/shared-concepts\/header\//.test(page), 'row clicks must navigate to the header-event path');
  assert(/onRowClick=\{[^}]*\.target/.test(page), "declined rows carry `target`, not `coord` — the declined table must navigate by it");
});

test('S3 (regression, passes pre AND post): action buttons keep stopPropagation', () => {
  const page = safeRead(QUEUE_PAGE_JSX);
  assert(page, 'AdoptionQueue.jsx unreadable');
  const stops = (page.match(/stopPropagation/g) || []).length;
  assert(stops >= 4,
    `the in-row action buttons must retain stopPropagation so clicks don't trigger row navigation — found ${stops}`);
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
  console.log(`\nadoption-raw-event-view: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, skipped, failures };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail ? 1 : 0));
}
