/**
 * Story #12 / ADR 0009 — Coordinate shared raw-data CSV cache for personalized
 * GrapeRank.
 *
 * Source/structural sentinels pin the ADR-required code shape. The behavioral
 * proof — two concurrent customer recalcs actually serialize on `flock`,
 * atomic-rename actually prevents partial reads under contention, cache-aware
 * eviction actually skips when a peer holds the lock, and the structured event
 * stream actually reflects hit/wait/init/evict outcomes — is reproducible only
 * against the live Docker stack and is the **authoritative cycle-local smoke**
 * (Reviewer-required, per ADR 0009 + project precedent #10/#11).
 *
 * T1..T9 + T8a/T8b/T8c : FAIL pre-implementation, PASS post.
 * R1, R2               : PASS pre AND post — regression guards on the rest of
 *                        the customer-aware pipeline and the per-customer
 *                        cleanup that the new model deliberately leaves alone.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HELPER             = path.join(ROOT, 'src/algos/personalizedGrapeRank/ensureRawDataCsv.sh');
const CUSTOMER_DRIVER    = path.join(ROOT, 'src/algos/customers/personalizedGrapeRank/personalizedGrapeRank.sh');
const OWNER_DRIVER       = path.join(ROOT, 'src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRank.sh');
const OWNER_CONTROLLER   = path.join(ROOT, 'src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRankController.sh');
const ALL_OWNER_ORCH     = path.join(ROOT, 'src/algos/updateAllScoresForOwner.sh');
const ALL_CUST_ORCH      = path.join(ROOT, 'src/algos/customers/processAllActiveCustomers.sh');
const SINGLE_CUST        = path.join(ROOT, 'src/algos/customers/updateAllScoresForSingleCustomer.sh');
const GRAPERANK_CONF_TPL = path.join(ROOT, 'config/graperank.conf.template');

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (_e) { return null; }
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once Story #12 is implemented per ADR 0009.
// ---------------------------------------------------------------------------

test('T1: ensureRawDataCsv.sh helper exists at the ADR-specified path (AC-1, AC-2, ADR 0009 §Implementation notes)', () => {
  assert(
    fs.existsSync(HELPER),
    'Helper file does not exist at src/algos/personalizedGrapeRank/ensureRawDataCsv.sh (AC-1/AC-2; ADR 0009). ' +
      'Create the sourceable helper that owns the shared raw-data CSV lifecycle for both the customer-aware ' +
      'and owner-scoped pipelines.'
  );
});

test('T2: ensureRawDataCsv.sh uses flock(1) for shared/exclusive coordination (AC-2, AC-3, ADR 0009 §Option A)', () => {
  const src = readSafe(HELPER);
  assert(src !== null, 'Helper file missing — T1 must pass first.');
  // The chosen primitive is flock(1) with shared (-s) and exclusive (-x) modes.
  // The Implementer must invoke flock at least once. Without it the helper has
  // no coordination protocol and AC-2 (exactly-one-init under contention) is
  // unsatisfiable.
  assert(
    /\bflock\b/.test(src),
    'Helper does not invoke flock(1) (AC-2/AC-3; ADR 0009). Without an advisory lock the existence-check ' +
      'guard the ADR replaces remains TOCTOU-racy. Use `flock -s` for read-share and `flock -x` for ' +
      'exclusive init; release happens automatically on fd close.'
  );
});

test('T3: ensureRawDataCsv.sh publishes via .partial + atomic rename to prevent partial reads (AC-3, ADR 0009 §Option A step 6)', () => {
  const src = readSafe(HELPER);
  assert(src !== null, 'Helper file missing — T1 must pass first.');
  // POSIX rename(2) is atomic; cypher-shell's `>` redirection is not. The ADR
  // pins the .partial intermediate filename + mv as the deterministic guard
  // against AC-3 ("no run reads a partially-written CSV file under any
  // concurrency pattern"). Pin both tokens; allow any one-of-four CSV name in
  // between.
  assert(
    /\.partial\b/.test(src),
    'Helper does not use a `.partial` intermediate filename (AC-3; ADR 0009 §Option A step 6). The atomic ' +
      'rename pattern is: stream cypher-shell output to <name>.csv.partial, then `mv <name>.csv.partial ' +
      '<name>.csv`. Without this, a concurrent reader can hit a truncated/streaming CSV.'
  );
  assert(
    /\bmv\b[^\n]*\.partial/.test(src),
    'Helper does not `mv` from the .partial intermediate to the published CSV path (AC-3; ADR 0009 §Option ' +
      'A step 6). Atomic rename is the deterministic guarantee that no reader sees a partial file.'
  );
});

test('T4: ensureRawDataCsv.sh checks freshness against .last_init and reads RAW_CSV_STALENESS_SECONDS (AC-4, AC-5, ADR 0009 §Option A steps 3, 5)', () => {
  const src = readSafe(HELPER);
  assert(src !== null, 'Helper file missing — T1 must pass first.');
  // ADR pins the freshness model: an mtime sentinel `.last_init` plus a
  // configurable window `RAW_CSV_STALENESS_SECONDS`. Both tokens must appear
  // in the helper.
  assert(
    /\.last_init\b/.test(src),
    'Helper does not reference the `.last_init` freshness sentinel (AC-4; ADR 0009 §Option A step 3). The ' +
      'sentinel mtime is what distinguishes "cache fresh" from "cache stale, must re-init". Touching it ' +
      'AFTER the four atomic renames is what makes step 3 reliable.'
  );
  assert(
    /\bRAW_CSV_STALENESS_SECONDS\b/.test(src),
    'Helper does not consume RAW_CSV_STALENESS_SECONDS (AC-4/AC-5; ADR 0009 §Option A step 3 + §Staleness ' +
      'window default). The staleness window must be operator-configurable; the helper is the consumer.'
  );
});

test('T5: ensureRawDataCsv.sh emits the ADR-required structured-event phase tokens (AC-10, ADR 0009 §Structured events)', () => {
  const src = readSafe(HELPER);
  assert(src !== null, 'Helper file missing — T1 must pass first.');
  // AC-10: "Structured event log makes it visible when a run waited for /
  // shared / re-used cached CSVs vs ran a fresh init." ADR §Structured events
  // pins the phase vocabulary. At minimum the helper must emit `csv_cache_hit`
  // (reuse), and the `csv_cache_init_begin`/`csv_cache_init_end` pair (fresh
  // init). Without these the operator cannot distinguish the two outcomes.
  assert(
    /\bcsv_cache_hit\b/.test(src),
    'Helper does not emit a `csv_cache_hit` structured-event phase (AC-10; ADR 0009 §Structured events). ' +
      'Without it the operator cannot observe cache reuse.'
  );
  assert(
    /\bcsv_cache_init_begin\b/.test(src) && /\bcsv_cache_init_end\b/.test(src),
    'Helper does not emit the `csv_cache_init_begin`/`csv_cache_init_end` pair (AC-10; ADR 0009 §Structured ' +
      'events). Without these phases the operator cannot observe fresh-init events or their duration.'
  );
});

test('T6: customer-aware personalizedGrapeRank.sh sources the helper and drops the non-atomic existence-check guard (AC-1, AC-2, ADR 0009 §Implementation notes)', () => {
  const src = readSafe(CUSTOMER_DRIVER);
  assert(src !== null, 'Customer-aware driver script missing at expected path — re-baseline this sentinel.');
  assert(
    /ensureRawDataCsv/.test(src),
    'src/algos/customers/personalizedGrapeRank/personalizedGrapeRank.sh does not reference the new helper ' +
      'ensureRawDataCsv (AC-1/AC-2; ADR 0009 §Implementation notes). The customer-aware driver must source ' +
      'the helper so the shared lock fd is inherited for the downstream pipeline.'
  );
  // The TOCTOU guard at line 81 takes the form `[ ! -f .../tmp/<name>.csv ]`.
  // Post-impl the entire guard is replaced by a helper call; no .csv-existence
  // probe survives in this script.
  assert(
    !/tmp\/(ratees|follows|mutes|reports)\.csv\s*\]/.test(src),
    'Customer-aware driver still contains the non-atomic `-f .../tmp/{ratees,follows,mutes,reports}.csv ]` ' +
      'existence-check guard (AC-1/AC-2; ADR 0009 §Context). Replace the guard with a single call into ' +
      'ensureRawDataCsv; the helper owns freshness internally.'
  );
});

test('T7: owner-scoped calculatePersonalizedGrapeRank.sh sources the helper, drops inline extraction, and drops the trailing `rm -rf $TEMP_DIR` (AC-7, AC-8, ADR 0009 §Implementation notes)', () => {
  const src = readSafe(OWNER_DRIVER);
  assert(src !== null, 'Owner-scoped driver script missing at expected path — re-baseline this sentinel.');
  assert(
    /ensureRawDataCsv/.test(src),
    'src/algos/personalizedGrapeRank/calculatePersonalizedGrapeRank.sh does not reference the new helper ' +
      'ensureRawDataCsv (AC-7; ADR 0009 §Implementation notes). The owner-scoped script must fold into the ' +
      'same shared-cache locking protocol by sourcing the helper.'
  );
  // Pre-impl: the script extracts inline via `cypher-shell ... > $TEMP_DIR/<name>.csv`
  // (lines 51-54). Post-impl: extraction moves to the helper; the owner script
  // no longer writes those paths directly.
  assert(
    !/cypher-shell[^\n]*>\s*\$\{?TEMP_DIR\}?\/(ratees|follows|mutes|reports)\.csv/.test(src),
    'Owner-scoped driver still writes the shared root CSVs inline via `cypher-shell > $TEMP_DIR/<name>.csv` ' +
      '(AC-7; ADR 0009 §Implementation notes). Delegate extraction to ensureRawDataCsv — duplicating the ' +
      'Cypher here re-introduces the very race the helper exists to eliminate.'
  );
  // Pre-impl: trailing `rm -rf "$TEMP_DIR"` at lines 84-87 wipes the shared
  // cache the moment the owner pipeline finishes. Post-impl: the cache
  // outlives the script.
  assert(
    !/rm\s+-rf\s+"?\$\{?TEMP_DIR\}?"?/.test(src),
    'Owner-scoped driver still contains a trailing `rm -rf "$TEMP_DIR"` (AC-7/AC-8; ADR 0009 §Implementation ' +
      'notes). The cache must survive the owner script the same way it survives a customer recalc; ' +
      'eviction belongs at the orchestrator boundaries and must be cache-aware (see T8a/T8b/T8c).'
  );
});

test('T8a: processAllActiveCustomers.sh end-of-batch cleanup is cache-aware (AC-8, ADR 0009 §Decision)', () => {
  const src = readSafe(ALL_CUST_ORCH);
  assert(src !== null, 'processAllActiveCustomers.sh missing at expected path — re-baseline this sentinel.');
  // The bare `rm -rf /var/lib/brainstorm/algos/personalizedGrapeRank/tmp` form
  // is exactly what the ADR forbids: it deletes files an in-flight peer may
  // be reading. Post-impl: cleanup must hold a non-blocking exclusive flock
  // and target only the four shared CSVs + .last_init.
  assert(
    !/rm\s+-rf\s+\/var\/lib\/brainstorm\/algos\/personalizedGrapeRank\/tmp\s*$/m.test(src),
    'processAllActiveCustomers.sh still wipes the entire shared tmp directory unconditionally (AC-8; ADR ' +
      '0009 §Decision). Replace the bare `rm -rf .../tmp` with a non-blocking exclusive `flock -x -n` ' +
      'guarded wipe of only the four shared CSVs + `.last_init`. If the lock cannot be acquired (peer in ' +
      'flight), skip and emit `csv_cache_evict_skipped`.'
  );
  assert(
    /\bflock\b/.test(src),
    'processAllActiveCustomers.sh end-of-batch cleanup does not invoke flock (AC-8; ADR 0009 §Decision). ' +
      'The cache-aware cleanup pattern requires a non-blocking exclusive lock; without it cleanup can race ' +
      'with an in-flight reader.'
  );
});

test('T8b: updateAllScoresForOwner.sh end-of-pipeline cleanup is cache-aware (AC-8, AC-7, ADR 0009 §Decision)', () => {
  const src = readSafe(ALL_OWNER_ORCH);
  assert(src !== null, 'updateAllScoresForOwner.sh missing at expected path — re-baseline this sentinel.');
  assert(
    !/rm\s+-rf\s+\/var\/lib\/brainstorm\/algos\/personalizedGrapeRank\/tmp\s*$/m.test(src),
    'updateAllScoresForOwner.sh still wipes the entire shared tmp directory unconditionally (AC-8; ADR ' +
      '0009 §Decision). The owner pipeline shares the cache with concurrent customer recalcs under the new ' +
      'protocol; replace with the same `flock -x -n` cache-aware variant used in processAllActiveCustomers.'
  );
  assert(
    /\bflock\b/.test(src),
    'updateAllScoresForOwner.sh end-of-pipeline cleanup does not invoke flock (AC-8; ADR 0009 §Decision). ' +
      'Without it the owner pipeline can yank the cache out from under an in-flight customer recalc.'
  );
});

test('T8c: calculatePersonalizedGrapeRankController.sh cleanup_graperank_tmp trap is cache-aware (AC-8, AC-7, ADR 0009 §Implementation notes)', () => {
  const src = readSafe(OWNER_CONTROLLER);
  assert(src !== null, 'calculatePersonalizedGrapeRankController.sh missing at expected path — re-baseline this sentinel.');
  assert(
    !/rm\s+-rf\s+\/var\/lib\/brainstorm\/algos\/personalizedGrapeRank\/tmp\s*$/m.test(src),
    'calculatePersonalizedGrapeRankController.sh trap EXIT still bulk-wipes the shared tmp (AC-8; ADR 0009 ' +
      '§Implementation notes). A trap that fires on retry/timeout in this controller can race against an ' +
      'in-flight customer recalc — replace with the cache-aware flock-guarded variant.'
  );
  assert(
    /\bflock\b/.test(src),
    'calculatePersonalizedGrapeRankController.sh cleanup_graperank_tmp does not invoke flock (AC-8; ADR ' +
      '0009 §Implementation notes). Without a non-blocking exclusive lock, the trap can delete a CSV a ' +
      'peer is mid-read.'
  );
});

test('T9: graperank.conf.template defines RAW_CSV_STALENESS_SECONDS with a numeric default (AC-5, ADR 0009 §Staleness window default)', () => {
  const src = readSafe(GRAPERANK_CONF_TPL);
  assert(src !== null, 'config/graperank.conf.template missing at expected path — re-baseline this sentinel.');
  // ADR §Staleness window default specifies a default of 1800. Tolerate the
  // Implementer choosing a different number only by writing the conf knob; if
  // the number itself needs to change, that is a follow-up ADR, not a Tester
  // call. Pin the canonical 1800 as the regression-protected default value.
  assert(
    /export\s+RAW_CSV_STALENESS_SECONDS\s*=\s*1800\b/.test(src),
    'config/graperank.conf.template does not define `export RAW_CSV_STALENESS_SECONDS=1800` (AC-5; ADR ' +
      '0009 §Staleness window default). The knob must be present in the template (deployment installs it ' +
      'at /etc/graperank.conf) with the ADR-recommended 1800-second default.'
  );
});

// ---------------------------------------------------------------------------
// Regression sentinels — PASS now AND post-implementation.
// ---------------------------------------------------------------------------

test('R1: customer-aware downstream pipeline phases are preserved end-to-end (AC-9, regression guard)', () => {
  const src = readSafe(CUSTOMER_DRIVER);
  assert(src !== null, 'Customer-aware driver script missing — re-baseline this sentinel.');
  // AC-9: "No regression: single-customer single-run flows produce identical
  // outputs to today." The four downstream child scripts that consume the
  // shared CSVs (or the per-customer outputs derived from them) must still
  // be invoked in sequence. R1 flips ⇒ the Implementer broke prior behavior.
  assert(src.includes('interpretRatings.js'),       'R1: customer driver no longer invokes interpretRatings.js — the ratings-interpretation phase is broken.');
  assert(src.includes('initializeScorecards.js'),   'R1: customer driver no longer invokes initializeScorecards.js — the scorecards-init phase is broken.');
  assert(src.includes('calculateGrapeRank.js'),     'R1: customer driver no longer invokes calculateGrapeRank.js — the GrapeRank-iteration phase is broken.');
  assert(src.includes('updateNeo4jWithApoc.js'),    'R1: customer driver no longer invokes updateNeo4jWithApoc.js — the Neo4j-write phase is broken.');
});

test('R2: per-customer subdirectory cleanup in updateAllScoresForSingleCustomer.sh is preserved (AC-8, regression guard)', () => {
  const src = readSafe(SINGLE_CUST);
  assert(src !== null, 'updateAllScoresForSingleCustomer.sh missing — re-baseline this sentinel.');
  // The story is explicit: per-customer outputs are already correctly
  // namespaced and the per-customer cleanup at lines 499-502 is correct.
  // The new protocol must NOT regress this — the cache-aware pattern targets
  // only the four shared root CSVs; per-customer subdir cleanup is untouched.
  assert(
    /rm\s+-rf\s+"?\/var\/lib\/brainstorm\/algos\/personalizedGrapeRank\/tmp\/\$\{?CUSTOMER_DIRECTORY_NAME\}?"?/.test(src),
    'R2: updateAllScoresForSingleCustomer.sh no longer scopes its cleanup to `tmp/${CUSTOMER_DIRECTORY_NAME}` ' +
      '— per-customer subdir cleanup was deliberately left intact by ADR 0009. Restoring this scope is ' +
      'required (the new cache-aware bulk wipe targets only the four shared root CSVs + sentinel).'
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
