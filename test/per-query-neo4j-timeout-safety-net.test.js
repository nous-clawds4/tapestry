/**
 * Story #5: Per-query Neo4j timeout for /api/get-user-data.
 *
 * The handler at src/api/export/users/queries/userdata.js calls
 *   session.run(cypherQuery)
 * with no transactionConfig, so a runaway Cypher query (e.g. for Jack —
 * pubkey 04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9 —
 * which fans out across hundreds of thousands of follow edges) hangs until
 * the nginx upstream drops the client. There's no application-layer
 * deadline and no structured failure response.
 *
 * These tests pin the safety net: a driver-layer timeout (default 15s,
 * configurable via NEO4J_QUERY_TIMEOUT_MS), a 504 JSON response branch
 * with success:false, an elapsed-time log distinct from the generic
 * Neo4j-error log, and a corresponding note in docs/SMOKE_TEST.md so the
 * smoke runner treats the 504 as expected until story #6 fixes the
 * underlying Cypher fan-out.
 *
 * Tests are intentionally source-regex (matching the project's
 * scheduled-search-and-house-scores-refresh and strfry-router-first-boot
 * precedents) so the spec is pinned without prescribing the exact wiring
 * the Implementer chooses (await/Promise/executeRead, etc.).
 */

const fs = require('fs');
const path = require('path');

const USERDATA_PATH = path.resolve(__dirname, '../src/api/export/users/queries/userdata.js');
const SMOKE_TEST_PATH = path.resolve(__dirname, '../docs/SMOKE_TEST.md');

const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

// ---------------------------------------------------------------------------
// Failing tests (T1–T5) — must FAIL pre-implementation, PASS post-implementation.
// ---------------------------------------------------------------------------

test('T1: userdata.js reads NEO4J_QUERY_TIMEOUT_MS via getConfigFromFile with a numeric default of 15000', () => {
  const src = fs.readFileSync(USERDATA_PATH, 'utf8');

  // Per story §"Open questions": key is NEO4J_QUERY_TIMEOUT_MS, default in code is 15000 (ms).
  // Read pattern must match the existing pattern for NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD.
  const re = /getConfigFromFile\(\s*['"]NEO4J_QUERY_TIMEOUT_MS['"]\s*,\s*15000\b/;
  assert(
    re.test(src),
    'userdata.js must read NEO4J_QUERY_TIMEOUT_MS via getConfigFromFile with a numeric default of 15000 (AC-5). ' +
      'Example: `const queryTimeoutMs = parseInt(getConfigFromFile(\'NEO4J_QUERY_TIMEOUT_MS\', 15000));`'
  );
});

test('T2: userdata.js passes a transactionConfig with a numeric timeout to session.run / executeRead / readTransaction', () => {
  const src = fs.readFileSync(USERDATA_PATH, 'utf8');

  // The Neo4j driver enforces transaction deadlines via { timeout: N } passed as the third arg
  // to session.run(query, params, config) or as the second arg to executeRead/readTransaction.
  // Accept any of those call shapes; reject a bare session.run(cypherQuery) with no config arg.
  // The check: somewhere in the file, an `{ timeout: <numeric or identifier> }` object appears
  // within ~400 chars of a session.run / executeRead / readTransaction call.
  const re = /session\.(run|executeRead|readTransaction|executeWrite|writeTransaction)\s*\([\s\S]{0,400}\btimeout\s*:/;
  assert(
    re.test(src),
    'userdata.js must enforce the query timeout at the Neo4j driver layer, not just on the Node side (AC-3). ' +
      'Expected `session.run(cypherQuery, {}, { timeout: queryTimeoutMs })` ' +
      '(or equivalent executeRead/readTransaction call with `{ timeout: ... }`). Current call has no transactionConfig.'
  );
});

test('T3: userdata.js has a 504 response branch with JSON body {success:false} and a message mentioning "timeout"', () => {
  const src = fs.readFileSync(USERDATA_PATH, 'utf8');

  // Must have res.status(504).json(...) somewhere.
  const statusRe = /\.status\(\s*504\s*\)\s*\.json\(/;
  assert(
    statusRe.test(src),
    'userdata.js must return HTTP 504 with a JSON body when the Neo4j query times out (AC-1, AC-6). ' +
      'No `.status(504).json(` call found.'
  );

  // The 504 JSON body must include success: false and a message mentioning timeout/timed out.
  // Capture a window around the 504 call site for the body assertion.
  const windowRe = /\.status\(\s*504\s*\)\s*\.json\(\s*\{[\s\S]{0,400}?\}/;
  const window = src.match(windowRe);
  assert(window, '504 JSON body must be an object literal — found `.status(504).json(` but could not match a body block');
  assert(
    /success\s*:\s*false/.test(window[0]),
    'The 504 JSON body must include `success: false` so clients can distinguish from a 200/2xx (AC-6). Found body: ' + window[0]
  );
  assert(
    /(timeout|timed[\s-]?out)/i.test(window[0]),
    'The 504 JSON body must include a message mentioning "timeout" (or "timed out") so the failure is self-describing (AC-1). Found body: ' +
      window[0]
  );
});

test('T4: userdata.js logs the timeout with elapsed-time context, distinct from the existing generic Neo4j-error log', () => {
  const src = fs.readFileSync(USERDATA_PATH, 'utf8');

  // AC-7: the timeout log must surface elapsed-time so operators can grep slow pubkeys without needing
  // Neo4j-side tracing. The exact log format is left to the Implementer, but the source must mention
  // `elapsed` (any casing) AND have a console.error site that references the timeout context.
  assert(
    /elapsed/i.test(src),
    'userdata.js must surface elapsed-time on timeout (AC-7) — search for "elapsed" yielded nothing. ' +
      'Suggested: include an `elapsedMs` field in the timeout log.'
  );

  // The timeout log must be distinguishable from the existing "Error fetching user data:" generic log.
  // Easiest pin: a console.error call site referencing "timeout" or "timed out" exists.
  const timeoutLogRe = /console\.error\([^)]*?(timeout|timed[\s-]?out)/i;
  assert(
    timeoutLogRe.test(src),
    'userdata.js must have a console.error call site that mentions "timeout" or "timed out" so the timeout failure is grep-able in container logs ' +
      'distinct from the existing generic `console.error(\'Error fetching user data:\', error)` line (AC-7).'
  );
});

test('T5: docs/SMOKE_TEST.md notes the get-user-data 504 expectation for the high-fanout pubkey (Jack)', () => {
  const src = fs.readFileSync(SMOKE_TEST_PATH, 'utf8');

  // AC-9: the doc must (a) reference 504 and (b) reference the high-fanout pubkey context near it,
  // so smoke runs treat the 504 as expected until story #6 lands.
  // Accept any of: explicit "504" mention plus either "Jack", the literal pubkey prefix, or "get-user-data" within ~300 chars.
  const noteRe = /504[\s\S]{0,300}(jack|04c915da|get-user-data|story\s*#?\s*6)|(?:jack|04c915da|get-user-data|story\s*#?\s*6)[\s\S]{0,300}504/i;
  assert(
    noteRe.test(src),
    'docs/SMOKE_TEST.md must note that /api/get-user-data is expected to return 504 for the high-fanout pubkey (Jack) ' +
      'until story #6 lands (AC-9). No co-located "504" + Jack/get-user-data/story #6 reference found.'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinels (R1–R3) — must PASS pre-implementation AND post-implementation.
// If they flip to FAIL during Implementation, an existing behavior was broken.
// ---------------------------------------------------------------------------

test('R1: userdata.js still closes session and driver in the .finally cleanup path (no resource leak on timeout)', () => {
  const src = fs.readFileSync(USERDATA_PATH, 'utf8');

  // The existing .finally block at userdata.js:275-278 must remain — it's what guarantees that
  // both the new timeout path and the existing error path release the bolt session and driver.
  // AC-4 is satisfied by leaving this in place; if the Implementer introduces a try/catch that
  // bypasses .finally, this sentinel flips to FAIL.
  const re = /\.finally\(\s*\(\s*\)\s*=>\s*\{[\s\S]*?session\.close\(\)[\s\S]*?driver\.close\(\)/;
  assert(
    re.test(src),
    'userdata.js must keep the `.finally(() => { session.close(); driver.close(); ... })` cleanup so no bolt session leaks ' +
      'on the new timeout path (AC-4). The sentinel is failing — the existing .finally block was removed or restructured.'
  );
});

test('R2: userdata.js still returns 500 with success:false for non-timeout Neo4j errors (existing error path unregressed)', () => {
  const src = fs.readFileSync(USERDATA_PATH, 'utf8');

  // AC-8: the new 504 branch must be additive, not a replacement. The existing 500 path stays.
  const re = /\.status\(\s*500\s*\)[\s\S]{0,200}success\s*:\s*false/;
  assert(
    re.test(src),
    'userdata.js must preserve its existing 500 + {success:false} error path for non-timeout Neo4j errors (AC-8). ' +
      'The sentinel is failing — the generic error branch appears to have been removed or changed.'
  );
});

test('R3: userdata.js still emits the existing 200 response shape (success/isUserInNeo4j/metaData/data)', () => {
  const src = fs.readFileSync(USERDATA_PATH, 'utf8');

  // AC-2: a fast pubkey must still get the same top-level response shape.
  // Scope the check to the `apiResponse` object literal so we accept both
  // colon form (`success: true`) and shorthand form (`isUserInNeo4j,`) and don't
  // false-match the four key names elsewhere in the file.
  const m = src.match(/const\s+apiResponse\s*=\s*\{[\s\S]*?\};/);
  assert(
    m,
    'userdata.js must construct an `apiResponse` object literal for the 200 response (AC-2). The sentinel cannot find it.'
  );
  const block = m[0];

  for (const key of ['success', 'isUserInNeo4j', 'metaData', 'data']) {
    const re = new RegExp('\\b' + key + '\\b');
    assert(
      re.test(block),
      `userdata.js apiResponse object must still include the \`${key}\` top-level key on the 200 response (AC-2). ` +
        'The sentinel is failing — the happy-path response shape was changed.'
    );
  }
});

async function run() {
  let pass = 0;
  let fail = 0;
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
