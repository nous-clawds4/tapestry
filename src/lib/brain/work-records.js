/**
 * Second Brain — pure work-records core (second-brain #5, ADR 0005 d9).
 *
 * Dependency-free CommonJS on purpose (the goals.js / resources.js precedent):
 * the brain read endpoint maps Neo4j rows through it to project a goal's
 * append-only record entries. It requires nothing and pulls in no modules.
 *
 * A "row" is what the work-records Cypher returns per element:
 *   { uuid, name, createdAt, json }  — json is the element's json-tag string.
 * A "record" is the parsed Work Record:
 *   { uuid, name, slug, type, goal, session, summary, questions, produced,
 *     happenedOn, createdAt }
 * "goal" is the slug of the goal this record is about (ADR 0005 d4:
 * record-based linkage, dereferenced at read by grouping — never an edge).
 * "produced" is a list of resource locators the record produced (resolved to
 * pointer cards at read against the goal's attached resources). Work records
 * are APPEND-ONLY (PRD §7.2): written once, only ever read — never re-signed.
 */

'use strict';

// The record type words this concept produces (ADR 0005 d2). The design guide's
// other type words (proposed/approved/skipped) come from other concepts
// (stories 6/7), merged into the same record list at read.
const WORK_RECORD_TYPES = ['worked', 'noted'];

/**
 * Parse one class-thread row into a work record, or return null when the row is
 * not a parseable Work Record (missing/malformed json, or no workRecord
 * section). Never throws on bad data — non-record rows are classified out at
 * read time (event-tagging ADR 0009 discipline).
 */
function parseWorkRecordRow(row) {
  if (!row || !row.uuid || typeof row.json !== 'string' || row.json === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(row.json);
  } catch {
    return null;
  }
  const section = parsed && parsed.workRecord;
  if (!section || typeof section !== 'object' || Array.isArray(section)) return null;
  return {
    uuid: row.uuid,
    name: row.name != null ? row.name : (section.name != null ? section.name : null),
    slug: section.slug != null ? section.slug : null,
    type: section.type != null ? section.type : null,
    goal: section.goal != null ? section.goal : null,
    session: section.session != null ? section.session : null,
    summary: section.summary != null ? section.summary : null,
    questions: Array.isArray(section.questions) ? section.questions : [],
    produced: Array.isArray(section.produced) ? section.produced : [],
    happenedOn: section.happenedOn != null ? section.happenedOn : null,
    createdAt: typeof row.createdAt === 'number' ? row.createdAt : null,
  };
}

/**
 * Bucket work records by the goal slug they are about (ADR 0005 d10). The
 * per-goal detail read groups a goal's records this way. Returns a
 * Map<goalSlug, record[]> — a goal with no records is simply absent from the
 * map (its record section renders empty).
 */
function groupWorkRecordsByGoal(records) {
  const byGoal = new Map();
  for (const r of records) {
    if (!r || typeof r.goal !== 'string' || r.goal === '') continue;
    if (!byGoal.has(r.goal)) byGoal.set(r.goal, []);
    byGoal.get(r.goal).push(r);
  }
  return byGoal;
}

/**
 * Order records newest-happenedOn first (createdAt tie-break) — the morning
 * review reads downward (ADR 0005 d10). Pure: returns a new sorted array,
 * tolerant of missing dates (they sort last).
 */
function sortRecordsByRecency(records) {
  return records.slice().sort((a, b) => {
    const da = (a && a.happenedOn) || '';
    const db = (b && b.happenedOn) || '';
    if (da !== db) return da < db ? 1 : -1;                 // newest happenedOn first
    return ((b && b.createdAt) || 0) - ((a && a.createdAt) || 0);
  });
}

module.exports = {
  WORK_RECORD_TYPES,
  parseWorkRecordRow,
  groupWorkRecordsByGoal,
  sortRecordsByRecency,
};
