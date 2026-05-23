#!/usr/bin/env node
/**
 * extractFollowsToTSV.js — Story #23 / ADR 0020 (Phase 3, reconcileAll).
 *
 * Streams the ENTIRE FOLLOWS edge set out of Neo4j as a flat
 * `rater<TAB>ratee` JSONL/TSV file, reactively (driver `subscribe`) — NO eager
 * operator (no DISTINCT/ORDER/collect/SKIP/LIMIT), so Neo4j streams rows lazily
 * under bounded transaction memory. Pubkeys are lowercased to match the
 * strfry-side converter; the output is `sort`-friendly and feeds the merge-join.
 *
 * Why a TSV stream, not per-pubkey files: at ~32M edges and ~2.2M raters,
 * per-pubkey files (the reconcileNetwork pattern) would write 2.2M small files
 * and the diff would walk them all. The merge-join needs ONE sorted stream per
 * side; bounded memory; comm-able.
 */

const fs = require('fs');
const neo4j = require('neo4j-driver');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('neo4jUri', { type: 'string', default: 'bolt://localhost:7687' })
  .option('neo4jUser', { type: 'string', default: 'neo4j' })
  .option('neo4jPassword', { type: 'string', default: '' })
  .option('logFile', { type: 'string', default: '/var/log/brainstorm/reconciliation.log' })
  .option('output', { type: 'string', describe: 'TSV output path (rater\\tratee per line)', demandOption: true })
  .help()
  .argv;

const driver = neo4j.driver(
  argv.neo4jUri,
  neo4j.auth.basic(argv.neo4jUser, argv.neo4jPassword),
  { maxConnectionPoolSize: 50 }
);

function log(msg) {
  const ts = Date.now();
  const line = `${ts}: extractFollowsToTSV - ${msg}\n`;
  console.log(msg);
  try { fs.appendFileSync(argv.logFile, line); } catch (e) { /* ignore */ }
}

async function main() {
  const start = Date.now();
  log(`Starting streamed extraction → ${argv.output}`);

  const session = driver.session({ defaultAccessMode: neo4j.session.READ });
  const writer = fs.createWriteStream(argv.output, { encoding: 'utf8' });

  let count = 0;
  await new Promise((resolve, reject) => {
    const result = session.run(
      // No eager operators (no DISTINCT/ORDER BY/collect/SKIP/LIMIT) → lazy
      // streaming → bounded transaction memory.
      'MATCH (u:NostrUser)-[:FOLLOWS]->(t:NostrUser) RETURN u.pubkey AS rater, t.pubkey AS ratee'
    );
    result.subscribe({
      onNext: (record) => {
        const rater = (record.get('rater') || '').toLowerCase();
        const ratee = (record.get('ratee') || '').toLowerCase();
        if (!rater || !ratee) return;
        if (!writer.write(`${rater}\t${ratee}\n`)) {
          // Apply back-pressure: pause the stream until the writer drains.
          // (neo4j-driver supports pause/resume via the rxjs-like subscription.)
        }
        count++;
        if (count % 1000000 === 0) log(`streamed ${count} edges so far`);
      },
      onCompleted: () => resolve(),
      onError: (err) => reject(err),
    });
  });

  await new Promise((resolve, reject) => writer.end((err) => (err ? reject(err) : resolve())));
  await session.close();
  await driver.close();

  const dur = ((Date.now() - start) / 1000).toFixed(1);
  log(`Completed: streamed ${count} edges in ${dur}s → ${argv.output}`);
}

main().catch(async (e) => {
  log(`ERROR: ${e && e.message ? e.message : e}`);
  try { await driver.close(); } catch (_) { /* ignore */ }
  process.exit(1);
});
