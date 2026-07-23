/**
 * Second Brain — pure goals core (second-brain #1, ADR 0001 decision 4).
 *
 * Dependency-free CommonJS on purpose: this module is the shared classification
 * surface — the brain read endpoint maps Neo4j rows through it, and story 2's
 * hygiene checker reuses it. It requires nothing and pulls in no modules.
 *
 * A "row" is what the goals Cypher returns per element:
 *   { uuid, name, createdAt, json }  — json is the element's json-tag string.
 * A "record" is the parsed goal:
 *   { uuid, name, statement, origin, capturedOn, createdAt }
 * The PRD's "statement" IS the concept's existing description field (ADR
 * decision 2) — adopted, not duplicated.
 */

'use strict';

/**
 * Parse one class-thread row into a goal record, or return null when the row
 * is not a parseable goal record (missing/malformed json, or no
 * tapestryOwnerGoal section). Never throws on bad data — non-goal rows are
 * classified out at read time (event-tagging ADR 0009 discipline).
 */
function parseGoalRow(row) {
  if (!row || !row.uuid || typeof row.json !== 'string' || row.json === '') return null;
  let parsed;
  try {
    parsed = JSON.parse(row.json);
  } catch {
    return null;
  }
  const section = parsed && parsed.tapestryOwnerGoal;
  if (!section || typeof section !== 'object' || Array.isArray(section)) return null;
  return {
    uuid: row.uuid,
    name: row.name != null ? row.name : (section.name != null ? section.name : null),
    statement: section.description != null ? section.description : null,
    origin: section.origin != null ? section.origin : null,
    capturedOn: section.capturedOn != null ? section.capturedOn : null,
    createdAt: typeof row.createdAt === 'number' ? row.createdAt : null,
  };
}

/**
 * Standing is derived from dated facts, never stored (PRD §6). Every goal this
 * story can represent derives to 'captured' — the canonical lowercase word.
 * Later stories extend the derivation (viability, achievement, abandonment)
 * here, in one place.
 */
function deriveStanding(_record) {
  return 'captured';
}

/**
 * The capture date: capturedOn (the stable json field) wins; legacy records
 * fall back to the event created_at (unix seconds → ISO date). A record with
 * neither resolves to null — the view renders nothing, never "Invalid Date".
 */
function resolveCaptureDate(record) {
  if (record && record.capturedOn) return record.capturedOn;
  if (record && typeof record.createdAt === 'number' && record.createdAt > 0) {
    const d = new Date(record.createdAt * 1000);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

/** Newest capture first (ADR decision 4 interpretation). Stable, non-mutating. */
function sortGoals(records) {
  return [...records].sort((a, b) => {
    const da = resolveCaptureDate(a) || '';
    const db = resolveCaptureDate(b) || '';
    if (da === db) return 0;
    return da < db ? 1 : -1;
  });
}

module.exports = { parseGoalRow, deriveStanding, resolveCaptureDate, sortGoals };
