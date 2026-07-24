/**
 * Second Brain — pure priority-signals core (second-brain #7, ADR 0007 d10).
 *
 * Dependency-free CommonJS on purpose (the goals.js / resources.js /
 * work-records.js / proposals.js precedent): the brain read endpoint maps
 * Neo4j rows through it to project the owner's pairwise choices onto the
 * record spines of the goals they touch. It depends on nothing and pulls in
 * no modules.
 *
 * A "row" is what the signals Cypher returns per stored fact:
 *   { uuid, name, createdAt, json }  — json is the fact's json-tag string.
 * A "record" is the parsed Priority Signal:
 *   { uuid, name, slug, description, prefers, over, reason, judgedBy,
 *     judgedOn, framing, createdAt }
 * "prefers"/"over" are goal slugs (ADR 0007 d3: record-based linkage,
 * dereferenced at read by grouping — never an edge). A signal is BORN FINAL
 * (PRD §7.2): written once, only ever read — no lifecycle, no decision, no
 * supersession; a changed mind is a NEW signal. The framing tag is carried BY
 * each signal and read back FROM it (AC5) — no read path substitutes a
 * live/global value, so a later framing replacement cannot re-label history.
 *
 * The load-bearing shape (ADR 0007 d3): ONE stored fact touches TWO goals, so
 * groupSignalsByGoal fans each record out under BOTH its prefers and over
 * keys, and signalEntry words each side from that goal's perspective (the
 * ratified d5 templates). One fact, two derived views — the sides can never
 * diverge.
 */

'use strict';

/**
 * Parse one class-thread row into a signal record, or return null when the
 * row is not a parseable Priority Signal (missing/malformed json, or no
 * prioritySignal section). Never throws on bad data — non-signal rows are
 * classified out at read time (event-tagging ADR 0009 discipline).
 */
function parseSignalRow(row) {
  if (!row || !row.uuid || typeof row.json !== 'string' || row.json === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(row.json);
  } catch {
    return null;
  }
  const section = parsed && parsed.prioritySignal;
  if (!section || typeof section !== 'object' || Array.isArray(section)) return null;
  return {
    uuid: row.uuid,
    name: row.name != null ? row.name : (section.name != null ? section.name : null),
    slug: section.slug != null ? section.slug : null,
    description: section.description != null ? section.description : null,
    prefers: section.prefers != null ? section.prefers : null,
    over: section.over != null ? section.over : null,
    reason: section.reason != null ? section.reason : null,
    judgedBy: section.judgedBy != null ? section.judgedBy : null,
    judgedOn: section.judgedOn != null ? section.judgedOn : null,
    framing: section.framing != null ? section.framing : null,
    createdAt: typeof row.createdAt === 'number' ? row.createdAt : null,
  };
}

/**
 * Bucket signal records by the goal slugs they touch (ADR 0007 d3) — the
 * two-goal fan-out. The SAME record appears under BOTH its prefers key and
 * its over key (one fact, two views; AC3's both-spines guarantee). A record
 * missing either slug, or preferring a goal over itself, is dropped as
 * malformed — never rendered. Returns a Map<goalSlug, record[]>; a goal with
 * no signals is simply absent.
 */
function groupSignalsByGoal(records) {
  const byGoal = new Map();
  for (const r of records) {
    if (!r || typeof r.prefers !== 'string' || r.prefers === '') continue;
    if (typeof r.over !== 'string' || r.over === '' || r.prefers === r.over) continue;
    for (const slug of [r.prefers, r.over]) {
      if (!byGoal.has(slug)) byGoal.set(slug, []);
      byGoal.get(slug).push(r);
    }
  }
  return byGoal;
}

/**
 * Project one signal record to the goal-detail record-entry shape for ONE
 * side of the pair (ADR 0007 d5, the ratified wording — verbatim):
 *   prefers side:  { date, type: 'preferred',   summary: 'chose this over "{other}"' }
 *   over side:     { date, type: 'passed over', summary: '"{other}" chosen over this' }
 * with the optional reason folded on after an em-dash, and date = judgedOn.
 * otherGoalName is the OTHER goal's current display name (handler-resolved);
 * when that goal is gone the wording falls back to its slug (read-tolerant).
 */
function signalEntry(record, side, otherGoalName) {
  if (!record) return { date: null, type: null, summary: null };
  const onPreferredSide = side === 'prefers';
  const other = otherGoalName || (onPreferredSide ? record.over : record.prefers) || '';
  const base = onPreferredSide
    ? `chose this over "${other}"`
    : `"${other}" chosen over this`;
  return {
    date: record.judgedOn != null ? record.judgedOn : null,
    type: onPreferredSide ? 'preferred' : 'passed over',
    summary: record.reason ? `${base} — ${record.reason}` : base,
  };
}

module.exports = {
  parseSignalRow,
  groupSignalsByGoal,
  signalEntry,
};
