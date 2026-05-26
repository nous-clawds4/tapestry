/**
 * Story #26 / ADR 0023 — Close `neo4j-heavy` semaphore coverage gaps for
 * subshell-invoked task chains.
 *
 * The fix has two halves: (1) tag the parent task entries identified by the
 * audit in the registry, so their BullMQ Worker wrap holds the `neo4j-heavy`
 * semaphore for the entire run including their subshell-spawned children;
 * (2) amend ADR 0013 in-place with a Protection-model section that documents
 * the convention, plus an audit-results table that records what was checked
 * and what was found. BIBLE.md §24 mirrors the convention for the
 * project-narrative readers.
 *
 * These tests use source/structural sentinels — the project convention for
 * task-queue tests (precedent: test/task-queue-bullmq.test.js, test/manual-
 * task-retrigger-after-finish.test.js). The sentinels pin:
 *   - The pre-audit confirmed tag-additions (processAllTasks +
 *     processNpubsUpToMaxNumBlocks). If the Implementer's audit surfaces
 *     additional gaps, those task-name entries should ALSO be tagged in the
 *     registry; this file's sentinels don't enumerate them (they'd be
 *     unknowable pre-impl), but T5's audit-table assertion will fail unless
 *     the table is fleshed out with every chain checked.
 *   - The ADR 0013 in-place amendment shape (Protection-model sub-section,
 *     cross-ref to ADR 0023, audit-results table with attestation).
 *   - BIBLE.md §24's convention paragraph + ADR 0023 in the §24 index.
 *
 * Behavioral verification (AC #1 + AC #2 — semaphore actually engages for
 * the tagged orchestrators across all paths) is deferred to cycle-local
 * smoke. ADR 0023 §"Test scenarios for the Tester" suggests an optional
 * behavioral probe (test/probe-resource-class-semaphore-serialization.js)
 * patterned after story #25's removeOnComplete probe; the Implementer may
 * write it for an extra integration-level signal but it's not required
 * (the ADR's own language is "Optional but recommended" — not mandated —
 * so the Tester does not require it via sentinel).
 *
 * AC #6 (no-downtime deploy) is cycle-staging/cycle-prod runtime behavior;
 * no unit test.
 *
 * T1..T6 : FAIL pre-implementation, PASS post.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const TASK_REGISTRY = path.join(ROOT, 'src/manage/taskQueue/taskRegistry.json');
const ADR_0013      = path.join(ROOT, 'engineering-team/decisions/0013-task-queue-neo4j-resource-class.md');
const BIBLE_MD      = path.join(ROOT, 'BIBLE.md');

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (_e) { return null; }
}

function readRegistry() {
  const src = readSafe(TASK_REGISTRY);
  if (!src) return null;
  try { return JSON.parse(src); }
  catch (_e) { return null; }
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

// Helper: extract the BIBLE.md §24 task-queue subsystem section body.
function bibleSection24Of(bibleText) {
  if (!bibleText) return null;
  // The section header in BIBLE.md is "## 24. Task Queue (BullMQ behind /api/run-task)".
  // Extract from that header until the next ## section or end of file.
  const m = bibleText.match(/##\s+24\.\s+Task Queue[\s\S]*?(?=\n##\s|\n---\s*$|$)/);
  return m ? m[0] : null;
}

// ---------------------------------------------------------------------------
// Failing tests — FAIL now, PASS once story #26 is implemented per ADR 0023.
// ---------------------------------------------------------------------------

test('T1: taskRegistry.json tags `processAllTasks` with resourceClass "neo4j-heavy" (AC #2; ADR 0023 §Confirmed gaps)', () => {
  const reg = readRegistry();
  assert(reg && reg.tasks, 'taskRegistry.json missing or unparseable at ' + TASK_REGISTRY);
  const task = reg.tasks.processAllTasks;
  assert(
    task,
    '`processAllTasks` is not present in taskRegistry.json — this is a pre-impl baseline check; if this fires, the registry has changed shape unexpectedly. (AC #2; ADR 0023 §Confirmed gaps)'
  );
  assert(
    task.resourceClass === 'neo4j-heavy',
    '`processAllTasks` must be tagged `resourceClass: "neo4j-heavy"` so its BullMQ Worker holds the semaphore for the duration of its run (including the ~10 tagged children it spawns via `launch_child_task`, all of which are dormant on this path otherwise). Currently: resourceClass=' + JSON.stringify(task.resourceClass) + '. (AC #2; ADR 0023 §Confirmed gaps)'
  );
});

test('T2: taskRegistry.json tags `processNpubsUpToMaxNumBlocks` with resourceClass "neo4j-heavy" (AC #2; ADR 0023 §Confirmed gaps)', () => {
  const reg = readRegistry();
  assert(reg && reg.tasks, 'taskRegistry.json missing or unparseable');
  const task = reg.tasks.processNpubsUpToMaxNumBlocks;
  assert(
    task,
    '`processNpubsUpToMaxNumBlocks` is not present in taskRegistry.json — pre-impl baseline check.'
  );
  assert(
    task.resourceClass === 'neo4j-heavy',
    '`processNpubsUpToMaxNumBlocks` must be tagged `resourceClass: "neo4j-heavy"`. This is the live-on-prod scheduled entry whose subshell chain reaches the tagged `updateNpubsInNeo4j` child; without the tag, that chain runs unprotected. Currently: resourceClass=' + JSON.stringify(task.resourceClass) + '. (AC #2; ADR 0023 §Confirmed gaps + §Context)'
  );
});

test('T3: ADR 0013 contains a "Protection model" sub-section documenting the subshell-children-inherit-from-tagged-parent convention + cross-reference to ADR 0023 (AC #4; ADR 0023 §Implementation 2)', () => {
  const adr = readSafe(ADR_0013);
  assert(adr !== null, 'ADR 0013 missing at ' + ADR_0013);
  assert(
    /Protection model/i.test(adr),
    'ADR 0013 must contain a "Protection model" sub-section (heading or labeled paragraph) per ADR 0023 §Implementation 2. The section should explain that subshell-invoked children\'s `resourceClass` tags are dormant on parent-driven paths, and that every tagged task\'s invocation chain must therefore have a tagged entry point. (AC #4)'
  );
  assert(
    /subshell/i.test(adr) && /(inherit|parent)/i.test(adr) && /(tagged|tag)/i.test(adr),
    'ADR 0013\'s Protection-model section must mention subshells, inheritance from parents, and tagging — these are the load-bearing words for the convention. (AC #4; ADR 0023 §Implementation 2)'
  );
  assert(
    /ADR\s*0023|adr[-_]?0023|0023-task-queue-semaphore-protection-audit/i.test(adr),
    'ADR 0013 must cross-reference ADR 0023 so readers can follow the amendment trail. Add the reference in the Protection-model section or near the top of the file. (AC #4; ADR 0023 §Implementation 2)'
  );
});

test('T4: ADR 0013 contains an audit-results table with the columns ADR 0023 specifies (parent | child | spawn pattern | gap before/after) (AC #3, AC #4; ADR 0023 §Audit method step 4)', () => {
  const adr = readSafe(ADR_0013);
  assert(adr !== null, 'ADR 0013 missing');
  // The audit-results table is a markdown table. Pin its presence by requiring
  // a table whose header row mentions "parent", "child", and "spawn" (or
  // similar — the ADR's column layout is flexible enough that exact column
  // labels can vary, but those three concepts must all appear).
  // Markdown tables look like: | col | col | col |\n|---|---|---|
  const tableHeadersRe = /\|[^\n]*parent[^\n]*\|[^\n]*child[^\n]*\|[^\n]*spawn[^\n]*\|/i;
  assert(
    tableHeadersRe.test(adr),
    'ADR 0013 must contain a markdown table whose header row references "parent", "child", and "spawn" (any column ordering). This is the audit-results table per ADR 0023 §Audit method step 4 — the Implementer compiles it from the audit walk over all four spawn patterns and embeds it in the in-place amendment. The Reviewer needs this to confirm the audit was actually performed. (AC #3, AC #4)'
  );
});

test('T5: ADR 0013\'s audit-results section includes an explicit attestation sentence per ADR 0023\'s Implementer outcome contract (AC #3; ADR 0023 §Outcome contract)', () => {
  const adr = readSafe(ADR_0013);
  assert(adr !== null, 'ADR 0013 missing');
  // ADR 0023's outcome contract requires either:
  //   (a) AUDIT CLEAN case: an attestation sentence reading roughly
  //       "No other parent scripts reach a tagged child ... audit performed
  //       DATE ... all four spawn patterns checked"
  //   (b) AUDIT-SURFACED-MORE case: an attestation that the audit ran +
  //       the additional rows added to the table convey completeness
  //
  // Either way, the ADR amendment must positively assert that the audit
  // happened (with date + spawn-pattern coverage), not silently rely on
  // the table being non-empty. Pin the semantic loosely so the Implementer
  // can phrase it naturally.
  const attestedRe = /audit\s+performed.*spawn\s+pattern/is;
  const attestedAltRe = /(four\s+spawn\s+patterns|all\s+spawn\s+patterns)\s+checked/i;
  assert(
    attestedRe.test(adr) || attestedAltRe.test(adr),
    'ADR 0013\'s audit-results section must include a positive attestation that the audit was performed and that all four spawn patterns (launch_child_task, bash $script, direct executable, node $script) were checked. Per ADR 0023 §Outcome contract this attestation is "not optional — it converts a silent omission into a positive assertion that future readers can rely on." Acceptable phrasings include: "audit performed <DATE> per ADR 0023 §Audit method, all four spawn patterns checked" or "all four spawn patterns checked, no additional gaps". (AC #3; ADR 0023 §Outcome contract)'
  );
});

test('T6: BIBLE.md §24 documents the parent-tag-is-load-bearing convention and includes ADR 0023 in the §24 ADR index (AC #5; ADR 0023 §Implementation 3)', () => {
  const bible = readSafe(BIBLE_MD);
  assert(bible !== null, 'BIBLE.md missing at ' + BIBLE_MD);
  const section = bibleSection24Of(bible);
  assert(
    section,
    'Could not locate the "## 24. Task Queue (BullMQ behind /api/run-task)" section in BIBLE.md. If the section header has changed, update this test\'s extraction helper.'
  );
  // Convention text — pin semantic loosely.
  assert(
    /subshell|launch_child_task|child/i.test(section) && /(tagged|tag)/i.test(section) && /(parent|entry[ -]?point)/i.test(section),
    'BIBLE.md §24 must contain a paragraph documenting the parent-tag-is-load-bearing convention — that subshell-invoked children inherit semaphore protection from a tagged parent in their invocation chain. The text should mention subshells (or `launch_child_task`), tagging, and parent/entry-point semantics. (AC #5; ADR 0023 §Implementation 3)'
  );
  // ADR 0023 in the §24 ADR index.
  assert(
    /ADR\s*0023|adr[-_]?0023|0023-task-queue-semaphore-protection-audit/i.test(section),
    'BIBLE.md §24\'s ADR index must include ADR 0023 so readers landing on the task-queue narrative can follow the protection-model amendment trail. (AC #5; ADR 0023 §Implementation 3)'
  );
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
