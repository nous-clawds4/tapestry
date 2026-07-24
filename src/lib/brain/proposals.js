/**
 * Second Brain — pure proposals core (second-brain #6, ADR 0006 d10).
 *
 * Dependency-free CommonJS on purpose (the goals.js / resources.js / work-records.js
 * precedent): the brain read endpoint maps Neo4j rows through it to project a goal's
 * append-only proposal facts into its record spine, and to derive which proposals
 * are still open for the queue. It requires nothing and pulls in no modules.
 *
 * A "row" is what the proposals Cypher returns per element:
 *   { uuid, name, createdAt, json }  — json is the element's json-tag string.
 * A "record" is the parsed Proposal fact:
 *   { uuid, name, slug, summary, type, goal, whyNow, passedOver, proposalId,
 *     reason, happenedOn, createdAt }
 * "type" is one of proposed | approved | skipped (ADR 0006 d2). "goal" is the slug
 * of the nominated goal this fact is about (ADR 0006 d4: record-based linkage,
 * dereferenced at read by grouping — never an edge). A `proposed` fact carries
 * whyNow + passedOver (the runners-up); a decision (`approved`/`skipped`) carries
 * proposalId (→ the proposed fact's slug) and, for a skip, the reason. Proposals
 * AND decisions are APPEND-ONLY (PRD §7.2): written once, only ever read — a
 * proposal is never mutated to record its decision; the decision is a separate
 * fact, and "is it open?" is derived from the ABSENCE of a decision (the
 * load-bearing (a)/(b) decision: shape (b)).
 */

'use strict';

// The record type words this concept produces (ADR 0006 d2). `proposed` is a
// nomination; `approved`/`skipped` are decisions referencing it by proposalId.
const PROPOSAL_TYPES = ['proposed', 'approved', 'skipped'];

/**
 * Parse one class-thread row into a proposal fact, or return null when the row is
 * not a parseable Proposal (missing/malformed json, or no proposal section). Never
 * throws on bad data — non-proposal rows are classified out at read time
 * (event-tagging ADR 0009 discipline).
 */
function parseProposalRow(row) {
  if (!row || !row.uuid || typeof row.json !== 'string' || row.json === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(row.json);
  } catch {
    return null;
  }
  const section = parsed && parsed.proposal;
  if (!section || typeof section !== 'object' || Array.isArray(section)) return null;
  // passedOver: a list of { goal, whyNot } — tolerate malformed entries (drop
  // non-objects; a runner-up with no goal or no why-not is kept but harmless).
  const passedOver = Array.isArray(section.passedOver)
    ? section.passedOver
        .filter((x) => x && typeof x === 'object' && !Array.isArray(x))
        .map((x) => ({ goal: x.goal != null ? x.goal : null, whyNot: x.whyNot != null ? x.whyNot : null }))
    : [];
  return {
    uuid: row.uuid,
    name: row.name != null ? row.name : (section.name != null ? section.name : null),
    slug: section.slug != null ? section.slug : null,
    summary: section.summary != null ? section.summary : null,
    type: section.type != null ? section.type : null,
    goal: section.goal != null ? section.goal : null,
    whyNow: section.whyNow != null ? section.whyNow : null,
    passedOver,
    proposalId: section.proposalId != null ? section.proposalId : null,
    reason: section.reason != null ? section.reason : null,
    happenedOn: section.happenedOn != null ? section.happenedOn : null,
    createdAt: typeof row.createdAt === 'number' ? row.createdAt : null,
  };
}

/**
 * Bucket proposal facts by the goal slug they are about (ADR 0006 d10). The
 * per-goal detail read groups a goal's proposal facts this way. Returns a
 * Map<goalSlug, record[]> — a goal with no proposal facts is simply absent.
 */
function groupProposalsByGoal(records) {
  const byGoal = new Map();
  for (const r of records) {
    if (!r || typeof r.goal !== 'string' || r.goal === '') continue;
    if (!byGoal.has(r.goal)) byGoal.set(r.goal, []);
    byGoal.get(r.goal).push(r);
  }
  return byGoal;
}

/**
 * Order proposal facts newest-happenedOn first (createdAt tie-break) — the spine
 * and the queue read downward (ADR 0006 d10/d11). Pure: a new sorted array,
 * tolerant of missing dates (they sort last).
 */
function sortProposalsByRecency(records) {
  return records.slice().sort((a, b) => {
    const da = (a && a.happenedOn) || '';
    const db = (b && b.happenedOn) || '';
    if (da !== db) return da < db ? 1 : -1;                 // newest happenedOn first
    return ((b && b.createdAt) || 0) - ((a && a.createdAt) || 0);
  });
}

/**
 * The OPEN proposals (ADR 0006 d10/d11): a `proposed` fact is open iff no decision
 * (`approved`/`skipped`) references its slug via proposalId. "Is it open?" is
 * DERIVED at read from the ABSENCE of a decision — never a stored flag (the
 * load-bearing (a)/(b) decision: shape (b), append separate facts). Returns the
 * open `proposed` facts, newest-happenedOn first.
 */
function openProposals(records) {
  const decidedIds = new Set();
  for (const r of records) {
    if (r && (r.type === 'approved' || r.type === 'skipped') && typeof r.proposalId === 'string' && r.proposalId !== '') {
      decidedIds.add(r.proposalId);
    }
  }
  const open = records.filter((r) => r && r.type === 'proposed' && !decidedIds.has(r.slug));
  return sortProposalsByRecency(open);
}

/**
 * Project one proposal fact to the goal-detail record-entry shape (ADR 0006 d10):
 * { date, type, summary } — uniform across proposed/approved/skipped (summary is
 * the fact's own one-line summary: the why-now on a nomination/approval, the
 * reason on a skip). The handler adds session:null / questions:[] / produced:[]
 * so a proposal entry renders in the same RecordEntry as a work record.
 */
function proposalEntry(record) {
  return {
    date: record ? record.happenedOn : null,
    type: record ? record.type : null,
    summary: record ? record.summary : null,
  };
}

module.exports = {
  PROPOSAL_TYPES,
  parseProposalRow,
  groupProposalsByGoal,
  sortProposalsByRecency,
  openProposals,
  proposalEntry,
};
