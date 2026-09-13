#!/usr/bin/env node
'use strict';
/**
 * `npm run gate:status` — read a gate run's result back (honest-test-gate #1,
 * ADR honest-test-gate/0001 §5). The run record (test/helpers/gateRecord.js) is the
 * gate's answer: engineering-team/README.md — "Running and reading the test gate".
 *
 *   npm run gate:status                      the newest run
 *   npm run gate:status -- --list            the newest 10 runs
 *   npm run gate:status -- --run <runId>     one run
 *   npm run gate:status -- --label <text>    the newest run with that GATE_LABEL
 *   npm run gate:status -- --json            the selected run's raw record
 *
 * Exit status: the selected run's recorded exit code (0 PASS, 1 FAIL, 128+n INTERRUPTED);
 * 3 when the run never finished and its process is gone (killed); 4 while it is still
 * running; 2 when there is no matching record. GATE_RECORD_DIR selects the directory.
 */

const path = require('path');
const R = require('./helpers/gateRecord');

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('usage: npm run gate:status [-- --list | --run <runId> | --label <text>] [--json]');
  process.exit(0);
}
function opt(flag) {
  const i = args.indexOf(flag);
  return i === -1 ? null : (args[i + 1] || '');
}

function ago(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return 'at an unknown time';
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

function describe({ path: file, rec: r }) {
  const p = r.progress || {};
  const t = r.totals || {};
  const commit = r.git && r.git.commit ? `${r.git.commit.slice(0, 8)}${r.git.dirty ? '+dirty' : ''}` : 'an unknown commit';
  const head = `${r.runId}${r.label ? ` [${r.label}]` : ''} started ${r.startedAt} on ${commit}`;
  const progress = `${p.completed}/${p.total} suites`;
  if (r.state === 'running') {
    if (R.isAlive(r.pid)) {
      return { code: 4, line: `${head} — RUNNING — ${progress}, current ${p.current || '—'}, last progress ${ago(r.updatedAt)} · ${file}` };
    }
    return { code: 3, line: `${head} — UNFINISHED — process ${r.pid} is gone (killed?) after ${progress}, last progress ${ago(r.updatedAt)} · ${file}` };
  }
  const failed = (r.suites || []).filter((s) => s.verdict === 'FAIL').map((s) => path.basename(String(s.file)).replace(/\.test\.js$/, ''));
  if ((r.strayErrors || []).length) failed.push('stray async errors');
  const how = r.state === 'interrupted' ? ` by ${r.signal}` : '';
  const numbers = r.totals ? `${t.passed} passed, ${t.failed} failed, ${t.skipped} skipped` : 'no totals (interrupted)';
  const code = Number.isInteger(r.exitCode) ? r.exitCode : 1;
  return {
    code,
    line: `${head} — ${r.verdict}${how}, exit ${r.exitCode}, ${numbers}, ${progress}${failed.length ? `; failed: ${failed.join(', ')}` : ''} · ${file}`,
  };
}

const dir = R.recordDir();
let records = R.listRecords(dir);
if (opt('--label') !== null) records = records.filter((x) => x.rec.label === opt('--label'));
if (opt('--run') !== null) records = records.filter((x) => x.rec.runId === opt('--run'));
if (!records.length) {
  console.log(`no gate run records${opt('--label') !== null || opt('--run') !== null ? ' matching that selection' : ''} in ${dir}`);
  process.exit(2);
}

if (args.includes('--list')) {
  for (const x of records.slice(0, 10)) console.log(describe(x).line);
  process.exit(describe(records[0]).code);
}
const selected = describe(records[0]);
console.log(args.includes('--json') ? JSON.stringify(records[0].rec, null, 2) : selected.line);
process.exit(selected.code);
