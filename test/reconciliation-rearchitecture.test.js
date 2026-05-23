/**
 * Story #23 / ADR 0020 — Reconciliation re-architecture: four independent,
 * guarantee-specific tasks, each extracting via ONE WHERE-scoped streamed
 * Cypher query (no per-author N+1, no eager rater-enumeration).
 *
 *   reconcileAuthor   WHERE u.pubkey = $pk         (one author)
 *   reconcileRecent   WHERE u.pubkey IN $recent    (bounded, overridable window)
 *   reconcileNetwork  WHERE <predicate>            (influence >= cutoff | hops < N)
 *   reconcileAll      (no filter)                  (truly all; streamed + merge-join)
 *
 * Source/structural sentinels pin the ADR-required code shape. The behavioral
 * heart — does reconcileRecent's bounded window produce edges identical to the
 * reconcileAll oracle; does reconcileNetwork select exactly the trusted set;
 * does reconcileAll complete within bounded memory at 32M-edge prod scale (the
 * actual retirement of the #22 prod block); is a stale-edge delete still caught;
 * are the budgets met — is reproducible only against the live strfry + Neo4j
 * stack at prod scale and is the **authoritative cycle-local / staging smoke**
 * (Reviewer-required, per precedent #5/#6/#8/#10/#11/#12/#13/#15/#18/#22). See
 * the test plan's "Not covered (deferred to smoke)" section.
 *
 * T1..T11 : FAIL pre-implementation, PASS post (the ADR 0020 new code shape).
 * R1..R4  : PASS pre AND post — regression guards on machinery ADR 0020 reuses
 *           VERBATIM (the per-author set diff, the kind-3 converter, the APOC
 *           apply, the strfry `--recent` capability). If the Implementer breaks
 *           one (e.g. turns the set diff into a count check), these trip.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RECON = path.join(ROOT, 'src/pipeline/reconciliation');

// The four independent task scripts ADR 0020 §Decision/§Impl prescribes (replacing reconciliation.sh --mode).
const TASK_SCRIPTS = {
  reconcileRecent:  path.join(RECON, 'reconcileRecent.sh'),
  reconcileNetwork: path.join(RECON, 'reconcileNetwork.sh'),
  reconcileAll:     path.join(RECON, 'reconcileAll.sh'),
  reconcileAuthor:  path.join(RECON, 'reconcileAuthor.sh'),
};

const DIFF_FOLLOWS      = path.join(RECON, 'calculateFollowsUpdates.js');
const CONVERTER_FOLLOWS = path.join(RECON, 'kind3EventsToFollows.js');
const APOC_ADD          = path.join(RECON, 'apocCypherCommands/apocCypherCommand1_followsToAddToNeo4j');
const APOC_DEL          = path.join(RECON, 'apocCypherCommands/apocCypherCommand1_followsToDeleteFromNeo4j');
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
// Search the whole reconciliation dir so "the broken query is gone" / "the new
// scope exists somewhere" sentinels don't over-constrain the exact file layout
// the Implementer chooses for the four scripts.
function reconDirSource() {
  let out = '';
  try {
    for (const f of fs.readdirSync(RECON)) {
      if (/\.(sh|js)$/.test(f)) out += '\n' + (readSafe(path.join(RECON, f)) || '');
    }
  } catch (_e) {}
  return out;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// ---------------------------------------------------------------------------
// Failing sentinels — FAIL now, PASS once Story #23 is implemented per ADR 0020.
// Grouped by the ADR's build phasing: recent → network → all → author/registry/docs.
// ---------------------------------------------------------------------------

// -- Phase 1: reconcileRecent + the core extraction fix ---------------------

test('T1: reconciliation is four independent task scripts, not one --mode engine (AC "four tasks independent"; ADR 0020 §Decision)', () => {
  const missing = Object.entries(TASK_SCRIPTS).filter(([, p]) => readSafe(p) === null).map(([k]) => k + '.sh');
  assert(
    missing.length === 0,
    'Missing per-task reconcile script(s): ' + missing.join(', ') + ' (ADR 0020 §Decision/§Impl). The single ' +
      '`reconciliation.sh --mode` engine is retired in favor of FOUR independent scripts under ' +
      'src/pipeline/reconciliation/ — reconcileRecent.sh, reconcileNetwork.sh, reconcileAll.sh, reconcileAuthor.sh ' +
      '— each tuned to its own guarantee (stricter separation). Each owns its scoped strfry dump, its single ' +
      'WHERE-scoped streamed extraction, diff, apply.'
  );
});

test('T2: reconcileRecent caps its lookback at a bounded, overridable max-recency window (AC reconcileRecent; ADR 0020 §Impl)', () => {
  const src = readSafe(TASK_SCRIPTS.reconcileRecent);
  assert(src !== null, 'reconcileRecent.sh missing — see T1.');
  assert(
    /RECONCILE_RECENT_MAX_RECENCY_SECONDS/.test(src),
    'reconcileRecent.sh does not define RECONCILE_RECENT_MAX_RECENCY_SECONDS (AC reconcileRecent; ADR 0020 §Impl). ' +
      'The lookback must be CAPPED — `min(now - watermark, max_recency)` with a sensible default (~6h = 21600s) — ' +
      'so reconcileRecent\'s cost is bounded by the window and it can never degrade into a full pass.'
  );
  assert(
    /\bmin\b|-lt|-gt|cap|clamp/.test(src),
    'reconcileRecent.sh defines the cap but does not appear to apply it as a ceiling on the lookback (AC ' +
      'reconcileRecent; ADR 0020 §Impl). Lookback = min(now - watermark, RECONCILE_RECENT_MAX_RECENCY_SECONDS).'
  );
});

test('T3: reconcileRecent accepts an explicit recency override (AC "recency window is overridable"; ADR 0020 §Impl)', () => {
  const src = readSafe(TASK_SCRIPTS.reconcileRecent);
  assert(src !== null, 'reconcileRecent.sh missing — see T1.');
  assert(
    /--(recency|max-recency|window|since|recent)\b/.test(src),
    'reconcileRecent.sh parses no recency-override flag (AC "recency window is overridable"; ADR 0020 §Impl). The ' +
      'operator must be able to override the default window per invocation (e.g. --recency <seconds>); the ' +
      'override replaces the default cap.'
  );
});

test('T4: the eager rater-enumeration + N+1 that crashed reconcileAll are gone (AC reconcileRecent/reconcileAll; ADR 0020 §Impl)', () => {
  const dir = reconDirSource();
  assert(dir.trim().length > 0, 'reconciliation dir unreadable — re-baseline this sentinel.');
  assert(
    !/function\s+getRaters\b|getRaterCount\s*\(/.test(dir),
    'The reconciliation extractors still define getRaters()/getRaterCount() (ADR 0020 §Impl). These are the ' +
      'eager full-graph `DISTINCT u.pubkey ... ORDER BY ... SKIP/LIMIT` enumeration (re-run per batch) that hit ' +
      'Neo4j\'s transaction.total.max and killed reconcileAll on staging. Replace per-author enumeration with one ' +
      'streamed WHERE-scoped query per task.'
  );
  assert(
    !/ORDER BY\s+u\.pubkey[\s\S]*?SKIP[\s\S]*?LIMIT/.test(dir),
    'The eager `... DISTINCT u.pubkey ... ORDER BY u.pubkey SKIP .. LIMIT ..` rater-pagination query is still ' +
      'present (ADR 0020 §Context/§Impl). This is the exact query that crashed; the extraction must stream rows ' +
      'with NO eager operator (no DISTINCT/ORDER BY/collect/SKIP/LIMIT).'
  );
  assert(
    !/function\s+getFollowsForRater\b/.test(dir),
    'getFollowsForRater() (the per-author N+1, ~2.2M round-trips at prod scale) is still present (ADR 0020 §Impl). ' +
      'The Neo4j side must be extracted by ONE streamed query per task, not a per-author query in a loop.'
  );
});

test('T5: reconcileRecent selects its authors by a parameterized pubkey set, not string interpolation (AC reconcileRecent; ADR 0020 §Decision)', () => {
  const src = (readSafe(TASK_SCRIPTS.reconcileRecent) || '') + reconDirSource();
  assert(
    /\bIN\s*\$\w+/.test(src) || /SET\s+\w*\.?reconcile\b|\breconcile\s*=\s*true|\breconcile:\s*true/i.test(src),
    'reconcileRecent does not select its author set by a parameterized list (AC reconcileRecent; ADR 0020 ' +
      '§Decision). Pass the recent pubkeys as a query PARAMETER — `WHERE u.pubkey IN $pubkeys` — never ' +
      'string-interpolated (which bloats the query + defeats plan caching), relying on the :NostrUser(pubkey) ' +
      'index. (The two-stage `SET u.reconcile=true … WHERE u.reconcile=true` fallback for very large windows also ' +
      'satisfies this — but not an interpolated literal list and not the removed enumeration.)'
  );
});

// -- Phase 2: reconcileNetwork ----------------------------------------------

test('T6: reconcileNetwork scopes by a parameterized network predicate (influence cutoff AND hops) (AC reconcileNetwork; ADR 0020 §Impl)', () => {
  const src = readSafe(TASK_SCRIPTS.reconcileNetwork);
  assert(src !== null, 'reconcileNetwork.sh missing — see T1.');
  assert(
    /influence/.test(src) && /(VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF|graperank\.conf|0\.05)/.test(src),
    'reconcileNetwork.sh does not define the "verified" network via the GrapeRank influence cutoff (AC ' +
      'reconcileNetwork; ADR 0020 §Impl). The default network is `u.influence >= cutoff`, reading ' +
      'VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF (default 0.05) from /etc/graperank.conf — the same threshold the rest ' +
      'of the system uses for "verified."'
  );
  assert(
    /\bhops\b/.test(src),
    'reconcileNetwork.sh supports no second network definition (AC reconcileNetwork; ADR 0020 §Impl). The network ' +
      'must be a PARAMETERIZED, extensible predicate — at minimum `u.influence >= cutoff` AND `u.hops < N` — ' +
      'selected by a --network argument, not a single hardcoded filter.'
  );
});

// -- Phase 3: reconcileAll ---------------------------------------------------

test('T7: reconcileAll reconciles truly-all via a streamed scan + sorted merge-join (no scope filter, no enumeration) (AC reconcileAll; ADR 0020 §Impl)', () => {
  const src = readSafe(TASK_SCRIPTS.reconcileAll);
  assert(src !== null, 'reconcileAll.sh missing — see T1.');
  assert(
    !/influence|u\.hops|pubkey\s*=\s*\$|pubkey\s+IN/.test(src),
    'reconcileAll.sh appears to scope to a subset (influence/hops/pubkey filter) (AC reconcileAll; ADR 0020 ' +
      '§Decision). reconcileAll is **truly all** — every rater, no WHERE filter. The bounded/trusted sweep is ' +
      'reconcileNetwork; do not conflate them.'
  );
  assert(
    /\bsort\b/.test(src),
    'reconcileAll.sh does not use an external `sort` (AC reconcileAll; ADR 0020 §Impl). Truly-all over ~32M edges ' +
      'must diff via a **sorted merge-join** — stream both sides as (rater,ratee) pairs, external-sort on disk, ' +
      'merge-join — so it completes within bounded memory rather than materializing the graph in one transaction.'
  );
});

// -- Phase 4: reconcileAuthor + registry + observability + docs --------------

test('T8: reconcileAuthor scopes to a single pubkey (AC reconcileAuthor; ADR 0020 §Impl)', () => {
  const src = readSafe(TASK_SCRIPTS.reconcileAuthor);
  assert(src !== null, 'reconcileAuthor.sh missing — see T1.');
  assert(
    /pubkey\s*=\s*\$|pubkey:\s*\$|--pubkey/.test(src),
    'reconcileAuthor.sh does not scope to a single `WHERE u.pubkey = $pk` (AC reconcileAuthor; ADR 0020 §Impl). It ' +
      'reconciles exactly one author identified by --pubkey, touching no other author and no sweep watermark.'
  );
});

test('T9: taskRegistry has all four reconcile tasks → their own scripts, legacy `reconciliation` key removed, neo4j-heavy correct (AC four-tasks + legacy-removed; ADR 0020 §Impl)', () => {
  const r = readJsonSafe(TASK_REGISTRY);
  assert(r !== null && r.tasks, 'taskRegistry.json missing or malformed — re-baseline this sentinel.');

  assert(
    !('reconciliation' in r.tasks),
    'taskRegistry.json still has the legacy `reconciliation` task key (AC legacy-removed; ADR 0020 §Decision/§Impl). ' +
      'The mode-less shared entry is deprecated/removed; only the four per-task keys remain.'
  );

  const cases = [
    { key: 'reconcileRecent',  script: 'reconcileRecent.sh',  heavy: true },
    { key: 'reconcileNetwork', script: 'reconcileNetwork.sh', heavy: true },
    { key: 'reconcileAll',     script: 'reconcileAll.sh',     heavy: true },
    { key: 'reconcileAuthor',  script: 'reconcileAuthor.sh',  heavy: false },
  ];
  for (const c of cases) {
    const entry = r.tasks[c.key];
    assert(entry, 'taskRegistry.json has no `' + c.key + '` task (AC four-tasks; ADR 0020 §Impl).');
    const blob = JSON.stringify(entry);
    assert(
      new RegExp(c.script.replace('.', '\\.')).test(blob),
      'taskRegistry.json `' + c.key + '` does not point at its own `' + c.script + '` (AC four-tasks; ADR 0020 ' +
        '§Impl). Each task is an independent script — NOT `reconciliation.sh --mode`.'
    );
    assert(
      !/reconciliation\.sh/.test(blob),
      'taskRegistry.json `' + c.key + '` still invokes the retired shared `reconciliation.sh` (ADR 0020 §Decision).'
    );
    if (c.heavy) {
      assert(
        entry.resourceClass === 'neo4j-heavy',
        'taskRegistry.json `' + c.key + '` is not "resourceClass":"neo4j-heavy" (AC; ADR 0020 §Impl; ADR 0013). The ' +
          'bulk sweeps must serialize via the semaphore.'
      );
    } else {
      assert(
        entry.resourceClass !== 'neo4j-heavy',
        'taskRegistry.json `' + c.key + '` must NOT be neo4j-heavy (ADR 0020 §Impl). reconcileAuthor backs an ' +
          'interactive trigger and must not queue behind a sweep.'
      );
    }
  }
});

test('T10: each task emits structured events under its OWN taskName + a terminal event on failure (fixes #22 OBS-1/OBS-2; ADR 0020 §Consequences/§Impl)', () => {
  for (const [name, p] of Object.entries(TASK_SCRIPTS)) {
    const src = readSafe(p);
    assert(src !== null, name + '.sh missing — see T1.');
    // OBS-2: own identity, not the shared "reconciliation" name.
    assert(
      new RegExp('TASK_(START|END|ERROR)[^\\n]*' + name).test(src) || new RegExp('emit_task_event[^\\n]*' + name).test(src),
      name + '.sh does not emit its structured events under its own taskName "' + name + '" (fixes #22 OBS-2; ADR ' +
        '0020 §Consequences). Run history must resolve per task — the shared `reconciliation` log identity is why ' +
        'the panel\'s last-run was blank for the reconcile tasks. Each task logs under its own name.'
    );
    // OBS-1: a failed task must not read as perpetually "running".
    assert(
      /\btrap\b/.test(src) && /TASK_(ERROR|END)/.test(src),
      name + '.sh emits no terminal event on failure (fixes #22 OBS-1; ADR 0020 §Impl). A neo4j-heavy task that ' +
        'dies mid-run must emit TASK_END/TASK_ERROR on every exit path (e.g. a `trap` on ERR/EXIT) so a crash ' +
        'never reads as "running" forever in the panel/API.'
    );
  }
});

test('T11: OPERATIONS.md documents the four tasks, the recency cap, the network selector, and the deprecation (AC OPERATIONS; ADR 0020 §Impl)', () => {
  const src = readSafe(OPERATIONS_MD);
  assert(src !== null, 'OPERATIONS.md missing — re-baseline this sentinel.');
  const missing = [];
  for (const k of ['reconcileRecent', 'reconcileNetwork', 'reconcileAll', 'reconcileAuthor']) {
    if (!new RegExp(k).test(src)) missing.push(k);
  }
  if (!/RECONCILE_RECENT_MAX_RECENCY_SECONDS|max.?recency/i.test(src)) missing.push('the recency cap');
  if (!/influence|VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF|--network/.test(src)) missing.push('the reconcileNetwork selector / verified cutoff');
  if (!/deprecat|retire|removed/i.test(src)) missing.push('the legacy reconciliation deprecation');
  assert(
    missing.length === 0,
    'OPERATIONS.md does not document: ' + missing.join(', ') + ' (AC OPERATIONS; ADR 0020 §Impl). Rewrite the ' +
      'reconciliation section for the four tasks + their scopes/guarantees/budgets, the bounded recency cap, the ' +
      'reconcileNetwork --network selector + verified cutoff, and the legacy-task deprecation. Remove the obsolete ' +
      'seed-via-reconcileAll-first runbook (reconcileRecent no longer bootstraps).'
  );
});

// ---------------------------------------------------------------------------
// Regression guards — PASS now AND post-implementation. Pin the machinery
// ADR 0020 reuses VERBATIM (diff, converter, APOC apply, strfry --recent).
// ---------------------------------------------------------------------------

test('R1: the diff still compares follow sets by membership (Set.has), not by count (ADR 0020 reuses §; ADR 0018 §Context 2)', () => {
  const src = readSafe(DIFF_FOLLOWS);
  assert(src !== null, 'calculateFollowsUpdates.js missing — re-baseline this sentinel.');
  assert(
    /new Set\(/.test(src) && /\.has\(/.test(src),
    'R1: calculateFollowsUpdates.js no longer does a Set-membership diff. ADR 0020 reuses the set-diff verbatim, ' +
      'fed by the new single-query output. It MUST stay a set difference of followed pubkeys, never a count check ' +
      '— equal counts can hide compensating changes (unfollow A + follow B). Do not "optimize" it into a count.'
  );
});

test('R2: the APOC apply still MERGEs / DELETEs FOLLOWS relationships (reused verbatim) (ADR 0020 §Decision)', () => {
  const add = readSafe(APOC_ADD);
  const del = readSafe(APOC_DEL);
  assert(add !== null && del !== null, 'apocCypherCommand1_followsTo{Add,Delete}* missing — re-baseline this sentinel.');
  assert(
    /MERGE/.test(add) && /FOLLOWS/.test(add),
    'R2: the add-APOC no longer MERGEs FOLLOWS. ADR 0020 reuses the apply UNCHANGED; the new extraction just feeds ' +
      'it add/delete files. The crash was in extraction, never the apply.'
  );
  assert(
    /FOLLOWS/.test(del) && /DELETE/.test(del),
    'R2: the delete-APOC no longer DELETEs FOLLOWS. Reused unchanged.'
  );
});

test('R3: all three strfry dumpers still support --recent (the mechanism reconcileRecent depends on) (ADR 0020 §Decision; ADR 0018 §Context 1)', () => {
  for (const p of STRFRY) {
    const src = readSafe(p);
    assert(src !== null, path.basename(p) + ' missing — re-baseline this sentinel.');
    assert(
      /--recent/.test(src) && /since/.test(src),
      'R3: ' + path.basename(p) + ' no longer supports `--recent <seconds>` (sets the strfry `since` filter). ' +
        'reconcileRecent\'s bounded window drives the strfry scan through this flag — it must remain in all three ' +
        'dumpers (kind 3 / 10000 / 1984).'
    );
  }
});

test('R4: the kind-3 → follows converter still extracts `p` tags as followed pubkeys (reused verbatim) (ADR 0020 §Decision)', () => {
  const src = readSafe(CONVERTER_FOLLOWS);
  assert(src !== null, 'kind3EventsToFollows.js missing — re-baseline this sentinel.');
  assert(
    /tag\[0\]\s*===\s*'p'/.test(src) || /\bp\b/.test(src) && /tags?/.test(src),
    'R4: kind3EventsToFollows.js no longer extracts `p` tags as followed pubkeys. The converter is reused ' +
      'verbatim for the strfry side of the diff — do not change the tag-extraction semantics.'
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
