/**
 * Second Brain — pure resources core (second-brain #4, ADR 0004 d4).
 *
 * Dependency-free CommonJS on purpose (the goals.js precedent): the brain read
 * endpoint maps Neo4j rows through it, and the freshness derivation is the one
 * place that turns a last-verified date into a standing word. It requires
 * nothing and pulls in no modules.
 *
 * A "row" is what the resources Cypher returns per element:
 *   { uuid, name, createdAt, json }  — json is the element's json-tag string.
 * A "record" is the parsed External Resource:
 *   { uuid, title, slug, description, locatorKind, locator, goal, whyKept,
 *     keywords, notedOn, lastVerified, lastVerifyStatus, createdAt }
 * The element name IS the resource title. "goal" is the pointing goal's json
 * slug (ADR 0004 d2: record-based linkage, dereferenced at read by grouping —
 * never a materialized edge). Freshness is DERIVED at read time from
 * lastVerified + lastVerifyStatus, never stored (PRD §6; event-tagging 0009).
 */

'use strict';

// The single tunable staleness threshold (ADR 0004 d13). A resource verified
// more than this many days ago is 'stale'; not per-kind in v1.
const STALE_AFTER_DAYS = 30;

/**
 * Parse one class-thread row into a resource record, or return null when the
 * row is not a parseable External Resource (missing/malformed json, or no
 * externalResource section). Never throws on bad data — non-resource rows are
 * classified out at read time (event-tagging ADR 0009 discipline).
 */
function parseResourceRow(row) {
  if (!row || !row.uuid || typeof row.json !== 'string' || row.json === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(row.json);
  } catch {
    return null;
  }
  const section = parsed && parsed.externalResource;
  if (!section || typeof section !== 'object' || Array.isArray(section)) return null;
  return {
    uuid: row.uuid,
    title: row.name != null ? row.name : (section.name != null ? section.name : null),
    slug: section.slug != null ? section.slug : null,
    description: section.description != null ? section.description : null,
    locatorKind: section.locatorKind != null ? section.locatorKind : null,
    locator: section.locator != null ? section.locator : null,
    goal: section.goal != null ? section.goal : null,
    whyKept: section.whyKept != null ? section.whyKept : null,
    keywords: Array.isArray(section.keywords) ? section.keywords : null,
    notedOn: section.notedOn != null ? section.notedOn : null,
    lastVerified: section.lastVerified != null ? section.lastVerified : null,
    lastVerifyStatus: section.lastVerifyStatus != null ? section.lastVerifyStatus : null,
    createdAt: typeof row.createdAt === 'number' ? row.createdAt : null,
  };
}

/**
 * Whole days between a record's lastVerified date and `nowMs`, or null when
 * there is no readable date. The API returns this so the UI's "verified N days
 * ago" / "not verified in N days" line never drifts from the derived standing.
 */
function freshnessDays(record, nowMs) {
  if (!record || typeof record.lastVerified !== 'string' || record.lastVerified === '') return null;
  const verifiedMs = Date.parse(record.lastVerified);
  if (Number.isNaN(verifiedMs)) return null;
  return Math.floor((nowMs - verifiedMs) / 86400000);
}

/**
 * Freshness is derived, never stored (PRD §6; parallel to deriveStanding):
 *   - an asserted 'unreachable' last-verify outcome wins over any recency;
 *   - else a resource not verified within STALE_AFTER_DAYS is 'stale'
 *     (a missing/unreadable last-verified date is also 'stale' — freshness
 *     cannot be confirmed);
 *   - else 'current'.
 * `nowMs` is a parameter so the derivation is pure and deterministic under test.
 */
function deriveFreshness(record, nowMs) {
  if (record && record.lastVerifyStatus === 'unreachable') return 'unreachable';
  const days = freshnessDays(record, nowMs);
  if (days == null) return 'stale';
  return days > STALE_AFTER_DAYS ? 'stale' : 'current';
}

/**
 * Bucket resource records by the goal slug they point at (ADR 0004 d2/d5). The
 * read groups a goal's pointers this way; the list read counts them for the
 * tree row. Returns a Map<goalSlug, record[]> — a goal with no resources is
 * simply absent from the map (the tree renders no pointer count for it).
 */
function groupResourcesByGoal(records) {
  const byGoal = new Map();
  for (const r of records) {
    if (!r || typeof r.goal !== 'string' || r.goal === '') continue;
    if (!byGoal.has(r.goal)) byGoal.set(r.goal, []);
    byGoal.get(r.goal).push(r);
  }
  return byGoal;
}

module.exports = {
  STALE_AFTER_DAYS,
  parseResourceRow,
  freshnessDays,
  deriveFreshness,
  groupResourcesByGoal,
};
