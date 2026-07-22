/**
 * Bug: Users page calls the removed `run-query` endpoint (Neo4j user list broken).
 *
 * Story: engineering-team/stories/users-page-run-query-regression.md
 * Origin: security-auth-exposure book prelude — `GET /api/neo4j/run-query` was deleted
 *         2026-07-19 (unauthenticated RCE + credential leak) and shipped to all three
 *         instances, but ui/src/pages/users/Index.jsx still fetched it on mount.
 *
 * Stack-free source sentinels (no Neo4j/Redis; assert on the shipped source):
 *
 *   AC-2 (regression guard, whole class): NO file under ui/src references the removed
 *         `/api/neo4j/run-query` endpoint. This is the class-level guard — if any client
 *         code calls a deleted backend route again, this fails.
 *   AC-1 (positive): the Users page issues a POST to `/api/neo4j/query` with a `cypher`
 *         body (the replacement, which preserves the `cypherResults` CSV shape the page
 *         parses).
 *
 * The AC-2 test FAILS until the fix lands: today Index.jsx fetches
 * `/api/neo4j/run-query?cypher=…`. That is the point.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const UI_SRC = path.join(ROOT, 'ui/src');
const USERS_INDEX = path.join(ROOT, 'ui/src/pages/users/Index.jsx');

function assert(cond, msg) { if (!cond) throw new Error(msg); }
function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } }

/** Recursively list *.js / *.jsx files under a directory. */
function listSource(dir) {
  const out = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listSource(full));
    else if (/\.(js|jsx)$/.test(e.name)) out.push(full);
  }
  return out;
}

const REMOVED_ENDPOINT = 'neo4j/run-query';

const tests = [
  ['AC-2: no ui/src file references the removed run-query endpoint', () => {
    const files = listSource(UI_SRC);
    assert(files.length > 0, `expected to find source under ${UI_SRC}, found none`);
    const offenders = files.filter(f => (readSafe(f) || '').includes(REMOVED_ENDPOINT));
    const rel = offenders.map(f => path.relative(ROOT, f));
    assert(
      offenders.length === 0,
      `these ui/src files still call the removed GET /api/${REMOVED_ENDPOINT} ` +
      `(deleted 2026-07-19; use POST /api/neo4j/query): ${rel.join(', ')}`
    );
  }],

  ['AC-1: Users page POSTs { cypher } to /api/neo4j/query', () => {
    const src = readSafe(USERS_INDEX);
    assert(src !== null, `could not read ${path.relative(ROOT, USERS_INDEX)}`);
    assert(
      src.includes('/api/neo4j/query'),
      'Users page no longer targets /api/neo4j/query (the replacement read endpoint)'
    );
    // The replacement is a POST with a JSON { cypher } body, not a query-string GET.
    assert(
      /method:\s*['"]POST['"]/.test(src) && /cypher/.test(src),
      'Users page must POST a { cypher } body to /api/neo4j/query (the GET query-string form was removed)'
    );
  }],
];

async function run() {
  console.log('\n--- users-page neo4j endpoint regression guard (run-query removal) ---');
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
  console.log(`\nusers-page-neo4j-endpoint: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

if (require.main === module) {
  run().then(({ fail }) => process.exit(fail === 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { run };
