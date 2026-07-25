/**
 * Second Brain — pure export core (second-brain #8, ADR 0008 d4).
 *
 * Dependency-free CommonJS on purpose (the goals.js → signals.js precedent):
 * this module is the artifact format's SINGLE owner — the brain read endpoint
 * assembles the export through it, the normalize lane validates incoming
 * artifacts with it, the drill compares with it, and the suite pins it.
 *
 * The artifact (ADR 0008 d1):
 *   { format: 'tapestry-brain-export', version: 1, takenOn: '<ISO date>',
 *     content: { goals, resources, workRecords, proposals, signals } }
 * Each family entry is { name, section } — the element's event name and its
 * RAW stored json section, VERBATIM. Membership is the family parser's call
 * (a row the parser rejects is not brain content); fidelity is raw (fields
 * the parser does not know still ride along — a protection artifact must
 * never silently drop what the owner stored). No uuids, no created-at
 * stamps, no signing identities anywhere in the artifact (§5.9 — the
 * portability seed carries content, never instance identity).
 *
 * ONE equivalence definition (ADR 0008 d2) serves both AC2 and AC4:
 * contentEquivalent(a, b) — canonically-sorted content, deep-equal,
 * key-order-insensitive; the envelope's takenOn is outside the comparison.
 */

'use strict';

const EXPORT_FORMAT = 'tapestry-brain-export';
const EXPORT_VERSION = 1;
const FAMILY_KEYS = ['goals', 'resources', 'workRecords', 'proposals', 'signals'];

/** Deterministic stringify: object keys sorted recursively (deep-equal probe). */
function sortedStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(sortedStringify).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + sortedStringify(v[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

/**
 * One family's export entries from its raw rows ({uuid, name, createdAt,
 * json}). A row belongs iff the family's parser accepts it; the entry's
 * section is the RAW stored object, extracted verbatim — never the parsed
 * projection. Rows the parser rejects are excluded (hygiene's territory,
 * not export's). Each entry is exactly {name, section}.
 */
function familyEntries(rows, sectionKey, parseRow) {
  const entries = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof parseRow !== 'function' || parseRow(row) == null) continue;
    let section = null;
    try { section = JSON.parse(row.json)[sectionKey]; } catch { section = null; }
    if (!section || typeof section !== 'object' || Array.isArray(section)) continue;
    const name = row.name != null ? row.name : (section.name != null ? section.name : null);
    entries.push({ name, section });
  }
  return entries;
}

/** Total order over entries: section slug first, full canonical form as tie-break. */
function compareEntries(a, b) {
  const sa = a && a.section && a.section.slug != null ? String(a.section.slug) : '';
  const sb = b && b.section && b.section.slug != null ? String(b.section.slug) : '';
  if (sa !== sb) return sa < sb ? -1 : 1;
  const ja = sortedStringify(a);
  const jb = sortedStringify(b);
  if (ja === jb) return 0;
  return ja < jb ? -1 : 1;
}

/**
 * The canonical form of a content object: every family present as an array,
 * each sorted into the total order above. Non-mutating — new arrays, same
 * entries. Canonicalization is what makes serialization deterministic and
 * the equivalence comparison order-insensitive (AC4).
 */
function canonicalContent(content) {
  const out = {};
  for (const key of FAMILY_KEYS) {
    const list = content && Array.isArray(content[key]) ? content[key] : [];
    out[key] = [...list].sort(compareEntries);
  }
  return out;
}

/** The versioned, dated envelope around the canonicalized families (ADR d1). */
function assembleExport(familiesByKey, takenOn) {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    takenOn,
    content: canonicalContent(familiesByKey),
  };
}

/**
 * THE equivalence definition (ADR 0008 d2): two artifacts are equivalent iff
 * their canonically-sorted content is deep-equal (key-order-insensitive).
 * takenOn identifies the export moment and is outside the comparison.
 */
function contentEquivalent(a, b) {
  const ca = canonicalContent(a && a.content);
  const cb = canonicalContent(b && b.content);
  return sortedStringify(ca) === sortedStringify(cb);
}

/**
 * Shape-validate an incoming artifact before any write path consumes it.
 * Answers {ok: true} or {ok: false, error: '<plain words>'} — each violation
 * named in the owner's terms, never a stack trace.
 */
function validateArtifact(artifact) {
  const bad = (error) => ({ ok: false, error });
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    return bad('this is not a brain export file — nothing readable inside.');
  }
  if (artifact.format !== EXPORT_FORMAT) {
    return bad('this is not a brain export file — its format label is wrong.');
  }
  if (artifact.version !== EXPORT_VERSION) {
    return bad('this brain export file uses a version this instance does not understand.');
  }
  const content = artifact.content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return bad('this brain export file carries no content.');
  }
  for (const key of FAMILY_KEYS) {
    if (!Array.isArray(content[key])) {
      return bad(`this brain export file is missing its '${key}' list.`);
    }
    for (const entry of content[key]) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return bad(`an entry under '${key}' is not readable.`);
      }
      if (typeof entry.name !== 'string' || entry.name.trim() === '') {
        return bad(`an entry under '${key}' has no name.`);
      }
      const s = entry.section;
      if (!s || typeof s !== 'object' || Array.isArray(s)) {
        return bad(`the entry '${entry.name}' under '${key}' has no content section.`);
      }
      if (typeof s.slug !== 'string' || s.slug.trim() === '') {
        return bad(`the entry '${entry.name}' under '${key}' has no slug.`);
      }
    }
  }
  return { ok: true };
}

module.exports = {
  EXPORT_FORMAT,
  FAMILY_KEYS,
  familyEntries,
  canonicalContent,
  assembleExport,
  contentEquivalent,
  validateArtifact,
};
