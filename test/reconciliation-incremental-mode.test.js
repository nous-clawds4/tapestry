/**
 * Story #21 / ADR 0018 — Reconciliation: author-restricted extraction with
 * `recent` / `all` / `author` modes.
 *
 * Source/structural sentinels pin the ADR-required code shape. The behavioral
 * heart — does `reconcileRecent` produce Neo4j edge sets identical to
 * `reconcileAll` (the oracle); does the no-drift no-op return cheaply; does
 * `reconcileAuthor` touch only one author; does an injected non-event drift get
 * missed by `recent` but caught by `all`; does the watermark survive a failed
 * run — is reproducible only against the live strfry + Neo4j Docker stack with
 * seeded data, and is the **authoritative cycle-local smoke** (Reviewer-required,
 * per project precedent #5/#6/#8/#10/#11/#12/#13/#15). See the test plan's
 * "Not covered (deferred to cycle-local smoke)" section.
 *
 * T1..T10 : FAIL pre-implementation, PASS post.
 * R1..R5  : PASS pre AND post — regression guards on the machinery ADR 0018
 *           reuses verbatim (the per-author SET diff, the converters, the APOC
 *           apply, cleanup(), and the strfry `--recent` capability).
 *
 * NOTE on behavioral coverage: the reconciliation Node scripts require runtime
 * deps (e.g. `yargs`) that live only in the production install
 * (/usr/local/lib/node_modules/brainstorm), not in this dev checkout — so they
 * cannot be invoked from `npm test`. The behavioral set-diff verification
 * (same-count-different-membership → one add + one delete; missing-side → all
 * adds / all deletes) is therefore exercised in cycle-local smoke against the
 * live stack. R1 pins the set-based shape at the source level here.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const RECON            = path.join(ROOT, 'src/pipeline/reconciliation');
const RECON_SH         = path.join(RECON, 'reconciliation.sh');
const STATE_HELPER     = path.join(RECON, 'reconciliationState.sh'); // ADR-suggested; may live inline in reconciliation.sh
const EXTRACT_FOLLOWS  = path.join(RECON, 'getCurrentFollowsFromNeo4j.js');
const EXTRACT_MUTES    = path.join(RECON, 'getCurrentMutesFromNeo4j.js');
const EXTRACT_REPORTS  = path.join(RECON, 'getCurrentReportsFromNeo4j.js');
const DIFF_FOLLOWS     = path.join(RECON, 'calculateFollowsUpdates.js');
const CONVERTER_FOLLOWS= path.join(RECON, 'kind3EventsToFollows.js');
const APOC_ADD         = path.join(RECON, 'apocCypherCommands/apocCypherCommand1_followsToAddToNeo4j');
const APOC_DEL         = path.join(RECON, 'apocCypherCommands/apocCypherCommand1_followsToDeleteFromNeo4j');
const STRFRY = [
  path.join(RECON, 'strfryToKind3Events.sh'),
  path.join(RECON, 'strfryToKind10000Events.sh'),
  path.join(RECON, 'strfryToKind1984Events.sh'),
];
const TASK_REGISTRY = path.join(ROOT, 'src/manage/taskQueue/taskRegistry.json');
const OPERATIONS_MD = path.join(ROOT, 'OPERATIONS.md');

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (_e) { return null; }
}
function readJsonSafe(p) {
  const s = readSafe(p);
  if (s === null) return null;
  try { return JSON.parse(s); }
  catch (_e) { return null; }
}
// Watermark logic may live in reconciliation.sh directly or in a sibling
// helper — search both so the sentinel doesn't over-constrain file layout.
function reconSource() {
  return [readSafe(RECON_SH) || '', readSafe(STATE_HELPER) || ''].join('\n');
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ---------------------------------------------------------------------------
// Failing sentinels — FAIL now, PASS once Story #21 is implemented per ADR 0018.
// ---------------------------------------------------------------------------

test('T1: reconciliation persists a watermark in state.json across runs (AC-3; ADR 0018 §Impl 1)', () => {
  const src = reconSource();
  assert(
    /state\.json/.test(src),
    'Reconciliation does not reference a persisted state.json watermark file (AC-3; ADR 0018 §Implementation ' +
      'notes 1). `reconcileRecent` must persist a watermark across runs at ' +
      '/var/lib/brainstorm/pipeline/reconciliation/state.json so each run only inspects authors changed since ' +
      'the prior successful run. Add the read/write helper (reconciliationState.sh) or inline it in ' +
      'reconciliation.sh.'
  );
  assert(
    /lastRunStartedAt|watermark/.test(src),
    'Reconciliation references no watermark field (e.g. lastRunStartedAt) (AC-3; ADR 0018 §Impl 1). The state ' +
      'file records the last successful run start so the next `recent` run can compute its --recent window.'
  );
});

test('T2: reconciliation.sh accepts --mode recent|all|author (+ --pubkey for author) (AC-2, AC-6; ADR 0018 §Impl 2)', () => {
  const src = readSafe(RECON_SH);
  assert(src !== null, 'reconciliation.sh missing — re-baseline this sentinel.');
  assert(
    /--mode/.test(src),
    'reconciliation.sh does not parse a --mode flag (AC-2, AC-6; ADR 0018 §Impl 2). One engine, three ' +
      'author-scoped modes: recent (incremental), all (full/oracle), author (single pubkey). The operator ' +
      'must reach all three via the same script.'
  );
  for (const mode of ['recent', 'author']) {
    assert(
      new RegExp('\\b' + mode + '\\b').test(src),
      'reconciliation.sh has no handling for `--mode ' + mode + '` (AC-2, AC-6; ADR 0018 §Impl 2). The three ' +
        'modes are recent / all / author.'
    );
  }
  assert(
    /--mode\s+all\b|\ball\)/.test(src) || /\ball\b/.test(src),
    'reconciliation.sh has no handling for `--mode all` (AC-2; ADR 0018 §Impl 2). `all` is today\'s full-graph ' +
      'sweep — the correctness oracle and weekly fallback.'
  );
  assert(
    /--pubkey/.test(src),
    'reconciliation.sh does not accept --pubkey (AC-6; ADR 0018 §Impl 2). `--mode author` reconciles a single ' +
      'author identified by --pubkey <hex>.'
  );
});

test('T3: reconcileRecent passes --recent (computed from the watermark + overlap) to the strfry dumpers (AC-1, AC-3; ADR 0018 §Impl 2)', () => {
  const src = readSafe(RECON_SH);
  assert(src !== null, 'reconciliation.sh missing — re-baseline this sentinel.');
  assert(
    /--recent/.test(src),
    'reconciliation.sh never invokes the strfry dumpers with --recent (AC-1, AC-3; ADR 0018 §Impl 2). Today it ' +
      'calls strfryToKind*Events.sh with no args (full history). In `recent` mode it must pass ' +
      '`--recent $(( now - T ))` so only events since the watermark are scanned — the single biggest lever ' +
      'behind the minutes-not-hours target.'
  );
  assert(
    /RECONCILIATION_OVERLAP_SECONDS/.test(src),
    'reconciliation.sh does not use RECONCILIATION_OVERLAP_SECONDS (AC-3; ADR 0018 §Impl 2,5). The scan window ' +
      'is `lastRunStartedAt - RECONCILIATION_OVERLAP_SECONDS` (default 3600) so events that landed during the ' +
      'prior run are re-covered; re-scanning already-reconciled authors is idempotent.'
  );
});

test('T4: reconcileRecent has a cheap no-drift early-exit when no events since the watermark (AC-7; ADR 0018 §Impl 2,6)', () => {
  const src = readSafe(RECON_SH);
  assert(src !== null, 'reconciliation.sh missing — re-baseline this sentinel.');
  assert(
    /no_drift/.test(src),
    'reconciliation.sh has no `no_drift` early-exit path (AC-7; ADR 0018 §Impl 2,6). When `strfry scan --count` ' +
      'reports zero events since the watermark, emit a PROGRESS event with phase "no_drift", advance the ' +
      'watermark, and exit 0 — reconciliation should report "no drift detected" cheaply rather than churning ' +
      'empty pipeline stages.'
  );
  assert(
    /--count/.test(src),
    'reconciliation.sh does not use `strfry scan --count` for the no-drift pre-check (AC-7; ADR 0018 §Impl 2). ' +
      'The early-exit is gated on the count of events since the watermark being zero.'
  );
});

test('T5: reconcileRecent bootstraps with a full pass when no watermark exists (first-run-after-deploy) (AC-5; ADR 0018 §Decision, §Impl 2,6)', () => {
  const src = reconSource();
  assert(
    /bootstrap/.test(src),
    'Reconciliation has no first-run bootstrap (AC-5; ADR 0018 §Decision). With no state.json (fresh deploy, or ' +
      'lost/corrupt watermark), `reconcileRecent` must run one full pass to establish a baseline, then write the ' +
      'watermark. This is the ONLY in-script auto-promotion (cadence otherwise lives in the scheduler). The ' +
      'ADR pins a `"bootstrap": true` marker on the TASK_START event for observability.'
  );
});

test('T6: the three Neo4j extractors honor --authorsFromDir (restrict to the covered author set) (AC-1, AC-4; ADR 0018 §Impl 3)', () => {
  for (const [p, label] of [[EXTRACT_FOLLOWS, 'follows'], [EXTRACT_MUTES, 'mutes'], [EXTRACT_REPORTS, 'reports']]) {
    const src = readSafe(p);
    assert(src !== null, label + ' extractor missing — re-baseline this sentinel.');
    assert(
      /authorsFromDir/.test(src),
      'getCurrent' + label[0].toUpperCase() + label.slice(1) + 'FromNeo4j.js does not accept --authorsFromDir ' +
        '(AC-1, AC-4; ADR 0018 §Impl 3). In recent/author mode the extractor must skip getRaters()/' +
        'getRaterCount() and instead read the covered pubkeys from the matching ' +
        'currentRelationshipsFromStrfry/<kind>/ directory, then run the existing per-author query over just ' +
        'that set. This is what kills the full-graph N+1 for the routine run AND upholds the correctness ' +
        'invariant (both sides restricted to the SAME author set).'
    );
  }
});

test('T7: the per-rater debug log (reconciliation_currentRaterBatch.log) is removed from the follows extractor (AC-1; ADR 0018 §Impl 4)', () => {
  const src = readSafe(EXTRACT_FOLLOWS);
  assert(src !== null, 'follows extractor missing — re-baseline this sentinel.');
  assert(
    !/currentRaterBatch/.test(src),
    'getCurrentFollowsFromNeo4j.js still writes the per-rater debug log reconciliation_currentRaterBatch.log ' +
      '(AC-1; ADR 0018 §Impl 4). ~6 fs.appendFileSync calls PER pubkey is pure overhead in the hot loop. Remove ' +
      'them; keep the real log() lines that go to reconciliation.log. (The mutes/reports extractors never had ' +
      'this log.)'
  );
});

test('T8: taskRegistry has reconcileRecent + reconcileAll (neo4j-heavy) and reconcileAuthor (NOT neo4j-heavy), all → reconciliation.sh (AC-2, AC-5, AC-6; ADR 0018 §Impl 5)', () => {
  const r = readJsonSafe(TASK_REGISTRY);
  assert(r !== null && r.tasks, 'taskRegistry.json missing or malformed — re-baseline this sentinel.');

  const cases = [
    { key: 'reconcileRecent', mode: 'recent', heavy: true },
    { key: 'reconcileAll',    mode: 'all',    heavy: true },
    { key: 'reconcileAuthor', mode: 'author', heavy: false },
  ];
  for (const c of cases) {
    const entry = r.tasks[c.key];
    assert(
      entry,
      'taskRegistry.json has no `' + c.key + '` task (AC-2, AC-6; ADR 0018 §Impl 5). The single `reconciliation` ' +
        'entry is replaced by three keys, all invoking the same reconciliation.sh with a different --mode. The ' +
        'operator triggers each via the existing surface — no new shell script.'
    );
    const blob = JSON.stringify(entry);
    assert(
      /reconciliation\.sh/.test(blob),
      'taskRegistry.json `' + c.key + '` does not point at reconciliation.sh (AC-6; ADR 0018 §Impl 5). All three ' +
        'modes share one engine script.'
    );
    assert(
      new RegExp('--mode\\s+' + c.mode + '\\b').test(blob),
      'taskRegistry.json `' + c.key + '` does not invoke `--mode ' + c.mode + '` (AC-2; ADR 0018 §Impl 5). The ' +
        'mode is selected by the registry entry, not by which script is called.'
    );
    if (c.heavy) {
      assert(
        entry.resourceClass === 'neo4j-heavy',
        'taskRegistry.json `' + c.key + '` is not tagged "resourceClass": "neo4j-heavy" (AC-5; ADR 0018 §Impl 5; ' +
          'ADR 0013). The bulk sweeps must serialize against calculateOwner{Hops,PageRank,GrapeRank} via the ' +
          'ADR 0013 semaphore — this is the fix for the original reconciliation-vs-recalculation Neo4j ' +
          'contention.'
      );
    } else {
      assert(
        entry.resourceClass !== 'neo4j-heavy',
        'taskRegistry.json `' + c.key + '` is tagged neo4j-heavy but must NOT be (ADR 0018 §Decision). ' +
          '`reconcileAuthor` is a tiny point write that backs an interactive "reconcile me" trigger; tagging it ' +
          'neo4j-heavy would queue it behind an 8-hour sweep. It stays off the class so it runs responsively.'
      );
    }
  }
});

test('T9: reconciliation.sh emits the ADR-pinned observability vocabulary (mode, watermark, per-kind drift counts) (AC-8; ADR 0018 §Impl 6)', () => {
  const src = readSafe(RECON_SH);
  assert(src !== null, 'reconciliation.sh missing — re-baseline this sentinel.');
  const missing = [];
  if (!/"mode"|\bmode\b/.test(src)) missing.push('the run mode (recent/all/author)');
  if (!/watermark/.test(src)) missing.push('the watermark consumed/advanced');
  if (!/added/.test(src)) missing.push('per-kind drift "added" counts');
  if (!/deleted/.test(src)) missing.push('per-kind drift "deleted" counts');
  assert(
    missing.length === 0,
    'reconciliation.sh structured logging is missing: ' + missing.join(', ') + ' (AC-8; ADR 0018 §Impl 6). ' +
      'The operator must be able to answer "what ran and how much drift did it catch?" from ' +
      'reconciliation.log / events.jsonl alone: TASK_START carries "mode" + "watermark"; completion carries ' +
      'per-kind {added, deleted} drift totals; TASK_END carries "watermark_advanced_to".'
  );
});

test('T10: OPERATIONS.md documents the three tasks, the watermark, the overlap setting, and the neo4j-heavy tagging (AC-10; ADR 0018 §Impl 7)', () => {
  const src = readSafe(OPERATIONS_MD);
  assert(src !== null, 'OPERATIONS.md missing — re-baseline this sentinel.');
  const missing = [];
  if (!/reconcileRecent/.test(src)) missing.push('reconcileRecent');
  if (!/reconcileAll/.test(src)) missing.push('reconcileAll');
  if (!/reconcileAuthor/.test(src)) missing.push('reconcileAuthor');
  if (!/watermark|state\.json/.test(src)) missing.push('the watermark / state.json');
  if (!/RECONCILIATION_OVERLAP_SECONDS/.test(src)) missing.push('RECONCILIATION_OVERLAP_SECONDS');
  if (!/neo4j-heavy/.test(src)) missing.push('the neo4j-heavy tagging');
  assert(
    missing.length === 0,
    'OPERATIONS.md does not document: ' + missing.join(', ') + ' (AC-10; ADR 0018 §Impl 7). Add a subsection ' +
      'covering: the three tasks + --mode/--pubkey; the recommended schedule (10-min recent, weekly all); the ' +
      'watermark file + how to inspect/reset it; RECONCILIATION_OVERLAP_SECONDS; how to force a full run for ' +
      'incident recovery (reconcileAll); and which tasks are neo4j-heavy (and why reconcileAuthor is not).'
  );
});

// ---------------------------------------------------------------------------
// Regression guards — PASS now AND post-implementation. These pin the
// machinery ADR 0018 reuses VERBATIM; the whole design rests on not breaking it.
// ---------------------------------------------------------------------------

test('R1: the diff still compares follow sets by membership (Set.has), not by count (ADR 0018 §Context 2; AC-9)', () => {
  const src = readSafe(DIFF_FOLLOWS);
  assert(src !== null, 'calculateFollowsUpdates.js missing — re-baseline this sentinel.');
  assert(
    /new Set\(/.test(src) && /\.has\(/.test(src),
    'R1: calculateFollowsUpdates.js no longer does a Set-membership diff (ADR 0018 §Context 2; AC-9). The diff ' +
      'MUST be a set difference of followed pubkeys, never a count comparison — equal counts can hide ' +
      'compensating changes (unfollow A + follow B keeps the count fixed but needs two edge fixes). The whole ' +
      'incremental design reuses this diff verbatim; do not "optimize" it into a count check.'
  );
});

test('R2: the kind-3 → follows converter still maps events to per-pubkey files (reused verbatim) (ADR 0018 §Decision)', () => {
  const src = readSafe(CONVERTER_FOLLOWS);
  assert(src !== null, 'kind3EventsToFollows.js missing — re-baseline this sentinel.');
  assert(
    /currentRelationshipsFromStrfry\/follows/.test(src) && /appendFileSync/.test(src),
    'R3: kind3EventsToFollows.js no longer writes per-pubkey files under currentRelationshipsFromStrfry/follows ' +
      '(ADR 0018 §Decision). The converters are reused UNCHANGED; in recent/author mode they simply process a ' +
      'smaller event set. The per-pubkey file convention is also how the extractor discovers the covered author ' +
      'set (--authorsFromDir).'
  );
  assert(
    /tag\[0\]\s*===\s*'p'/.test(src),
    'R3: kind3EventsToFollows.js no longer extracts `p` tags as followed pubkeys (ADR 0018 §Decision). Reused ' +
      'verbatim — do not change the tag-extraction semantics.'
  );
});

test('R3: the APOC apply still MERGEs / DELETEs FOLLOWS relationships (reused verbatim) (ADR 0018 §Decision; AC-9)', () => {
  const add = readSafe(APOC_ADD);
  const del = readSafe(APOC_DEL);
  assert(add !== null, 'apocCypherCommand1_followsToAddToNeo4j missing — re-baseline this sentinel.');
  assert(del !== null, 'apocCypherCommand1_followsToDeleteFromNeo4j missing — re-baseline this sentinel.');
  assert(
    /MERGE/.test(add) && /FOLLOWS/.test(add),
    'R4: the add-APOC no longer MERGEs FOLLOWS (ADR 0018 §Decision; AC-9). The apply stage is reused unchanged; ' +
      'incremental just feeds it smaller add/delete files.'
  );
  assert(
    /FOLLOWS/.test(del) && /DELETE/.test(del),
    'R4: the delete-APOC no longer DELETEs FOLLOWS (ADR 0018 §Decision; AC-9). Reused unchanged.'
  );
});

test('R4: reconciliation.sh cleanup() still wipes the per-pubkey dirs at run start (ADR 0018 §Context 5)', () => {
  const src = readSafe(RECON_SH);
  assert(src !== null, 'reconciliation.sh missing — re-baseline this sentinel.');
  assert(
    /rm -rf .*currentRelationshipsFromStrfry/.test(src) && /currentRelationshipsFromNeo4j/.test(src),
    'R5: reconciliation.sh cleanup() no longer wipes currentRelationshipsFromStrfry / ' +
      'currentRelationshipsFromNeo4j (ADR 0018 §Context 5). Every run must start from EMPTY per-pubkey dirs — ' +
      'recent mode relies on this so the dirs hold ONLY the covered authors and no stale files leak across runs ' +
      '(stale files would corrupt the restricted-set diff).'
  );
});

test('R5: all three strfry dumpers still support --recent (the mechanism recent mode depends on) (ADR 0018 §Context 1; AC-1)', () => {
  for (const p of STRFRY) {
    const src = readSafe(p);
    assert(src !== null, path.basename(p) + ' missing — re-baseline this sentinel.');
    assert(
      /--recent/.test(src) && /since/.test(src),
      'R6: ' + path.basename(p) + ' no longer supports the --recent <seconds> flag that sets the strfry ' +
        '`since` filter (ADR 0018 §Context 1; AC-1). recent mode drives incremental scanning entirely through ' +
        'this flag — it must remain in all three dumpers (kind 3 / 10000 / 1984).'
    );
  }
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
