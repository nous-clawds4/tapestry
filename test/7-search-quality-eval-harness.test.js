/**
 * Failing tests for story #7: offline search-quality evaluation harness.
 * See engineering-team/stories/7-search-quality-eval-harness.test-plan.md
 *
 * Each test maps to one or more acceptance criteria. Tests fail on the
 * pre-implementation tree and pass once the Implementer lands the modules
 * described in ADR 0004 (Option A).
 *
 * Approach mirrors story #4: pure functions get real behavioral assertions;
 * anything needing the live stack (proxy + ephemeral Meilisearch + corpus
 * load) is intentionally NOT automated here — see test-plan.md "Not covered".
 * Implementation modules are require()'d *inside* tests (guarded) so a missing
 * file produces a clean assertion failure, not a runner crash.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const EVAL = path.join(REPO, 'nostr-search/eval');
const SCORE_PATH = path.join(EVAL, 'score.js');
const SCHEMA_PATH = path.join(EVAL, 'schema.js');
const RUNNER_PATH = path.join(EVAL, 'runner.js');
const BASELINE_PATH = path.join(EVAL, 'baseline.json');
const GOLD_DIR = path.join(EVAL, 'gold');
const WORKFLOW_PATH = path.join(REPO, '.github/workflows/search-eval.yml');

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function approx(a, b, eps = 1e-9) { return Math.abs(a - b) <= eps; }
function req(p, label) {
  try { return require(p); }
  catch (e) { throw new Error(`${label} must exist and be require()-able — ${e.message}`); }
}

// ── AC-1: pure scorer surface ────────────────────────────────
test('score.js exposes pure recallAtK, mrr, and aggregate functions', () => {
  const s = req(SCORE_PATH, 'nostr-search/eval/score.js');
  assert(typeof s.recallAtK === 'function', 'score.js must export recallAtK(hitPubkeys, judged, k) (ADR 0004 impl notes)');
  assert(typeof s.mrr === 'function', 'score.js must export mrr(hitPubkeys, judged) (ADR 0004 impl notes)');
  assert(typeof s.aggregate === 'function', 'score.js must export aggregate(perQuery, opts) (ADR 0004 impl notes)');
});

// ── AC-1: recall@k correctness + edge cases ──────────────────
test('recallAtK returns the fraction of judged-relevant items found within the top k', () => {
  const { recallAtK } = req(SCORE_PATH, 'nostr-search/eval/score.js');
  const judged = ['A', 'B', 'C'];                 // 3 relevant
  const hits = ['A', 'X', 'B', 'Y', 'Z'];         // A@1, B@3, C absent
  assert(approx(recallAtK(hits, judged, 2), 1 / 3), 'recall@2 of [A,X,…] vs {A,B,C} must be 1/3 (only A in top 2)');
  assert(approx(recallAtK(hits, judged, 3), 2 / 3), 'recall@3 must be 2/3 (A and B in top 3)');
  assert(approx(recallAtK(hits, judged, 10), 2 / 3), 'recall@10 must be 2/3 (C never returned)');
  assert(approx(recallAtK([], judged, 10), 0), 'recall of an empty result list must be 0');
  assert(approx(recallAtK(hits, [], 10), 0), 'recall with no judged-relevant items must be 0 (not NaN)');
});

// ── AC-1: MRR correctness + none-relevant edge case ──────────
test('mrr is the reciprocal rank of the first judged-relevant hit, 0 when none are relevant', () => {
  const { mrr } = req(SCORE_PATH, 'nostr-search/eval/score.js');
  assert(approx(mrr(['A', 'X', 'Y'], ['A']), 1), 'first hit relevant → MRR 1');
  assert(approx(mrr(['X', 'Y', 'B'], ['B']), 1 / 3), 'first relevant at rank 3 → MRR 1/3');
  assert(approx(mrr(['X', 'Y'], ['Z']), 0), 'no relevant hit → MRR 0');
});

// ── AC-1 / AC-4: aggregate produces overall + per-query breakdown ──
test('aggregate returns an overall score and a per-query breakdown carrying each query id', () => {
  const { aggregate } = req(SCORE_PATH, 'nostr-search/eval/score.js');
  const perQuery = [
    { id: 'q1', query: 'alice', recall: 1, mrr: 1 },
    { id: 'q2', query: 'bob', recall: 0, mrr: 0 },
  ];
  const out = aggregate(perQuery, { corpus: 'fixture@deadbeef' });
  assert(out && out.overall, 'aggregate must return an `overall` summary');
  assert(approx(out.overall.recall, 0.5), 'overall.recall must be the mean of per-query recall (0.5)');
  assert(Array.isArray(out.perQuery) && out.perQuery.length === 2, 'aggregate must return the per-query breakdown');
  assert(out.perQuery.every(p => 'id' in p), 'each per-query entry must carry its id (AC-4 auditability)');
});

// ── AC-1: report records the corpus/index reference ──────────
test('aggregate records the corpus/index reference it ran against', () => {
  const { aggregate } = req(SCORE_PATH, 'nostr-search/eval/score.js');
  const out = aggregate([{ id: 'q1', recall: 1, mrr: 1 }], { corpus: 'fixture@deadbeef' });
  assert(out.corpus === 'fixture@deadbeef', 'aggregate output must echo the corpus reference (AC-1: "reports the corpus/index reference it ran against")');
});

// ── AC-4: per-query report is auditable ──────────────────────
test('the per-query report exposes query, observer, returned results, and judged hit/miss', () => {
  const { aggregate } = req(SCORE_PATH, 'nostr-search/eval/score.js');
  const perQuery = [{
    id: 'q1', query: 'alice', observer: { wotPov: 'house' },
    returnedResults: ['A', 'X'], hits: ['A'], missed: ['B'], recall: 0.5, mrr: 1,
  }];
  const out = aggregate(perQuery, { corpus: 'c' });
  const p = out.perQuery[0];
  for (const k of ['query', 'observer', 'returnedResults', 'hits', 'missed']) {
    assert(k in p, `per-query report entry must include "${k}" so a human can audit WHY the score is what it is (AC-4)`);
  }
});

// ── AC-2: regression gate decision (pure) ────────────────────
test('the gate fails below baseline-minus-tolerance and names exactly the regressed queries', () => {
  const s = req(SCORE_PATH, 'nostr-search/eval/score.js');
  assert(typeof s.evaluateGate === 'function',
    'score.js must export a pure evaluateGate(overall, { baseline, tolerance }, perQuery) for hermetic gate testing (see test-plan "Module export requirement"; precedent: story #4 parseArgs seam)');
  const perQuery = [
    { id: 'q1', recall: 0.2, baseline: 0.9 },
    { id: 'q2', recall: 0.95, baseline: 0.9 },
  ];
  const fail = s.evaluateGate(0.40, { baseline: 0.50, tolerance: 0.02 }, perQuery);
  assert(fail.pass === false, 'overall 0.40 vs baseline 0.50 (tol 0.02) must FAIL');
  assert(Array.isArray(fail.regressed) && fail.regressed.includes('q1') && !fail.regressed.includes('q2'),
    'evaluateGate must list exactly the regressed query ids (AC-2: "lists exactly which queries regressed")');
});

test('the gate passes when the score is at or within tolerance of baseline', () => {
  const { evaluateGate } = req(SCORE_PATH, 'nostr-search/eval/score.js');
  const onEdge = evaluateGate(0.48, { baseline: 0.50, tolerance: 0.02 }, []);
  assert(onEdge.pass === true, 'overall exactly baseline-minus-tolerance must PASS (boundary is inclusive)');
  const above = evaluateGate(0.55, { baseline: 0.50, tolerance: 0.02 }, []);
  assert(above.pass === true && above.regressed.length === 0, 'above baseline → PASS with no regressed queries');
});

// ── AC-3: schema validation + layered-ready, never rejected ──
test('validateGoldEntry accepts a minimal entry and rejects ones missing query/observer/judgments', () => {
  const { validateGoldEntry } = req(SCHEMA_PATH, 'nostr-search/eval/schema.js');
  const ok = validateGoldEntry({ id: 'q1', query: 'alice', observer: { wotPov: 'house' }, judgments: [{ pubkey: 'a'.repeat(64), relevant: true }] });
  assert(ok && ok.valid === true, 'a well-formed gold entry must validate');
  assert(validateGoldEntry({ observer: { wotPov: 'house' }, judgments: [] }).valid === false, 'missing `query` must be invalid');
  assert(validateGoldEntry({ query: 'x', judgments: [] }).valid === false, 'missing `observer` must be invalid');
  assert(validateGoldEntry({ query: 'x', observer: { wotPov: 'house' } }).valid === false, 'missing `judgments` must be invalid');
});

test('validateGoldEntry accepts a layered-ready entry — tag/dlist fields are never a rejection reason (AC-3)', () => {
  const { validateGoldEntry } = req(SCHEMA_PATH, 'nostr-search/eval/schema.js');
  const layered = {
    id: 'q1', query: 'alice', observer: { wotPov: 'house' },
    judgments: [{ pubkey: 'a'.repeat(64), relevant: true }],
    layered: { tagLayer: { expectTags: ['#nostr'] }, dlistLayer: { expectItems: ['x'] } },
  };
  const res = validateGoldEntry(layered);
  assert(res.valid === true, 'an entry carrying a `layered` block MUST validate — v1 accepts and ignores it, never rejects (AC-3)');
});

test('v1 scoring ignores the layered block — score is identical with or without it (AC-3)', () => {
  const { recallAtK } = req(SCORE_PATH, 'nostr-search/eval/score.js');
  const { scoringInputs } = req(SCHEMA_PATH, 'nostr-search/eval/schema.js');
  assert(typeof scoringInputs === 'function',
    'schema.js must export scoringInputs(entry) → { query, observer, judged } that omits `layered`, so v1 provably scores profile-only (AC-3)');
  const base = { id: 'q', query: 'a', observer: { wotPov: 'house' }, judgments: [{ pubkey: 'A', relevant: true }] };
  const withLayer = { ...base, layered: { tagLayer: { expectTags: ['#x'] } } };
  const a = scoringInputs(base), b = scoringInputs(withLayer);
  assert(!('layered' in a) && !('layered' in b), 'scoringInputs must not surface `layered` into the v1 scoring path');
  const hits = ['A', 'X'];
  assert(approx(recallAtK(hits, a.judged, 10), recallAtK(hits, b.judged, 10)),
    'the v1 score must be identical whether or not a `layered` block is present');
});

// ── AC-5: ≥30 committed hand-judged gold queries, all schema-valid ──
test('at least 30 hand-judged gold queries are committed and every one is schema-valid', () => {
  assert(fs.existsSync(GOLD_DIR), 'nostr-search/eval/gold/ must exist and hold the hand-judged gold set (AC-5)');
  const { validateGoldEntry } = req(SCHEMA_PATH, 'nostr-search/eval/schema.js');
  const files = fs.readdirSync(GOLD_DIR).filter(f => f.endsWith('.json'));
  const entries = [];
  for (const f of files) {
    const parsed = JSON.parse(fs.readFileSync(path.join(GOLD_DIR, f), 'utf8'));
    for (const e of (Array.isArray(parsed) ? parsed : [parsed])) entries.push(e);
  }
  const judged = entries.filter(e => Array.isArray(e.judgments) && e.judgments.length > 0);
  assert(judged.length >= 30, `≥30 hand-judged gold entries required (AC-5) — found ${judged.length}`);
  for (const e of judged) {
    assert(validateGoldEntry(e).valid === true, `every committed gold entry must be schema-valid — offending id: ${e && e.id}`);
  }
});

// ── ADR-constraint: runner testability seam + baseline shape ──
test('runner.js guards main with require.main===module and baseline.json declares metric/baseline/tolerance', () => {
  assert(fs.existsSync(RUNNER_PATH), 'nostr-search/eval/runner.js must exist (ADR 0004 impl notes)');
  const src = fs.readFileSync(RUNNER_PATH, 'utf8');
  assert(/require\.main\s*===\s*module/.test(src),
    'runner.js must guard its entrypoint with `if (require.main === module)` so runEval is require()-able without exiting (testability; story #4 precedent)');
  assert(fs.existsSync(BASELINE_PATH), 'nostr-search/eval/baseline.json must exist (ADR 0004 impl notes)');
  const b = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  for (const k of ['metric', 'baseline', 'tolerance']) {
    assert(k in b, `baseline.json must declare "${k}" (the concrete number is filled post-Implementation per the story Open Questions)`);
  }
});

// ── ADR-constraint: PR CI workflow runs the eval on a pinned Meili ──
test('a PR CI workflow runs the eval runner against a pinned Meilisearch v1.12.8 service', () => {
  assert(fs.existsSync(WORKFLOW_PATH), '.github/workflows/search-eval.yml must exist (ADR 0004 — net-new tooling authorized by the ADR)');
  const wf = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  assert(/nostr-search\/eval\/runner\.js/.test(wf), 'the workflow must invoke nostr-search/eval/runner.js');
  assert(/meilisearch/i.test(wf), 'the workflow must stand up a Meilisearch service for a hermetic run');
  assert(/1\.12\.8/.test(wf), 'the Meilisearch service must be pinned to v1.12.8 to match docker-compose.yml (ADR 0004)');
});

// ── Runner ───────────────────────────────────────────────────
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
