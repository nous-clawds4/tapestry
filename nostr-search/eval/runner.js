'use strict';
/**
 * Search-quality eval runner. See ADR 0004.
 *
 * Replays each hand-judged gold query through the REAL product seam — the
 * tapestry proxy `/api/search/profiles/meili` (the documented single authority
 * for POV resolution + WoT field namespacing) — against an ephemeral
 * Meilisearch loaded with the pinned fixture corpus, scores the results with
 * the pure functions in score.js, writes an auditable per-query report, and
 * exits non-zero if the overall score regressed past the committed baseline.
 *
 * The unit suite (test/7-search-quality-eval-harness.test.js) covers the pure
 * pieces. The live end-to-end path here is exercised by the CI workflow and by
 * running this file directly — see the test plan's "Not covered".
 */

const fs = require('fs');
const path = require('path');
const { recallAtK, mrr, aggregate, evaluateGate } = require('./score');
const { validateGoldEntry, scoringInputs } = require('./schema');

const EVAL_DIR = __dirname;
const GOLD_DIR = path.join(EVAL_DIR, 'gold');
const CORPUS_DIR = path.join(EVAL_DIR, 'corpus');
const BASELINE_PATH = path.join(EVAL_DIR, 'baseline.json');

const TAPESTRY_URL = process.env.TAPESTRY_URL || 'http://localhost:7778';
const MEILI_URL = process.env.MEILI_URL || 'http://localhost:7700';
const MEILI_INDEX = process.env.MEILI_INDEX || 'profiles';

function readJsonEntries(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).filter(n => n.endsWith('.json') && !n.startsWith('_'))) {
    const parsed = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const e of (Array.isArray(parsed) ? parsed : [parsed])) out.push(e);
  }
  return out;
}

/** Load the pinned fixture corpus into the (ephemeral) Meilisearch index. */
async function loadCorpus() {
  const docs = readJsonEntries(CORPUS_DIR);
  if (docs.length === 0) return { loaded: 0 };
  const res = await fetch(`${MEILI_URL}/indexes/${MEILI_INDEX}/documents`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docs),
  });
  if (!res.ok) throw new Error(`corpus load failed: Meili ${res.status} ${await res.text()}`);
  return { loaded: docs.length };
}

/** One gold query → ranked pubkeys, via the real proxy seam. */
async function searchVia(entry) {
  const { query, observer } = scoringInputs(entry);
  const u = new URL('/api/search/profiles/meili', TAPESTRY_URL);
  u.searchParams.set('q', query);
  u.searchParams.set('wotPov', (observer && observer.wotPov) || 'house');
  if (observer && observer.userPubkey) u.searchParams.set('userPubkey', observer.userPubkey);
  const res = await fetch(u.toString());
  if (!res.ok) throw new Error(`search failed for "${query}": ${res.status}`);
  const data = await res.json();
  return (data.hits || []).map(h => h.pubkey || h.id);
}

async function runEval({ k } = {}) {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const topK = k || baseline.k || 10;

  const gold = readJsonEntries(GOLD_DIR).filter(
    e => Array.isArray(e.judgments) && e.judgments.length > 0
  );
  const invalid = gold.filter(e => !validateGoldEntry(e).valid);
  if (invalid.length) {
    throw new Error(`${invalid.length} gold entr(y/ies) fail schema validation; fix before running`);
  }

  await loadCorpus();

  const perQuery = [];
  for (const entry of gold) {
    const { judged } = scoringInputs(entry);
    const returnedResults = await searchVia(entry);
    const hits = returnedResults.filter(pk => judged.includes(pk));
    const missed = judged.filter(pk => !returnedResults.includes(pk));
    perQuery.push({
      id: entry.id || entry.query,
      query: entry.query,
      observer: entry.observer,
      returnedResults,
      hits,
      missed,
      recall: recallAtK(returnedResults, judged, topK),
      mrr: mrr(returnedResults, judged),
      baseline: typeof entry.baseline === 'number' ? entry.baseline : undefined,
    });
  }

  const corpusRef = `fixture@${gold.length}q/k${topK}`;
  const report = aggregate(perQuery, { corpus: corpusRef });
  const gate = evaluateGate(report.overall.recall, baseline, perQuery);

  fs.writeFileSync(
    path.join(EVAL_DIR, 'report.json'),
    JSON.stringify({ ...report, gate, generatedAt: new Date().toISOString() }, null, 2)
  );

  return { report, gate, topK };
}

function printReport({ report, gate, topK }) {
  console.log(`\nSearch-quality eval — ${report.perQuery.length} queries @k=${topK} (corpus ${report.corpus})`);
  for (const p of report.perQuery) {
    const mark = p.missed.length === 0 ? '✓' : '·';
    console.log(`  ${mark} [${p.id}] "${p.query}" (pov=${p.observer && p.observer.wotPov})`);
    console.log(`      recall=${p.recall.toFixed(3)} mrr=${p.mrr.toFixed(3)} hit=${p.hits.length}/${p.hits.length + p.missed.length}`);
    if (p.missed.length) console.log(`      missed: ${p.missed.join(', ')}`);
  }
  console.log(`\nOverall: recall=${report.overall.recall.toFixed(4)} mrr=${report.overall.mrr.toFixed(4)}`);
  console.log(gate.pass ? 'GATE: PASS' : `GATE: FAIL — regressed: ${gate.regressed.join(', ') || '(overall below baseline)'}`);
}

if (require.main === module) {
  runEval()
    .then(result => {
      printReport(result);
      process.exit(result.gate.pass ? 0 : 1);
    })
    .catch(err => {
      console.error(`[eval] ${err.message}`);
      process.exit(1);
    });
}

module.exports = { runEval, loadCorpus };
