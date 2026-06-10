#!/usr/bin/env node
/**
 * kind3EventsToFollowsTSV.js — Story #23 / ADR 0020 (Phase 3, reconcileAll).
 *
 * Streams allKind3EventsStripped.json (JSONL) and emits one TSV line per
 * (rater, ratee) p-tag pair, lowercased, filtered to valid 64-hex pubkeys —
 * the same output as the previous `jq | awk` pipeline, but ~10× faster.
 *
 * On staging's prod-scale graph (~2.2M kind-3 events × ~32M p-tags total) the
 * jq step was the single dominant cost of reconcileAll — 74 min of an 86-min
 * run, 86% of the runtime. V8's JSON parser + a tight per-tag loop +
 * Node-stream backpressure drops that into single-digit minutes, taking
 * reconcileAll comfortably under the <1h ADR target.
 *
 * Usage: kind3EventsToFollowsTSV.js <input.jsonl> <output.tsv> [logFile]
 */

const fs = require('fs');
const readline = require('readline');

const inputPath = process.argv[2];
const outputPath = process.argv[3];
const logFile = process.argv[4] || '/var/log/brainstorm/reconciliation.log';

if (!inputPath || !outputPath) {
  console.error('Usage: kind3EventsToFollowsTSV.js <input.jsonl> <output.tsv> [logFile]');
  process.exit(1);
}

const HEX64 = /^[0-9a-f]{64}$/;

function log(msg) {
  const line = `${Date.now()}: kind3EventsToFollowsTSV - ${msg}\n`;
  console.log(msg);
  try { fs.appendFileSync(logFile, line); } catch (_) { /* ignore */ }
}

async function main() {
  const start = Date.now();
  log(`Starting: ${inputPath} → ${outputPath}`);

  const reader = readline.createInterface({
    input: fs.createReadStream(inputPath),
    crlfDelay: Infinity,
  });
  const writer = fs.createWriteStream(outputPath, { encoding: 'utf8' });

  let events = 0, lines = 0, skipped = 0;
  // Batch small writes — fewer syscalls = faster at 32M lines.
  const BATCH_BYTES = 65536;
  let buf = '';

  function flushBuf() {
    if (buf.length === 0) return true;
    const ok = writer.write(buf);
    buf = '';
    return ok;
  }

  writer.on('drain', () => reader.resume());

  reader.on('line', (line) => {
    if (!line) return;
    events++;
    if (events % 100000 === 0) {
      log(`processed ${events} events, emitted ${lines} TSV lines`);
    }

    let ev;
    try { ev = JSON.parse(line); } catch (_) { skipped++; return; }

    const raterRaw = ev.pubkey;
    if (typeof raterRaw !== 'string') { skipped++; return; }
    const rater = raterRaw.toLowerCase();
    if (!HEX64.test(rater)) { skipped++; return; }

    const tags = ev.tags;
    if (!Array.isArray(tags)) return;

    for (let i = 0; i < tags.length; i++) {
      const t = tags[i];
      if (!Array.isArray(t) || t[0] !== 'p' || typeof t[1] !== 'string') continue;
      const ratee = t[1].toLowerCase();
      if (!HEX64.test(ratee)) continue;
      buf += rater + '\t' + ratee + '\n';
      lines++;
    }

    if (buf.length >= BATCH_BYTES) {
      if (!flushBuf()) reader.pause();
    }
  });

  await new Promise((resolve, reject) => {
    reader.on('close', resolve);
    reader.on('error', reject);
  });

  flushBuf();
  await new Promise((resolve, reject) => writer.end((err) => (err ? reject(err) : resolve())));

  const dur = ((Date.now() - start) / 1000).toFixed(1);
  log(`Completed: ${events} events → ${lines} TSV lines (skipped ${skipped}) in ${dur}s`);
}

main().catch((e) => {
  log(`ERROR: ${e && e.message ? e.message : e}`);
  process.exit(1);
});
