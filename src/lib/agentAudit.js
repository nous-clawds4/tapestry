const fs = require('fs');
const path = require('path');
const { dbPath } = require('../db/bounties');

// Append-only audit sink for agent decisions (dry-run would-be payments, LLM
// judgments). Deliberately a flat JSONL file, NOT the auto_payments table — a
// dry-run/judgment record must never reserve a payment slot or suppress a real
// one. Co-located with the bounties DB so it lands wherever that's writable.
const AUDIT_PATH = process.env.AGENT_AUDIT_PATH || path.join(path.dirname(dbPath), 'agent-audit.jsonl');

function appendAudit(record) {
  const entry = { at: Math.floor(Date.now() / 1000), ...record };
  fs.appendFileSync(AUDIT_PATH, `${JSON.stringify(entry)}\n`);
  return entry;
}

function readAudit(match = {}) {
  let lines;
  try { lines = fs.readFileSync(AUDIT_PATH, 'utf8').split('\n').filter(Boolean); } catch { return []; }
  return lines
    .map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean)
    .filter(rec => Object.entries(match).every(([k, v]) => rec[k] === v));
}

// The newest judgment record for a claim (or null) — the basis for the
// no-pay-without-an-accept-judgment gate in paymentService.
function latestJudgment(bountyId, claimEventId) {
  const rows = readAudit({ kind: 'judgment', bountyId, claimEventId });
  return rows.length ? rows[rows.length - 1] : null;
}

module.exports = { appendAudit, readAudit, latestJudgment, AUDIT_PATH };
