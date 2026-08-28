/**
 * neo4j-sizing #1: Entrypoint memory override.
 *
 * Story: engineering-team/stories/neo4j-sizing/1-entrypoint-memory-override.md
 * Ledger: OPEN.md rows 185 (the crash loop) and 186 (this fix's ratified design).
 *
 * The behavioral tests EXECUTE the real sizing block extracted from
 * docker/entrypoint.sh — `grep`/`nproc` stubbed as shell functions — so the
 * pins hold against the actual script, not a transcription of it.
 *
 * Classes:
 *   P (pin)      — today's formula behavior, green BEFORE and AFTER this story;
 *                  they are the "droplets change nothing" guarantee (P1 pins
 *                  staging's live 8038/8038/4019 from its measured MemTotal).
 *   U (override) — the new override semantics. FAIL until implemented.
 *   S (structure)— compose plumbing + placement/safety of the new lines. FAIL now.
 */

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ENTRYPOINT = path.resolve(__dirname, '../docker/entrypoint.sh');
const COMPOSE = path.resolve(__dirname, '../docker-compose.yml');

function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

/** Extract the sizing block: from TOTAL_MEM_KB= up to (not including) the
 *  "=== Neo4j Dynamic Configuration ===" banner echo. */
function sizingBlock() {
  const lines = safeRead(ENTRYPOINT).split('\n');
  const start = lines.findIndex((l) => l.includes('TOTAL_MEM_KB=$(grep MemTotal'));
  const end = lines.findIndex((l) => l.includes('=== Neo4j Dynamic Configuration ==='));
  assert(start >= 0 && end > start, 'sizing block not found in docker/entrypoint.sh');
  return lines.slice(start, end).join('\n');
}

const NO_OVERRIDE = { BRAINSTORM_NEO4J_HEAP_MB: '', BRAINSTORM_NEO4J_CACHE_MB: '', BRAINSTORM_NEO4J_TX_MAX_MB: '' };

/** Run the real block with stubbed system probes and the given env.
 *  The base env NEUTRALIZES ambient BRAINSTORM_NEO4J_* (empty ≡ unset by the
 *  `:-` contract): the full `npm test` loads the repo `.env` into process.env
 *  via lib/config, and this machine's `.env` legitimately carries the dev
 *  override (row 186) — without the pin, the P-tests would measure the
 *  operator's profile instead of the formula (caught at the neo4j-sizing
 *  book-close gate, 2026-08-28). Tests opt in explicitly via `env`. */
function runSizing({ memTotalKb, env = {} }) {
  const script = [
    'grep() { echo "MemTotal:       ' + memTotalKb + ' kB"; }',
    'nproc() { echo 8; }',
    sizingBlock(),
    'printf "RESULT %s %s %s\\n" "$NEO4J_HEAP_MB" "$NEO4J_CACHE_MB" "$NEO4J_TX_MAX_MB"',
  ].join('\n');
  const out = cp.execFileSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env, ...NO_OVERRIDE, ...env },
    timeout: 15000,
  });
  const m = out.match(/RESULT (\d+) (\d+) (\d+)/);
  assert(m, `sizing block produced no RESULT line; output: ${out.slice(0, 200)}`);
  return { heap: +m[1], cache: +m[2], tx: +m[3] };
}


const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

/* ── P: formula pins (green before and after — the no-change guarantee) ── */

test('P1: staging reproduction — 32,866,228 kB with nothing set yields exactly 8038/8038/4019', () => {
  const r = runSizing({ memTotalKb: 32866228 });
  assert(r.heap === 8038 && r.cache === 8038 && r.tx === 4019,
    `AC-1: staging's live values must reproduce; got ${JSON.stringify(r)}`);
});

test('P2: branch thresholds hold — 24000MB is large-reserve, one MB under is medium', () => {
  const large = runSizing({ memTotalKb: 24576000 });   // exactly 24000 MB
  assert(large.heap === (24000 - 12000) * 40 / 100, `large branch: got ${large.heap}`);
  const medium = runSizing({ memTotalKb: 24575999 });  // 23999 MB
  assert(medium.heap === Math.floor((23999 - 7000) * 40 / 100), `medium branch: got ${medium.heap}`);
});

test('P3: medium-branch arithmetic (the local-machine class) — 20,000,000 kB → 5012/5012/2506', () => {
  const r = runSizing({ memTotalKb: 20000000 });
  assert(r.heap === 5012 && r.cache === 5012 && r.tx === 2506,
    `E3: medium branch must stay put; got ${JSON.stringify(r)}`);
});

/* ── U: override semantics (fail until implemented) ── */

test('U1: all three overrides are used verbatim', () => {
  const r = runSizing({
    memTotalKb: 32866228,
    env: { BRAINSTORM_NEO4J_HEAP_MB: '2048', BRAINSTORM_NEO4J_CACHE_MB: '1024', BRAINSTORM_NEO4J_TX_MAX_MB: '1024' },
  });
  assert(r.heap === 2048 && r.cache === 1024 && r.tx === 1024,
    `AC-2: overrides verbatim; got ${JSON.stringify(r)}`);
});

test('U2: empty-string env behaves exactly as unset (the compose pass-through case)', () => {
  const r = runSizing({ memTotalKb: 32866228, env: NO_OVERRIDE });
  assert(r.heap === 8038 && r.cache === 8038 && r.tx === 4019,
    `AC-1/E1: compose injects empty strings on droplets — formula must run; got ${JSON.stringify(r)}`);
});

test('U3: partial override — heap verbatim, cache and tx stay formula-derived', () => {
  const r = runSizing({ memTotalKb: 32866228, env: { ...NO_OVERRIDE, BRAINSTORM_NEO4J_HEAP_MB: '2048' } });
  assert(r.heap === 2048, `AC-2: heap override; got ${r.heap}`);
  assert(r.cache === 8038 && r.tx === 4019,
    `AC-2/E2: vars are independent — tx is NOT re-derived from an overridden heap; got ${JSON.stringify(r)}`);
});

/* ── S: structure & plumbing ── */

test('S1: the override lines sit after the formula and before the config writer, set -e safe', () => {
  const src = safeRead(ENTRYPOINT);
  for (const v of ['HEAP_MB', 'CACHE_MB', 'TX_MAX_MB']) {
    assert(new RegExp(`NEO4J_${v}="?\\$\\{BRAINSTORM_NEO4J_${v}:-\\$NEO4J_${v}\\}`).test(src),
      `AC-2: :-  override line for ${v} (colon form so empty ≡ unset)`);
  }
  const overrideAt = src.indexOf('BRAINSTORM_NEO4J_HEAP_MB');
  const txComputeAt = src.indexOf('NEO4J_TX_MAX_MB=$((NEO4J_HEAP_MB');
  const writerAt = src.indexOf('server.memory.heap.initial_size=${NEO4J_HEAP_MB}m');
  assert(txComputeAt > -1 && writerAt > -1 && txComputeAt < overrideAt && overrideAt < writerAt,
    'AC-2: override must run after the formula completes and before the config is written');
  assert(!/\[[^\]]*BRAINSTORM[^\]]*\]\s*&&/.test(src),
    'AC-3: no bare `[ … ] && …` for the note line — set -e would kill the entrypoint when the condition is false');
});

test('S2: docker-compose passes the three vars through with empty defaults', () => {
  const yml = safeRead(COMPOSE);
  for (const v of ['HEAP_MB', 'CACHE_MB', 'TX_MAX_MB']) {
    assert(yml.includes(`BRAINSTORM_NEO4J_${v}=\${BRAINSTORM_NEO4J_${v}:-}`),
      `AC-3: compose pass-through for ${v} with an explicit empty default (no droplet warnings)`);
  }
});

test('S3: the written config block itself is untouched (five exact lines)', () => {
  const src = safeRead(ENTRYPOINT);
  for (const line of [
    'server.memory.heap.initial_size=${NEO4J_HEAP_MB}m',
    'server.memory.heap.max_size=${NEO4J_HEAP_MB}m',
    'server.memory.pagecache.size=${NEO4J_CACHE_MB}m',
    'dbms.memory.transaction.total.max=${NEO4J_TX_MAX_MB}m',
    'db.transaction.concurrent.maximum=${NEO4J_CONCURRENT_MAX}',
  ]) {
    assert(src.includes(line), `AC-1: config writer line must stay byte-identical: ${line}`);
  }
});

async function run() {
  let pass = 0, fail = 0;
  for (const t of tests) {
    try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
    catch (err) { console.log(`  ✗ ${t.name}`); console.log(`      ${err.message}`); fail++; }
  }
  return { pass, fail, skipped: 0 };
}

module.exports = { run };
